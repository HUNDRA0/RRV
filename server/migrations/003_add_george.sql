-- Add George (rank 16) to the I Dunno tier. INSERT OR IGNORE so the migration
-- is also safe to run on a fresh DB where the seed has already inserted him.
INSERT OR IGNORE INTO friends (id, name, rank, tier, street, postcode, city, note)
VALUES ('george', 'Gogo', 16, 'i', 'Slungbollsvägen 14', '15159', 'Södertälje', '');
