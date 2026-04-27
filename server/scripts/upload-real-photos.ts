// One-shot: convert HEIC → JPEG with sips, upload real photos to DB, fill to 3 with SVGs.
// Run with: npx tsx server/scripts/upload-real-photos.ts
// Safe to re-run: clears all existing photos per friend before inserting.

import { execSync } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, extname } from 'node:path';
import { db, queryAll } from '../db.js';

const PHOTOS_DIR = `${process.env.HOME}/Downloads/Claude grejer`;
const TMP_DIR = '/tmp/viber-photos-converted';

// Map: friend_id → filenames in PHOTOS_DIR (in carousel order).
// Paths without extension will be tried as-is + common extensions.
const FRIEND_PHOTOS: Record<string, string[]> = {
  mario:    ['Mario.PNG'],
  adam:     ['Adam.JPG', 'Adam 2.JPG'],
  emanuel:  ['Emanuel.HEIC'],
  andre:    ['Andre suli.jpeg', 'Andre suli 2.JPG', 'Andre suli 3.JPG'],
  gab:      ['Gab.HEIC'],
  john:     ['John.JPG'],
  robin:    ['Robin.HEIC'],
  ninos:    ['Ninos.JPG'],
  joseph:   ['Joseph.JPG'],
  fredrik:  ['Fredrik.HEIC'],
  ninmar:   ['Ninmar.jpg'],
  jovo:     ['Jovo.JPG'],
  christian:['Christian.jpg'],
  // jacob, joel, george have no real photos — SVG placeholders only
};

const TIER_PALETTE: Record<string, { from: string; to: string; ink: string }> = {
  s: { from: '#f1d489', to: '#b8892a', ink: '#3a2807' },
  a: { from: '#f4a585', to: '#c25a2a', ink: '#3a1707' },
  i: { from: '#bfb6e8', to: '#6e5fc1', ink: '#1f1646' },
};

function makeSvg(opts: { initial: string; rank: number; tier: string; variant: number }) {
  const p = TIER_PALETTE[opts.tier] ?? TIER_PALETTE['i'];
  const angles = ['0% 0%, 100% 100%', '100% 0%, 0% 100%', '50% 0%, 50% 100%'];
  const [xy1, xy2] = (angles[opts.variant % angles.length]).split(', ');
  const focal = opts.variant === 0
    ? opts.initial.toUpperCase()
    : `#${opts.rank}`;
  const fontSize = opts.variant === 0 ? 360 : 240;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
  <defs>
    <linearGradient id="g" x1="${xy1}" x2="${xy2}">
      <stop offset="0%" stop-color="${p.from}"/>
      <stop offset="100%" stop-color="${p.to}"/>
    </linearGradient>
    <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.06 0"/></filter>
  </defs>
  <rect width="600" height="600" fill="url(#g)"/>
  <rect width="600" height="600" filter="url(#grain)"/>
  <text x="50%" y="52%" font-family="Georgia,serif" font-size="${fontSize}" font-weight="900" fill="${p.ink}" text-anchor="middle" dominant-baseline="middle" font-style="italic" opacity="0.9">${focal}</text>
  <text x="50%" y="93%" font-family="-apple-system,sans-serif" font-size="22" font-weight="700" letter-spacing="0.32em" fill="${p.ink}" text-anchor="middle" opacity="0.55">${opts.initial.toUpperCase()} · TOPP 16</text>
</svg>`;
}

function convertToJpeg(srcPath: string): Buffer {
  const ext = extname(srcPath).toLowerCase();
  if (ext === '.heic') {
    mkdirSync(TMP_DIR, { recursive: true });
    const out = join(TMP_DIR, `${Date.now()}.jpg`);
    execSync(`sips -s format jpeg "${srcPath}" --out "${out}"`, { stdio: 'pipe' });
    const buf = readFileSync(out);
    rmSync(out, { force: true });
    return buf;
  }
  return readFileSync(srcPath);
}

function mimeFor(filename: string): string {
  const ext = extname(filename).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.svg') return 'image/svg+xml';
  return 'image/jpeg';
}

interface FriendRow { id: string; name: string; rank: number; tier: string; }

async function main() {
  const friends = await queryAll<FriendRow>(
    'SELECT id, name, rank, tier FROM friends ORDER BY rank',
  );

  for (const f of friends) {
    console.log(`\n[${f.rank}] ${f.name} (${f.id})`);

    // Clear existing photos.
    await db.execute({ sql: 'DELETE FROM friend_photos WHERE friend_id = ?', args: [f.id] });

    const realFiles = FRIEND_PHOTOS[f.id] ?? [];
    let position = 1;

    // Upload real photos (up to 3).
    for (const filename of realFiles.slice(0, 3)) {
      const fullPath = join(PHOTOS_DIR, filename);
      if (!existsSync(fullPath)) {
        console.log(`  ⚠ Not found: ${filename}`);
        continue;
      }
      const ext = extname(filename).toLowerCase();
      const isHeic = ext === '.heic';
      const data = convertToJpeg(fullPath);
      const mime = isHeic ? 'image/jpeg' : mimeFor(filename);
      await db.execute({
        sql: 'INSERT INTO friend_photos (friend_id, position, photo_data, photo_mime) VALUES (?, ?, ?, ?)',
        args: [f.id, position, data, mime],
      });
      console.log(`  ✓ position ${position}: ${filename}${isHeic ? ' (converted)' : ''}`);
      position++;
    }

    // Fill up to 3 with SVG placeholders.
    let svgVariant = 0;
    while (position <= 3) {
      const body = makeSvg({ initial: f.name[0], rank: f.rank, tier: f.tier, variant: svgVariant });
      const bytes = new TextEncoder().encode(body);
      await db.execute({
        sql: 'INSERT INTO friend_photos (friend_id, position, photo_data, photo_mime) VALUES (?, ?, ?, ?)',
        args: [f.id, position, bytes, 'image/svg+xml'],
      });
      console.log(`  + position ${position}: SVG placeholder (variant ${svgVariant})`);
      position++;
      svgVariant++;
    }
  }

  console.log('\n✅ All done — every friend now has exactly 3 photos.');
  await db.close?.();
}

main().then(
  () => process.exit(0),
  (err) => { console.error(err); process.exit(1); },
);
