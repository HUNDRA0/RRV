# Handoff — The Real Rankings

A handoff doc for picking up this project in a new chat. Skim README/ROADMAP/ARCHITECTURE/CLAUDE.md first; this doc covers what's *changed* relative to those plans.

---

## TL;DR — what this app is now

A private friend tier-list site for Jacob's inner circle (16 people).
Three pages: **Rankings**, **Making Moves 2027**, **G Map**.
Light editorial design (cream/ink/gold), a 2-up "showcase" grid, and a click-to-open detail modal with a photo carousel + bio.

- Dev URL: http://localhost:5173 (Vite dev) → proxies `/api` and `/photos` to Express on :3001
- Live data lives in **Turso** (managed SQLite). Nothing app-related is on disk in the project except source code.
- The only secret: `ADMIN_PASSWORD` in `.env.local`, plus `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`.

---

## Where we are vs the ROADMAP

| Roadmap phase | Status |
| --- | --- |
| Phase 0 — prototype | ✅ Preserved at [`prototype/index.html`](prototype/index.html). `npm run prototype` to view. |
| Phase 1 — frontend modernization | ✅ Vite + React 19 + TS + Tailwind v4. All three pages ported with full feature parity. |
| Phase 2 — real backend | ✅ Express + libSQL (Turso). Photos as BLOBs in DB. Admin auth with bearer tokens. |
| Phase 3 — real distances on G Map | ✅ Nominatim geocoder, haversine + greedy pairing. 14/16 friends geocoded. |
| Phase 4 — polish & extras | 🟡 In progress. Light theme, multi-photo per friend, bios, click-to-open modal landed. |
| Phase 5 — deploy | ⏳ Not started. |

---

## What changed last (most recent → oldest)

### Pass C + Modal (just landed — needs visual QA)
- **Site renamed** "FriendsList" / "The Friends List" → **"The Real Rankings"** in all user-facing copy. (Internal hook names like `useFriendsList` kept — internal only, would churn every component.)
- **`friend_photos` table** (migration 004) — multi-photo per friend, BLOBs ordered by `position`. Old single-photo columns dropped. Existing photos forward-migrated.
- **`friends.bio` column** (migration 005) — funny default bios (migration 006) for all 16. Editable in admin mode.
- **2nd placeholder photo per friend** — every friend has ≥2 photos via `npm run seed-placeholders` (Andre had 3 from earlier admin uploads). SVG portraits with initial + tier-color gradient. So the carousel always has something to flip between.
- **`PersonDetailModal`** — clicking any card opens a rectangular modal: photo carousel (← → arrows in-photo, dot indicator, keyboard arrows, Esc closes) on the left, rank + name + bio + meta on the right. Mobile stacks. Esc, backdrop click, X-button all close. Spring-y open animation (`scale 0.96 → 1`, 320 ms, custom ease-out).
- **`PersonCard` simplified** — now a tappable preview (rank, photo, name, sublabel, short bio teaser, "Öppna →" hint on hover). Click anywhere or press Enter/Space → modal.

### Earlier Pass A (cream/ink theme)
- Switched from dark editorial to **warm cream** (`#f7f3eb`) palette. All accents retuned for contrast on light bg. Paper grain at 4 % (multiply blend). Bigger orbs at lower opacity.
- **2-up showcase grid** for Rankings (`repeat(2, minmax(0, 1fr))`).
- Big square photos (~240–280 px) instead of small circles.

### Earlier polish (Emil-design pass)
- Custom easing curves (`--ease-out`, `--ease-in-out`, `--ease-drawer`).
- Press feedback (`scale(0.97)`) on every clickable.
- Stagger entrance (tier sections + G Map pairs).
- `@starting-style` for entries, page-level fade-in on tab switch.
- Marquee ticker strip (per-page tone), magnetic tier letters, giant roman-numeral section markers, film grain overlay.
- `prefers-reduced-motion` strips translation/scale/grain, keeps opacity.

---

## File map

```
.env.local                  ADMIN_PASSWORD + TURSO_*  (gitignored)
.env.example                template
.claude/launch.json         3 dev-server configs (web/api/prototype) for preview_start
HANDOFF.md                  ← this doc
README.md                   high-level overview
ROADMAP.md                  phase plan
ARCHITECTURE.md             prototype's structure (mostly historical now)
CLAUDE.md                   project-wide instructions for Claude

server/
├── index.ts                Express boot + migrations + seed
├── db.ts                   libSQL client + queryAll/queryOne/exec helpers + runMigrations
├── seed.ts                 seedIfEmpty — populates friends + position-1 photos on fresh DB
├── routes.ts               every /api endpoint + photosRouter at root
├── lib/
│   ├── photos.ts           data-URL → bytes decoder
│   └── gmap.ts             haversine + greedy pairing + distance buckets
├── migrations/
│   ├── 001_initial.sql     friends + predictions + admin_sessions
│   ├── 002_geocoding.sql   adds lat/lon/area/geocoded_at to friends
│   ├── 003_add_george.sql  inserts Gogo as friend #16
│   ├── 004_friend_photos.sql  carousel-friendly photos table; drops legacy photo cols
│   ├── 005_bio.sql         adds friends.bio
│   └── 006_default_bios.sql funny defaults for all 16
└── scripts/
    ├── geocode.ts          npm run geocode  (Nominatim, 1.1 s/req)
    └── seed-placeholder-photos.ts  npm run seed-placeholders  (SVG portraits)

src/
├── App.tsx                 page switcher + tickers + roman-numeral markers
├── main.tsx                Provider wrap
├── index.css               ALL the styles (~1 100 lines, single file by design)
├── data/
│   ├── friends.ts          types + TIERS + TIER_ORDER + FRIENDS seed (server only) + helpers
│   └── initialPhotos.ts    base64 of 11 friends' photos (used only by server seed)
├── lib/
│   ├── api.ts              fetch wrappers + DTOs (Friend, ApiPrediction, ApiGMap, …)
│   └── state.tsx           FriendsListProvider + useFriendsList()
└── components/
    ├── BgDecoration.tsx
    ├── TopNav.tsx          nav + login/logout
    ├── Marquee.tsx         continuous ticker, tone-themed per page
    ├── MagneticLetter.tsx  cursor-tracking decorative wrapper
    ├── Masthead.tsx        Rankings page title
    ├── TierSection.tsx     S / A / ? sections
    ├── PersonCard.tsx      ← clean preview, click → modal
    ├── PersonDetailModal.tsx  ← THE NEW THING. Photo carousel + bio + admin edits.
    ├── MovesPage.tsx + MovesSubmitForm + MovesBoard + CountdownBadge
    ├── GMapPage.tsx + GPairCard + GLessCard
    └── …
```

---

## Data model (Turso DB)

```
friends
  id TEXT PK              ('mario', 'george' = Gogo, …)
  name TEXT
  rank INTEGER UNIQUE     1..16
  tier 's' | 'a' | 'i'
  street, postcode, city
  note TEXT               (mostly empty; one preset for Joseph)
  bio TEXT                ← funny default bios
  lat, lon REAL           ← from Nominatim
  area TEXT               ← neighborhood from reverse geocode
  geocoded_at TEXT
  created_at, updated_at

friend_photos             ← carousel data
  id INTEGER PK AUTOINC
  friend_id TEXT REFS friends(id) ON DELETE CASCADE
  position INTEGER        (1-based, unique per friend, repacked on delete)
  photo_data BLOB
  photo_mime TEXT
  uploaded_at TEXT
  UNIQUE (friend_id, position)

predictions
  id INTEGER PK AUTOINC
  guesser_name, friend_id, prediction_text
  marked_correct 0|1
  created_at

admin_sessions
  token TEXT PK           (256 random bits, 7-day TTL)
  created_at, expires_at
```

DTO shape returned by `GET /api/friends`:
```ts
{
  id, name, rank, tier,
  address: { street, postcode, city },
  note, bio,
  photoUrl: '/photos/mario/1?v=…' | null,   // first photo, convenience
  photos: [{ url, position }, …],            // carousel-ready
  lat, lon, area
}
```

---

## API surface (in [server/routes.ts](server/routes.ts))

| Method | Path | Auth | What |
| --- | --- | --- | --- |
| GET | `/api/health` | — | `{ ok, ts, friends }` |
| POST | `/api/admin/login` | — | password → `{ token, expiresAt }` (7 d TTL) |
| POST | `/api/admin/logout` | bearer | invalidate token |
| GET | `/api/admin/check` | bearer | confirm token still valid |
| GET | `/api/friends` | — | rank-ordered friends with photos[] + bio |
| PUT | `/api/friends/:id` | bearer | update `name`, `note`, and/or `bio` |
| POST | `/api/friends/:id/photo` | bearer | dataUrl → append at position max+1 |
| DELETE | `/api/friends/:id/photos/:position` | bearer | remove + repack positions |
| GET | `/api/gmap` | — | `{ pairs, gLessIds, pending, geocodedCount, totalCount }` |
| GET | `/api/predictions` | — | newest first |
| POST | `/api/predictions` | — | submit anonymous prediction |
| PATCH | `/api/predictions/:id` | bearer | flip `correct` |
| GET | `/photos/:id/:position` | — | streams BLOB with mime + cache-bust |
| GET | `/photos/:id` | — | back-compat → position 1 |

All admin-only routes use `requireAdmin` middleware; tokens come from `Authorization: Bearer <hex>`.

---

## Dev workflow

```bash
# Both servers (web + api), color-tagged in one terminal
npm run dev

# Or each separately
npm run dev:client    # vite, port 5173
npm run dev:server    # tsx watch, port 3001

# One-shot scripts
npm run geocode                  # Nominatim, fills missing lat/lon (1.1s/req)
npm run geocode -- --all         # re-geocode every friend
npm run seed-placeholders        # ensures every friend has ≥2 photos

# Production build
npm run build         # tsc -b && vite build → dist/
npm run preview       # serve dist on :4173

# Legacy reference
npm run prototype     # serve old single-file HTML
```

`.claude/launch.json` describes web/api/prototype for `preview_start` if you want managed previews.

---

## Things that work now (manual QA checklist)

- [ ] Open http://localhost:5173 → cream theme, Rankings 2-up grid, all 16 cards
- [ ] Click any card → modal opens with smooth scale-in
- [ ] Modal: ← → arrows or keyboard arrows flip between the 2 photos. Dots highlight.
- [ ] Modal: Esc / X / backdrop click closes. Body scroll restored.
- [ ] Login as admin (password in `.env.local`) → name + bio in modal become editable.
- [ ] Admin: "+ Lägg till bild" inside modal appends a 3rd photo. Carousel grows.
- [ ] Admin: "Ta bort denna" deletes the current photo + repacks positions.
- [ ] G Map: 7 pairs (Joseph & Gogo, Emanuel & Andre, etc.). Real distances.
- [ ] Moves: countdown, submit form, columns per friend.
- [ ] `prefers-reduced-motion`: no scale/translate, opacity-only crossfades.

---

## Known unfinished / next-up

1. **Real photos for the 5 without one (Andre, Jacob, Fredrik, Joel, Gogo).**
   Loose `.HEIC`/`.JPG` files exist in `~/Downloads/Claude grejer/` (Andre.HEIC, Jacob — actually missing, Fredrik.HEIC, Joel — missing, Gogo — missing). Could write a one-shot script: convert HEIC → JPEG via macOS `sips`, then POST to `/api/friends/:id/photo`. This would replace placeholder SVGs with real shots.

2. **Bio length.** Currently shown in full on the card. If bios get long (admin can write whatever), the cards may grow uneven. Could clamp to 3 lines on the card with `-webkit-line-clamp: 3` and full text in modal. Easy tweak — say the word.

3. **Tab fairness for cards.** Tab order through 16 cards is long. Consider a "Skip to Moves" link or grouping by tier with `<section role>` for screen readers.

4. **The G Map "Robin alone" outcome.** Greedy pairing leaves Robin (Brunnsäng/Ritorp) unmatched because Joel pairs with Christian first. Mathematically correct; might feel off. Could swap to **min-cost perfect matching** (blossom algorithm) if desired — but `O(N⁴)` is overkill for 16 nodes.

5. **Phase 5 deploy.** Easiest path: Render or Fly.io for the Express server. Vite output can sit on Vercel/Netlify and proxy to the API host. Or one Fly app serving both via Express static. Need a domain.

6. **Photo upload UX.** Drag-drop into the modal photo frame would feel nicer than the file input. Optional polish.

7. **Emil's photo crossfade-with-blur trick** — when changing carousel photos, currently a 250 ms opacity crossfade. Could add `filter: blur(2px)` during the transition for the masking effect Emil recommends. Easy 5-line change.

---

## Asks if you're picking this up

The user said "We are going to make changes to the site" and is iterating fast. Default to:
- **Tone:** Swedish-leaning Swenglish, lightly self-aware, "ranking committee" voice.
- **Theme:** Light cream/ink/gold. Don't go back to dark.
- **Copy:** Prefer "Topp 16" framing.
- **Pace:** Small focused passes, check in between large changes (per [CLAUDE.md](CLAUDE.md) and stored memory).
- **Skill in play:** [Emil Kowalski's design engineering skill](~/.claude/skills/emil-design-eng/SKILL.md) — review format = Before/After/Why markdown table.
- **Unsaved sites in their references:** awwwards.com + asendomedia.se (Swedish agency style — light, alive, generous typography).

Stored memory facts about the user (in `~/.claude/projects/-Users-jacobercan-Downloads-friendslist-project/memory/`):
- Comfortable with web dev concepts but not deeply technical with build tools/databases. Speaks Swedish + English.
- Prefers small working steps; confirm before moving between roadmap phases.

---

## Reach the running stack from a fresh shell

```bash
export PATH="$HOME/.local/node/bin:$PATH"   # Node was installed in $HOME/.local/node
cd /Users/jacobercan/Downloads/friendslist-project
npm run dev
# → web on http://localhost:5173, api on http://localhost:3001
```

Process state lives in `/tmp/dev.pid` and `/tmp/dev.log` (current session). Kill stale dev with `pkill -f concurrently`.

---

That's the whole picture. Good luck.
