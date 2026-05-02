CREATE TABLE IF NOT EXISTS gmap_route_cache (
  id_a           TEXT NOT NULL,
  id_b           TEXT NOT NULL,
  distance_meters REAL NOT NULL,
  fetched_at     TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (id_a, id_b)
);
