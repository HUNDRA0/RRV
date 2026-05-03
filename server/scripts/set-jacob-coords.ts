import { db } from '../db';
// Östertälje station, Södertälje
const lat = 59.18067, lon = 17.65140;
await db.execute({
  sql: `UPDATE friends SET lat = ?, lon = ?, area = ? WHERE id = 'jacob'`,
  args: [lat, lon, 'Östertälje'],
});
// Invalidate cached routes for Jacob so OSRM redoes them
await db.execute({
  sql: `DELETE FROM gmap_route_cache WHERE id_a = 'jacob' OR id_b = 'jacob'`,
});
console.log('Jacob set to Östertälje station');
