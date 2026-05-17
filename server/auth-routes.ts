// User accounts + polls.
//
// Auth flow:
//   POST /api/auth/register     username, password, securityQuestion, securityAnswer
//   POST /api/auth/login        username, password → { token, user }
//   POST /api/auth/logout       (bearer) invalidate session
//   GET  /api/auth/me           (bearer) → { user }
//   POST /api/auth/recover/start username → { securityQuestion }
//   POST /api/auth/recover/finish username, securityAnswer, newPassword → { token, user }
//
// Polls flow:
//   GET  /api/polls             list of polls with options + per-poll vote counts + my vote
//   POST /api/polls             (bearer) create a poll
//   POST /api/polls/:id/vote    (bearer) cast or change a vote
//   DELETE /api/polls/:id       (bearer, owner or admin)

import type { Router } from 'express';
import { exec, queryAll, queryOne } from './db.js';
import {
  USER_SESSION_TTL_MS,
  hashPassword,
  loadUserBySessionToken,
  newPollId,
  newSessionToken,
  newUserId,
  normalizeAnswer,
  requireUser,
  verifyPassword,
} from './auth.js';

const MAX_USERNAME = 32;
const MIN_USERNAME = 2;
const MIN_PASSWORD = 6;
const MAX_PASSWORD = 200;
const MAX_QUESTION = 200;
const MAX_ANSWER = 200;
const MAX_POLL_QUESTION = 200;
const MAX_OPTION_LABEL = 80;
const MAX_OPTIONS = 8;
const MIN_OPTIONS = 2;

const USERNAME_PATTERN = /^[a-zA-Z0-9_.-]+$/;

function userDto(u: { id: string; username: string; role: 'user' | 'admin' }) {
  return { id: u.id, username: u.username, role: u.role };
}

async function issueSession(userId: string) {
  // GC expired sessions opportunistically.
  await exec(`DELETE FROM user_sessions WHERE expires_at < datetime('now')`);
  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + USER_SESSION_TTL_MS).toISOString();
  await exec(
    `INSERT INTO user_sessions (token, user_id, expires_at) VALUES (?, ?, ?)`,
    [token, userId, expiresAt],
  );
  return { token, expiresAt };
}

// Per-IP throttle for register + recover; in-memory like the admin one.
const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

function throttle(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (entry && entry.resetAt > now) {
    if (entry.count >= MAX_ATTEMPTS) return false;
    entry.count += 1;
    return true;
  }
  attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
  return true;
}

function clientIp(req: { headers: Record<string, unknown>; ip?: string }): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length) return xff.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

export function addAuthRoutes(router: Router): void {
  // ── Register ──────────────────────────────────────────────────────────
  router.post('/auth/register', async (req, res) => {
    if (!throttle(clientIp(req))) {
      res.status(429).json({ error: 'för många försök, vänta 15 minuter' });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const question = typeof body.securityQuestion === 'string' ? body.securityQuestion.trim() : '';
    const answer = typeof body.securityAnswer === 'string' ? body.securityAnswer : '';

    if (username.length < MIN_USERNAME || username.length > MAX_USERNAME) {
      res.status(400).json({ error: `användarnamn ${MIN_USERNAME}–${MAX_USERNAME} tecken` });
      return;
    }
    if (!USERNAME_PATTERN.test(username)) {
      res.status(400).json({ error: 'användarnamn: bara bokstäver, siffror, _ . -' });
      return;
    }
    if (password.length < MIN_PASSWORD || password.length > MAX_PASSWORD) {
      res.status(400).json({ error: `lösenord minst ${MIN_PASSWORD} tecken` });
      return;
    }
    if (question.length < 4 || question.length > MAX_QUESTION) {
      res.status(400).json({ error: 'skriv en säkerhetsfråga (4–200 tecken)' });
      return;
    }
    const normAnswer = normalizeAnswer(answer);
    if (normAnswer.length < 1 || normAnswer.length > MAX_ANSWER) {
      res.status(400).json({ error: 'skriv ett svar på säkerhetsfrågan' });
      return;
    }

    const existing = await queryOne<{ id: string }>(
      `SELECT id FROM users WHERE username = ? COLLATE NOCASE`,
      [username],
    );
    if (existing) {
      res.status(409).json({ error: 'användarnamnet är upptaget' });
      return;
    }

    const id = newUserId();
    await exec(
      `INSERT INTO users (id, username, password_hash, security_question, security_answer_hash, role)
       VALUES (?, ?, ?, ?, ?, 'user')`,
      [id, username, hashPassword(password), question, hashPassword(normAnswer)],
    );
    const { token, expiresAt } = await issueSession(id);
    res.json({ token, expiresAt, user: userDto({ id, username, role: 'user' }) });
  });

  // ── Login ─────────────────────────────────────────────────────────────
  router.post('/auth/login', async (req, res) => {
    if (!throttle(clientIp(req))) {
      res.status(429).json({ error: 'för många försök, vänta 15 minuter' });
      return;
    }
    const body = req.body as Record<string, unknown>;
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (!username || !password) {
      res.status(400).json({ error: 'användarnamn och lösenord krävs' });
      return;
    }
    const row = await queryOne<{
      id: string;
      username: string;
      password_hash: string;
      role: 'user' | 'admin';
    }>(
      `SELECT id, username, password_hash, role FROM users WHERE username = ? COLLATE NOCASE`,
      [username],
    );
    if (!row || !verifyPassword(password, row.password_hash)) {
      res.status(401).json({ error: 'fel användarnamn eller lösenord' });
      return;
    }
    const { token, expiresAt } = await issueSession(row.id);
    res.json({ token, expiresAt, user: userDto(row) });
  });

  // ── Me ────────────────────────────────────────────────────────────────
  router.get('/auth/me', requireUser, (req, res) => {
    res.json({ user: userDto(req.user!) });
  });

  // ── Logout ────────────────────────────────────────────────────────────
  router.post('/auth/logout', async (req, res) => {
    const header = req.header('authorization') ?? '';
    const match = /^Bearer\s+(.+)$/i.exec(header);
    if (match) {
      await exec('DELETE FROM user_sessions WHERE token = ?', [match[1].trim()]);
    }
    res.json({ ok: true });
  });

  // ── Recovery: step 1 fetches the question ─────────────────────────────
  router.post('/auth/recover/start', async (req, res) => {
    if (!throttle(clientIp(req))) {
      res.status(429).json({ error: 'för många försök, vänta 15 minuter' });
      return;
    }
    const body = req.body as Record<string, unknown>;
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    if (!username) { res.status(400).json({ error: 'användarnamn krävs' }); return; }
    const row = await queryOne<{ security_question: string }>(
      `SELECT security_question FROM users WHERE username = ? COLLATE NOCASE`,
      [username],
    );
    if (!row) {
      // Don't leak which usernames exist.
      res.status(404).json({ error: 'okänd användare' });
      return;
    }
    res.json({ securityQuestion: row.security_question });
  });

  // ── Recovery: step 2 verifies answer + sets new password ──────────────
  router.post('/auth/recover/finish', async (req, res) => {
    if (!throttle(clientIp(req))) {
      res.status(429).json({ error: 'för många försök, vänta 15 minuter' });
      return;
    }
    const body = req.body as Record<string, unknown>;
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    const answer = typeof body.securityAnswer === 'string' ? body.securityAnswer : '';
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';
    if (!username || !answer || !newPassword) {
      res.status(400).json({ error: 'alla fält krävs' });
      return;
    }
    if (newPassword.length < MIN_PASSWORD || newPassword.length > MAX_PASSWORD) {
      res.status(400).json({ error: `lösenord minst ${MIN_PASSWORD} tecken` });
      return;
    }
    const row = await queryOne<{
      id: string;
      username: string;
      role: 'user' | 'admin';
      security_answer_hash: string;
    }>(
      `SELECT id, username, role, security_answer_hash FROM users WHERE username = ? COLLATE NOCASE`,
      [username],
    );
    if (!row || !verifyPassword(normalizeAnswer(answer), row.security_answer_hash)) {
      res.status(401).json({ error: 'fel svar på säkerhetsfrågan' });
      return;
    }
    // Reset password, drop all existing sessions for this user.
    await exec(
      `UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`,
      [hashPassword(newPassword), row.id],
    );
    await exec('DELETE FROM user_sessions WHERE user_id = ?', [row.id]);
    const { token, expiresAt } = await issueSession(row.id);
    res.json({ token, expiresAt, user: userDto(row) });
  });

  // ── Polls ─────────────────────────────────────────────────────────────

  // Public list. Includes counts + caller's own vote if a valid bearer is passed.
  // Polls with `closes_at` in the past are hidden (auto-expire — used to hide
  // event-linked polls the day after the event).
  router.get('/polls', async (req, res) => {
    const polls = await queryAll<{
      id: string;
      event_id: string | null;
      question: string;
      created_at: string;
      closes_at: string | null;
      created_by: string;
      author: string;
    }>(
      `SELECT p.id, p.event_id, p.question, p.created_at, p.closes_at, p.created_by,
              u.username AS author
       FROM polls p
       JOIN users u ON u.id = p.created_by
       WHERE p.closes_at IS NULL OR datetime(p.closes_at) > datetime('now')
       ORDER BY p.created_at DESC`,
    );
    if (polls.length === 0) {
      res.json({ polls: [] });
      return;
    }
    const options = await queryAll<{
      id: number;
      poll_id: string;
      label: string;
      position: number;
    }>(`SELECT id, poll_id, label, position FROM poll_options ORDER BY poll_id, position`);
    const tallies = await queryAll<{ option_id: number; n: number }>(
      `SELECT option_id, COUNT(*) AS n FROM poll_votes GROUP BY option_id`,
    );
    const tallyMap = new Map<number, number>();
    for (const t of tallies) tallyMap.set(t.option_id, t.n);

    // If caller has a session, surface their own choice per poll AND include
    // voter usernames per option (so the friend group can see who voted for what).
    // Anonymous viewers see only counts.
    let myVotes = new Map<string, number>();
    let votersByOption = new Map<number, string[]>();
    const header = req.header('authorization') ?? '';
    const match = /^Bearer\s+(.+)$/i.exec(header);
    if (match) {
      const user = await loadUserBySessionToken(match[1].trim());
      if (user) {
        const rows = await queryAll<{ poll_id: string; option_id: number }>(
          `SELECT poll_id, option_id FROM poll_votes WHERE user_id = ?`,
          [user.id],
        );
        for (const r of rows) myVotes.set(r.poll_id, r.option_id);

        const voterRows = await queryAll<{ option_id: number; username: string }>(
          `SELECT v.option_id, u.username
           FROM poll_votes v JOIN users u ON u.id = v.user_id
           ORDER BY v.created_at`,
        );
        for (const r of voterRows) {
          const list = votersByOption.get(r.option_id) ?? [];
          list.push(r.username);
          votersByOption.set(r.option_id, list);
        }
      }
    }

    res.json({
      polls: polls.map(p => ({
        id: p.id,
        eventId: p.event_id,
        question: p.question,
        author: p.author,
        createdBy: p.created_by,
        createdAt: p.created_at,
        closesAt: p.closes_at,
        options: options
          .filter(o => o.poll_id === p.id)
          .map(o => ({
            id: o.id,
            label: o.label,
            position: o.position,
            voters: votersByOption.get(o.id) ?? [],
            votes: tallyMap.get(o.id) ?? 0,
          })),
        myVote: myVotes.get(p.id) ?? null,
      })),
    });
  });

  // Create poll.
  router.post('/polls', requireUser, async (req, res) => {
    const body = req.body as Record<string, unknown>;
    const question = typeof body.question === 'string'
      ? body.question.trim().slice(0, MAX_POLL_QUESTION)
      : '';
    const eventId = typeof body.eventId === 'string' && body.eventId.trim()
      ? body.eventId.trim().slice(0, 60)
      : null;
    const rawOptions = Array.isArray(body.options) ? body.options : [];

    // Optional auto-close timestamp. We accept ISO strings only.
    // Used by the client to expire event-linked polls the day after the event.
    let closesAt: string | null = null;
    if (typeof body.closesAt === 'string' && body.closesAt) {
      const t = Date.parse(body.closesAt);
      if (!Number.isFinite(t)) {
        res.status(400).json({ error: 'ogiltigt datum för stängning' });
        return;
      }
      if (t <= Date.now()) {
        res.status(400).json({ error: 'stängningsdatum måste vara i framtiden' });
        return;
      }
      closesAt = new Date(t).toISOString();
    }

    if (question.length < 4) {
      res.status(400).json({ error: 'fråga måste vara minst 4 tecken' });
      return;
    }
    const cleanOptions = rawOptions
      .map(o => (typeof o === 'string' ? o.trim().slice(0, MAX_OPTION_LABEL) : ''))
      .filter(s => s.length > 0);
    // De-dup case-insensitively while preserving order.
    const seen = new Set<string>();
    const uniqueOptions: string[] = [];
    for (const o of cleanOptions) {
      const key = o.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      uniqueOptions.push(o);
    }
    if (uniqueOptions.length < MIN_OPTIONS) {
      res.status(400).json({ error: `minst ${MIN_OPTIONS} olika alternativ` });
      return;
    }
    if (uniqueOptions.length > MAX_OPTIONS) {
      res.status(400).json({ error: `max ${MAX_OPTIONS} alternativ` });
      return;
    }

    const id = newPollId();
    await exec(
      `INSERT INTO polls (id, created_by, event_id, question, closes_at) VALUES (?, ?, ?, ?, ?)`,
      [id, req.user!.id, eventId, question, closesAt],
    );
    for (let i = 0; i < uniqueOptions.length; i++) {
      await exec(
        `INSERT INTO poll_options (poll_id, label, position) VALUES (?, ?, ?)`,
        [id, uniqueOptions[i], i + 1],
      );
    }
    res.json({ ok: true, id });
  });

  // Cast/change vote. Upserts on (poll_id, user_id).
  router.post<{ id: string }>('/polls/:id/vote', requireUser, async (req, res) => {
    const pollId = req.params.id;
    const body = req.body as Record<string, unknown>;
    const optionIdRaw = body.optionId;
    const optionId = typeof optionIdRaw === 'number' ? optionIdRaw : Number(optionIdRaw);
    if (!Number.isFinite(optionId)) {
      res.status(400).json({ error: 'optionId krävs' });
      return;
    }
    const opt = await queryOne<{ poll_id: string }>(
      `SELECT poll_id FROM poll_options WHERE id = ?`,
      [optionId],
    );
    if (!opt || opt.poll_id !== pollId) {
      res.status(400).json({ error: 'alternativet tillhör inte denna omröstning' });
      return;
    }
    // Optional close-at enforcement.
    const poll = await queryOne<{ closes_at: string | null }>(
      `SELECT closes_at FROM polls WHERE id = ?`,
      [pollId],
    );
    if (!poll) { res.status(404).json({ error: 'okänd omröstning' }); return; }
    if (poll.closes_at && new Date(poll.closes_at).getTime() < Date.now()) {
      res.status(409).json({ error: 'omröstningen är stängd' });
      return;
    }

    // Upsert: PRIMARY KEY (poll_id, user_id) handles the unique constraint.
    await exec(
      `INSERT INTO poll_votes (poll_id, option_id, user_id) VALUES (?, ?, ?)
       ON CONFLICT(poll_id, user_id) DO UPDATE SET option_id = excluded.option_id, created_at = datetime('now')`,
      [pollId, optionId, req.user!.id],
    );
    res.json({ ok: true });
  });

  // Delete poll. Owner or admin.
  router.delete<{ id: string }>('/polls/:id', requireUser, async (req, res) => {
    const pollId = req.params.id;
    const row = await queryOne<{ created_by: string }>(
      `SELECT created_by FROM polls WHERE id = ?`,
      [pollId],
    );
    if (!row) { res.status(404).json({ error: 'okänd omröstning' }); return; }
    if (row.created_by !== req.user!.id && req.user!.role !== 'admin') {
      res.status(403).json({ error: 'bara skaparen kan ta bort' });
      return;
    }
    await exec(`DELETE FROM polls WHERE id = ?`, [pollId]);
    res.json({ ok: true });
  });
}
