// Phase 2: friend records now come from the API — `FRIENDS` here is only the
// seed source for the SQLite database (imported by server/seed.ts). Client
// code reads the live list via useFriendsList() instead. Tier metadata, G Map
// pairings, and G Less stay local because they're static UI configuration.

export type TierId = string;

export interface Tier {
  id: TierId;
  letter: string;       // big right-side letter shown in the tier header ('S' / 'A' / '?')
  kicker: string;       // small uppercase line above the title ('Tier One' …)
  title: string;        // big tier-section title ('The Eliten' / 'Normal People' / 'I Dunno')
  cardLabel: string;    // sublabel under each person card
  pickerLabel: string;  // shorter label used in the Moves dropdown
}

export const TIERS: Record<TierId, Tier> = {
  s: { id: 's', letter: 'S', kicker: 'Tier One',   title: 'The Eliten',    cardLabel: 'Eliten',        pickerLabel: 'Eliten'  },
  // NOTE: prototype shows "Normal People" on cards but "Normal" in the moves dropdown.
  a: { id: 'a', letter: 'A', kicker: 'Tier Two',   title: 'Normal People', cardLabel: 'Normal People', pickerLabel: 'Normal'  },
  i: { id: 'i', letter: '?', kicker: 'Tier Three', title: 'I Dunno',       cardLabel: 'I Dunno',       pickerLabel: 'I Dunno' },
};

export const TIER_ORDER: TierId[] = ['s', 'a', 'i'];

export interface Address {
  street: string;     // e.g. 'Bangatan 28'
  postcode: string;   // e.g. '15132'
  city: string;       // e.g. 'Södertälje'
}

// Seed-time shape (no photoUrl — server fills that in from INITIAL_PHOTOS).
export interface FriendSeed {
  id: string;
  name: string;
  rank: number;        // 1–15, drives the "#N" badge on each card
  tier: TierId;
  address: Address;
  note: string;        // empty for most; one preset note in the prototype (Joseph)
}

// Runtime shape, returned by GET /api/friends. lat/lon/area come from the
// Phase 3 geocoder (npm run geocode) and are null until that's been run.
// `photos` is the carousel-friendly array; `photoUrl` is the first photo's
// URL kept around for places (avatar tiles, G Map cards) that only want one.
export interface FriendPhoto {
  url: string;
  position: number;
}
export interface Friend extends FriendSeed {
  photoUrl: string | null;
  photos: FriendPhoto[];
  bio: string;
  currentMove: string;
  lat: number | null;
  lon: number | null;
  area: string | null;
}

// Used only by server/seed.ts to populate the friends table on a fresh DB.
// Client code reads the live list via useFriendsList() — do not import this
// from the React app.
export const FRIENDS: FriendSeed[] = [
  // S tier — Eliten
  { id: 'mario',     name: 'Mario',     rank: 1,  tier: 's', address: { street: 'Mariekällgatan 36',  postcode: '15144', city: 'Södertälje' }, note: '' },
  { id: 'adam',      name: 'Adam',      rank: 2,  tier: 's', address: { street: 'Dalgatan 23',        postcode: '15133', city: 'Södertälje' }, note: '' },
  { id: 'emanuel',   name: 'Emanuel',   rank: 3,  tier: 's', address: { street: 'Bangatan 28',        postcode: '15132', city: 'Södertälje' }, note: '' },
  { id: 'fredrik',   name: 'Fredrik',   rank: 4,  tier: 's', address: { street: 'Drejarvägen 18',     postcode: '15162', city: 'Södertälje' }, note: '' },
  { id: 'gab',       name: 'Gab',       rank: 5,  tier: 's', address: { street: 'Handbollsvägen 5',   postcode: '15159', city: 'Södertälje' }, note: '' },
  // A tier — Normal People
  { id: 'john',      name: 'John',      rank: 6,  tier: 'a', address: { street: 'Drejarvägen 24',     postcode: '15162', city: 'Södertälje' }, note: '' },
  { id: 'jacob',     name: 'Jacob',     rank: 7,  tier: 'a', address: { street: 'Hyvelgränd 1',       postcode: '15257', city: 'Södertälje' }, note: '' },
  { id: 'robin',     name: 'Robin',     rank: 8,  tier: 'a', address: { street: 'Åsbovägen 99',       postcode: '15252', city: 'Södertälje' }, note: '' },
  { id: 'ninos',     name: 'Ninos',     rank: 9,  tier: 'a', address: { street: 'Bollvägen 67',       postcode: '15159', city: 'Södertälje' }, note: '' },
  // I tier — I Dunno
  { id: 'joseph',    name: 'Joseph',    rank: 10, tier: 'i', address: { street: 'Slungbollsvägen 3',  postcode: '15159', city: 'Södertälje' }, note: 'Hänger ej med oss' },
  { id: 'andre',     name: 'Andre',     rank: 11, tier: 'i', address: { street: 'Bangatan 28',        postcode: '15132', city: 'Södertälje' }, note: '' },
  { id: 'ninmar',    name: 'Ninmar',    rank: 12, tier: 'i', address: { street: 'Hövdingevägen 1',    postcode: '15151', city: 'Södertälje' }, note: '' },
  { id: 'jovo',      name: 'Jovo',      rank: 13, tier: 'i', address: { street: 'Mosshagestigen 212', postcode: '',      city: 'Rönninge'   }, note: '' },
  { id: 'christian', name: 'Christian', rank: 14, tier: 'i', address: { street: 'Gamla enhörnavägen 12', postcode: '15152', city: 'Södertälje' }, note: '' },
  { id: 'joel',      name: 'Joel',      rank: 15, tier: 'i', address: { street: 'Alice Tegnérs stig 33', postcode: '15156', city: 'Södertälje' }, note: '' },
  { id: 'george',    name: 'Gogo',      rank: 16, tier: 'i', address: { street: 'Slungbollsvägen 14', postcode: '15159', city: 'Södertälje' }, note: '' },
];

// G Map pairings used to be hand-curated here. Phase 3 made them dynamic:
// the server geocodes addresses and computes pairs greedily by haversine
// distance. The client fetches the result via /api/gmap (see src/lib/api.ts
// and useFriendsList().gmap).
