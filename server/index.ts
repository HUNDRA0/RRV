// Express API server.
// Boot order: open libSQL connection, run migrations, seed if empty, then
// start listening. /photos/:id is served by an Express route (not static
// middleware) because images live as BLOBs inside the DB.
//
// In production (NODE_ENV=production) Express also serves the Vite build
// from dist/ and falls back to index.html for client-side routing.

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { runMigrations, queryOne } from './db';
import { seedIfEmpty } from './seed';
import { router as apiRouter, photosRouter } from './routes';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROD = process.env.NODE_ENV === 'production';

await runMigrations();
await seedIfEmpty();

const app = express();
// Body limit kept to 2 MB — large enough for one photo (resized client-side)
// but small enough to limit DoS amplification on the JSON parser.
app.use(express.json({ limit: '2mb' }));

// Security headers (lightweight, no extra dependency needed).
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Minimal CSP — restrict scripts/frames to self, allow inline styles
  // (Tailwind/utility classes use these) and data: images.
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'sha256-6JehW/Vl8fBZ9xkeeNP6c4UFJCIPBJcg2F4uvQdYo8g='; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  );
  next();
});

app.get('/api/health', async (_req, res) => {
  const row = await queryOne<{ n: number }>('SELECT COUNT(*) AS n FROM friends');
  res.json({ ok: true, ts: new Date().toISOString(), friends: row?.n ?? 0 });
});

app.use('/api', apiRouter);
app.use(photosRouter);

if (PROD) {
  // Serve built frontend assets.
  const distDir = resolve(HERE, '..', 'dist');
  app.use(express.static(distDir));
  // SPA fallback — any unmatched GET returns index.html.
  app.get('*', (_req, res) => {
    res.sendFile(resolve(distDir, 'index.html'));
  });
}

// Global error handler — must be last. Express 4 doesn't auto-forward
// async rejections, so async route handlers should explicitly call next(err)
// on failure. This catches anything that does reach the middleware chain
// and returns a generic error to the client without leaking stack traces.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[error]', err);
  if (res.headersSent) return;
  res.status(500).json({ error: 'internt serverfel' });
});

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, () => {
  console.log(`[api] listening on port ${PORT} (${PROD ? 'production' : 'dev'})`);
});

// Unhandled promise rejections should crash loudly so Render restarts.
process.on('unhandledRejection', (reason) => {
  console.error('[fatal] unhandled rejection:', reason);
  process.exit(1);
});
