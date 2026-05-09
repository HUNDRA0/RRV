// HTTP routes. SQL columns are snake_case; the JSON we return is camelCase
// (the conversion happens at the boundary so the rest of the API stays clean).
//
// Auth model: POST /api/admin/login takes the password, issues an opaque
// session token (256 bits of randomness) with a 7-day expiry. Mutating
// endpoints require Authorization: Bearer <token>; reads are anonymous.
//
// Photos live in the friend_photos table as BLOBs (one row per photo, ordered
// by `position`). /photos/:id/:position streams the BLOB. The Friend DTO
// returns both `photos: [{url, position}]` for the carousel and `photoUrl`
// (= first photo's URL) as a convenience.

import { randomBytes } from 'node:crypto';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { exec, queryAll, queryOne } from './db.js';
import { decodeDataUrl } from './lib/photos.js';
import { buildMapsUrl, cacheKey, computePairs, type GeoFriend } from './lib/gmap.js';

// ── DTO conversion ────────────────────────────────────────────────────

interface FriendRow {
  id: string;
  name: string;
  rank: number;
  tier: 's' | 'a' | 'i';
  street: string;
  postcode: string;
  city: string;
  note: string;
  bio: string;
  current_move: string;
  lat: number | null;
  lon: number | null;
  area: string | null;
}

interface FriendPhotoMetaRow {
  friend_id: string;
  position: number;
  uploaded_at: string;
}

interface PredictionRow {
  id: number;
  guesser_name: string;
  friend_id: string;
  prediction_text: string;
  marked_correct: 0 | 1;
  created_at: string;
}

const SELECT_FRIEND_COLS =
  `id, name, rank, tier, street, postcode, city, note, bio, current_move, lat, lon, area`;
const SELECT_PREDICTION_COLS =
  `id, guesser_name, friend_id, prediction_text, marked_correct, created_at`;

function buildPhotoUrl(friendId: string, position: number, uploadedAt: string): string {
  return `/photos/${encodeURIComponent(friendId)}/${position}?v=${encodeURIComponent(uploadedAt)}`;
}

function toFriendDto(row: FriendRow, photos: FriendPhotoMetaRow[]) {
  const sorted = photos
    .filter(p => p.friend_id === row.id)
    .sort((a, b) => a.position - b.position);
  const photoEntries = sorted.map(p => ({
    position: p.position,
    url: buildPhotoUrl(row.id, p.position, p.uploaded_at),
  }));
  return {
    id: row.id,
    name: row.name,
    rank: row.rank,
    tier: row.tier,
    address: { street: row.street, postcode: row.postcode, city: row.city },
    note: row.note,
    bio: row.bio,
    currentMove: row.current_move,
    photoUrl: photoEntries[0]?.url ?? null,
    photos: photoEntries,
    lat: row.lat,
    lon: row.lon,
    area: row.area,
  };
}

function toPredictionDto(row: PredictionRow) {
  return {
    id: row.id,
    guesser: row.guesser_name,
    friendId: row.friend_id,
    text: row.prediction_text,
    correct: row.marked_correct === 1,
    createdAt: row.created_at,
  };
}

async function getFriendDto(id: string) {
  const row = await queryOne<FriendRow>(
    `SELECT ${SELECT_FRIEND_COLS} FROM friends WHERE id = ?`,
    [id],
  );
  if (!row) return null;
  const photos = await queryAll<FriendPhotoMetaRow>(
    `SELECT friend_id, position, uploaded_at FROM friend_photos WHERE friend_id = ? ORDER BY position`,
    [id],
  );
  return toFriendDto(row, photos);
}

async function getPredictionDto(id: number) {
  const row = await queryOne<PredictionRow>(
    `SELECT ${SELECT_PREDICTION_COLS} FROM predictions WHERE id = ?`,
    [id],
  );
  return row ? toPredictionDto(row) : null;
}

// ── Auth ──────────────────────────────────────────────────────────────

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const header = req.header('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) {
    res.status(401).json({ error: 'missing bearer token' });
    return;
  }
  const token = match[1].trim();
  const row = await queryOne<{ expires_at: string }>(
    `SELECT expires_at FROM admin_sessions WHERE token = ?`,
    [token],
  );
  if (!row) {
    res.status(401).json({ error: 'invalid token' });
    return;
  }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await exec('DELETE FROM admin_sessions WHERE token = ?', [token]);
    res.status(401).json({ error: 'token expired' });
    return;
  }
  next();
}

// ── Routes ────────────────────────────────────────────────────────────

export const router: Router = Router();

router.post('/admin/login', async (req, res) => {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    res.status(503).json({ error: 'admin login is not configured on this server' });
    return;
  }
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (password !== expected) {
    res.status(401).json({ error: 'fel lösenord' });
    return;
  }
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  await exec(`INSERT INTO admin_sessions (token, expires_at) VALUES (?, ?)`, [token, expiresAt]);
  res.json({ token, expiresAt });
});

router.post('/admin/logout', requireAdmin, async (req, res) => {
  const token = (req.header('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  await exec('DELETE FROM admin_sessions WHERE token = ?', [token]);
  res.json({ ok: true });
});

router.get('/admin/check', requireAdmin, (_req, res) => {
  res.json({ ok: true });
});

router.get('/friends', async (_req, res) => {
  const rows = await queryAll<FriendRow>(
    `SELECT ${SELECT_FRIEND_COLS} FROM friends ORDER BY rank`,
  );
  const photos = await queryAll<FriendPhotoMetaRow>(
    `SELECT friend_id, position, uploaded_at FROM friend_photos ORDER BY friend_id, position`,
  );
  res.setHeader('Cache-Control', 'public, max-age=10, stale-while-revalidate=30');
  res.json(rows.map(r => toFriendDto(r, photos)));
});

// Single endpoint that returns friends + predictions + gmap + content in one
// round-trip. Cuts 4 cold-start Lambda invocations down to 1.
router.get('/bootstrap', async (_req, res) => {
  const [friendRows, photoRows, predRows, contentRows, cacheRows] = await Promise.all([
    queryAll<FriendRow>(`SELECT ${SELECT_FRIEND_COLS} FROM friends ORDER BY rank`),
    queryAll<FriendPhotoMetaRow>(`SELECT friend_id, position, uploaded_at FROM friend_photos ORDER BY friend_id, position`),
    queryAll<PredictionRow>(`SELECT ${SELECT_PREDICTION_COLS} FROM predictions ORDER BY created_at DESC, id DESC`),
    queryAll<{ key: string; value: string }>('SELECT key, value FROM site_content'),
    queryAll<{ id_a: string; id_b: string; distance_meters: number }>('SELECT id_a, id_b, distance_meters FROM gmap_route_cache'),
  ]);

  // Build gmap (reuse friendRows so we don't query twice)
  const geocoded: GeoFriend[] = [];
  const ungeocodedIds: string[] = [];
  const addrById = new Map<string, { street: string; postcode: string; city: string }>();
  for (const row of friendRows) {
    addrById.set(row.id, { street: row.street, postcode: row.postcode, city: row.city });
    if (row.lat != null && row.lon != null) {
      geocoded.push({ id: row.id, name: row.name, lat: row.lat, lon: row.lon, area: row.area });
    } else {
      ungeocodedIds.push(row.id);
    }
  }
  const routeCache = new Map<string, number>();
  for (const row of cacheRows) routeCache.set(cacheKey(row.id_a, row.id_b), row.distance_meters);
  const { pairs, unpairedIds } = computePairs(geocoded, routeCache);

  const content: Record<string, string> = {};
  for (const r of contentRows) content[r.key] = r.value;

  res.setHeader('Cache-Control', 'public, max-age=10, stale-while-revalidate=30');
  res.json({
    friends: friendRows.map(r => toFriendDto(r, photoRows)),
    predictions: predRows.map(toPredictionDto),
    gmap: {
      pairs: pairs.map(p => ({
        rank: p.rank,
        proximity: p.proximity,
        proximityLabel: p.proximityLabel,
        proximityColor: p.proximityColor,
        emoji: p.emoji,
        friends: p.friendIds,
        distanceMeters: Math.round(p.distanceMeters),
        distanceLabel: p.distanceLabel,
        area: p.area,
        mapsUrl: buildMapsUrl(addrById.get(p.friendIds[0])!, addrById.get(p.friendIds[1])!),
      })),
      gLessIds: [...unpairedIds, ...ungeocodedIds],
      pending: ungeocodedIds.length > 0,
      geocodedCount: geocoded.length,
      totalCount: friendRows.length,
    },
    content,
  });
});

router.put<{ id: string }>('/friends/:id', requireAdmin, async (req, res) => {
  const id = req.params.id;
  const friend = await getFriendDto(id);
  if (!friend) {
    res.status(404).json({ error: 'friend not found' });
    return;
  }
  const body = req.body as { name?: unknown; note?: unknown; bio?: unknown; currentMove?: unknown; lat?: unknown; lon?: unknown; tier?: unknown };
  const updates: string[] = [];
  const args: (string | number)[] = [];
  let coordsChanged = false;
  let newLat: number | null = null;
  let newLon: number | null = null;

  if (body.name !== undefined) {
    if (typeof body.name !== 'string') { res.status(400).json({ error: 'name must be a string' }); return; }
    const trimmed = body.name.trim();
    if (!trimmed) { res.status(400).json({ error: 'name cannot be empty' }); return; }
    updates.push('name = ?'); args.push(trimmed);
  }
  if (body.note !== undefined) {
    if (typeof body.note !== 'string') { res.status(400).json({ error: 'note must be a string' }); return; }
    updates.push('note = ?'); args.push(body.note);
  }
  if (body.bio !== undefined) {
    if (typeof body.bio !== 'string') { res.status(400).json({ error: 'bio must be a string' }); return; }
    updates.push('bio = ?'); args.push(body.bio);
  }
  if (body.currentMove !== undefined) {
    if (typeof body.currentMove !== 'string') { res.status(400).json({ error: 'currentMove must be a string' }); return; }
    updates.push('current_move = ?'); args.push(body.currentMove);
  }
  if (body.lat !== undefined) {
    const v = typeof body.lat === 'string' ? parseFloat(body.lat) : body.lat;
    if (typeof v !== 'number' || !isFinite(v)) { res.status(400).json({ error: 'lat must be a finite number' }); return; }
    updates.push('lat = ?'); args.push(v); coordsChanged = true; newLat = v;
  }
  if (body.lon !== undefined) {
    const v = typeof body.lon === 'string' ? parseFloat(body.lon) : body.lon;
    if (typeof v !== 'number' || !isFinite(v)) { res.status(400).json({ error: 'lon must be a finite number' }); return; }
    updates.push('lon = ?'); args.push(v); coordsChanged = true; newLon = v;
  }
  if (body.tier !== undefined) {
    if (body.tier !== 's' && body.tier !== 'a' && body.tier !== 'i') { res.status(400).json({ error: "tier must be 's', 'a', or 'i'" }); return; }
    updates.push('tier = ?'); args.push(body.tier);
  }
  if (updates.length === 0) { res.json(friend); return; }
  updates.push(`updated_at = datetime('now')`);
  args.push(id);
  await exec(`UPDATE friends SET ${updates.join(', ')} WHERE id = ?`, args);

  if (coordsChanged && newLat != null && newLon != null) {
    // Invalidate cached routes and re-fetch from OSRM in background.
    await exec('DELETE FROM gmap_route_cache WHERE id_a = ? OR id_b = ?', [id, id]);
    const lat = newLat, lon = newLon, fid = id;
    (async () => {
      const others = await queryAll<{ id: string; lat: number; lon: number }>(
        'SELECT id, lat, lon FROM friends WHERE id != ? AND lat IS NOT NULL AND lon IS NOT NULL',
        [fid],
      );
      for (const other of others) {
        try {
          const url = `https://router.project-osrm.org/route/v1/driving/${lon},${lat};${other.lon},${other.lat}?overview=false`;
          const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
          if (!r.ok) continue;
          const json = await r.json() as { code: string; routes?: { distance: number }[] };
          if (json.code !== 'Ok' || !json.routes?.length) continue;
          const m = json.routes[0].distance;
          const key = fid < other.id ? `${fid}|${other.id}` : `${other.id}|${fid}`;
          const [ka, kb] = key.split('|');
          await exec('INSERT OR REPLACE INTO gmap_route_cache (id_a, id_b, distance_meters) VALUES (?,?,?)', [ka, kb, m]);
          await new Promise(r2 => setTimeout(r2, 300));
        } catch { /* ignore individual failures */ }
      }
    })().catch(() => {});
  }

  res.json(await getFriendDto(id));
});

// Append a new photo to the friend's carousel. Returns the updated friend DTO.
router.post<{ id: string }>('/friends/:id/photo', requireAdmin, async (req, res) => {
  const id = req.params.id;
  const friend = await queryOne<{ id: string }>('SELECT id FROM friends WHERE id = ?', [id]);
  if (!friend) {
    res.status(404).json({ error: 'friend not found' });
    return;
  }
  const dataUrl = typeof req.body?.dataUrl === 'string' ? req.body.dataUrl : '';
  const decoded = decodeDataUrl(dataUrl);
  if (!decoded) {
    res.status(400).json({ error: 'invalid or unsupported image data URL' });
    return;
  }
  const mime = `image/${decoded.ext === 'jpg' ? 'jpeg' : decoded.ext}`;
  const next = await queryOne<{ next: number }>(
    `SELECT COALESCE(MAX(position), 0) + 1 AS next FROM friend_photos WHERE friend_id = ?`,
    [id],
  );
  const position = next?.next ?? 1;
  await exec(
    `INSERT INTO friend_photos (friend_id, position, photo_data, photo_mime)
     VALUES (?, ?, ?, ?)`,
    [id, position, new Uint8Array(decoded.bytes), mime],
  );
  res.json(await getFriendDto(id));
});

// Delete one photo and re-pack remaining positions so they stay 1..N.
router.delete<{ id: string; position: string }>(
  '/friends/:id/photos/:position',
  requireAdmin,
  async (req, res) => {
    const id = req.params.id;
    const position = Number(req.params.position);
    if (!Number.isFinite(position) || position < 1) {
      res.status(400).json({ error: 'invalid position' });
      return;
    }
    const result = await exec(
      `DELETE FROM friend_photos WHERE friend_id = ? AND position = ?`,
      [id, position],
    );
    if (result.changes === 0) {
      res.status(404).json({ error: 'photo not found' });
      return;
    }
    // Re-pack: shift positions > deleted down by one so the carousel stays 1..N.
    await exec(
      `UPDATE friend_photos SET position = position - 1
       WHERE friend_id = ? AND position > ?`,
      [id, position],
    );
    res.json(await getFriendDto(id));
  },
);

// Photo BLOB stream — mounted under photosRouter at root, not /api.
export const photosRouter: Router = Router();

async function streamPhoto(
  friendId: string,
  position: number,
  res: Response,
): Promise<void> {
  const row = await queryOne<{
    photo_data: ArrayBuffer | Uint8Array | null;
    photo_mime: string | null;
    uploaded_at: string | null;
  }>(
    `SELECT photo_data, photo_mime, uploaded_at
     FROM friend_photos WHERE friend_id = ? AND position = ?`,
    [friendId, position],
  );
  if (!row || !row.photo_data || !row.photo_mime) {
    res.status(404).end();
    return;
  }
  const buf = Buffer.isBuffer(row.photo_data)
    ? row.photo_data
    : Buffer.from(row.photo_data instanceof ArrayBuffer ? row.photo_data : row.photo_data.buffer);
  res.setHeader('content-type', row.photo_mime);
  res.setHeader('content-length', String(buf.length));
  res.setHeader('cache-control', 'public, max-age=31536000, immutable');
  if (row.uploaded_at) res.setHeader('last-modified', new Date(row.uploaded_at).toUTCString());
  res.send(buf);
}

photosRouter.get<{ id: string; position: string }>(
  '/photos/:id/:position',
  async (req, res) => {
    const position = Number(req.params.position);
    if (!Number.isFinite(position)) {
      res.status(400).end();
      return;
    }
    await streamPhoto(req.params.id, position, res);
  },
);

// Backward-compat: /photos/<id> (no position) → position 1.
photosRouter.get<{ id: string }>('/photos/:id', async (req, res) => {
  await streamPhoto(req.params.id, 1, res);
});

router.get('/gmap', async (_req, res) => {
  const rows = await queryAll<FriendRow>(
    `SELECT ${SELECT_FRIEND_COLS} FROM friends ORDER BY rank`,
  );
  const geocoded: GeoFriend[] = [];
  const ungeocodedIds: string[] = [];
  const addrById = new Map<string, { street: string; postcode: string; city: string }>();
  for (const row of rows) {
    addrById.set(row.id, { street: row.street, postcode: row.postcode, city: row.city });
    if (row.lat != null && row.lon != null) {
      geocoded.push({ id: row.id, name: row.name, lat: row.lat, lon: row.lon, area: row.area });
    } else {
      ungeocodedIds.push(row.id);
    }
  }
  // Load cached OSRM road distances.
  const cacheRows = await queryAll<{ id_a: string; id_b: string; distance_meters: number }>(
    `SELECT id_a, id_b, distance_meters FROM gmap_route_cache`,
  );
  const routeCache = new Map<string, number>();
  for (const row of cacheRows) {
    routeCache.set(cacheKey(row.id_a, row.id_b), row.distance_meters);
  }

  const { pairs, unpairedIds } = computePairs(geocoded, routeCache);
  const gLessIds = [...unpairedIds, ...ungeocodedIds];

  const dtoPairs = pairs.map(p => ({
    rank: p.rank,
    proximity: p.proximity,
    proximityLabel: p.proximityLabel,
    proximityColor: p.proximityColor,
    emoji: p.emoji,
    friends: p.friendIds,
    distanceMeters: Math.round(p.distanceMeters),
    distanceLabel: p.distanceLabel,
    area: p.area,
    mapsUrl: buildMapsUrl(addrById.get(p.friendIds[0])!, addrById.get(p.friendIds[1])!),
  }));

  res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  res.json({
    pairs: dtoPairs,
    gLessIds,
    pending: ungeocodedIds.length > 0,
    geocodedCount: geocoded.length,
    totalCount: rows.length,
  });
});

router.get('/predictions', async (_req, res) => {
  const rows = await queryAll<PredictionRow>(
    `SELECT ${SELECT_PREDICTION_COLS} FROM predictions ORDER BY created_at DESC, id DESC`,
  );
  res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  res.json(rows.map(toPredictionDto));
});

router.post('/predictions', async (req, res) => {
  const body = req.body as { guesser?: unknown; friendId?: unknown; text?: unknown };
  const guesser = typeof body.guesser === 'string' ? body.guesser.trim() : '';
  const friendId = typeof body.friendId === 'string' ? body.friendId : '';
  const text = typeof body.text === 'string' ? body.text.trim() : '';

  if (!guesser) { res.status(400).json({ error: 'skriv ditt namn' }); return; }
  if (!friendId) { res.status(400).json({ error: 'välj en person' }); return; }
  if (text.length < 5) { res.status(400).json({ error: 'skriv en riktig gissning!' }); return; }

  const exists = await queryOne<{ one: 1 }>('SELECT 1 AS one FROM friends WHERE id = ?', [friendId]);
  if (!exists) { res.status(400).json({ error: 'unknown friend' }); return; }

  const guessCount = await queryOne<{ n: number }>(
    `SELECT COUNT(*) AS n FROM predictions WHERE LOWER(guesser_name) = LOWER(?)`,
    [guesser],
  );
  if ((guessCount?.n ?? 0) >= 3) {
    res.status(400).json({ error: 'max 3 gissningar per person' });
    return;
  }

  const result = await exec(
    `INSERT INTO predictions (guesser_name, friend_id, prediction_text)
     VALUES (?, ?, ?)`,
    [guesser, friendId, text],
  );
  res.status(201).json(await getPredictionDto(result.lastInsertRowid));
});

router.delete<{ id: string }>('/predictions/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: 'invalid id' }); return; }
  const existing = await getPredictionDto(id);
  if (!existing) { res.status(404).json({ error: 'prediction not found' }); return; }
  await exec('DELETE FROM predictions WHERE id = ?', [id]);
  res.json({ ok: true });
});

router.patch<{ id: string }>('/predictions/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: 'invalid id' }); return; }
  const existing = await getPredictionDto(id);
  if (!existing) { res.status(404).json({ error: 'prediction not found' }); return; }
  const body = req.body as { correct?: unknown };
  if (typeof body.correct !== 'boolean') {
    res.status(400).json({ error: 'correct must be a boolean' });
    return;
  }
  await exec('UPDATE predictions SET marked_correct = ? WHERE id = ?', [body.correct ? 1 : 0, id]);
  res.json(await getPredictionDto(id));
});

// ── Site content (CMS key-value store) ───────────────────────────────

router.get('/content', async (_req, res) => {
  const rows = await queryAll<{ key: string; value: string }>('SELECT key, value FROM site_content');
  const obj: Record<string, string> = {};
  for (const r of rows) obj[r.key] = r.value;
  res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  res.json(obj);
});

router.patch<{ key: string }>('/content/:key', requireAdmin, async (req, res) => {
  const key = req.params.key;
  const body = req.body as { value?: unknown };
  if (typeof body.value !== 'string') { res.status(400).json({ error: 'value must be a string' }); return; }
  await exec(
    `INSERT INTO site_content (key, value) VALUES (?, ?)
     ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    [key, body.value.trim()],
  );
  res.json({ key, value: body.value.trim() });
});
