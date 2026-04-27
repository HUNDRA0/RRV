# Instructions for Claude Code

This file gives Claude Code context about the project so it can pick up where we left off.

## Project context

This is a private friend tier-list website that already has a working single-file HTML prototype at `public/index.html`. The user wants to evolve it into a real web app with a backend so friends can interact with shared data.

## Read these files first

When starting a session, please read in this order:
1. `README.md` — project overview and current limitations
2. `ROADMAP.md` — what to build next, in phases
3. `ARCHITECTURE.md` — how the prototype is structured (important for migration)

## How to interact with the user

- The user is comfortable with web dev concepts but not deeply technical with build tools/databases
- Prefer explaining choices in plain language ("we'll use X because Y")
- When making code changes, show what you're doing rather than dumping a wall of code
- The user speaks Swedish and English — match whichever they use
- Default to small, working steps rather than building everything at once

## Working priorities

The user explicitly asked to "play with frontend and backend" and eventually deploy. So:

1. **Phase 1 (frontend modernization) should come first** — it's the foundation
2. **Phase 2 (backend) is the main goal** — that's what unlocks shared data
3. **Phase 3 (real geocoding) is a nice-to-have** — only after the basics work
4. **Phase 5 (deploy) happens when Phase 2 is solid**

Don't try to do all phases in one go. Confirm with the user before moving between phases.

## Important constraints

- **Admin password** lives in `.env.local` as `ADMIN_PASSWORD`. Never commit it.
- **Photos** are large base64 strings. As soon as we have a backend, move them to file storage and serve via URLs.
- **Friends data** is hardcoded in the HTML. Extracting this to a typed data file is the very first task of Phase 1.
- **The prototype works** — don't break it while migrating. Keep `public/index.html` as a reference until the React version reaches feature parity.

## Tech stack the user has agreed to (target)

- React + Vite + TypeScript
- Tailwind CSS
- Either Vercel + Postgres OR Express + SQLite for the backend
- Deployed on Vercel or Netlify

If the user changes their mind about any of these, follow their preference.

## Known unknowns (questions to ask the user when relevant)

- Do you want the site fully public (with a login wall) or fully private (only people with the link)?
- Should friends need to log in with their own accounts, or stay anonymous when submitting predictions?
- Do you want a real map view on the G Map page (Leaflet), or are the cards + Google Maps links enough?
- For deployment, do you have a preferred platform (Vercel, Netlify, Cloudflare, self-hosted)?
- Do you have a domain name in mind?

Don't ask all at once — ask when each becomes relevant.
