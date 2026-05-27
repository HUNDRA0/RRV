// Wrappers around the Hall of Fame backend. Reads are anonymous; create
// and delete require a user token (handled by the request util in api.ts).

import { userTokenStore, ApiError } from './api';

export interface HallPost {
  id: string;
  userId: string;
  author: string;
  authorAvatarUrl: string | null;
  kind: 'image' | 'video' | 'youtube';
  blobUrl: string | null;
  blobMime: string | null;
  youtubeId: string | null;
  caption: string;
  createdAt: string;
  likeCount: number;
  dislikeCount: number;
  commentCount: number;
  myReaction: 'like' | 'dislike' | null;
}

export interface HallComment {
  id: string;
  postId: string;
  userId: string;
  author: string;
  authorAvatarUrl: string | null;
  body: string;
  createdAt: string;
}

export async function fetchHallPosts(): Promise<HallPost[]> {
  const token = userTokenStore.get();
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  const r = await fetch('/api/hall/posts', { headers });
  if (!r.ok) throw new Error('kunde inte hämta inlägg');
  return (await r.json()).posts;
}

export async function fetchHallComments(postId: string): Promise<HallComment[]> {
  const r = await fetch(`/api/hall/posts/${encodeURIComponent(postId)}/comments`);
  if (!r.ok) throw new Error('kunde inte hämta kommentarer');
  return (await r.json()).comments;
}

export async function addHallComment(postId: string, body: string): Promise<HallComment> {
  const token = userTokenStore.get();
  if (!token) throw new ApiError('not logged in', 401);
  const r = await fetch(`/api/hall/posts/${encodeURIComponent(postId)}/comments`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ body }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(j.error || 'kunde inte kommentera', r.status);
  return j;
}

export async function deleteHallComment(id: string): Promise<void> {
  const token = userTokenStore.get();
  if (!token) throw new ApiError('not logged in', 401);
  const r = await fetch(`/api/hall/comments/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { 'authorization': `Bearer ${token}` },
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(j.error || 'kunde inte radera', r.status);
}

export interface ReactionResult {
  likeCount: number;
  dislikeCount: number;
  myReaction: 'like' | 'dislike' | null;
}

export async function setHallReaction(
  postId: string,
  kind: 'like' | 'dislike' | null,
): Promise<ReactionResult> {
  const token = userTokenStore.get();
  if (!token) throw new ApiError('not logged in', 401);
  const r = await fetch(`/api/hall/posts/${encodeURIComponent(postId)}/reaction`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ kind }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(j.error || 'kunde inte reagera', r.status);
  return j;
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

// Raw-binary upload — avoids base64 inflation so we can fit ~30% more
// content under Vercel's 4.5 MB serverless body cap.
export async function createHallBinaryPost(
  file: File,
  kind: 'image' | 'video',
  caption: string,
): Promise<HallPost> {
  const token = userTokenStore.get();
  if (!token) throw new ApiError('not logged in', 401);
  const q = new URLSearchParams({ kind, caption });
  const r = await fetch(`/api/hall/posts/binary?${q.toString()}`, {
    method: 'POST',
    headers: {
      'content-type': file.type || 'application/octet-stream',
      'authorization': `Bearer ${token}`,
    },
    body: file,
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(body.error || 'kunde inte ladda upp', r.status);
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
// Vercel caps serverless request bodies at ~4.5 MB. Raw binary fits closer
// to that ceiling than base64 (which adds ~33%), but we leave headroom for
// headers + URL + content-length so the request never gets bounced at the
// edge. For larger videos, the YouTube tab is the right choice.
export const CLIENT_MAX_BYTES = 4 * 1024 * 1024; // 4 MB
