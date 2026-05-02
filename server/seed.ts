// First-boot seed: populate the friends table from src/data/friends.ts and
// store every embedded base64 photo from src/data/initialPhotos.ts as the
// position-1 photo in friend_photos. Subsequent boots skip if friends has
// rows. Photo data goes to friend_photos (post-Phase-4 schema).

import { FRIENDS } from '../src/data/friends';
import { INITIAL_PHOTOS } from '../src/data/initialPhotos';
import { db, queryOne } from './db';
import { decodeDataUrl } from './lib/photos';

export async function seedIfEmpty(): Promise<void> {
  const row = await queryOne<{ n: number }>('SELECT COUNT(*) AS n FROM friends');
  if (row && row.n >= FRIENDS.length) return;

  const tx = await db.transaction('write');
  try {
    for (const friend of FRIENDS) {
      await tx.execute({
        sql: `INSERT OR IGNORE INTO friends (id, name, rank, tier, street, postcode, city, note)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          friend.id,
          friend.name,
          friend.rank,
          friend.tier,
          friend.address.street,
          friend.address.postcode,
          friend.address.city,
          friend.note,
        ],
      });
      const dataUrl = INITIAL_PHOTOS[friend.id];
      const decoded = dataUrl ? decodeDataUrl(dataUrl) : null;
      if (decoded) {
        const mime = `image/${decoded.ext === 'jpg' ? 'jpeg' : decoded.ext}`;
        await tx.execute({
          sql: `INSERT OR IGNORE INTO friend_photos (friend_id, position, photo_data, photo_mime)
                VALUES (?, 1, ?, ?)`,
          args: [friend.id, new Uint8Array(decoded.bytes), mime],
        });
      }
    }
    await tx.commit();
  } catch (err) {
    await tx.rollback();
    throw err;
  }
  console.log(`[db] seeded ${FRIENDS.length} friends`);
}
