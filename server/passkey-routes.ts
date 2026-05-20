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
  newSessionToken,
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
  userId?: string;       // when registering — bound to this user
  expiresAt: number;
}
const challenges = new Map<string, ChallengeEntry>();
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

function newNonce(): string {
  return randomBytes(16).toString('hex');
}
function stashChallenge(challenge: string, userId?: string): string {
  // Opportunistic GC.
  const now = Date.now();
  for (const [k, v] of challenges) if (v.expiresAt < now) challenges.delete(k);
  const nonce = newNonce();
  challenges.set(nonce, { challenge, userId, expiresAt: now + CHALLENGE_TTL_MS });
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
    const nonce = stashChallenge(options.challenge, user.id);
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
