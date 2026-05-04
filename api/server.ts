// Vercel serverless entry-point. Wraps the Express routes from server/ so
// they run as a single Lambda function. Vercel handles the Node.js adapter;
// we just export the Express app.
//
// The migrations are already applied in Turso — we skip runMigrations() here.
// No seedIfEmpty() either — production data lives in the remote DB.

import express from 'express';
import { router, photosRouter } from '../server/routes';

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
