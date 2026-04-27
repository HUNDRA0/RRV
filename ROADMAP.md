# 🗺 Roadmap

The current prototype works but has key limitations. This roadmap is the recommended order to address them. Each phase builds on the last. **Don't skip ahead.**

---

## ✅ Phase 0 — What's already done

- Working three-page UI (Rankings, Moves 2027, G Map)
- Admin/viewer mode with password gate
- Photo upload & storage in `localStorage`
- Editable names and notes
- Mobile-responsive design
- Dark editorial aesthetic (gold + serif typography)
- 11 of 15 friend photos embedded

---

## 🎯 Phase 1 — Modernize the codebase (frontend only)

**Goal:** Convert the single-file prototype into a proper React/Vite project, no behavior change.

**Why first:** Everything after this is easier with a real component structure. Don't add a backend to a 400-line script tag.

**Tasks:**
1. `npm create vite@latest . -- --template react-ts`
2. Install Tailwind CSS, configure to match the current design tokens (gold `#c9a84c`, ink `#0c0c14`, the tier accent colors, etc.)
3. Break the HTML into components:
   - `<TopNav />`, `<Masthead />`, `<TierSection />`, `<PersonCard />`
   - `<MovesPage />`, `<MovesSubmitForm />`, `<MovesBoard />`
   - `<GMapPage />`, `<GPairCard />`, `<GLessCard />`
   - `<LoginGate />` for the admin password flow
4. Move all the friend data (names, tiers, addresses, photos) into `src/data/friends.ts` as typed records
5. Keep `localStorage` working exactly as before — Phase 1 is just a refactor
6. Confirm everything still works the same as the current prototype

**Done when:** `npm run dev` shows the same site, `npm run build` produces a deployable `dist/`.

---

## 🔐 Phase 2 — Real backend with shared data

**Goal:** Predictions and edits sync between everyone who visits the site.

**Why now:** Without this, the site is per-person. Once you ship Phase 2, friends actually share a board.

**Pick one of these stacks:**

### Option A — Vercel + Postgres (recommended)
- Frontend deployed to Vercel
- API routes via `/api/*.ts` serverless functions
- Database: Vercel Postgres or Neon (free tier)
- Photos: Vercel Blob or Cloudflare R2

### Option B — Express + SQLite (simpler dev, more work to deploy)
- Node.js + Express server in `/server`
- SQLite file as the database for dev
- Migrate to Postgres for prod

**Tasks:**
1. Design the schema:
   - `friends` (id, name, tier, sublabel, address, photo_url, note)
   - `predictions` (id, guesser_name, friend_id, prediction_text, created_at, marked_correct)
   - `admin_sessions` (token, expires_at) — only if you want session-based admin auth
2. Build API endpoints:
   - `GET /api/friends` — list all friends with photos and notes
   - `PUT /api/friends/:id` — update name/note (admin only)
   - `POST /api/friends/:id/photo` — upload a new photo (admin only)
   - `GET /api/predictions` — list all predictions
   - `POST /api/predictions` — submit a new prediction (anyone)
   - `PATCH /api/predictions/:id` — mark correct/incorrect (admin only)
   - `POST /api/admin/login` — exchange password for a session token
3. Replace every `localStorage` call in the React app with API calls
4. Move the admin password to a server environment variable (`ADMIN_PASSWORD=…`). Verify it server-side, return a session token, store the token in `httpOnly` cookie or `localStorage`
5. Use that token to authorize PUT/POST/PATCH endpoints
6. Migrate existing user data: when a logged-in admin first visits the new version, offer to upload their `localStorage` photos and notes to the server

**Done when:** Two different browsers see the same predictions and photos.

---

## 🗺 Phase 3 — Real distances on G Map

**Goal:** Replace the descriptive labels ("samma kvarter") with actual distances.

**Tasks:**
1. Sign up for a Google Maps API key (or use OpenRouteService — free, no card required)
2. Write a one-time script `scripts/geocode-friends.ts` that:
   - Reads each address from the database
   - Calls the geocoding API to get `(lat, lon)`
   - Stores coordinates back in the database
3. Write `scripts/compute-pairings.ts` that:
   - Reads all coordinates
   - Computes pairwise haversine distances
   - Runs greedy matching (closest first) to assign G pairs
   - Stores pairings in a new `g_pairs` table OR computes on the fly
4. Update the G Map page to show real distances from the database
5. Optionally: render an actual map (Leaflet + OpenStreetMap tiles) showing all 15 pins

**Done when:** Each pair card shows "367 m" or "1.2 km" pulled from real geocoded data.

---

## ✨ Phase 4 — Polish & extras

Things that would be nice but aren't blocking:

- **Add/remove friends from admin UI** instead of editing data files
- **Profile pages** — click a friend, see all their predictions, history, photos over time
- **Comments on predictions** — let people roast each other's guesses
- **Notifications** — email or push when someone submits a prediction about you
- **Year-end results show** — animated reveal sequence on Dec 31, 2027
- **Public read-only mode** vs **private friends-only mode** (login wall for everyone, not just admin)
- **Export to PDF** — generate a printable "Annual Report"
- **Activity feed** — "Marcus added a prediction · 2 min ago"

---

## 🚀 Phase 5 — Deploy

When the site has a backend and shared data:

1. Push to GitHub
2. Connect repo to Vercel (or Netlify)
3. Set environment variables: `ADMIN_PASSWORD`, `DATABASE_URL`, `GOOGLE_MAPS_API_KEY`
4. Deploy → share the URL with friends
5. Set up automatic deploys on every `git push`

---

## 💡 Tips for working with Claude Code

When you open this repo in Claude Code, here are good first prompts:

- *"Read the README and ROADMAP. What should we work on first?"*
- *"Let's start Phase 1. Set up the Vite + React + Tailwind scaffold and migrate the TopNav component first."*
- *"Look at public/index.html and extract the friends data into a typed TypeScript file in src/data."*
- *"I want to deploy this. Walk me through Phase 2 step by step."*

Claude Code can run commands, edit multiple files, and iterate — so you can move fast. Keep prompts focused on one phase at a time.
