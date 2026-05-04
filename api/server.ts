// Vercel serverless entry-point.
//
// All server/* modules (which pull in @libsql/client with native bindings)
// are loaded via dynamic import so the Lambda can boot and answer /api/health
// regardless of whether the DB modules load successfully.

import express from 'express';
import type { Router } from 'express';

const app = express();
app.use(express.json({ limit: '10mb' }));

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Health check — zero DB imports, always boots even without env vars.
app.get('/api/health', (_req, res) => {
  res.json({
    ok: !!process.env.TURSO_DATABASE_URL && !!process.env.TURSO_AUTH_TOKEN,
    ts: new Date().toISOString(),
    tursoUrl: process.env.TURSO_DATABASE_URL ? 'set' : 'MISSING — add TURSO_DATABASE_URL in Vercel env vars',
    tursoToken: process.env.TURSO_AUTH_TOKEN ? 'set' : 'MISSING — add TURSO_AUTH_TOKEN in Vercel env vars',
  });
});

// Lazily mount the API + photos routers. The promise is created once and
// shared, so concurrent cold-start requests all await the same load.
// Once mounted, Express picks them up when this middleware calls next().
let mountError: string | null = null;
let mounted = false;

const mountOnce = (async () => {
  try {
    const routes = await import('../server/routes');
    app.use('/api', routes.router as Router);
    app.use(routes.photosRouter as Router);
    mounted = true;
    // Fire-and-forget DB init (migrations are idempotent, seed runs once).
    import('../server/db')
      .then(({ runMigrations }) => runMigrations())
      .then(() => import('../server/seed'))
      .then(({ seedIfEmpty }) => seedIfEmpty())
      .catch((err) => console.error('[api] DB init error:', err));
  } catch (err) {
    mountError = err instanceof Error ? err.message : String(err);
    console.error('[api] routes failed to mount:', mountError);
  }
})();

// Block non-health requests until routes are mounted (or failed).
app.use(async (_req, res, next) => {
  if (!mounted && !mountError) await mountOnce;
  if (mountError) {
    res.status(503).json({ error: 'Server startup failed', detail: mountError });
    return;
  }
  next();
});

export default app;
