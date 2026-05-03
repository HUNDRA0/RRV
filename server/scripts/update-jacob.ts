import { db, queryAll } from '../db';
await db.execute({
  sql: `UPDATE friends SET postcode = ?, lat = NULL, lon = NULL, area = NULL WHERE id = ?`,
  args: ['15257', 'jacob'],
});
const rows = await queryAll('SELECT id, postcode, lat, lon FROM friends WHERE id = ?', ['jacob']);
console.log('After update:', rows);
