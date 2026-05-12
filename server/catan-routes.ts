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
import { emitGameUpdate, subscribeGameUpdate } from './catan/events.js';

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
  emitGameUpdate(state.id);
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
    myPlayerId: requestingPlayerId ?? '',
    devDeck: undefined,
    devDeckSize: state.devDeck.length,
    chatMessages: state.chatMessages ?? [],
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

    // Name collisions: append " 2", " 3", … until unique. (Case-insensitive
    // match.) Rejoin after refresh still works via the saved token in
    // sessionStorage — name-based rejoin was unsafe (anyone with the room
    // code could take over a slot just by guessing the name).
    const takenLower = new Set(state.players.map(p => p.name.toLowerCase()));
    let finalName = name;
    if (takenLower.has(name.toLowerCase())) {
      let n = 2;
      while (takenLower.has(`${name} ${n}`.toLowerCase())) n++;
      finalName = `${name} ${n}`;
    }

    try {
      const playerId = randomUUID();
      const newState = addPlayer(state, playerId, finalName);
      await saveGame(newState);
      const token = await createPlayerToken(id, playerId);
      res.status(201).json({ playerId, token, name: finalName });
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
    const sinceParam = req.query.since as string | undefined;

    let state = await loadGame(id);
    if (!state) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    // Long poll: if client already has this version, hold up to 7 s OR until
    // an event-emitter signals a state change for this game (typically within
    // ~50 ms after the other player's action). Vercel hobby 10 s timeout cap.
    if (sinceParam !== undefined && state.updatedAt === Number(sinceParam) && !state.winner) {
      // Prevent buffering proxies from breaking the hold
      res.setHeader('Cache-Control', 'no-store');
      await new Promise<void>(resolve => {
        let done = false;
        const finish = () => { if (done) return; done = true; clearTimeout(t); unsubscribe(); resolve(); };
        const t = setTimeout(finish, 7000);
        const unsubscribe = subscribeGameUpdate(id, finish);
        req.on('close', finish);
      });
      const fresh = await loadGame(id);
      if (fresh) state = fresh;
    } else {
      res.setHeader('Cache-Control', 'no-store');
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

  // POST /api/catan/:id/chat
  router.post('/catan/:id/chat', async (req, res) => {
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

    const body = req.body as { text?: unknown };
    const text = typeof body.text === 'string' ? body.text.trim().slice(0, 200) : '';
    if (!text) {
      res.status(400).json({ error: 'text is required' });
      return;
    }

    const player = state.players.find(p => p.id === playerId);
    if (!player) {
      res.status(403).json({ error: 'Player not in this game' });
      return;
    }

    const chatMessages = [
      ...(state.chatMessages ?? []),
      { playerId, playerName: player.name, text, ts: Date.now() },
    ].slice(-50);

    const newState: GameState = { ...state, chatMessages };
    await saveGame(newState);
    res.json(filterStateForPlayer(newState, playerId));
  });

  // POST /api/catan/:id/leave
  router.post('/catan/:id/leave', async (req, res) => {
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

    const player = state.players.find(p => p.id === playerId);
    if (!player) {
      res.status(200).json({ ok: true });
      return;
    }

    const chatMessages = [
      ...(state.chatMessages ?? []),
      {
        playerId: 'system',
        playerName: 'System',
        text: `${player.name} lämnade spelet`,
        ts: Date.now(),
        system: true,
      },
    ].slice(-50);

    const newState: GameState = { ...state, chatMessages };
    await saveGame(newState);
    res.status(200).json({ ok: true });
  });
}
