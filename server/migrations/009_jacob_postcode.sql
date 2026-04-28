-- Fix Jacob's postcode (geocoder had 15255, correct is 15257).
-- lat/lon stay as-is; use the coord editor in admin mode to set exact values.

UPDATE friends SET postcode = '15257' WHERE id = 'jacob';
