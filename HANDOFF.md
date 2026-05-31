# Handoff — Viber Rankings (RRV)

Pick-up doc for continuing this project in a fresh chat. This is the **single source of truth** for current state — it supersedes the older phase notes in README/ROADMAP/ARCHITECTURE (those describe the early prototype era and are now mostly historical).

_Last updated: through PR #42 (Face ID/Touch ID signup on the register tab). 21 migrations applied._

---

## TL;DR — what this app is

A **private friend tier-list site** for a Swedish friend group (~16 people), live at **viberrankings.se**. Started as a single-file HTML prototype, now a real React + Express + Turso app deployed on **Vercel**.

**Pages / sections** (single-page app with hash routing for the heavy pages):
- **Tier** (Rankings) — the tier list, the core feature
- **Jobblistan** (Leaderboard) — job/ranking list
- **G's** (G Map) — who lives near whom, driving distances
- **Making Moves** — what everyone's "current move" is
- **Events** — events + polls (Yes/Nej/Kanske + custom answers)
- **Lunch 🎟** — lunch-ticket debt tracker (multi-creditor)
- **Hall of Fame 🏆** (`#hall-of-fame`) — Instagram/YouTube-style feed (images/videos/YouTube embeds), comments, like/dislike, views, sort, share
- **Catan 🎲** (`#catan`) — Catan stats page

**Two repos / two paths — IMPORTANT:**
- `/Users/jacobercan/Documents/Projects/RRV/` — **the real git clone. All work happens here.**
- `/Users/jacobercan/Documents/Projects/RRV-main/` — a zip-extracted copy that is the Claude Code **cwd**. The shell resets here between calls, so always `cd /Users/jacobercan/Documents/Projects/RRV` first (or use absolute paths).

---

## Stack

| Layer | Tech |
| --- | --- |
| Frontend | React 19 + Vite 8 + TypeScript 6 (strict + noUnusedLocals/Parameters) |
| Styling | Tailwind v4 (`@tailwindcss/vite`) + one big `src/index.css` (~3000 lines, single file by design) |
| Backend | Express 5, run as a **Vercel serverless function** (`api/server.ts`) |
| DB | **Turso** (managed libSQL/SQLite) via `@libsql/client/web` — **remote only, no local file fallback** |
| Auth | scrypt password hashing (`node:crypto`, no external lib) + WebAuthn/passkeys (`@simplewebauthn/*` v13) |
| Hosting | Vercel (frontend static + serverless API). Domain: viberrankings.se |

Build: `tsc -b && vite build`. Output `dist/`. Vercel config in `vercel.json`.

---

## Local dev

```bash
cd /Users/jacobercan/Documents/Projects/RRV
npm run dev          # concurrently: api (tsx watch :3001) + web (vite :5173)
# vite proxies /api, /photos, /hall/blob → :3001

npx tsc -b --force   # typecheck (do this before every commit)
npx vite build       # full prod build sanity check
```

**Secrets live in `.env.local` (gitignored):**
- `ADMIN_PASSWORD` — the legacy password-admin login
- `TURSO_DATABASE_URL` = `libsql://friendslist-hundra0.aws-eu-west-1.turso.io`
- `TURSO_AUTH_TOKEN`

**Vercel env vars** (set in dashboard) additionally include:
- `RP_ID=viberrankings.se`, `RP_NAME=Viber Rankings` (WebAuthn relying-party)
- the same `ADMIN_PASSWORD` + `TURSO_*`

There is **no local SQLite** — even dev talks to the real Turso DB. Be mindful: dev writes hit production data.

---

## Git / deploy workflow (follow this exactly)

The user works PR-by-PR. Standard loop for any change:

```bash
cd /Users/jacobercan/Documents/Projects/RRV
git checkout main && git pull
git checkout -b feat/short-name           # or fix/...
# ... make changes ...
npx tsc -b --force                         # must be clean
git add -A && git commit -m "…"            # see commit style below
git push -u origin feat/short-name
gh pr create --title "…" --body "…"
gh pr merge --merge --delete-branch        # squash not used; plain merge
```

- **Merging to main auto-deploys to Vercel.**
- Commit/PR co-author trailer: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` and PR body footer `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- `gh` is authenticated. Repo: **HUNDRA0/RRV**.
- The local git identity prints a noisy "name/email configured automatically" warning on commit — harmless, ignore it.

### ⚠️ Migrations need a manual step
The migration runner (`server/db.ts` → `runMigrations`) runs on serverless boot, but to avoid the live deploy 500-ing on first request after a schema change, **apply new migrations to Turso directly before merging**. Pattern used repeatedly this session — write a throwaway script in the repo root and run it:

```js
// _apply_NNN.mjs  (delete after running)
import { createClient } from '@libsql/client';
import { readFileSync } from 'node:fs';
const env = readFileSync('.env.local','utf8').split('\n').reduce((a,l)=>{const [k,...r]=l.split('=');if(k&&r.length)a[k.trim()]=r.join('=').trim();return a;},{});
const db = createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });
const name = 'NNN_xxx.sql';
if ((await db.execute({sql:"SELECT 1 FROM _migrations WHERE name=?",args:[name]})).rows.length) { console.log('already applied'); process.exit(0); }
await db.executeMultiple(readFileSync(`server/migrations/${name}`,'utf8'));
await db.execute({ sql:'INSERT INTO _migrations (name) VALUES (?)', args:[name] });
console.log('applied');
```
```bash
node _apply_NNN.mjs && rm _apply_NNN.mjs    # run inside RRV/ so @libsql/client resolves
```

---

## File map (current)

```
api/server.ts              Vercel serverless entry — boots Express, CSP headers, mounts routers
vercel.json                build + rewrites (/api, /photos, /hall/blob → serverless fn)
.env.local                 secrets (gitignored)

server/
├── index.ts               local Express boot (mirrors api/server.ts for `npm run dev`)
├── db.ts                   libSQL client + queryAll/queryOne/exec + runMigrations
├── seed.ts                 seedIfEmpty (fresh-DB friend seed)
├── auth.ts                 scrypt hash/verify, session token load, requireUser + attachUser
│                           middleware, UserRole type + permission helpers
├── auth-routes.ts          /api/auth/* (register, login, logout, me, recover, avatar)
├── passkey-routes.ts       /api/auth/passkey/* (register/login/signup start+finish)
├── hall-routes.ts          /api/hall/* (posts, comments, reactions, views, blob serving)
├── catan-routes.ts         /api/catan/*
├── routes.ts               core /api (friends, predictions, gmap, content, users) + requireAdmin
│                           + requireAdminOrRole middleware
├── lib/{gmap.ts, photos.ts}
├── migrations/             001 … 021 (see below)
└── scripts/{geocode.ts, seed-placeholder-photos.ts}

src/
├── main.tsx                Provider wrap
├── Root.tsx                hash router: #catan → CatanPage, #hall-of-fame → HallOfFamePage (both lazy), else App
├── App.tsx                 main page shell, section composition, modal wiring
├── index.css               ALL styles (single file)
├── data/friends.ts         types + seed (server side)
├── lib/
│   ├── api.ts              fetch wrappers + DTOs + tokenStore/userTokenStore (separate localStorage keys)
│   ├── state.tsx           FriendsListProvider + useFriendsList() — the central store + all actions + perms
│   ├── passkey.ts          WebAuthn browser flows (register/login/signup)
│   ├── hallApi.ts          Hall of Fame fetch wrappers
│   ├── compressVideo.ts    client-side MediaRecorder re-encode for big videos
│   ├── socials.ts          12 social platforms (icons/colors/url builders)
│   └── theme.ts            admin theme overrides (CSS vars + data-attrs) + Google Font presets
└── components/viber/
    ├── StickyNav.tsx       top nav, tab indicator, hamburger, UserMenu
    ├── UserMenu.tsx        account dropdown (login/register/recover, Admin Console, Redigera, Mitt konto, logout)
    ├── LoginModal.tsx      3 tabs: Logga in / Skapa konto / Glömt — both login+register have passkey option
    ├── AdminConsole.tsx    full admin console (tabs) + RESTRICTED editor mode for Court/Stronk (editorScope prop)
    ├── ProfileSettingsModal.tsx   user avatar upload (PhotoCropModal)
    ├── PhotoCropModal.tsx  square crop editor, drag-pan + pinch/wheel zoom → 800×800 JPEG
    ├── HallOfFamePage.tsx  feed, upload modal, lightbox, comments, reactions, views, sort, share (lazy)
    ├── PersonCard.tsx, PersonModal.tsx, PhotoCell.tsx
    ├── RankingsSection / LeaderboardSection / GMapSection / MovesSection / EventsSection / LunchSection
    ├── PollsBlock.tsx, QuoteTicker.tsx, SocialChips.tsx, TierSection.tsx, Hero.tsx, AuroraBg.tsx
    ├── tier-map.ts          dynamic tier config parsing
    └── EditBanner.tsx ⚠️DEAD   Editable.tsx ⚠️INERT   (see Cleanup below)
```

---

## Roles & permissions (current model)

Five roles on `users.role`: **`admin`, `court`, `stronk`, `peasant`, `user`**.

| Role | Friend bio + photos | Address fields | Tier/rank/name/socials/delete | HoF: delete any post | Role assignment |
| --- | --- | --- | --- | --- | --- |
| **admin** | ✅ all | ✅ | ✅ | ✅ | ✅ |
| **court** | ✅ all | ❌ | ❌ | ✅ | ❌ |
| **stronk** | ✅ own linked friend only | ❌ | ❌ | ❌ | ❌ |
| **peasant** | ❌ (view) | ❌ | ❌ | ❌ | ❌ |
| **user** | ❌ (view + comment/like) | ❌ | ❌ | ❌ | ❌ |

Key facts:
- **A `role='admin'` user account = full equivalence with the password admin.** No separate login. `requireAdmin` (server) accepts either an `admin_sessions` token OR a user session whose role is `admin`. Frontend `isAdmin = adminViaToken || currentUser.role === 'admin'`.
- **`users.linked_friend_id`** ties a Stronk account to one friend record. Admin sets role + linked friend in **Admin Console → "Roller"** tab.
- **Address (street/postcode/city/lat/lon) is admin-only** — server rejects address edits from court/stronk with 403.
- **Editing is console-only now.** The old inline "Edit mode" toggle + per-card affordances were removed. Everyone edits via a console opened from the account menu:
  - admin → full **Admin Console** ("Admin Console" menu item)
  - court/stronk → **restricted editor** ("Redigera" menu item) = `AdminConsole` with `editorScope` prop (`'all'` for court, `string[]` of linked ids for stronk). Renders only bio + making-move + photos per person, each with an explicit **Spara** button + "✓ Sparat" confirmation.
- Permission helpers live in `server/auth.ts` (`canEditFriend`, `canEditFriendAddress`, `canDeleteAnyHallPost`, `canEditAnyFriend`) and are mirrored in `src/lib/state.tsx` (`canEditAnyFriend`, `canEditFriendById`, `canEditAddress`, `canDeleteAnyHallPost`).
- Server middleware `requireAdminOrRole(allowedRoles)` guards friend-edit endpoints; frontend `api.ts` uses an `adminOrUser: true` request option that sends whichever token exists (admin token preferred, else user token).

---

## Auth details

- **Two localStorage tokens**: `friendslist_admin_token` (admin) + `rrv_user_token` (user). Managed by `tokenStore` / `userTokenStore` in `api.ts`.
- **Synthetic `__admin__` user**: admin password login also issues a parallel user session for a fake `__admin__` user so admin can use user-gated features (polls, HoF). It's filtered out of the `GET /api/users` list.
- **Passkeys (Face ID / Touch ID)**: register, login, AND anonymous signup all supported. Signup-with-passkey collects username + security question + answer (for recoverability if device lost). Available on BOTH the **Logga in** tab (shortcut) and the **Skapa konto** tab (PR #42). `RP_ID`/`RP_NAME` env vars required.
- **Password recovery** = security-question challenge (`/api/auth/recover/start` → returns question, `/finish` → verify answer + set new password). Passkey-only accounts recover the same way.

---

## Hall of Fame (the big recent feature area)

`#hall-of-fame`, lazy-loaded. Reachable only via the nav menu (like Catan).

- **Post kinds**: `image`, `video` (both BLOB in Turso), `youtube` (stores 11-char id, embeds iframe).
- **SECURITY (explicit user requirement)**: only image/video may be uploaded. Enforced server-side by mime allowlist + **magic-byte sniffing** (rejects a `.php` renamed to `.jpg`). YouTube URLs parsed via regex → canonical `/embed/{id}`. CSP allows `frame-src` youtube + `media-src 'self' blob:`, `X-Content-Type-Options: nosniff` on blobs.
- **Vercel 4.5 MB body cap workaround**: uploads go as **raw binary** to `POST /hall/posts/binary` (not base64 JSON, which inflates ~33%). Videos over 4 MB are **re-encoded client-side** via `MediaRecorder` (`lib/compressVideo.ts`) down to fit, with a progress bar. iOS Safari lacks `captureStream` → clear error, fall back to YouTube. Source video cap 100 MB; image cap 4 MB.
- **Engagement**: comments (avatar + name + delete-own/admin/court), like/dislike (one reaction per user/post, optimistic toggle), **view count** (IntersectionObserver: counts after ≥50% visible ≥1.5 s, deduped per session via sessionStorage), **sort** (newest/oldest/most_viewed/most_liked/most_disliked — server-side allowlisted ORDER BY), **filter tabs** (Alla/Bilder/Videor), **image lightbox** (zoom/pan), **share** (Web Share API on phones, clipboard + toast on desktop; deep link `#hall-of-fame?post=ID` scrolls + flashes the target).
- Guests can view + see counts; tapping like/dislike/comment opens the login modal.

---

## Migrations (Turso)

```
001 initial (friends, predictions, admin_sessions)   012 dynamic_tiers
002 geocoding                                          013 catan
003 add_george                                         014 users_and_polls
004 friend_photos                                      015 friend_socials
005 bio                                                016 passkeys
006 default_bios                                        017 hall_of_fame
007 current_move                                        018 user_avatars
008 job_leaderboard / 008 route_cache                  019 hall_engagement (comments+reactions)
009 site_content / 009 jacob_postcode                  020 user_roles (court/stronk/peasant + linked_friend_id)
010 lb_order                                            021 hall_view_count
011 joseph_tier
```

Note the two pairs of duplicate-numbered files (008, 009) — historical, both apply, runner tracks by filename in `_migrations`.

Key tables added this era: `users`, `user_sessions`, `polls`/`poll_options`/`poll_votes`, `friend_socials`, `passkeys`, `hall_of_fame_posts`, `hall_of_fame_comments`, `hall_of_fame_reactions`. `users` has `avatar_data/avatar_mime/avatar_updated_at`, `role` (5-value CHECK), `linked_friend_id`. `hall_of_fame_posts` has `view_count`.

---

## Known cleanup / loose ends

1. **`src/components/viber/EditBanner.tsx` is fully dead** — no imports after the edit-mode removal (PR #40). Safe to delete.
2. **`Editable.tsx` is inert** — still imported by `PersonModal.tsx` + `MovesSection.tsx`, but `App.tsx` now hardwires `const isEditing = false`, so it always renders read-only. The edit branches can be stripped, or the component removed and call sites simplified.
3. **`state.tsx` `isEditMode` / `toggleEditMode` / `isEditing`** are no longer consumed outside the store (App uses a local `isEditing = false`). Dead-ish; could be removed from the context type.
4. **`[seed]`-tagged Hall of Fame demo posts** exist in Turso (5 sample posts inserted via a one-off script: 3 images, 1 video, 1 YouTube — captions all end with `[seed]`). Delete when real content arrives: `DELETE FROM hall_of_fame_posts WHERE caption LIKE '%[seed]%'`.
5. **Older docs are stale** — README/ROADMAP/ARCHITECTURE describe the prototype/early phases. This HANDOFF is current; the others are historical.

---

## Working style (from CLAUDE.md + this session)

- User speaks **Swedish + English** — match whatever they use (they mostly write Swedish). UI copy is Swedish.
- Comfortable with web concepts, not deeply technical with build tools/DBs. Explain choices in plain language.
- **Small, working steps**; one feature per PR; typecheck before every commit.
- Light cream/ink/gold editorial theme. Don't regress to dark by default (dark mode is a user toggle).
- When a change needs a product decision you can't infer, ask briefly (the `AskUserQuestion` flow worked well — e.g. clarifying what "bio" meant for roles).
- The user enjoys iterating on the Hall of Fame and the friend cards; lots of small UX polish requests.

---

## Quick "what would I build next" ideas (none requested yet)

- Livestream embed (discussed, not built): cheapest = YouTube Live unlisted iframe (CSP already allows YouTube); group-call = Daily.co/Whereby embed. User was "just curious".
- Do the EditBanner/Editable dead-code cleanup.
- Per-section empty/long-content edge cases on the cards.

---

That's the whole picture as of PR #42. Start by `cd /Users/jacobercan/Documents/Projects/RRV`, `git pull`, `npm run dev`, and read this file. Good luck.
