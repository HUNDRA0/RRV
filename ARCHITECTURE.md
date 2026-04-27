# 🏗 Architecture (current prototype)

This document explains how `public/index.html` is currently structured. Useful when porting it to React.

---

## Single-file structure

The entire app lives in `public/index.html` (~400KB, mostly base64 photo data).

```
<head>
├── <style>             # All CSS (CSS variables for colors, no Tailwind yet)
└── Google Fonts link    # Playfair Display, Bebas Neue, Barlow Condensed, Barlow

<body>
├── <div class="bg-decoration">   # Background orbs + grid + vignette
├── <div class="top-nav">          # Sticky nav: logo, page tabs, login form
├── <div id="page-tierlist">       # Page 1: Rankings
├── <div id="page-moves">          # Page 2: Making Moves 2027
├── <div id="page-gmap">           # Page 3: G Map
├── <div class="page-footer">      # Footer
└── <script>                       # All JS: state, auth, page switching, board rendering
```

Pages are toggled by `.active` class — no router, no history.

---

## State management

Everything is stored in `localStorage`:

| Key                       | Type   | Description                              |
|---------------------------|--------|------------------------------------------|
| `card_<name>_name`        | string | Custom name for a friend                 |
| `card_<name>_note`        | string | Custom note shown under the friend       |
| `photo_<name>`            | string | Base64-encoded photo                     |
| `moves_guesses`           | JSON   | Array of all submitted predictions       |

Admin state (`isAdmin`) is just a JS variable — does NOT persist across reloads. You log in every time. (This is intentional; the password gate is the only "auth" right now.)

---

## Friends data

Currently inline in JS:

```js
const ALL_MEMBERS = [
  {name:'Mario',  tier:'s', sublabel:'Eliten'},
  {name:'Adam',   tier:'s', sublabel:'Eliten'},
  // ...15 entries
];
```

And tier rows are hard-coded HTML inside `#page-tierlist`. **Important:** when you migrate to React, generate the cards from the data array, don't keep them as static HTML.

Photos are base64 strings inside `INITIAL_PHOTOS = { Mario: 'data:image/jpeg;base64,...', ... }` — about 200KB total, embedded directly in the HTML.

---

## G Map data

Pairings are hard-coded HTML in `#page-gmap`. The pairings themselves were computed from:

- **Verified facts** — postcodes and stadsdel names confirmed via web search
- **Address relationships** — same street, same postcode, adjacent postcodes

The "distance" labels are descriptive (e.g. "Samma kvarter", "Promenadavstånd") rather than exact meters because we couldn't geocode addresses without internet access. Each pair has a Google Maps directions link so users can see real distances on click.

When you add a backend, store coordinates in the DB and compute real distances. See ROADMAP Phase 3.

---

## Auth flow

```
1. User loads page → sees login form in nav (top right)
2. User types password → onclick="tryLogin()"
3. tryLogin() compares against the ADMIN_PASSWORD constant
4. If match: sets isAdmin = true, adds class .admin-mode to <body>
5. CSS uses .admin-mode to enable contenteditable and show overlays
6. Logout: removes .admin-mode, sets isAdmin = false
```

---

## CSS architecture

CSS variables defined at the top:

```css
:root {
  --bg: #080c10;        /* main background */
  --surface: #0d1219;   /* cards, panels */
  --gold: #c9a84c;      /* primary accent */
  --gold2: #e8c76a;     /* hover/highlight */
  --s: #c9a84c;         /* S tier (gold) */
  --a: #d4734a;         /* A tier (orange) */
  --i: #8b7fd4;         /* I dunno tier (purple) */
  --moves: #3ecfb0;     /* Moves 2027 (teal) */
  --gmap-gold: #FFD700; /* G Map highlight */
  /* ... */
}
```

When porting to Tailwind, configure these as theme extensions in `tailwind.config.js`:

```js
theme: {
  extend: {
    colors: {
      ink: '#080c10',
      surface: '#0d1219',
      gold: { DEFAULT: '#c9a84c', light: '#e8c76a' },
      tier: {
        s: '#c9a84c',
        a: '#d4734a',
        i: '#8b7fd4',
      },
      moves: '#3ecfb0',
      'gmap-gold': '#FFD700',
    },
    fontFamily: {
      display: ['Playfair Display', 'serif'],
      heading: ['Bebas Neue', 'sans-serif'],
      condensed: ['Barlow Condensed', 'sans-serif'],
      body: ['Barlow', 'sans-serif'],
    },
  },
}
```

---

## Responsive breakpoints

Two breakpoints, mobile-first-ish:

- `@media (max-width: 768px)` — phones: nav tabs go full-width on a second row, person cards become 2-column
- `@media (max-width: 400px)` — small phones: nav tab text shrinks further

---

## Known quirks

- Photos are loaded into `<img>` tags by JS on page load (not as `src=` attributes) — done this way so they work the same whether the photo comes from `INITIAL_PHOTOS` or from `localStorage`
- The Moves board re-renders fully on every change (`renderMovesBoard()`) — fine at this scale, but switch to React state diffing in Phase 1
- The countdown timer updates every 60s via `setInterval`. Move that to a `useEffect` hook in React
- `contenteditable` is used for inline editing. In React this is awkward — consider switching to controlled `<input>` and `<textarea>` elements that toggle between display and edit mode
