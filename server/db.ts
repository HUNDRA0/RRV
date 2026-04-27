// Database connection via libSQL (Turso's SQLite-compatible driver). The
// driver is async-only — every query returns a Promise — but it speaks the
// same SQL dialect as plain SQLite so our schema and queries are unchanged.
//
// URL resolution:
//   - TURSO_DATABASE_URL (libsql://…)  → remote Turso DB, nothing on disk
//   - TURSO_DATABASE_URL (file:…)      → local file (useful for tests)
//   - unset                            → defaults to file:server/data/local.db
//
// When TURSO_AUTH_TOKEN is set it's passed through (required for libsql:// URLs).

import { createClient, type Client, type InValue } from '@libsql/client';
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = resolve(HERE, 'migrations');

function buildClient(): Client {
  const url = process.env.TURSO_DATABASE_URL ?? `file:${resolve(HERE, 'data', 'local.db')}`;
  if (url.startsWith('file:')) {
    // Make sure the parent directory exists for the local fallback.
    mkdirSync(resolve(HERE, 'data'), { recursive: true });
  }
  const authToken = process.env.TURSO_AUTH_TOKEN;
  return createClient({ url, ...(authToken ? { authToken } : {}) });
}

export const db: Client = buildClient();

// Tiny helpers that wrap the verbose result API.
export async function queryAll<T>(sql: string, args: InValue[] = []): Promise<T[]> {
  const result = await db.execute({ sql, args });
  return result.rows as unknown as T[];
}
export async function queryOne<T>(sql: string, args: InValue[] = []): Promise<T | undefined> {
  const result = await db.execute({ sql, args });
  return (result.rows[0] as unknown as T | undefined) ?? undefined;
}
export async function exec(sql: string, args: InValue[] = []): Promise<{ lastInsertRowid: number; changes: number }> {
  const result = await db.execute({ sql, args });
  return {
    lastInsertRowid: result.lastInsertRowid !== undefined ? Number(result.lastInsertRowid) : 0,
    changes: result.rowsAffected,
  };
}

export async function runMigrations(): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name        TEXT PRIMARY KEY,
      applied_at  TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  const appliedRows = await queryAll<{ name: string }>('SELECT name FROM _migrations');
  const applied = new Set(appliedRows.map(r => r.name));

  const files = readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    await db.executeMultiple(sql);
    await db.execute({ sql: 'INSERT INTO _migrations (name) VALUES (?)', args: [file] });
    console.log(`[db] applied migration: ${file}`);
  }
}
