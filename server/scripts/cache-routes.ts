// Fetches road distances for all geocoded friend pairs from the OSRM demo API
// and caches them in gmap_route_cache. Safe to re-run — uses INSERT OR REPLACE.
//
// Usage: npx tsx server/scripts/cache-routes.ts
// (needs TURSO_DATABASE_URL + TURSO_AUTH_TOKEN in env, or .env.local)

import { createClient } from '@libsql/client';
import { cacheKey } from '../lib/gmap';

const OSRM = 'https://router.project-osrm.org/route/v1/driving';
const DELAY_MS = 300; // respect rate limits on the public demo server

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function fetchRouteMeters(
  latA: number, lonA: number,
  latB: number, lonB: number,
): Promise<number | null> {
  const url = `${OSRM}/${lonA},${latA};${lonB},${latB}?overview=false`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) { console.warn(`  OSRM ${res.status}: ${url}`); return null; }
  const json = await res.json() as { code: string; routes?: { distance: number }[] };
  if (json.code !== 'Ok' || !json.routes?.length) { console.warn('  OSRM no route'); return null; }
  return json.routes[0].distance;
}

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  const rows = await db.execute(
    'SELECT id, name, lat, lon FROM friends WHERE lat IS NOT NULL AND lon IS NOT NULL ORDER BY rank',
  );
  const friends = rows.rows as unknown as { id: string; name: string; lat: number; lon: number }[];
  console.log(`${friends.length} geocoded friends — computing ${(friends.length * (friends.length - 1)) / 2} pairs`);

  let cached = 0;
  let skipped = 0;
  for (let i = 0; i < friends.length; i++) {
    for (let j = i + 1; j < friends.length; j++) {
      const a = friends[i];
      const b = friends[j];
      const key = cacheKey(a.id, b.id);
      const [idA, idB] = key.split('|');

      // Skip if already cached.
      const existing = await db.execute({
        sql: 'SELECT 1 FROM gmap_route_cache WHERE id_a = ? AND id_b = ?',
        args: [idA, idB],
      });
      if (existing.rows.length > 0) { skipped++; continue; }

      process.stdout.write(`  ${a.name} ↔ ${b.name} … `);
      const meters = await fetchRouteMeters(a.lat, a.lon, b.lat, b.lon);
      if (meters == null) { console.log('failed'); continue; }

      await db.execute({
        sql: `INSERT OR REPLACE INTO gmap_route_cache (id_a, id_b, distance_meters)
              VALUES (?, ?, ?)`,
        args: [idA, idB, meters],
      });
      console.log(`${(meters / 1000).toFixed(1)} km`);
      cached++;
      await sleep(DELAY_MS);
    }
  }
  console.log(`\nDone — ${cached} new, ${skipped} already cached.`);
  await db.close();
}

main().catch(err => { console.error(err); process.exit(1); });
