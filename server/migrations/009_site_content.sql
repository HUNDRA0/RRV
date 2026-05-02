CREATE TABLE IF NOT EXISTS site_content (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO site_content (key, value) VALUES
  ('masthead.sub',   'Den officiella inrekretsens topp 16 — från eliten till tveksamt'),
  ('moves.sub',      'Vad ska din kille göra i år? Lägg din gissning — resultaten avslöjas vid årets slut. Den som gissade rätt blir Champion.'),
  ('gmap.sub',       'Alla 16 personer parade ihop baserat på närmaste granne — riktiga avstånd från geokodade adresser. Klicka på kartlänken för att se rutten via Google Maps.'),
  ('footer.tagline', 'Alla rankingar är slutgiltiga · Vol. I');
