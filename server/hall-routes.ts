// Hall of Fame endpoints.
//
// Three resource shapes share one feed:
//   - image  — binary in DB, served via GET /hall/blob/:id
//   - video  — binary in DB, same blob endpoint
//   - youtube — only the 11-char video id is stored, client embeds an iframe
//
// Security boundaries (a private friend site, but we still keep these
// strict so a stolen credential can't paint shells onto the page):
//   1. Mime allowlist — image/jpeg|png|webp|gif, video/mp4|webm|quicktime
//   2. Magic-byte sniff on the decoded bytes; rejects renamed .php etc.
//   3. 16 MB hard cap on upload size (raw bytes after base64 decode)
//   4. YouTube URL parsed via regex, only ids matching /^[A-Za-z0-9_-]{11}$/
//      survive — embeds use the canonical https://www.youtube.com/embed/{id}
//   5. Caption clamped to 300 chars, stored as-is (React auto-escapes)
//
// Use express.json with a higher limit for this router only — the global
// 2mb cap would refuse most video uploads.

import express, { type Router } from 'express';
import { randomBytes } from 'node:crypto';
import { exec, queryAll, queryOne } from './db.js';
import { attachUser, canDeleteAnyHallPost, requireUser } from './auth.js';

const MAX_COMMENT = 500;

const MAX_BYTES = 16 * 1024 * 1024;     // 16 MB after decoding
const MAX_CAPTION = 300;

// Allowed mime types per kind. Image set covers everything iOS/Android
// pickers commonly produce; video stays narrow since we render via <video>.
const ALLOWED_IMAGE_MIMES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
]);
const ALLOWED_VIDEO_MIMES = new Set([
  'video/mp4', 'video/webm', 'video/quicktime',
]);

// Magic-byte signatures for the formats above. We accept iff the decoded
// bytes start with one of these prefixes — even if the mime header lies.
const IMAGE_MAGIC: Array<{ mime: string; bytes: number[] }> = [
  { mime: 'image/jpeg', bytes: [0xFF, 0xD8, 0xFF] },
  { mime: 'image/png',  bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] },
  { mime: 'image/gif',  bytes: [0x47, 0x49, 0x46, 0x38] }, // GIF8
  { mime: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF (verify WEBP at offset 8)
];
// Video signatures — looking at the right offset for each container.
const VIDEO_MAGIC: Array<{ mime: string; matcher: (b: Uint8Array) => boolean }> = [
  // MP4 / QuickTime: 'ftyp' at offset 4
  { mime: 'video/mp4',       matcher: (b) => b.length > 12 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70 },
  { mime: 'video/quicktime', matcher: (b) => b.length > 12 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70 },
  // WebM (Matroska EBML): 1A 45 DF A3
  { mime: 'video/webm', matcher: (b) => b.length > 4 && b[0] === 0x1A && b[1] === 0x45 && b[2] === 0xDF && b[3] === 0xA3 },
];

function startsWith(buf: Uint8Array, prefix: number[]): boolean {
  if (buf.length < prefix.length) return false;
  for (let i = 0; i < prefix.length; i++) if (buf[i] !== prefix[i]) return false;
  return true;
}

function detectImage(buf: Uint8Array, declaredMime: string): string | null {
  for (const sig of IMAGE_MAGIC) {
    if (startsWith(buf, sig.bytes)) {
      if (sig.mime === 'image/webp') {
        // Verify "WEBP" at offset 8 — RIFF alone isn't enough.
        const isWebp = buf.length > 12
          && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50;
        if (!isWebp) continue;
      }
      // Optional: warn when declared and detected disagree, but we trust
      // the detected signature.
      void declaredMime;
      return sig.mime;
    }
  }
  return null;
}

function detectVideo(buf: Uint8Array): string | null {
  for (const sig of VIDEO_MAGIC) {
    if (sig.matcher(buf)) return sig.mime;
  }
  return null;
}

// Pull the 11-char video id out of any common YouTube URL shape.
function extractYouTubeId(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  // Quick win: input IS already a bare id.
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  try {
    const u = new URL(s);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') {
      const id = u.pathname.replace(/^\//, '').split('/')[0];
      return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
    }
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
      const v = u.searchParams.get('v');
      if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v;
      // /embed/{id} or /shorts/{id}
      const m = u.pathname.match(/^\/(?:embed|shorts|v)\/([A-Za-z0-9_-]{11})/);
      if (m) return m[1];
    }
  } catch { /* not a URL */ }
  return null;
}

function newId(): string {
  return randomBytes(9).toString('hex');
}

// Parse a `data:` URL of any mime type. Returns null on any malformed
// input — caller treats null as a 400. We accept payloads up to roughly
// MAX_BYTES × 4/3 (base64 overhead) plus a small allowance for the prefix.
function decodeAnyDataUrl(dataUrl: string): { mime: string; bytes: Uint8Array } | null {
  if (typeof dataUrl !== 'string') return null;
  if (dataUrl.length > 24_000_000) return null; // ~16 MB binary
  const match = /^data:([^;,]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  const mime = match[1].toLowerCase();
  try {
    const buf = Buffer.from(match[2], 'base64');
    return { mime, bytes: new Uint8Array(buf) };
  } catch {
    return null;
  }
}

interface PostRow {
  id: string;
  user_id: string;
  kind: 'image' | 'video' | 'youtube';
  blob_mime: string | null;
  youtube_id: string | null;
  caption: string;
  created_at: string;
  author_username: string;
  author_avatar_updated_at: string | null;
  like_count?: number;
  dislike_count?: number;
  comment_count?: number;
  my_reaction?: 'like' | 'dislike' | null;
  view_count?: number;
}

function postDto(row: PostRow) {
  return {
    id: row.id,
    userId: row.user_id,
    author: row.author_username,
    authorAvatarUrl: row.author_avatar_updated_at
      ? `/api/auth/avatar/${encodeURIComponent(row.user_id)}?v=${encodeURIComponent(row.author_avatar_updated_at)}`
      : null,
    kind: row.kind,
    blobUrl: row.kind === 'youtube' ? null : `/hall/blob/${encodeURIComponent(row.id)}`,
    blobMime: row.blob_mime,
    youtubeId: row.youtube_id,
    caption: row.caption,
    createdAt: row.created_at,
    likeCount: Number(row.like_count ?? 0),
    dislikeCount: Number(row.dislike_count ?? 0),
    commentCount: Number(row.comment_count ?? 0),
    viewCount: Number(row.view_count ?? 0),
    myReaction: row.my_reaction ?? null,
  };
}

interface CommentRow {
  id: string;
  post_id: string;
  user_id: string;
  body: string;
  created_at: string;
  author_username: string;
  author_avatar_updated_at: string | null;
}

function commentDto(row: CommentRow) {
  return {
    id: row.id,
    postId: row.post_id,
    userId: row.user_id,
    author: row.author_username,
    authorAvatarUrl: row.author_avatar_updated_at
      ? `/api/auth/avatar/${encodeURIComponent(row.user_id)}?v=${encodeURIComponent(row.author_avatar_updated_at)}`
      : null,
    body: row.body,
    createdAt: row.created_at,
  };
}

export function addHallRoutes(router: Router): void {
  // List the entire feed. Public — anyone can view. If a session token is
  // present we also populate `myReaction` so the UI can highlight buttons.
  //
  // Sort options come in via ?sort=...:
  //   newest         (default) — created_at DESC
  //   oldest         — created_at ASC
  //   most_viewed    — view_count DESC then newest
  //   most_liked     — like_count DESC then newest
  //   most_disliked  — dislike_count DESC then newest
  router.get('/hall/posts', attachUser, async (req, res) => {
    const me = req.user?.id ?? null;
    const sortParam = String(req.query.sort ?? 'newest');
    const orderBy = (() => {
      switch (sortParam) {
        case 'oldest':        return 'p.created_at ASC';
        case 'most_viewed':   return 'p.view_count DESC, p.created_at DESC';
        case 'most_liked':    return 'like_count DESC, p.created_at DESC';
        case 'most_disliked': return 'dislike_count DESC, p.created_at DESC';
        case 'newest':
        default:              return 'p.created_at DESC';
      }
    })();
    const rows = await queryAll<PostRow>(
      `SELECT p.id, p.user_id, p.kind, p.blob_mime, p.youtube_id, p.caption,
              p.created_at, p.view_count, u.username AS author_username, u.avatar_updated_at AS author_avatar_updated_at,
              (SELECT COUNT(*) FROM hall_of_fame_reactions r WHERE r.post_id = p.id AND r.kind = 'like') AS like_count,
              (SELECT COUNT(*) FROM hall_of_fame_reactions r WHERE r.post_id = p.id AND r.kind = 'dislike') AS dislike_count,
              (SELECT COUNT(*) FROM hall_of_fame_comments c WHERE c.post_id = p.id) AS comment_count,
              (SELECT r.kind FROM hall_of_fame_reactions r WHERE r.post_id = p.id AND r.user_id = ?) AS my_reaction
       FROM hall_of_fame_posts p
       JOIN users u ON u.id = p.user_id
       ORDER BY ${orderBy}`,
      [me ?? ''],
    );
    // Personalized field → no shared cache.
    res.setHeader('Cache-Control', me ? 'private, no-store' : 'public, max-age=15, stale-while-revalidate=60');
    res.json({ posts: rows.map(postDto) });
  });

  // Bump the view counter on a post. Anonymous — the dedupe is on the
  // client via sessionStorage so this stays a single round-trip per
  // post per session.
  router.post<{ id: string }>('/hall/posts/:id/view', async (req, res) => {
    const r = await exec(
      `UPDATE hall_of_fame_posts SET view_count = view_count + 1 WHERE id = ?`,
      [req.params.id],
    );
    if (r.changes === 0) { res.status(404).json({ error: 'okänt inlägg' }); return; }
    res.json({ ok: true });
  });

  // List comments for one post. Public.
  router.get<{ id: string }>('/hall/posts/:id/comments', async (req, res) => {
    const rows = await queryAll<CommentRow>(
      `SELECT c.id, c.post_id, c.user_id, c.body, c.created_at,
              u.username AS author_username, u.avatar_updated_at AS author_avatar_updated_at
       FROM hall_of_fame_comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.post_id = ?
       ORDER BY c.created_at ASC`,
      [req.params.id],
    );
    res.json({ comments: rows.map(commentDto) });
  });

  // Add a comment. Requires login.
  router.post<{ id: string }>('/hall/posts/:id/comments', requireUser, async (req, res) => {
    const body = req.body as Record<string, unknown>;
    const text = typeof body.body === 'string' ? body.body.trim().slice(0, MAX_COMMENT) : '';
    if (!text) { res.status(400).json({ error: 'kommentaren är tom' }); return; }
    const exists = await queryOne<{ id: string }>(`SELECT id FROM hall_of_fame_posts WHERE id = ?`, [req.params.id]);
    if (!exists) { res.status(404).json({ error: 'okänt inlägg' }); return; }
    const id = newId();
    await exec(
      `INSERT INTO hall_of_fame_comments (id, post_id, user_id, body) VALUES (?, ?, ?, ?)`,
      [id, req.params.id, req.user!.id, text],
    );
    const row = await queryOne<CommentRow>(
      `SELECT c.id, c.post_id, c.user_id, c.body, c.created_at,
              u.username AS author_username, u.avatar_updated_at AS author_avatar_updated_at
       FROM hall_of_fame_comments c JOIN users u ON u.id = c.user_id
       WHERE c.id = ?`,
      [id],
    );
    res.status(201).json(row ? commentDto(row) : { id });
  });

  // Delete a comment — owner or admin.
  router.delete<{ id: string }>('/hall/comments/:id', requireUser, async (req, res) => {
    const row = await queryOne<{ user_id: string }>(
      `SELECT user_id FROM hall_of_fame_comments WHERE id = ?`,
      [req.params.id],
    );
    if (!row) { res.status(404).json({ error: 'okänd kommentar' }); return; }
    if (row.user_id !== req.user!.id && req.user!.role !== 'admin') {
      res.status(403).json({ error: 'inte din kommentar' });
      return;
    }
    await exec(`DELETE FROM hall_of_fame_comments WHERE id = ?`, [req.params.id]);
    res.json({ ok: true });
  });

  // Set, change, or clear my reaction on a post. body { kind: 'like'|'dislike'|null }
  // Tapping the same kind twice clears it (toggle). Tapping the other kind
  // replaces. Requires login.
  router.post<{ id: string }>('/hall/posts/:id/reaction', requireUser, async (req, res) => {
    const body = req.body as Record<string, unknown>;
    const wanted = body.kind === 'like' || body.kind === 'dislike' ? body.kind : null;
    const exists = await queryOne<{ id: string }>(`SELECT id FROM hall_of_fame_posts WHERE id = ?`, [req.params.id]);
    if (!exists) { res.status(404).json({ error: 'okänt inlägg' }); return; }

    const existing = await queryOne<{ kind: 'like' | 'dislike' }>(
      `SELECT kind FROM hall_of_fame_reactions WHERE post_id = ? AND user_id = ?`,
      [req.params.id, req.user!.id],
    );
    if (wanted === null || existing?.kind === wanted) {
      // Clear (explicit null or toggle-off)
      await exec(
        `DELETE FROM hall_of_fame_reactions WHERE post_id = ? AND user_id = ?`,
        [req.params.id, req.user!.id],
      );
    } else if (existing) {
      await exec(
        `UPDATE hall_of_fame_reactions SET kind = ?, created_at = datetime('now') WHERE post_id = ? AND user_id = ?`,
        [wanted, req.params.id, req.user!.id],
      );
    } else {
      await exec(
        `INSERT INTO hall_of_fame_reactions (post_id, user_id, kind) VALUES (?, ?, ?)`,
        [req.params.id, req.user!.id, wanted],
      );
    }

    const counts = await queryOne<{ likes: number; dislikes: number }>(
      `SELECT
         (SELECT COUNT(*) FROM hall_of_fame_reactions WHERE post_id = ? AND kind = 'like')    AS likes,
         (SELECT COUNT(*) FROM hall_of_fame_reactions WHERE post_id = ? AND kind = 'dislike') AS dislikes`,
      [req.params.id, req.params.id],
    );
    const finalRow = await queryOne<{ kind: 'like' | 'dislike' } | null>(
      `SELECT kind FROM hall_of_fame_reactions WHERE post_id = ? AND user_id = ?`,
      [req.params.id, req.user!.id],
    );
    res.json({
      likeCount: Number(counts?.likes ?? 0),
      dislikeCount: Number(counts?.dislikes ?? 0),
      myReaction: finalRow?.kind ?? null,
    });
  });

  // Create — requires user session (admin's synthetic user counts). 16 MB
  // body cap is enforced via the dedicated express.json middleware below.
  router.post(
    '/hall/posts',
    express.json({ limit: '20mb' }),
    requireUser,
    async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const kind = typeof body.kind === 'string' ? body.kind : '';
      const caption = typeof body.caption === 'string'
        ? body.caption.trim().slice(0, MAX_CAPTION)
        : '';

      if (kind === 'youtube') {
        const url = typeof body.url === 'string' ? body.url : '';
        const ytId = extractYouTubeId(url);
        if (!ytId) {
          res.status(400).json({ error: 'kunde inte hitta YouTube-id i länken' });
          return;
        }
        const id = newId();
        await exec(
          `INSERT INTO hall_of_fame_posts (id, user_id, kind, youtube_id, caption)
           VALUES (?, ?, 'youtube', ?, ?)`,
          [id, req.user!.id, ytId, caption],
        );
        const row = await fetchPost(id);
        res.status(201).json(row);
        return;
      }

      if (kind !== 'image' && kind !== 'video') {
        res.status(400).json({ error: 'kind måste vara image, video eller youtube' });
        return;
      }

      // image + video: body.dataUrl carries the file as a data: URL.
      const dataUrl = typeof body.dataUrl === 'string' ? body.dataUrl : '';
      if (!dataUrl) { res.status(400).json({ error: 'fil saknas' }); return; }
      const decoded = decodeAnyDataUrl(dataUrl);
      if (!decoded) {
        res.status(400).json({ error: 'kunde inte avkoda filen' });
        return;
      }
      const { bytes, mime: declaredMime } = decoded;
      if (bytes.length > MAX_BYTES) {
        res.status(413).json({ error: `filen är för stor (max ${Math.round(MAX_BYTES / 1024 / 1024)} MB)` });
        return;
      }

      // Allowlist + magic-byte sniff. We trust the detected mime, not the
      // declared one — that's how we keep .php uploads renamed to .jpg out.
      let actualMime: string | null;
      const allowed = kind === 'image' ? ALLOWED_IMAGE_MIMES : ALLOWED_VIDEO_MIMES;
      if (!allowed.has(declaredMime)) {
        res.status(415).json({ error: `${declaredMime || 'okänt format'} stöds inte` });
        return;
      }
      actualMime = kind === 'image' ? detectImage(bytes, declaredMime) : detectVideo(bytes);
      if (!actualMime || !allowed.has(actualMime)) {
        res.status(415).json({ error: 'filens innehåll matchar inte ett bild- eller videoformat' });
        return;
      }

      const id = newId();
      await exec(
        `INSERT INTO hall_of_fame_posts (id, user_id, kind, blob_data, blob_mime, caption)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, req.user!.id, kind, Buffer.from(bytes), actualMime, caption],
      );
      const row = await fetchPost(id);
      res.status(201).json(row);
    },
  );

  // Binary upload — raw bytes instead of base64 data URL. We accept this
  // path because Vercel caps serverless request bodies at 4.5 MB; base64
  // inflates the payload by ~33% so the JSON endpoint above tops out around
  // a 3 MB video. Raw bytes give us ~4.4 MB of actual file budget.
  //
  // The kind + caption arrive in the query string (UTF-8 safe via
  // URLSearchParams). The Content-Type header carries the declared mime
  // — we still magic-byte-verify the actual bytes.
  router.post(
    '/hall/posts/binary',
    express.raw({ type: ['image/*', 'video/*'], limit: '20mb' }),
    requireUser,
    async (req, res) => {
      const kindParam = String(req.query.kind ?? '');
      const kind = kindParam === 'image' || kindParam === 'video' ? kindParam : null;
      if (!kind) {
        res.status(400).json({ error: 'kind måste vara image eller video' });
        return;
      }
      const caption = String(req.query.caption ?? '').slice(0, MAX_CAPTION);
      const declaredMime = (req.header('content-type') || '').toLowerCase();
      const bytes = req.body as Buffer | undefined;
      if (!Buffer.isBuffer(bytes) || bytes.length === 0) {
        res.status(400).json({ error: 'fil saknas' });
        return;
      }
      if (bytes.length > MAX_BYTES) {
        res.status(413).json({ error: `filen är för stor (max ${Math.round(MAX_BYTES / 1024 / 1024)} MB)` });
        return;
      }

      const allowed = kind === 'image' ? ALLOWED_IMAGE_MIMES : ALLOWED_VIDEO_MIMES;
      if (!allowed.has(declaredMime)) {
        res.status(415).json({ error: `${declaredMime || 'okänt format'} stöds inte` });
        return;
      }
      const u8 = new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const actualMime = kind === 'image' ? detectImage(u8, declaredMime) : detectVideo(u8);
      if (!actualMime || !allowed.has(actualMime)) {
        res.status(415).json({ error: 'filens innehåll matchar inte ett bild- eller videoformat' });
        return;
      }

      const id = newId();
      await exec(
        `INSERT INTO hall_of_fame_posts (id, user_id, kind, blob_data, blob_mime, caption)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, req.user!.id, kind, bytes, actualMime, caption],
      );
      const row = await fetchPost(id);
      res.status(201).json(row);
    },
  );

  // Delete — owner or admin.
  router.delete<{ id: string }>('/hall/posts/:id', requireUser, async (req, res) => {
    const row = await queryOne<{ user_id: string }>(
      `SELECT user_id FROM hall_of_fame_posts WHERE id = ?`,
      [req.params.id],
    );
    if (!row) { res.status(404).json({ error: 'okänt inlägg' }); return; }
    // Owner can delete their own; admin and Court can delete anything.
    if (row.user_id !== req.user!.id && !canDeleteAnyHallPost(req.user!.role)) {
      res.status(403).json({ error: 'inte ditt inlägg' });
      return;
    }
    await exec(`DELETE FROM hall_of_fame_posts WHERE id = ?`, [req.params.id]);
    res.json({ ok: true });
  });
}

async function fetchPost(id: string) {
  const row = await queryOne<PostRow>(
    `SELECT p.id, p.user_id, p.kind, p.blob_mime, p.youtube_id, p.caption,
            p.created_at, p.view_count, u.username AS author_username, u.avatar_updated_at AS author_avatar_updated_at
     FROM hall_of_fame_posts p
     JOIN users u ON u.id = p.user_id
     WHERE p.id = ?`,
    [id],
  );
  return row ? postDto(row) : null;
}

// Public blob serving — separate router so it lives outside /api and the
// frontend can <img src> / <video src> straight at it.
export function addHallBlobRoute(router: Router): void {
  router.get<{ id: string }>('/hall/blob/:id', async (req, res) => {
    const row = await queryOne<{ blob_data: Uint8Array; blob_mime: string | null }>(
      `SELECT blob_data, blob_mime FROM hall_of_fame_posts WHERE id = ? AND blob_data IS NOT NULL`,
      [req.params.id],
    );
    if (!row || !row.blob_data) { res.status(404).end(); return; }
    res.setHeader('Content-Type', row.blob_mime ?? 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    // Defense in depth — even if mime spoofs HTML, browsers won't sniff.
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end(Buffer.from(row.blob_data));
  });
}
