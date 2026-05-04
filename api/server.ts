// Vercel serverless entry-point. Wraps the Express routes from server/ so
// they run as a single Lambda function. Vercel handles the Node.js adapter;
// we just export the Express app.
//
// runMigrations() is idempotent — it no-ops if all migrations are applied,
// so it's safe to call on every cold start. seedIfEmpty() only runs once
// (when friends count is 0). Both are awaited before the app is exported.

import express from 'express';
import { runMigrations } from '../server/db';
import { seedIfEmpty } from '../server/seed';
import { router, photosRouter } from '../server/routes';

const app = express();
app.use(express.json({ limit: '10mb' }));

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Health check — always responds, never needs a DB connection.
app.get('/api/health', (_req, res) => {
  const hasUrl = !!process.env.TURSO_DATABASE_URL;
  const hasToken = !!process.env.TURSO_AUTH_TOKEN;
  res.status(hasUrl && hasToken ? 200 : 503).json({
    ok: hasUrl && hasToken,
    ts: new Date().toISOString(),
    tursoUrl: hasUrl ? 'set' : 'MISSING — add TURSO_DATABASE_URL in Vercel Environment Variables',
    tursoToken: hasToken ? 'set' : 'MISSING — add TURSO_AUTH_TOKEN in Vercel Environment Variables',
  });
});

// Kick off migrations + seed as a fire-and-forget promise so there is no
// top-level await that could crash the Lambda before it exports the app.
runMigrations()
  .then(() => seedIfEmpty())
  .catch((err) => console.error('[api/server] startup error:', err));

app.use('/api', router);
app.use(photosRouter);

export default app;
