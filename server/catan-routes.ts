import { type Router } from 'express';
import { randomUUID } from 'node:crypto';
import { exec, queryAll, queryOne } from './db.js';
import {
  createGame,
  addPlayer,
  startGame,
  applyAction,
  countVP,
  type GameAction,
} from './catan/game.js';
import type { GameState, Player } from './catan/types.js';

// ── Persistence helpers ───────────────────────────────────────────────────────

async function loadGame(gameId: string): Promise<GameState | null> {
  const row = await queryOne<{ state: string }>('SELECT state FROM catan_games WHERE id = ?', [gameId]);
  if (!row) return null;
  return JSON.parse(row.state) as GameState;
}

async function saveGame(state: GameState): Promise<void> {
  await exec(
    'INSERT OR REPLACE INTO catan_games (id, state, updated_at) VALUES (?, ?, unixepoch())',
    [state.id, JSON.stringify(state)],
  );
}

async function getPlayerId(gameId: string, token: string): Promise<string | null> {
  const row = await queryOne<{ player_id: string }>(
    'SELECT player_id FROM catan_players WHERE game_id = ? AND token = ?',
    [gameId, token],
  );
  return row?.player_id ?? null;
}

async function createPlayerToken(gameId: string, playerId: string): Promise<string> {
  const token = randomUUID();
  await exec(
    'INSERT INTO catan_players (game_id, player_id, token) VALUES (?, ?, ?)',
    [gameId, playerId, token],
  );
  return token;
}

// ── State filtering (hide other players' dev cards) ───────────────────────────

function filterStateForPlayer(state: GameState, requestingPlayerId: string | null) {
  return {
    ...state,
    devDeck: state.devDeck.length, // just count
    players: state.players.map(p => {
      if (p.id === requestingPlayerId) {
        return {
          ...p,
          vp: countVP(p, state),
        };
      }
      return {
        ...p,
        devCards: p.devCards.length, // hide card types from others
        vp: countVP(p, state),
      };
    }),
  };
}

function getToken(req: { headers: Record<string, string | string[] | undefined> }): string | null {
  const raw = req.headers['x-catan-token'];
  if (!raw) return null;
  return Array.isArray(raw) ? raw[0] : raw;
}

// ── Route registration ────────────────────────────────────────────────────────

export function addCatanRoutes(router: Router): void {
  // POST /api/catan/create
  router.post('/catan/create', async (req, res) => {
    const body = req.body as { name?: unknown };
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }

    const gameId = randomUUID();
    const playerId = randomUUID();
    const state = createGame(gameId, playerId, name);
    await saveGame(state);
    const token = await createPlayerToken(gameId, playerId);

    res.status(201).json({ gameId, playerId, token, code: state.code });
  });

  // GET /api/catan/by-code/:code → { gameId }
  router.get('/catan/by-code/:code', async (req, res) => {
    const code = (req.params as { code: string }).code.toUpperCase();
    const row = await queryOne<{ id: string, state: string }>(
      'SELECT id, state FROM catan_games WHERE state LIKE ?',
      [`%"code":"${code}"%`],
    );
    if (!row) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }
    res.json({ gameId: row.id });
  });

  // POST /api/catan/:id/join
  router.post('/catan/:id/join', async (req, res) => {
    const { id } = req.params as { id: string };
    const body = req.body as { name?: unknown };
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }

    const state = await loadGame(id);
    if (!state) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    // Check if a player with this name already exists and has a token (rejoin)
    const existingPlayer = state.players.find(p => p.name.toLowerCase() === name.toLowerCase());
    if (existingPlayer) {
      const existingToken = await queryOne<{ token: string }>(
        'SELECT token FROM catan_players WHERE game_id = ? AND player_id = ?',
        [id, existingPlayer.id],
      );
      if (existingToken) {
        res.json({ playerId: existingPlayer.id, token: existingToken.token });
        return;
      }
    }

    try {
      const playerId = randomUUID();
      const newState = addPlayer(state, playerId, name);
      await saveGame(newState);
      const token = await createPlayerToken(id, playerId);
      res.status(201).json({ playerId, token });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // POST /api/catan/:id/start
  router.post('/catan/:id/start', async (req, res) => {
    const { id } = req.params as { id: string };
    const token = getToken(req);
    if (!token) {
      res.status(401).json({ error: 'x-catan-token header required' });
      return;
    }

    const playerId = await getPlayerId(id, token);
    if (!playerId) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    const state = await loadGame(id);
    if (!state) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    try {
      const newState = startGame(state, playerId);
      await saveGame(newState);
      res.json(filterStateForPlayer(newState, playerId));
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // GET /api/catan/:id
  router.get('/catan/:id', async (req, res) => {
    const { id } = req.params as { id: string };
    const token = getToken(req);

    const state = await loadGame(id);
    if (!state) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    let requestingPlayerId: string | null = null;
    if (token) {
      requestingPlayerId = await getPlayerId(id, token);
    }

    res.json(filterStateForPlayer(state, requestingPlayerId));
  });

  // POST /api/catan/:id/action
  router.post('/catan/:id/action', async (req, res) => {
    const { id } = req.params as { id: string };
    const token = getToken(req);
    if (!token) {
      res.status(401).json({ error: 'x-catan-token header required' });
      return;
    }

    const playerId = await getPlayerId(id, token);
    if (!playerId) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    const state = await loadGame(id);
    if (!state) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    const action = req.body as GameAction;
    if (!action || typeof action.type !== 'string') {
      res.status(400).json({ error: 'Invalid action' });
      return;
    }

    try {
      const newState = applyAction(state, playerId, action);
      await saveGame(newState);
      res.json(filterStateForPlayer(newState, playerId));
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // GET /api/catan (list active games — useful for debugging)
  router.get('/catan', async (_req, res) => {
    const rows = await queryAll<{ id: string; created_at: number; updated_at: number }>(
      'SELECT id, created_at, updated_at FROM catan_games ORDER BY updated_at DESC LIMIT 20',
    );
    res.json(rows);
  });

  // GET /api/catan/:id/players (public player list without sensitive data)
  router.get('/catan/:id/players', async (req, res) => {
    const { id } = req.params as { id: string };
    const state = await loadGame(id);
    if (!state) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }
    res.json(state.players.map((p: Player) => ({ id: p.id, name: p.name, color: p.color })));
  });
}
