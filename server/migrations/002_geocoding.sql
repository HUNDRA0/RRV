-- Phase 3: real geocoding on the G Map page.
--
-- lat/lon are nullable because friends start un-geocoded. The geocode script
-- (npm run geocode) hits Nominatim once per address and fills these in. The
-- /api/gmap endpoint computes pairings on the fly from these coordinates.

ALTER TABLE friends ADD COLUMN lat REAL;
ALTER TABLE friends ADD COLUMN lon REAL;
ALTER TABLE friends ADD COLUMN area TEXT;          -- e.g. "Saltskog, Södertälje" — from reverse geocoding
ALTER TABLE friends ADD COLUMN geocoded_at TEXT;   -- ISO timestamp of last successful geocode
