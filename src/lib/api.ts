// Typed wrappers around the Express API. All endpoints are same-origin during
// dev (Vite proxies /api → http://localhost:3001) so no base URL is needed.
//
// The current admin token, if any, is read from localStorage and attached as
// Authorization: Bearer <token>. Endpoints that require admin will surface a
// 401 as a thrown ApiError — the caller (state.tsx) reacts by clearing the
// stored token.

import type { Friend } from '../data/friends';

const TOKEN_KEY = 'friendslist_admin_token';
const USER_TOKEN_KEY = 'rrv_user_token';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function makeStore(key: string) {
  return {
    get: (): string | null => {
      try { return localStorage.getItem(key); } catch { return null; }
    },
    set: (token: string) => {
      try { localStorage.setItem(key, token); } catch { /* ignore */ }
    },
    clear: () => {
      try { localStorage.removeItem(key); } catch { /* ignore */ }
    },
  };
}

export const tokenStore = makeStore(TOKEN_KEY);
export const userTokenStore = makeStore(USER_TOKEN_KEY);

interface FetchOptions {
  method?: string;
  body?: unknown;
  auth?: boolean;       // admin bearer
  userAuth?: boolean;   // user bearer (optional; if no token, header is just omitted)
  requireUser?: boolean; // user bearer, throw if missing
}

async function request<T>(path: string, opts: FetchOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  if (opts.auth) {
    const token = tokenStore.get();
    if (!token) throw new ApiError('not logged in', 401);
    headers['authorization'] = `Bearer ${token}`;
  } else if (opts.requireUser) {
    const token = userTokenStore.get();
    if (!token) throw new ApiError('not logged in', 401);
    headers['authorization'] = `Bearer ${token}`;
  } else if (opts.userAuth) {
    const token = userTokenStore.get();
    if (token) headers['authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(path, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  const parsed = text ? (() => { try { return JSON.parse(text) as unknown; } catch { return null; } })() : null;
  if (!res.ok) {
    const message =
      parsed && typeof parsed === 'object' && parsed !== null && 'error' in parsed && typeof (parsed as { error: unknown }).error === 'string'
        ? (parsed as { error: string }).error
        : `${res.status} ${res.statusText}`;
    throw new ApiError(message, res.status);
  }
  return parsed as T;
}

// ── Predictions DTO (matches /api/predictions response) ──────────────

export interface ApiPrediction {
  id: number;
  guesser: string;
  friendId: string;
  text: string;
  correct: boolean;
  createdAt: string;
}

// ── G Map DTO (matches /api/gmap response) ───────────────────────────

export type GProximity = 'legendary' | 'close' | 'mid' | 'far' | 'veryfar';

export interface ApiGMapPair {
  rank: number;
  proximity: GProximity;
  proximityLabel: string;     // 'Samma adress', 'Grannar', …
  proximityColor: string;     // hex
  emoji: string;              // 👑 🏠 🚶 🚗
  friends: [string, string];  // friend ids — left, right
  distanceMeters: number;
  distanceLabel: string;      // '152 m' or '1.3 km' or 'Samma adress'
  area: string;               // composed from each friend's geocoded area
  mapsUrl: string;
}

export interface ApiGMap {
  pairs: ApiGMapPair[];
  gLessIds: string[];
  pending: boolean;           // true if any friend still has no coords
  geocodedCount: number;
  totalCount: number;
}

// ── Site content ─────────────────────────────────────────────────────

export type SiteContent = Record<string, string>;

// ── Endpoint wrappers ────────────────────────────────────────────────

export interface BootstrapPayload {
  friends: Friend[];
  predictions: ApiPrediction[];
  gmap: ApiGMap;
  content: SiteContent;
  dailyQuote: string;
}

export const api = {
  fetchBootstrap: () => request<BootstrapPayload>('/api/bootstrap'),
  // kept for direct cache-busted calls after mutations
  fetchFriends: () => request<Friend[]>('/api/friends'),
  fetchPredictions: () => request<ApiPrediction[]>('/api/predictions'),
  fetchContent: () => request<SiteContent>('/api/content'),

  login: (password: string) =>
    request<{ token: string; expiresAt: string }>('/api/admin/login', {
      method: 'POST',
      body: { password },
    }),
  logout: () => request<{ ok: true }>('/api/admin/logout', { method: 'POST', auth: true }),
  checkSession: () => request<{ ok: true }>('/api/admin/check', { auth: true }),

  updateContent: (key: string, value: string) =>
    request<{ key: string; value: string }>(`/api/content/${encodeURIComponent(key)}`, {
      method: 'PATCH',
      body: { value },
      auth: true,
    }),

  updateFriend: (id: string, patch: { name?: string; note?: string; bio?: string; currentMove?: string; lat?: number; lon?: number; tier?: string; rank?: number }) =>
    request<Friend>(`/api/friends/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: patch,
      auth: true,
    }),

  swapFriends: (idA: string, idB: string) =>
    request<{ ok: boolean }>('/api/admin/friends/swap', {
      method: 'POST',
      body: { idA, idB },
      auth: true,
    }),

  deletePhoto: (id: string, position: number) =>
    request<Friend>(`/api/friends/${encodeURIComponent(id)}/photos/${position}`, {
      method: 'DELETE',
      auth: true,
    }),

  uploadPhoto: (id: string, dataUrl: string) =>
    request<Friend>(`/api/friends/${encodeURIComponent(id)}/photo`, {
      method: 'POST',
      body: { dataUrl },
      auth: true,
    }),

  submitPrediction: (input: { guesser: string; friendId: string; text: string }) =>
    request<ApiPrediction>('/api/predictions', { method: 'POST', body: input }),

  markCorrect: (id: number, correct: boolean) =>
    request<ApiPrediction>(`/api/predictions/${id}`, {
      method: 'PATCH',
      body: { correct },
      auth: true,
    }),

  deletePrediction: (id: number) =>
    request<{ ok: true }>(`/api/predictions/${id}`, { method: 'DELETE', auth: true }),

  // ── User auth ─────────────────────────────────────────────────────────

  register: (input: {
    username: string;
    password: string;
    securityQuestion: string;
    securityAnswer: string;
  }) =>
    request<AuthResponse>('/api/auth/register', { method: 'POST', body: input }),

  userLogin: (input: { username: string; password: string }) =>
    request<AuthResponse>('/api/auth/login', { method: 'POST', body: input }),

  userLogout: () =>
    request<{ ok: true }>('/api/auth/logout', { method: 'POST', requireUser: true }),

  userMe: () => request<{ user: ApiUser }>('/api/auth/me', { requireUser: true }),

  recoverStart: (username: string) =>
    request<{ securityQuestion: string }>('/api/auth/recover/start', {
      method: 'POST',
      body: { username },
    }),

  recoverFinish: (input: { username: string; securityAnswer: string; newPassword: string }) =>
    request<AuthResponse>('/api/auth/recover/finish', { method: 'POST', body: input }),

  // ── Polls ────────────────────────────────────────────────────────────

  fetchPolls: () => request<{ polls: ApiPoll[] }>('/api/polls', { userAuth: true }),

  createPoll: (input: { question: string; options: string[]; eventId?: string | null }) =>
    request<{ ok: true; id: string }>('/api/polls', {
      method: 'POST',
      body: input,
      requireUser: true,
    }),

  votePoll: (pollId: string, optionId: number) =>
    request<{ ok: true }>(`/api/polls/${encodeURIComponent(pollId)}/vote`, {
      method: 'POST',
      body: { optionId },
      requireUser: true,
    }),

  deletePoll: (pollId: string) =>
    request<{ ok: true }>(`/api/polls/${encodeURIComponent(pollId)}`, {
      method: 'DELETE',
      requireUser: true,
    }),
};

// ── DTOs for new endpoints ─────────────────────────────────────────────

export interface ApiUser {
  id: string;
  username: string;
  role: 'user' | 'admin';
}

export interface AuthResponse {
  token: string;
  expiresAt: string;
  user: ApiUser;
}

export interface ApiPollOption {
  id: number;
  label: string;
  position: number;
  votes: number;
}

export interface ApiPoll {
  id: string;
  eventId: string | null;
  question: string;
  author: string;
  createdBy: string;
  createdAt: string;
  closesAt: string | null;
  options: ApiPollOption[];
  myVote: number | null;
}
