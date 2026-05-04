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

await runMigrations();
await seedIfEmpty();

const app = express();
app.use(express.json({ limit: '10mb' }));

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

app.use('/api', router);
app.use(photosRouter);

export default app;
