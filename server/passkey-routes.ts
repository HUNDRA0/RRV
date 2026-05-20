// WebAuthn / Passkeys endpoints.
//
// Flow A — register (must be logged in already):
//   POST /api/auth/passkey/register/start   → { options, nonce }
//                  options are passed to navigator.credentials.create()
//                  nonce binds the response to this request (we don't trust
//                  the client to echo back the challenge unaltered)
//   POST /api/auth/passkey/register/finish  → { ok, credential }
//
// Flow B — login (no prior session needed):
//   POST /api/auth/passkey/login/start      → { options, nonce }
//                  empty allowCredentials → "discoverable" passkey selection;
//                  browser shows the system picker with all eligible passkeys.
//   POST /api/auth/passkey/login/finish     → { token, user }
//
// Challenges are stored in memory and expire after 5 minutes. Cold starts
// invalidate pending challenges — acceptable since user just retries.

import type { Router } from 'express';
import { randomBytes } from 'node:crypto';
import {
  generateRegistrationOptions, verifyRegistrationResponse,
  generateAuthenticationOptions, verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/server';
import { exec, queryAll, queryOne } from './db.js';
import {
  USER_SESSION_TTL_MS,
  hashPassword,
  newSessionToken,
  newUserId,
  requireUser,
  type UserRow,
} from './auth.js';

// Relying Party config — domain the browser binds credentials to.
// Local dev: localhost. Prod: viberrankings.se. Set via env var.
function rpId(): string {
  return process.env.RP_ID || 'localhost';
}
function rpName(): string {
  return process.env.RP_NAME || 'Viber Rankings';
}
function expectedOrigin(): string | string[] {
  // Browsers send `https://<host>` (or http://localhost:<port>) as origin.
  // Accept the standard dev origin alongside any explicit RP_ORIGIN.
  const env = process.env.RP_ORIGIN;
  if (env) return env.split(',').map(s => s.trim()).filter(Boolean);
  const id = rpId();
  if (id === 'localhost') return ['http://localhost:5173', 'http://localhost:3001'];
  return `https://${id}`;
}

// In-memory challenge store. Each nonce maps to challenge bytes + expiry.
// Keyed by a nonce (NOT the IP) so multiple users behind a NAT don't clash.
interface ChallengeEntry {
  challenge: string;
  // When registering an existing user → bound to that user.
  userId?: string;
  // When signing up a brand-new account → carries the proposed username and a
  // pre-generated user id. We materialize the user row only on signup/finish
  // to avoid orphan rows from abandoned biometric prompts.
  pendingSignup?: { username: string; userId: string };
  expiresAt: number;
}
const challenges = new Map<string, ChallengeEntry>();
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

function newNonce(): string {
  return randomBytes(16).toString('hex');
}
function stashChallenge(challenge: string, extras?: { userId?: string; pendingSignup?: { username: string; userId: string } }): string {
  // Opportunistic GC.
  const now = Date.now();
  for (const [k, v] of challenges) if (v.expiresAt < now) challenges.delete(k);
  const nonce = newNonce();
  challenges.set(nonce, { challenge, ...extras, expiresAt: now + CHALLENGE_TTL_MS });
  return nonce;
}
function popChallenge(nonce: string): ChallengeEntry | undefined {
  const entry = challenges.get(nonce);
  if (!entry) return undefined;
  challenges.delete(nonce);
  if (entry.expiresAt < Date.now()) return undefined;
  return entry;
}

interface PasskeyRow {
  credential_id: string;
  user_id: string;
  public_key: Uint8Array;
  counter: number;
  transports: string;
  device_label: string;
}

async function passkeyForCredentialId(id: string): Promise<PasskeyRow | undefined> {
  return queryOne<PasskeyRow>(
    `SELECT credential_id, user_id, public_key, counter, transports, device_label
     FROM passkeys WHERE credential_id = ?`,
    [id],
  );
}

function detectDeviceLabel(userAgent: string): string {
  // Friendly default based on UA. User can rename later.
  if (/iPhone|iPad/i.test(userAgent)) return 'iPhone · Face ID/Touch ID';
  if (/Android/i.test(userAgent)) return 'Android · Fingerprint';
  if (/Mac OS X|Macintosh/i.test(userAgent)) return 'Mac · Touch ID';
  if (/Windows/i.test(userAgent)) return 'Windows Hello';
  return 'Säkerhetsnyckel';
}

export function addPasskeyRoutes(router: Router): void {
  // ── REGISTER (logged-in user binds a new passkey) ─────────────────

  router.post('/auth/passkey/register/start', requireUser, async (req, res) => {
    const user = req.user!;
    const existing = await queryAll<{ credential_id: string; transports: string }>(
      `SELECT credential_id, transports FROM passkeys WHERE user_id = ?`,
      [user.id],
    );
    const options = await generateRegistrationOptions({
      rpName: rpName(),
      rpID: rpId(),
      userID: new TextEncoder().encode(user.id),
      userName: user.username,
      userDisplayName: user.username,
      // Block re-registering the same credential.
      excludeCredentials: existing.map(c => ({
        id: c.credential_id,
        transports: c.transports ? c.transports.split(',') as AuthenticatorTransportLike[] : undefined,
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
      attestationType: 'none',
    });
    const nonce = stashChallenge(options.challenge, { userId: user.id });
    res.json({ options, nonce });
  });

  router.post('/auth/passkey/register/finish', requireUser, async (req, res) => {
    const body = req.body as { nonce?: string; response?: RegistrationResponseJSON };
    if (!body.nonce || !body.response) {
      res.status(400).json({ error: 'nonce and response required' });
      return;
    }
    const entry = popChallenge(body.nonce);
    if (!entry || entry.userId !== req.user!.id) {
      res.status(400).json({ error: 'utgången eller okänd challenge' });
      return;
    }
    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: body.response,
        expectedChallenge: entry.challenge,
        expectedOrigin: expectedOrigin(),
        expectedRPID: rpId(),
        requireUserVerification: false,
      });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'verifiering misslyckades' });
      return;
    }
    if (!verification.verified || !verification.registrationInfo) {
      res.status(400).json({ error: 'verifiering misslyckades' });
      return;
    }
    const info = verification.registrationInfo;
    const cred = info.credential;
    const transports = (body.response.response.transports ?? []).join(',');
    const label = detectDeviceLabel(req.header('user-agent') ?? '');
    try {
      await exec(
        `INSERT INTO passkeys (credential_id, user_id, public_key, counter, transports, device_label)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [cred.id, req.user!.id, Buffer.from(cred.publicKey), cred.counter ?? 0, transports, label],
      );
    } catch {
      res.status(409).json({ error: 'denna passkey är redan registrerad' });
      return;
    }
    res.json({
      ok: true,
      credential: {
        id: cred.id,
        deviceLabel: label,
        createdAt: new Date().toISOString(),
      },
    });
  });

  // ── SIGN UP (anonymous — creates a new account in one biometric prompt) ─

  // The flow:
  //   1. user picks a username
  //   2. server reserves it (validates + checks uniqueness, but DOESN'T
  //      insert the user row yet — we don't want orphan rows from cancelled
  //      Face ID prompts)
  //   3. server returns RegistrationOptions
  //   4. browser invokes the platform authenticator → Face ID prompt
  //   5. browser sends back a RegistrationResponse
  //   6. server materializes the user row + passkey + session in one go,
  //      re-checking uniqueness in case of a TOCTOU race

  const USERNAME_PATTERN = /^[a-zA-Z0-9_.-]+$/;
  const MIN_USERNAME = 2;
  const MAX_USERNAME = 32;

  async function isUsernameAvailable(username: string): Promise<boolean> {
    const row = await queryOne<{ id: string }>(
      `SELECT id FROM users WHERE username = ? COLLATE NOCASE`,
      [username],
    );
    return !row;
  }

  router.post('/auth/passkey/signup/start', async (req, res) => {
    const body = req.body as { username?: unknown };
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    if (username.length < MIN_USERNAME || username.length > MAX_USERNAME) {
      res.status(400).json({ error: `Användarnamn ${MIN_USERNAME}–${MAX_USERNAME} tecken.` });
      return;
    }
    if (!USERNAME_PATTERN.test(username)) {
      res.status(400).json({ error: 'Bara bokstäver, siffror, _ . -' });
      return;
    }
    if (!await isUsernameAvailable(username)) {
      res.status(409).json({ error: 'Användarnamnet är upptaget.' });
      return;
    }
    if (username.toLowerCase() === 'admin') {
      res.status(409).json({ error: 'Användarnamnet är reserverat.' });
      return;
    }
    const userId = newUserId();
    const options = await generateRegistrationOptions({
      rpName: rpName(),
      rpID: rpId(),
      userID: new TextEncoder().encode(userId),
      userName: username,
      userDisplayName: username,
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
      attestationType: 'none',
    });
    const nonce = stashChallenge(options.challenge, { pendingSignup: { username, userId } });
    res.json({ options, nonce });
  });

  router.post('/auth/passkey/signup/finish', async (req, res) => {
    const body = req.body as { nonce?: string; response?: RegistrationResponseJSON };
    if (!body.nonce || !body.response) {
      res.status(400).json({ error: 'nonce and response required' });
      return;
    }
    const entry = popChallenge(body.nonce);
    if (!entry || !entry.pendingSignup) {
      res.status(400).json({ error: 'utgången eller okänd challenge' });
      return;
    }
    const { username, userId } = entry.pendingSignup;

    // Re-check uniqueness — a different signup may have used the name while
    // the user was holding their finger on the sensor.
    if (!await isUsernameAvailable(username)) {
      res.status(409).json({ error: 'Användarnamnet är upptaget. Välj ett annat.' });
      return;
    }

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: body.response,
        expectedChallenge: entry.challenge,
        expectedOrigin: expectedOrigin(),
        expectedRPID: rpId(),
        requireUserVerification: false,
      });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'verifiering misslyckades' });
      return;
    }
    if (!verification.verified || !verification.registrationInfo) {
      res.status(400).json({ error: 'verifiering misslyckades' });
      return;
    }

    const info = verification.registrationInfo;
    const cred = info.credential;
    const transports = (body.response.response.transports ?? []).join(',');
    const label = detectDeviceLabel(req.header('user-agent') ?? '');

    // Lock-out hashes for password + security answer — this account is
    // biometric-only until the user adds a password from settings.
    const lock1 = randomBytes(32).toString('hex');
    const lock2 = randomBytes(32).toString('hex');

    try {
      await exec(
        `INSERT INTO users (id, username, password_hash, security_question, security_answer_hash, role)
         VALUES (?, ?, ?, ?, ?, 'user')`,
        [userId, username, hashPassword(lock1), 'n/a (biometric-only account)', hashPassword(lock2)],
      );
    } catch {
      res.status(409).json({ error: 'Användarnamnet är upptaget.' });
      return;
    }

    try {
      await exec(
        `INSERT INTO passkeys (credential_id, user_id, public_key, counter, transports, device_label)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [cred.id, userId, Buffer.from(cred.publicKey), cred.counter ?? 0, transports, label],
      );
    } catch {
      // Roll back the user we just created — orphan otherwise.
      await exec(`DELETE FROM users WHERE id = ?`, [userId]);
      res.status(500).json({ error: 'kunde inte spara passkey' });
      return;
    }

    await exec(`DELETE FROM user_sessions WHERE expires_at < datetime('now')`);
    const token = newSessionToken();
    const expiresAt = new Date(Date.now() + USER_SESSION_TTL_MS).toISOString();
    await exec(
      `INSERT INTO user_sessions (token, user_id, expires_at) VALUES (?, ?, ?)`,
      [token, userId, expiresAt],
    );
    res.json({
      token,
      expiresAt,
      user: { id: userId, username, role: 'user' as const },
    });
  });

  // ── LOGIN (no session required) ────────────────────────────────────

  router.post('/auth/passkey/login/start', async (_req, res) => {
    const options = await generateAuthenticationOptions({
      rpID: rpId(),
      userVerification: 'preferred',
      // Empty allowCredentials → discoverable credential selection.
      // Browser shows its system passkey picker.
      allowCredentials: [],
    });
    const nonce = stashChallenge(options.challenge);
    res.json({ options, nonce });
  });

  // Convenience for the client: "is this username free + valid?" Used by
  // the inline signup form to give instant feedback before invoking the
  // biometric prompt.
  router.post('/auth/passkey/signup/check-username', async (req, res) => {
    const body = req.body as { username?: unknown };
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    if (username.length < MIN_USERNAME || username.length > MAX_USERNAME) {
      res.json({ ok: false, reason: `Användarnamn ${MIN_USERNAME}–${MAX_USERNAME} tecken.` });
      return;
    }
    if (!USERNAME_PATTERN.test(username)) {
      res.json({ ok: false, reason: 'Bara bokstäver, siffror, _ . -' });
      return;
    }
    if (username.toLowerCase() === 'admin') {
      res.json({ ok: false, reason: 'Användarnamnet är reserverat.' });
      return;
    }
    if (!await isUsernameAvailable(username)) {
      res.json({ ok: false, reason: 'Användarnamnet är upptaget.' });
      return;
    }
    res.json({ ok: true });
  });

  router.post('/auth/passkey/login/finish', async (req, res) => {
    const body = req.body as { nonce?: string; response?: AuthenticationResponseJSON };
    if (!body.nonce || !body.response) {
      res.status(400).json({ error: 'nonce and response required' });
      return;
    }
    const entry = popChallenge(body.nonce);
    if (!entry) {
      res.status(400).json({ error: 'utgången eller okänd challenge' });
      return;
    }
    const cred = await passkeyForCredentialId(body.response.id);
    if (!cred) {
      res.status(404).json({ error: 'okänd passkey — registrera den först' });
      return;
    }

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response: body.response,
        expectedChallenge: entry.challenge,
        expectedOrigin: expectedOrigin(),
        expectedRPID: rpId(),
        credential: {
          id: cred.credential_id,
          publicKey: new Uint8Array(cred.public_key),
          counter: cred.counter,
          transports: cred.transports ? cred.transports.split(',') as AuthenticatorTransportLike[] : undefined,
        },
        requireUserVerification: false,
      });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'verifiering misslyckades' });
      return;
    }
    if (!verification.verified) {
      res.status(401).json({ error: 'verifiering misslyckades' });
      return;
    }

    // Bump counter + last_used_at.
    await exec(
      `UPDATE passkeys SET counter = ?, last_used_at = datetime('now') WHERE credential_id = ?`,
      [verification.authenticationInfo.newCounter, cred.credential_id],
    );

    // Issue a user_session for this user.
    const userRow = await queryOne<UserRow>(
      `SELECT id, username, role FROM users WHERE id = ?`,
      [cred.user_id],
    );
    if (!userRow) {
      res.status(500).json({ error: 'användarpost saknas' });
      return;
    }
    await exec(`DELETE FROM user_sessions WHERE expires_at < datetime('now')`);
    const token = newSessionToken();
    const expiresAt = new Date(Date.now() + USER_SESSION_TTL_MS).toISOString();
    await exec(
      `INSERT INTO user_sessions (token, user_id, expires_at) VALUES (?, ?, ?)`,
      [token, userRow.id, expiresAt],
    );
    res.json({ token, expiresAt, user: userRow });
  });

  // ── List + delete (logged-in user manages their own) ───────────────

  router.get('/auth/passkey/list', requireUser, async (req, res) => {
    const rows = await queryAll<{ credential_id: string; device_label: string; created_at: string; last_used_at: string | null }>(
      `SELECT credential_id, device_label, created_at, last_used_at
       FROM passkeys WHERE user_id = ? ORDER BY created_at DESC`,
      [req.user!.id],
    );
    res.json({ passkeys: rows.map(r => ({
      id: r.credential_id,
      deviceLabel: r.device_label,
      createdAt: r.created_at,
      lastUsedAt: r.last_used_at,
    })) });
  });

  router.delete<{ id: string }>('/auth/passkey/:id', requireUser, async (req, res) => {
    // The credential id can contain URL-unsafe characters; client sends it
    // already URL-encoded as a path param.
    const credId = decodeURIComponent(req.params.id);
    const row = await queryOne<{ user_id: string }>(
      `SELECT user_id FROM passkeys WHERE credential_id = ?`,
      [credId],
    );
    if (!row) { res.status(404).json({ error: 'okänd passkey' }); return; }
    if (row.user_id !== req.user!.id) {
      res.status(403).json({ error: 'inte din passkey' });
      return;
    }
    await exec(`DELETE FROM passkeys WHERE credential_id = ?`, [credId]);
    res.json({ ok: true });
  });
}

// Local re-export of the transport string union — keeps the runtime usage
// strictly typed against SimpleWebAuthn's expectations.
type AuthenticatorTransportLike = 'usb' | 'nfc' | 'ble' | 'internal' | 'hybrid' | 'cable' | 'smart-card';
