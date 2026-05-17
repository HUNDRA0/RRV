// One-shot geocoder. Reads every friend whose lat/lon is NULL, queries
// Nominatim (OpenStreetMap's free geocoder — no API key, 1 req/sec policy),
// and writes the result back to the friends table. Run via:
//
//   npm run geocode           — geocode the missing ones
//   npm run geocode -- --all  — re-geocode every friend, even ones already done
//
// Nominatim TOS: https://operations.osmfoundation.org/policies/nominatim/
// We respect the rate limit by sleeping 1.1s between requests and identify
// ourselves with a clear User-Agent.

import { db, queryAll } from '../db';

const USER_AGENT = 'friendslist-app/1.0 (private friend tier-list, contact: localhost)';
const NOMINATIM = 'https://nominatim.openstreetmap.org';

interface FriendRow {
  id: string;
  name: string;
  street: string;
  postcode: string;
  city: string;
  lat: number | null;
  lon: number | null;
}

interface GeocodeHit {
  lat: number;
  lon: number;
  area: string | null;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function nominatimSearch(query: string): Promise<GeocodeHit | null> {
  const url = `${NOMINATIM}/search?${new URLSearchParams({
    q: query,
    format: 'json',
    addressdetails: '1',
    limit: '1',
    countrycodes: 'se',
  })}`;
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'sv,en' } });
  if (!res.ok) {
    throw new Error(`Nominatim ${res.status} ${res.statusText} for "${query}"`);
  }
  const json = (await res.json()) as Array<{
    lat: string;
    lon: string;
    address?: Record<string, string | undefined>;
  }>;
  if (json.length === 0) return null;
  const hit = json[0];
  // Nominatim returns several address fields; pick the most-specific
  // neighborhood-ish one we have, falling back to suburb / town / city.
  const a = hit.address ?? {};
  const neighborhood =
    a.neighbourhood ??
    a.suburb ??
    a.quarter ??
    a.city_district ??
    a.residential ??
    a.borough ??
    a.town ??
    a.village ??
    a.city ??
    null;
  return {
    lat: Number(hit.lat),
    lon: Number(hit.lon),
    area: neighborhood ?? null,
  };
}

async function main(): Promise<void> {
  const reGeocodeAll = process.argv.includes('--all');
  const where = reGeocodeAll ? '' : 'WHERE lat IS NULL OR lon IS NULL';
  const rows = await queryAll<FriendRow>(
    `SELECT id, name, street, postcode, city, lat, lon FROM friends ${where} ORDER BY rank`,
  );

  if (rows.length === 0) {
    console.log('Nothing to geocode. Use --all to force re-geocoding.');
    return;
  }

  console.log(`Geocoding ${rows.length} friend${rows.length === 1 ? '' : 's'} via Nominatim…`);

  let success = 0;
  let failed: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const friend = rows[i];
    const query = `${friend.street}, ${friend.postcode} ${friend.city}, Sweden`;
    process.stdout.write(`  [${i + 1}/${rows.length}] ${friend.name.padEnd(10)} ← `);
    try {
      const hit = await nominatimSearch(query);
      if (!hit) {
        console.log('NO MATCH');
        failed.push(friend.id);
      } else {
        await db.execute({
          sql: `UPDATE friends
                SET lat = ?, lon = ?, area = ?, updated_at = datetime('now')
                WHERE id = ?`,
          args: [hit.lat, hit.lon, hit.area, friend.id],
        });
        console.log(`(${hit.lat.toFixed(5)}, ${hit.lon.toFixed(5)}) — ${hit.area ?? '(no area)'}`);
        success++;
      }
    } catch (err) {
      console.log(`ERROR: ${err instanceof Error ? err.message : err}`);
      failed.push(friend.id);
    }
    if (i < rows.length - 1) await sleep(1100); // Nominatim TOS: 1 req/sec max
  }

  console.log(`\nDone. ${success}/${rows.length} geocoded.`);
  if (failed.length > 0) console.log(`Failed: ${failed.join(', ')}`);
}

main().then(
  () => process.exit(0),
  err => { console.error(err); process.exit(1); },
);
