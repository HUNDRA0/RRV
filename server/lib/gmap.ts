// Distance computation + greedy pairing for the G Map page.
//
// Given a list of friends with lat/lon, we compute every pairwise distance
// (using cached OSRM road distances where available, haversine otherwise),
// sort closest-first, and pick pairs greedily. Pairs farther than
// MAX_PAIR_METERS are treated as G-less (no meaningful proximity).

export interface GeoFriend {
  id: string;
  name: string;
  lat: number;
  lon: number;
  area: string | null;
}

export interface ComputedPair {
  rank: number;                                                            // 1..N by distance
  proximity: 'legendary' | 'close' | 'mid' | 'far' | 'veryfar';
  proximityLabel: string;                                                  // 'Samma adress', 'Grannar', …
  proximityColor: string;
  emoji: string;
  friendIds: [string, string];
  distanceMeters: number;
  distanceLabel: string;                                                   // '367 m' or '1.2 km'
  area: string;                                                            // composed from each friend's area
}

const EARTH_R_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

// Haversine — great-circle distance between two lat/lon points, in meters.
export function distanceMeters(a: GeoFriend, b: GeoFriend): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_R_M * Math.asin(Math.sqrt(h));
}

export function formatDistance(meters: number): string {
  if (meters < 50) return 'Samma adress';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

interface ProximityBucket {
  proximity: ComputedPair['proximity'];
  label: string;
  color: string;
  emoji: string;
}

// Buckets carry the descriptive Swedish label + the color that the prototype
// used. We keep the human label for flavor and append the actual distance.
function bucket(meters: number): ProximityBucket {
  if (meters < 50)    return { proximity: 'legendary', label: 'Samma adress',    color: '#FFD700', emoji: '👑' };
  if (meters < 250)   return { proximity: 'close',     label: 'Grannar',         color: '#3ecfb0', emoji: '🏠' };
  if (meters < 800)   return { proximity: 'close',     label: 'Granngator',      color: '#3ecfb0', emoji: '🏠' };
  if (meters < 2500)  return { proximity: 'mid',       label: 'Promenadavstånd', color: '#FF9955', emoji: '🚶' };
  if (meters < 6000)  return { proximity: 'far',       label: 'Olika stadsdelar', color: '#f87171', emoji: '🚗' };
  return                     { proximity: 'veryfar',   label: 'Tvärs över stan',  color: '#f87171', emoji: '🚗' };
}

function composeArea(a: GeoFriend, b: GeoFriend): string {
  if (a.area && b.area && a.area === b.area) return a.area;
  if (a.area && b.area) return `${a.area} → ${b.area}`;
  return a.area ?? b.area ?? '';
}

// Pairs farther than this are considered G-less (no meaningful proximity).
const MAX_PAIR_METERS = 25_000;

// cacheKey returns a consistent lookup key regardless of argument order.
export function cacheKey(idA: string, idB: string): string {
  return idA < idB ? `${idA}|${idB}` : `${idB}|${idA}`;
}

export function computePairs(
  friends: GeoFriend[],
  routeCache: Map<string, number> = new Map(),
): {
  pairs: ComputedPair[];
  unpairedIds: string[];
} {
  if (friends.length < 2) {
    return { pairs: [], unpairedIds: friends.map(f => f.id) };
  }

  // Build all pairwise distances, preferring cached OSRM over haversine.
  type Entry = { a: GeoFriend; b: GeoFriend; m: number };
  const all: Entry[] = [];
  for (let i = 0; i < friends.length; i++) {
    for (let j = i + 1; j < friends.length; j++) {
      const key = cacheKey(friends[i].id, friends[j].id);
      const m = routeCache.get(key) ?? distanceMeters(friends[i], friends[j]);
      all.push({ a: friends[i], b: friends[j], m });
    }
  }
  all.sort((x, y) => x.m - y.m);

  const taken = new Set<string>();
  const pairs: ComputedPair[] = [];
  const gLessFromDistance: string[] = [];

  for (const { a, b, m } of all) {
    if (taken.has(a.id) || taken.has(b.id)) continue;
    // If they're farther than the cutoff, both become G-less; stop pairing them.
    if (m > MAX_PAIR_METERS) {
      if (!taken.has(a.id)) gLessFromDistance.push(a.id);
      if (!taken.has(b.id)) gLessFromDistance.push(b.id);
      taken.add(a.id);
      taken.add(b.id);
      continue;
    }
    taken.add(a.id);
    taken.add(b.id);
    const buck = bucket(m);
    pairs.push({
      rank: pairs.length + 1,
      proximity: buck.proximity,
      proximityLabel: buck.label,
      proximityColor: buck.color,
      emoji: buck.emoji,
      friendIds: [a.id, b.id],
      distanceMeters: m,
      distanceLabel: formatDistance(m),
      area: composeArea(a, b),
    });
  }
  const unpairedIds = [
    ...friends.filter(f => !taken.has(f.id)).map(f => f.id),
    ...gLessFromDistance,
  ];
  return { pairs, unpairedIds };
}

// Build a Google Maps directions URL between two friends' addresses. We pass
// addresses (rather than lat/lon) because the rendered "directions" link is
// nicer to read.
export function buildMapsUrl(addrA: { street: string; postcode: string; city: string }, addrB: typeof addrA): string {
  const enc = (a: typeof addrA) =>
    encodeURIComponent(`${a.street}, ${a.postcode} ${a.city}`.replace(/\s+/g, ' ').trim());
  return `https://www.google.com/maps/dir/${enc(addrA)}/${enc(addrB)}`;
}
