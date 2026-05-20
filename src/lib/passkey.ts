// Thin wrapper around @simplewebauthn/browser + our /api/auth/passkey/* endpoints.
// We do the round-trip (start → browser.credentials → finish) in one helper
// per flow so callers don't have to know the protocol.
//
// Browser support detection: presence of PublicKeyCredential + (preferably)
// a platform authenticator. We expose `isPlatformAuthenticatorAvailable()`
// for the UI to feature-gate the "Logga in med Face ID" button.

import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
} from '@simplewebauthn/browser';
import type { ApiUser } from './api';

export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!browserSupportsWebAuthn()) return false;
  if (typeof PublicKeyCredential === 'undefined') return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const checker = (PublicKeyCredential as any).isUserVerifyingPlatformAuthenticatorAvailable;
  if (typeof checker !== 'function') return false;
  try { return await checker.call(PublicKeyCredential); }
  catch { return false; }
}

export interface RegisteredPasskey {
  id: string;
  deviceLabel: string;
  createdAt: string;
}

// Requires user_token in storage. Used from UserMenu/Settings.
export async function registerPasskey(userToken: string): Promise<RegisteredPasskey> {
  // 1. ask server for options + nonce
  const start = await fetch('/api/auth/passkey/register/start', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${userToken}` },
  });
  if (!start.ok) throw new Error((await start.json()).error || 'kunde inte starta');
  const { options, nonce } = await start.json();

  // 2. let browser prompt for biometric — this triggers Face ID / Touch ID
  const credential = await startRegistration({ optionsJSON: options });

  // 3. submit response to server for verification
  const finish = await fetch('/api/auth/passkey/register/finish', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${userToken}` },
    body: JSON.stringify({ nonce, response: credential }),
  });
  const body = await finish.json();
  if (!finish.ok) throw new Error(body.error || 'kunde inte verifiera');
  return body.credential as RegisteredPasskey;
}

export interface PasskeyLoginResult {
  token: string;
  expiresAt: string;
  user: ApiUser;
}

// No auth required — this IS the login.
export async function loginWithPasskey(): Promise<PasskeyLoginResult> {
  const start = await fetch('/api/auth/passkey/login/start', { method: 'POST' });
  if (!start.ok) throw new Error((await start.json()).error || 'kunde inte starta');
  const { options, nonce } = await start.json();

  // Browser shows native passkey picker. User taps Face ID / Touch ID.
  const credential = await startAuthentication({ optionsJSON: options });

  const finish = await fetch('/api/auth/passkey/login/finish', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ nonce, response: credential }),
  });
  const body = await finish.json();
  if (!finish.ok) throw new Error(body.error || 'inloggning misslyckades');
  return body as PasskeyLoginResult;
}

// ── Anonymous signup (no account yet) ──────────────────────────────
// Single biometric prompt creates: a user record, a passkey, and a session.

export async function checkSignupUsername(username: string): Promise<{ ok: boolean; reason?: string }> {
  const r = await fetch('/api/auth/passkey/signup/check-username', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username }),
  });
  return r.json();
}

export async function signupWithPasskey(input: {
  username: string;
  securityQuestion: string;
  securityAnswer: string;
}): Promise<PasskeyLoginResult> {
  const start = await fetch('/api/auth/passkey/signup/start', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!start.ok) throw new Error((await start.json()).error || 'kunde inte starta');
  const { options, nonce } = await start.json();

  // Triggers Face ID / Touch ID. User can cancel here.
  const credential = await startRegistration({ optionsJSON: options });

  const finish = await fetch('/api/auth/passkey/signup/finish', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ nonce, response: credential }),
  });
  const body = await finish.json();
  if (!finish.ok) throw new Error(body.error || 'kunde inte verifiera');
  return body as PasskeyLoginResult;
}

export interface PasskeyEntry {
  id: string;
  deviceLabel: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export async function listPasskeys(userToken: string): Promise<PasskeyEntry[]> {
  const r = await fetch('/api/auth/passkey/list', {
    headers: { authorization: `Bearer ${userToken}` },
  });
  if (!r.ok) throw new Error('kunde inte hämta passkeys');
  return (await r.json()).passkeys;
}

export async function deletePasskey(userToken: string, credentialId: string): Promise<void> {
  const r = await fetch(`/api/auth/passkey/${encodeURIComponent(credentialId)}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${userToken}` },
  });
  if (!r.ok) throw new Error('kunde inte radera');
}
