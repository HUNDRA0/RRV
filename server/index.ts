// Express API server.
// Boot order: open libSQL connection, run migrations, seed if empty, then
// start listening. /photos/:id is served by an Express route (not static
// middleware) because images live as BLOBs inside the DB.

import express from 'express';
import { runMigrations, queryOne } from './db';
import { seedIfEmpty } from './seed';
import { router as apiRouter, photosRouter } from './routes';

await runMigrations();
await seedIfEmpty();

const app = express();
app.use(express.json({ limit: '10mb' }));

app.get('/api/health', async (_req, res) => {
  const row = await queryOne<{ n: number }>('SELECT COUNT(*) AS n FROM friends');
  res.json({ ok: true, ts: new Date().toISOString(), friends: row?.n ?? 0 });
});

app.use('/api', apiRouter);
app.use(photosRouter);

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, () => {
  console.log(`[api] listening on http://localhost:${PORT}`);
});
