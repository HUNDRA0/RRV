// Express API server.
// Boot order: open libSQL connection, run migrations, seed if empty, then
// start listening. /photos/:id is served by an Express route (not static
// middleware) because images live as BLOBs inside the DB.
//
// In production (NODE_ENV=production) Express also serves the Vite build
// from dist/ and falls back to index.html for client-side routing.

import { createRequire } from 'node:module';
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
app.use(express.json({ limit: '10mb' }));

// Security headers (lightweight, no extra dependency needed).
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
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

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, () => {
  console.log(`[api] listening on port ${PORT} (${PROD ? 'production' : 'dev'})`);
});

// Unhandled promise rejections should crash loudly so Render restarts.
process.on('unhandledRejection', (reason) => {
  console.error('[fatal] unhandled rejection:', reason);
  process.exit(1);
});
