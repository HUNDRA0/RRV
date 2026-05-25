// Wrappers around the Hall of Fame backend. Reads are anonymous; create
// and delete require a user token (handled by the request util in api.ts).

import { userTokenStore, ApiError } from './api';

export interface HallPost {
  id: string;
  userId: string;
  author: string;
  kind: 'image' | 'video' | 'youtube';
  blobUrl: string | null;
  blobMime: string | null;
  youtubeId: string | null;
  caption: string;
  createdAt: string;
}

export async function fetchHallPosts(): Promise<HallPost[]> {
  const r = await fetch('/api/hall/posts');
  if (!r.ok) throw new Error('kunde inte hämta inlägg');
  return (await r.json()).posts;
}

interface CreateInput {
  kind: 'image' | 'video' | 'youtube';
  dataUrl?: string;
  url?: string;
  caption?: string;
}

export async function createHallPost(input: CreateInput): Promise<HallPost> {
  const token = userTokenStore.get();
  if (!token) throw new ApiError('not logged in', 401);
  const r = await fetch('/api/hall/posts', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(body.error || 'kunde inte skapa inlägg', r.status);
  return body;
}

export async function deleteHallPost(id: string): Promise<void> {
  const token = userTokenStore.get();
  if (!token) throw new ApiError('not logged in', 401);
  const r = await fetch(`/api/hall/posts/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { 'authorization': `Bearer ${token}` },
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(body.error || 'kunde inte radera', r.status);
}

// Client-side hint check before we send. Server enforces these strictly
// regardless, this just gives the user faster feedback.
export const CLIENT_ALLOWED_IMAGE = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const CLIENT_ALLOWED_VIDEO = ['video/mp4', 'video/webm', 'video/quicktime'];
export const CLIENT_MAX_BYTES = 16 * 1024 * 1024;
