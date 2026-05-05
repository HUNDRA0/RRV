// Vercel serverless entry-point. Static imports are used so esbuild bundles
// everything. @libsql/client/web (no native bindings) is what makes this safe.

import express from 'express';
import { runMigrations } from '../server/db.js';
import { seedIfEmpty } from '../server/seed.js';
import { router, photosRouter } from '../server/routes.js';

const app = express();
app.use(express.json({ limit: '10mb' }));

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Health check — always responds.
app.get('/api/health', (_req, res) => {
  res.json({
    ok: !!process.env.TURSO_DATABASE_URL && !!process.env.TURSO_AUTH_TOKEN,
    ts: new Date().toISOString(),
    tursoUrl: process.env.TURSO_DATABASE_URL ? 'set' : 'MISSING',
    tursoToken: process.env.TURSO_AUTH_TOKEN ? 'set' : 'MISSING',
  });
});

// Fire-and-forget: migrations are idempotent, seed runs once.
runMigrations()
  .then(() => seedIfEmpty())
  .catch((err) => console.error('[api] startup error:', err));

app.use('/api', router);
app.use(photosRouter);

export default app;
