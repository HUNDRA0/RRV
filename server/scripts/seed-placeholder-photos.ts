// One-shot: ensure every friend has ≥ 2 photos by appending SVG placeholders.
// Each placeholder is a tier-colored gradient with the friend's initial (variant A)
// or rank number (variant B). Stored as image/svg+xml in friend_photos.
//
// Run with: npm run seed-placeholders
// Idempotent: skips a friend that already has 2+ photos.

import { db, queryAll } from '../db';

interface Row {
  id: string;
  name: string;
  rank: number;
  tier: 's' | 'a' | 'i';
  photo_count: number;
}

const TIER_PALETTE: Record<'s' | 'a' | 'i', { from: string; to: string; ink: string }> = {
  s: { from: '#f1d489', to: '#b8892a', ink: '#3a2807' },
  a: { from: '#f4a585', to: '#c25a2a', ink: '#3a1707' },
  i: { from: '#bfb6e8', to: '#6e5fc1', ink: '#1f1646' },
};

function svg(opts: { initial: string; rank: number; tier: 's' | 'a' | 'i'; variant: 'A' | 'B' }) {
  const p = TIER_PALETTE[opts.tier];
  const focal = opts.variant === 'A' ? opts.initial.toUpperCase() : `#${opts.rank}`;
  // Variant B flips the gradient angle so the two photos read as visibly different.
  const grad = opts.variant === 'A'
    ? `<linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${p.from}"/><stop offset="100%" stop-color="${p.to}"/></linearGradient>`
    : `<linearGradient id="g" x1="100%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="${p.to}"/><stop offset="100%" stop-color="${p.from}"/></linearGradient>`;
  const fontSize = opts.variant === 'A' ? 360 : 240;
  // Subtle paper grain via a feTurbulence overlay so the placeholders feel
  // intentional, not flat-color filler.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
  <defs>
    ${grad}
    <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.06 0"/></filter>
  </defs>
  <rect width="600" height="600" fill="url(#g)"/>
  <rect width="600" height="600" filter="url(#grain)"/>
  <text x="50%" y="55%" font-family="Georgia, 'Playfair Display', serif" font-size="${fontSize}" font-weight="900" fill="${p.ink}" text-anchor="middle" dominant-baseline="middle" font-style="italic" opacity="0.92">${focal}</text>
  <text x="50%" y="93%" font-family="-apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif" font-size="22" font-weight="700" letter-spacing="0.32em" fill="${p.ink}" text-anchor="middle" opacity="0.55">${opts.initial.toUpperCase()} · TOPP 16</text>
</svg>`;
}

async function main() {
  // Pull each friend's current photo count.
  const rows = await queryAll<Row>(`
    SELECT f.id, f.name, f.rank, f.tier,
           COALESCE(COUNT(p.id), 0) AS photo_count
    FROM friends f
    LEFT JOIN friend_photos p ON p.friend_id = f.id
    GROUP BY f.id
    ORDER BY f.rank
  `);

  let added = 0;
  for (const friend of rows) {
    if (friend.photo_count >= 2) {
      console.log(`  [${friend.rank}] ${friend.name.padEnd(10)} → already ${friend.photo_count} photo(s), skipping`);
      continue;
    }

    // Determine which variants we still need. If the friend has 0 photos, add A and B.
    // If they have 1, add only A.
    const variants: Array<'A' | 'B'> = friend.photo_count === 0 ? ['A', 'B'] : ['A'];
    let nextPos = friend.photo_count + 1;
    for (const v of variants) {
      const body = svg({ initial: friend.name[0], rank: friend.rank, tier: friend.tier, variant: v });
      const bytes = new TextEncoder().encode(body);
      await db.execute({
        sql: `INSERT INTO friend_photos (friend_id, position, photo_data, photo_mime)
              VALUES (?, ?, ?, ?)`,
        args: [friend.id, nextPos, bytes, 'image/svg+xml'],
      });
      console.log(`  [${friend.rank}] ${friend.name.padEnd(10)} ← variant ${v} at position ${nextPos}`);
      nextPos += 1;
      added += 1;
    }
  }

  console.log(`\nDone. Added ${added} placeholder photo(s).`);
}

main().then(
  () => process.exit(0),
  err => { console.error(err); process.exit(1); },
);
