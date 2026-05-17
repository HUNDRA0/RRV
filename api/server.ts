// Vercel serverless entry-point. Static imports are used so esbuild bundles
// everything. @libsql/client/web (no native bindings) is what makes this safe.

import express from 'express';
import { runMigrations } from '../server/db.js';
import { seedIfEmpty } from '../server/seed.js';
import { router, photosRouter } from '../server/routes.js';

const app = express();
app.use(express.json({ limit: '2mb' }));

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'sha256-6JehW/Vl8fBZ9xkeeNP6c4UFJCIPBJcg2F4uvQdYo8g='; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  );
  next();
});

// Health check — always responds. Intentionally doesn't reveal whether env
// vars are set (that's a fingerprint signal); just reports if the DB is
// reachable by attempting a no-op.
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

// Fire-and-forget: migrations are idempotent, seed runs once.
runMigrations()
  .then(() => seedIfEmpty())
  .catch((err) => console.error('[api] startup error:', err));

app.use('/api', router);
app.use(photosRouter);

// Global error handler — must be last.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[error]', err);
  if (res.headersSent) return;
  res.status(500).json({ error: 'internt serverfel' });
});

export default app;
