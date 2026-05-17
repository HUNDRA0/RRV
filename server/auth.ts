// User auth (separate from admin auth):
//   - scrypt password hashing via node:crypto, no external deps
//   - user_sessions table mirrors admin_sessions (256-bit opaque tokens, 7d TTL)
//   - requireUser middleware loads the session and attaches req.user
//
// The admin flow in routes.ts is left untouched. Polls are user-only; if the
// admin wants to create or vote on polls they register a user account too.

import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { exec, queryOne } from './db.js';

export const USER_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const SCRYPT_KEYLEN = 64;
const SCRYPT_N = 16384;

export interface UserRow {
  id: string;
  username: string;
  role: 'user' | 'admin';
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: UserRow;
    }
  }
}

export function hashPassword(plain: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(plain, salt, SCRYPT_KEYLEN, { N: SCRYPT_N });
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  try {
    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(hashHex, 'hex');
    const actual = scryptSync(plain, salt, expected.length, { N: SCRYPT_N });
    if (actual.length !== expected.length) return false;
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function normalizeAnswer(answer: string): string {
  return answer.trim().toLowerCase();
}

export function newSessionToken(): string {
  return randomBytes(32).toString('hex');
}

export function newUserId(): string {
  // 9-byte → 18-char hex; collision-resistant for our scale.
  return randomBytes(9).toString('hex');
}

export function newPollId(): string {
  return randomBytes(6).toString('hex');
}

export async function loadUserBySessionToken(token: string): Promise<UserRow | null> {
  const row = await queryOne<{
    user_id: string;
    expires_at: string;
    username: string;
    role: 'user' | 'admin';
  }>(
    `SELECT s.user_id, s.expires_at, u.username, u.role
     FROM user_sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = ?`,
    [token],
  );
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await exec('DELETE FROM user_sessions WHERE token = ?', [token]);
    return null;
  }
  return { id: row.user_id, username: row.username, role: row.role };
}

export async function requireUser(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.header('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) {
    res.status(401).json({ error: 'missing bearer token' });
    return;
  }
  const user = await loadUserBySessionToken(match[1].trim());
  if (!user) {
    res.status(401).json({ error: 'invalid or expired token' });
    return;
  }
  req.user = user;
  next();
}
