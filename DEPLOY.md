# Deploying Real Rankings Viber

The app runs as a single Node.js process on **Render** — Express serves both
the API and the built React frontend. The database is **Turso** (remote libSQL),
so there is no local disk to manage.

---

## What you need before you start

| Thing | Where to get it |
|---|---|
| GitHub account | github.com |
| Render account (free) | render.com |
| Turso account (free) | turso.tech |
| The repo pushed to GitHub | Already done: `HUNDRA0/RRV` |

---

## Step 1 — Create a Turso database

If you already have one running locally (`.env.local` has the URL), skip to Step 2.

1. Install the Turso CLI: `brew install tursodatabase/tap/turso`
2. Log in: `turso auth login`
3. Create a database: `turso db create rrv`
4. Get the URL: `turso db show rrv --url`
5. Get an auth token: `turso db tokens create rrv`
6. Copy both values — you'll paste them into Render in Step 3.

---

## Step 2 — Deploy on Render

1. Go to [render.com](https://render.com) and sign in.
2. Click **New → Web Service**.
3. Choose **"Connect a Git repository"** → select `HUNDRA0/RRV`.
4. Render will detect `render.yaml` automatically. If it asks manually:
   - **Runtime:** Node
   - **Build command:** `npm ci && npm run build`
   - **Start command:** `npm start`
   - **Region:** Frankfurt (closest to Stockholm)

---

## Step 3 — Set environment variables on Render

In the Render dashboard for the service, go to **Environment** and add:

| Key | Value |
|---|---|
| `NODE_ENV` | `production` |
| `ADMIN_PASSWORD` | your admin password |
| `TURSO_DATABASE_URL` | `libsql://your-db.turso.io` (from Step 1) |
| `TURSO_AUTH_TOKEN` | the token from Step 1 |

Click **Save Changes** — Render will redeploy automatically.

---

## Step 4 — First deploy

Render builds and starts the app. On first boot:
- All migrations run automatically (tables are created).
- The 16 friends are seeded into the database.
- The server starts serving on the URL Render gives you (e.g. `https://real-rankings-viber.onrender.com`).

Check it's alive: visit `https://your-url.onrender.com/api/health`  
You should see: `{"ok":true,"friends":16,...}`

---

## Step 5 — Upload photos

Photos are stored in the database, not on disk. They survive restarts and
redeployments automatically. To add them:

1. Open the live site in your browser.
2. Log in as admin.
3. Click each friend's card → upload their photo in the modal.

---

## Updating the site after deploy

Every time you push to `main`:

```bash
git add -A
git commit -m "your message"
git push origin HEAD:main
```

Render detects the push, rebuilds, and redeploys in ~2 minutes. No downtime
for the database — Turso stays online throughout.

---

## Running locally

```bash
# Terminal 1 — API (reads .env.local)
npm run dev:server

# Terminal 2 — Vite dev server
npm run dev:client

# Or both at once:
npm run dev
```

The local server uses `server/data/local.db` (SQLite) unless you set
`TURSO_DATABASE_URL` in `.env.local` to point at the real Turso database.

---

## Free tier notes (Render)

- The service **sleeps after 15 minutes of inactivity**. The first request
  after sleep takes ~30 seconds to wake up. This is fine for a friend site.
- To avoid sleep: upgrade to the $7/month Render plan, or use a free uptime
  monitor (e.g. UptimeRobot) to ping `/api/health` every 10 minutes.

---

## Security checklist

- [x] Admin password in environment variable — not in code
- [x] Turso credentials in environment variable — not in code
- [x] `.env.local` in `.gitignore`
- [x] Admin endpoints require a Bearer token (7-day TTL)
- [x] Photos served from database BLOBs — no filesystem exposure
- [x] `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` headers set
- [ ] Optional: add a custom domain in Render dashboard (Settings → Custom Domain)
