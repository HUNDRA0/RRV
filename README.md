# 🏆 The Friends List

A private tier-list website for ranking friends with three pages:
**Rankings**, **Making Moves 2027** (prediction game), and **G Map** (geographic pairing).

A React + Vite + TypeScript app with an Express + libSQL backend.

---

## 📦 What's in this repo

```
friendslist-project/
├── public/
│   └── index.html          # Current single-file prototype (working!)
├── src/                    # (empty — for the rebuild)
│   ├── components/
│   └── data/
├── README.md               # You are here
├── ROADMAP.md              # What to build next, in order
├── ARCHITECTURE.md         # How the code is currently structured
└── .gitignore
```

The `public/index.html` file is the live prototype. It works as-is — open it in a browser and everything functions. But it has limitations we want to fix (see ROADMAP).

---

## 🎯 Current features (working in the prototype)

### 🏆 Rankings page
- 15 friends sorted into 3 tiers: **Eliten** (S), **Normal** (A), **I Dunno** (?)
- Editable photos, names, and notes (admin only)
- Photos pre-loaded for 11 of 15 friends

### 🎯 Making Moves 2027
- Prediction game: anyone submits a guess about what each friend will do in 2027
- Live board grouping predictions by person
- Admin can mark predictions as correct → automatic Champion banner
- Countdown to Dec 31, 2027

### 📍 G Map
- All friends paired by closest geographic neighbour
- One unpaired friend goes to "G Less" section
- Each pair links out to Google Maps directions to verify exact distance

### 🔐 Admin mode
- Password-protected
- Only admin can edit photos/names/notes and mark predictions as correct
- Everyone else has read-only access

---

## 🛠 Tech stack (current vs target)

| Layer       | Current                          | Target                                    |
|-------------|----------------------------------|-------------------------------------------|
| Frontend    | Single HTML file, vanilla JS     | React + Vite + TypeScript                 |
| Styling     | Inline `<style>` tag             | Tailwind CSS                              |
| Data        | `localStorage` (per-browser)     | Real backend API + shared database        |
| Backend     | None                             | Node.js + Express OR serverless functions |
| Database    | None                             | SQLite (dev) → Postgres (prod)            |
| Auth        | Hardcoded password in HTML       | Server-side admin token                   |
| Photos      | Base64 inline                    | Object storage (e.g. Cloudflare R2)       |
| Geocoding   | Manual / approximations          | Google Maps API for real distances        |
| Hosting     | Static (Netlify Drop)            | Vercel / Netlify with serverless API      |

---

## 🚀 Getting started

```bash
# Just open the prototype in a browser:
open public/index.html

# Or serve it locally:
npx serve public
```

When you're ready to rebuild, see **ROADMAP.md** for the recommended order.

---

## 📝 License

Private project. Do not share publicly without permission.
