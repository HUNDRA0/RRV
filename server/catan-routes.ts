import { type Router } from 'express';
import { randomUUID } from 'node:crypto';
import { exec, queryOne } from './db.js';
import {
  createGame,
  addPlayer,
  startGame,
  applyAction,
  countVP,
  type GameAction,
} from './catan/game.js';
import type { GameState, Player } from './catan/types.js';
import { emitGameUpdate } from './catan/events.js';

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
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 8) : '';
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
    const raw = (req.params as { code: string }).code.toUpperCase();
    // Strict validation: 4–8 ASCII letters/digits only. Blocks SQL LIKE
    // wildcards (% _) and any other unexpected characters.
    if (!/^[A-Z0-9]{4,8}$/.test(raw)) {
      res.status(400).json({ error: 'invalid code format' });
      return;
    }
    const row = await queryOne<{ id: string, state: string }>(
      'SELECT id, state FROM catan_games WHERE state LIKE ?',
      [`%"code":"${raw}"%`],
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
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 8) : '';
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

    const playerId = randomUUID();
    let newState;
    try {
      newState = addPlayer(state, playerId, finalName);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'invalid join' });
      return;
    }
    try {
      await saveGame(newState);
      const token = await createPlayerToken(id, playerId);
      res.status(201).json({ playerId, token, name: finalName });
    } catch (err) {
      console.error('[catan join]', err);
      res.status(500).json({ error: 'kunde inte spara spel' });
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

    let newState;
    try {
      newState = startGame(state, playerId);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'cannot start' });
      return;
    }
    try {
      await saveGame(newState);
      res.json(filterStateForPlayer(newState, playerId));
    } catch (err) {
      console.error('[catan start]', err);
      res.status(500).json({ error: 'kunde inte spara spel' });
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

    res.setHeader('Cache-Control', 'no-store');

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

    let newState;
    try {
      newState = applyAction(state, playerId, action);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'invalid action' });
      return;
    }
    try {
      await saveGame(newState);
      res.json(filterStateForPlayer(newState, playerId));
    } catch (err) {
      console.error('[catan action]', err);
      res.status(500).json({ error: 'kunde inte spara spel' });
    }
  });

  // (Removed: public GET /api/catan game-list endpoint — leaked active
  // game IDs to anonymous callers and was only intended for debugging.)

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
