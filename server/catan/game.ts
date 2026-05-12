import type {
  GameState,
  Player,
  Resource,
  Resources,
  DevCardType,
  PlayerColor,
  BuildingType,
  Vertex,
  Edge,
} from './types.js';
import { generateBoard } from './board.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const PLAYER_COLORS: PlayerColor[] = ['red', 'blue', 'orange', 'white'];
const BANK_MAX = 19;

const SETTLEMENT_COST: Resources = { wood: 1, brick: 1, grain: 1, wool: 1, ore: 0 };
const ROAD_COST: Resources = { wood: 1, brick: 1, grain: 0, ore: 0, wool: 0 };
const CITY_COST: Resources = { wood: 0, brick: 0, grain: 2, ore: 3, wool: 0 };
const DEV_CARD_COST: Resources = { wood: 0, brick: 0, grain: 1, ore: 1, wool: 1 };

const PIECE_LIMITS = { settlements: 5, cities: 4, roads: 15 };

// Per-turn time budget. Each turn change (incl. setup steps) resets to now + TURN_MS.
const TURN_MS = 60_000;
function nextDeadline(): number { return Date.now() + TURN_MS; }

// Standard 25-card dev deck
function buildDevDeck(): DevCardType[] {
  const deck: DevCardType[] = [
    ...Array(14).fill('knight'),
    ...Array(2).fill('roadBuilding'),
    ...Array(2).fill('yearOfPlenty'),
    ...Array(2).fill('monopoly'),
    ...Array(5).fill('victoryPoint'),
  ];
  return shuffle(deck);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function emptyResources(): Resources {
  return { wood: 0, brick: 0, grain: 0, ore: 0, wool: 0 };
}

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function createGame(gameId: string, hostId: string, hostName: string): GameState {
  const board = generateBoard();
  const host: Player = {
    id: hostId,
    name: hostName,
    color: PLAYER_COLORS[0],
    resources: emptyResources(),
    devCards: [],
    playedKnights: 0,
    settlements: PIECE_LIMITS.settlements,
    cities: PIECE_LIMITS.cities,
    roads: PIECE_LIMITS.roads,
    hasLargestArmy: false,
    hasLongestRoad: false,
    devCardPlayedThisTurn: false,
    justBoughtDevCard: null,
  };
  return {
    id: gameId,
    code: generateCode(),
    phase: 'lobby',
    hostId,
    players: [host],
    board,
    currentPlayerIndex: 0,
    setupRound: 1,
    setupDirection: 'forward',
    setupStep: 'settlement',
    diceRolled: false,
    dice: null,
    devDeck: buildDevDeck(),
    longestRoadLength: 0,
    longestRoadPlayerId: null,
    largestArmyCount: 0,
    largestArmyPlayerId: null,
    tradeOffer: null,
    pendingAction: null,
    log: [`${hostName} created the game.`],
    chatMessages: [],
    turnDeadline: null,
    winner: null,
    updatedAt: Date.now(),
  };
}

export function addPlayer(state: GameState, playerId: string, name: string): GameState {
  if (state.phase !== 'lobby') throw new Error('Game already started');
  if (state.players.length >= 4) throw new Error('Game is full');
  if (state.players.some(p => p.id === playerId)) throw new Error('Already in game');
  const player: Player = {
    id: playerId,
    name,
    color: PLAYER_COLORS[state.players.length],
    resources: emptyResources(),
    devCards: [],
    playedKnights: 0,
    settlements: PIECE_LIMITS.settlements,
    cities: PIECE_LIMITS.cities,
    roads: PIECE_LIMITS.roads,
    hasLargestArmy: false,
    hasLongestRoad: false,
    devCardPlayedThisTurn: false,
    justBoughtDevCard: null,
  };
  return {
    ...state,
    players: [...state.players, player],
    log: [...state.log, `${name} joined.`],
    updatedAt: Date.now(),
  };
}

export function startGame(state: GameState, playerId: string): GameState {
  if (state.phase !== 'lobby') throw new Error('Game already started');
  if (playerId !== state.hostId) throw new Error('Only the host can start the game');
  if (state.players.length < 2) throw new Error('Need at least 2 players to start');
  const diceOffRolls: Record<string, [number, number] | null> = {};
  state.players.forEach(p => { diceOffRolls[p.id] = null; });
  return {
    ...state,
    phase: 'diceOff',
    diceOffRolls,
    diceOffActive: state.players.map(p => p.id),
    turnDeadline: nextDeadline(),
    log: [...state.log, 'Spelet börjar! Varje spelare kastar tärning — högst summa börjar.'],
    updatedAt: Date.now(),
  };
}

// ── Action types ──────────────────────────────────────────────────────────────

export type DevCardParams =
  | { resource1: Resource; resource2: Resource }
  | { resource: Resource }
  | { edgeId1: string; edgeId2?: string };

export type GameAction =
  | { type: 'placeSettlement'; vertexId: string }
  | { type: 'placeRoad'; edgeId: string }
  | { type: 'rollDice' }
  | { type: 'moveRobber'; hexId: string }
  | { type: 'steal'; targetPlayerId: string }
  | { type: 'buildSettlement'; vertexId: string }
  | { type: 'buildRoad'; edgeId: string }
  | { type: 'buildCity'; vertexId: string }
  | { type: 'buyDevCard' }
  | { type: 'playDevCard'; card: DevCardType; params?: DevCardParams }
  | { type: 'tradeBank'; give: Resource; want: Resource }
  | { type: 'tradeOffer'; give: Resources; want: Resources }
  | { type: 'tradeRespond'; accept: boolean }
  | { type: 'tradeComplete'; acceptingPlayerId: string }
  | { type: 'tradeCancel' }
  | { type: 'endTurn' }
  | { type: 'diceOffRoll' }
  | { type: 'forceEndTurn' };

// ── Main dispatch ─────────────────────────────────────────────────────────────

export function applyAction(state: GameState, playerId: string, action: GameAction): GameState {
  if (state.winner) throw new Error('Game is over');

  // diceOffRoll is allowed by any active player regardless of currentPlayerIndex
  if (action.type === 'diceOffRoll') return handleDiceOffRoll(state, playerId);

  // forceEndTurn — any player may invoke once the deadline is past
  if (action.type === 'forceEndTurn') return handleForceEndTurn(state);

  // Trade respond is allowed for non-current players
  if (action.type === 'tradeRespond') return handleTradeRespond(state, playerId, action.accept);

  // For all other actions, must be current player (unless pending steal check)
  const currentPlayer = state.players[state.currentPlayerIndex];
  if (!currentPlayer) throw new Error('No current player');

  if (state.phase === 'setup') return handleSetupAction(state, playerId, action);

  if (playerId !== currentPlayer.id) throw new Error('Not your turn');

  switch (action.type) {
    case 'rollDice': return handleRollDice(state, currentPlayer);
    case 'moveRobber': return handleMoveRobber(state, currentPlayer, action.hexId);
    case 'steal': return handleSteal(state, currentPlayer, action.targetPlayerId);
    case 'buildSettlement': return handleBuildSettlement(state, currentPlayer, action.vertexId);
    case 'buildRoad': return handleBuildRoad(state, currentPlayer, action.edgeId);
    case 'buildCity': return handleBuildCity(state, currentPlayer, action.vertexId);
    case 'buyDevCard': return handleBuyDevCard(state, currentPlayer);
    case 'playDevCard': return handlePlayDevCard(state, currentPlayer, action.card, action.params);
    case 'tradeBank': return handleTradeBank(state, currentPlayer, action.give, action.want);
    case 'tradeOffer': return handleTradeOffer(state, currentPlayer, action.give, action.want);
    case 'tradeComplete': return handleTradeComplete(state, currentPlayer, action.acceptingPlayerId);
    case 'tradeCancel': return handleTradeCancel(state, currentPlayer);
    case 'endTurn': return handleEndTurn(state, currentPlayer);
    default: throw new Error('Unknown action type');
  }
}

// ── Setup phase ───────────────────────────────────────────────────────────────

function handleSetupAction(state: GameState, playerId: string, action: GameAction): GameState {
  const currentPlayer = state.players[state.currentPlayerIndex];
  if (!currentPlayer) throw new Error('No current player');
  if (playerId !== currentPlayer.id) throw new Error('Not your turn');

  if (action.type === 'placeSettlement') {
    return handleSetupSettlement(state, currentPlayer, action.vertexId);
  }
  if (action.type === 'placeRoad') {
    return handleSetupRoad(state, currentPlayer, action.edgeId);
  }
  throw new Error(`Action '${action.type}' not valid during setup`);
}

function handleSetupSettlement(state: GameState, player: Player, vertexId: string): GameState {
  if (state.setupStep !== 'settlement') throw new Error('Place a road first');
  const vertex = findVertex(state, vertexId);
  if (vertex.building) throw new Error('Vertex already occupied');
  if (!distanceRuleOk(state, vertexId)) throw new Error('Too close to another settlement');
  if (player.settlements <= 0) throw new Error('No settlements left');

  const updatedPlayers = updatePlayer(state.players, player.id, p => ({
    ...p,
    settlements: p.settlements - 1,
  }));
  const updatedVertices = state.board.vertices.map(v =>
    v.id === vertexId ? { ...v, building: { type: 'settlement' as BuildingType, playerId: player.id } } : v,
  );

  return {
    ...state,
    players: updatedPlayers,
    board: { ...state.board, vertices: updatedVertices },
    setupStep: 'road',
    log: [...state.log, `${player.name} placed a settlement.`],
    updatedAt: Date.now(),
  };
}

function handleSetupRoad(state: GameState, player: Player, edgeId: string): GameState {
  if (state.setupStep !== 'road') throw new Error('Place a settlement first');
  const edge = findEdge(state, edgeId);
  if (edge.road) throw new Error('Edge already has a road');
  if (player.roads <= 0) throw new Error('No roads left');

  // Must be adjacent to the last-placed settlement of this player
  const lastSettlement = findLastSettlement(state, player.id);
  if (!lastSettlement) throw new Error('No settlement found for road placement');
  if (edge.v1 !== lastSettlement && edge.v2 !== lastSettlement) {
    throw new Error('Road must connect to your last settlement');
  }

  const updatedPlayers = updatePlayer(state.players, player.id, p => ({
    ...p,
    roads: p.roads - 1,
  }));
  const updatedEdges = state.board.edges.map(e =>
    e.id === edgeId ? { ...e, road: { playerId: player.id } } : e,
  );

  let newState: GameState = {
    ...state,
    players: updatedPlayers,
    board: { ...state.board, edges: updatedEdges },
    log: [...state.log, `${player.name} placed a road.`],
    updatedAt: Date.now(),
  };

  // Grant resources for round 2 settlement
  if (state.setupRound === 2) {
    const lastVid = lastSettlement;
    const lastV = newState.board.vertices.find(v => v.id === lastVid);
    if (lastV) {
      const resources = emptyResources();
      for (const hexId of lastV.hexIds) {
        const hex = newState.board.hexes.find(h => h.id === hexId);
        if (hex && hex.terrain !== 'desert') {
          resources[hex.terrain as Resource]++;
        }
      }
      newState = {
        ...newState,
        players: updatePlayer(newState.players, player.id, p => ({
          ...p,
          resources: addResources(p.resources, resources),
        })),
        log: [...newState.log, `${player.name} received starting resources.`],
      };
    }
  }

  // Advance setup turn
  return advanceSetupTurn(newState);
}

function findLastSettlement(state: GameState, playerId: string): string | null {
  // Find the settlement belonging to this player that was placed most recently
  // during setup. In setup, the player places exactly one settlement per turn.
  // We look for all their settlements and find the one without a road yet.
  const playerSettlements = state.board.vertices.filter(
    v => v.building?.playerId === playerId && v.building.type === 'settlement',
  );
  if (playerSettlements.length === 0) return null;

  // Find settlement that doesn't yet have a road touching it from this player
  for (const v of playerSettlements) {
    const hasRoad = state.board.edges.some(
      e => e.road?.playerId === playerId && (e.v1 === v.id || e.v2 === v.id),
    );
    if (!hasRoad) return v.id;
  }
  // If all have roads (shouldn't happen in valid setup), return last one
  return playerSettlements[playerSettlements.length - 1].id;
}

function advanceSetupTurn(state: GameState): GameState {
  const n = state.players.length;
  const cur = state.currentPlayerIndex;
  let next = cur;
  let round = state.setupRound;
  let direction = state.setupDirection;
  let phase: GameState['phase'] = 'setup';

  if (round === 1) {
    if (cur < n - 1) {
      next = cur + 1;
    } else {
      // Last player in round 1 → start round 2 (same player goes again)
      round = 2;
      direction = 'backward';
      next = cur;
    }
  } else {
    // Round 2, backward
    if (cur > 0) {
      next = cur - 1;
    } else {
      // Setup complete
      phase = 'playing';
    }
  }

  return {
    ...state,
    phase,
    currentPlayerIndex: next,
    setupRound: round,
    setupDirection: direction,
    setupStep: 'settlement',
    turnDeadline: nextDeadline(),
    log: phase === 'playing'
      ? [...state.log, 'Setup complete! Game begins.']
      : state.log,
    updatedAt: Date.now(),
  };
}

// ── Playing phase ─────────────────────────────────────────────────────────────

function handleRollDice(state: GameState, player: Player): GameState {
  if (state.phase !== 'playing') throw new Error('Not in playing phase');
  if (state.diceRolled) throw new Error('Dice already rolled this turn');
  if (state.pendingAction) throw new Error('Resolve pending action first');

  const d1 = Math.floor(Math.random() * 6) + 1;
  const d2 = Math.floor(Math.random() * 6) + 1;
  const total = d1 + d2;
  const dice: [number, number] = [d1, d2];

  let newState: GameState = {
    ...state,
    dice,
    diceRolled: true,
    log: [...state.log, `${player.name} rolled ${d1}+${d2}=${total}.`],
    updatedAt: Date.now(),
  };

  if (total === 7) {
    newState = {
      ...newState,
      pendingAction: { type: 'moveRobber' },
      log: [...newState.log, 'Rolled 7! Move the robber.'],
    };
  } else {
    // Produce resources
    newState = produceResources(newState, total);
  }

  return newState;
}

function produceResources(state: GameState, roll: number): GameState {
  let players = [...state.players];
  const logLines: string[] = [];

  for (const hex of state.board.hexes) {
    if (hex.number !== roll || hex.hasRobber) continue;
    const adjacentVertices = state.board.vertices.filter(v => v.hexIds.includes(hex.id));
    for (const v of adjacentVertices) {
      if (!v.building) continue;
      const amount = v.building.type === 'city' ? 2 : 1;
      players = updatePlayer(players, v.building.playerId, p => ({
        ...p,
        resources: addResources(p.resources, { ...emptyResources(), [hex.terrain]: amount }),
      }));
      const p = players.find(pl => pl.id === v.building!.playerId)!;
      logLines.push(`${p.name} received ${amount} ${hex.terrain}.`);
    }
  }

  return {
    ...state,
    players,
    log: [...state.log, ...logLines],
    updatedAt: Date.now(),
  };
}

function handleMoveRobber(state: GameState, player: Player, hexId: string): GameState {
  if (!state.pendingAction || state.pendingAction.type !== 'moveRobber') {
    throw new Error('No pending robber move');
  }
  const hex = state.board.hexes.find(h => h.id === hexId);
  if (!hex) throw new Error('Invalid hex');

  // Find current robber hex
  const currentRobberHex = state.board.hexes.find(h => h.hasRobber);
  if (currentRobberHex?.id === hexId) throw new Error('Must move robber to a different hex');

  const updatedHexes = state.board.hexes.map(h => ({
    ...h,
    hasRobber: h.id === hexId,
  }));

  // Find adjacent players to steal from
  const adjacentVertices = state.board.vertices.filter(v => v.hexIds.includes(hexId));
  const stealFrom = adjacentVertices
    .filter(v => v.building && v.building.playerId !== player.id)
    .map(v => v.building!.playerId)
    .filter((id, i, arr) => arr.indexOf(id) === i) // unique
    .filter(id => {
      const p = state.players.find(pl => pl.id === id);
      return p && totalResources(p.resources) > 0;
    });

  let newState: GameState = {
    ...state,
    board: { ...state.board, hexes: updatedHexes },
    pendingAction: stealFrom.length > 0 ? { type: 'steal', stealFrom } : null,
    log: [...state.log, `${player.name} moved the robber.`],
    updatedAt: Date.now(),
  };

  // If only one player to steal from, auto-steal
  if (stealFrom.length === 1) {
    newState = performSteal(newState, player.id, stealFrom[0]);
    newState = { ...newState, pendingAction: null };
  }

  return newState;
}

function handleSteal(state: GameState, player: Player, targetPlayerId: string): GameState {
  if (!state.pendingAction || state.pendingAction.type !== 'steal') {
    throw new Error('No pending steal');
  }
  const stealFrom = state.pendingAction.stealFrom ?? [];
  if (!stealFrom.includes(targetPlayerId)) throw new Error('Cannot steal from that player');

  const newState = performSteal(state, player.id, targetPlayerId);
  return { ...newState, pendingAction: null };
}

function performSteal(state: GameState, thiefId: string, victimId: string): GameState {
  const victim = state.players.find(p => p.id === victimId);
  if (!victim) throw new Error('Target player not found');
  const available = resourceList(victim.resources);
  if (available.length === 0) return state;

  const stolen = available[Math.floor(Math.random() * available.length)];
  const thief = state.players.find(p => p.id === thiefId)!;

  return {
    ...state,
    players: state.players.map(p => {
      if (p.id === thiefId) return { ...p, resources: addResources(p.resources, { ...emptyResources(), [stolen]: 1 }) };
      if (p.id === victimId) return { ...p, resources: subResources(p.resources, { ...emptyResources(), [stolen]: 1 }) };
      return p;
    }),
    log: [...state.log, `${thief.name} stole 1 resource from ${victim.name}.`],
    updatedAt: Date.now(),
  };
}

function handleBuildSettlement(state: GameState, player: Player, vertexId: string): GameState {
  if (!state.diceRolled) throw new Error('Roll dice first');
  if (state.pendingAction) throw new Error('Resolve pending action first');
  if (!hasResources(player.resources, SETTLEMENT_COST)) throw new Error('Not enough resources');
  if (player.settlements <= 0) throw new Error('No settlements left');

  const vertex = findVertex(state, vertexId);
  if (vertex.building) throw new Error('Vertex already occupied');
  if (!distanceRuleOk(state, vertexId)) throw new Error('Too close to another settlement');

  // Must be on own road network
  const onOwnRoad = state.board.edges.some(
    e => e.road?.playerId === player.id && (e.v1 === vertexId || e.v2 === vertexId),
  );
  if (!onOwnRoad) throw new Error('Settlement must be connected to your road');

  const updatedVertices = state.board.vertices.map(v =>
    v.id === vertexId ? { ...v, building: { type: 'settlement' as BuildingType, playerId: player.id } } : v,
  );
  let newState: GameState = {
    ...state,
    players: updatePlayer(state.players, player.id, p => ({
      ...p,
      resources: subResources(p.resources, SETTLEMENT_COST),
      settlements: p.settlements - 1,
    })),
    board: { ...state.board, vertices: updatedVertices },
    log: [...state.log, `${player.name} built a settlement.`],
    updatedAt: Date.now(),
  };
  newState = recalcLongestRoad(newState);
  return checkWin(newState);
}

function handleBuildRoad(state: GameState, player: Player, edgeId: string): GameState {
  if (!state.diceRolled && !state.pendingAction) throw new Error('Roll dice first');
  if (state.pendingAction && state.pendingAction.type !== 'placeRoad') {
    throw new Error('Resolve pending action first');
  }

  const edge = findEdge(state, edgeId);
  if (edge.road) throw new Error('Edge already has a road');
  if (player.roads <= 0) throw new Error('No roads left');

  // If this is a free road (roadBuilding dev card), no resource cost
  const isFreeRoad = state.pendingAction?.type === 'placeRoad';
  if (!isFreeRoad && !hasResources(player.resources, ROAD_COST)) {
    throw new Error('Not enough resources');
  }
  if (!canPlaceRoad(state, player.id, edgeId)) throw new Error('Road must connect to your network');

  const updatedEdges = state.board.edges.map(e =>
    e.id === edgeId ? { ...e, road: { playerId: player.id } } : e,
  );
  let newState: GameState = {
    ...state,
    players: updatePlayer(state.players, player.id, p => ({
      ...p,
      resources: isFreeRoad ? p.resources : subResources(p.resources, ROAD_COST),
      roads: p.roads - 1,
    })),
    board: { ...state.board, edges: updatedEdges },
    log: [...state.log, `${player.name} built a road.`],
    updatedAt: Date.now(),
  };

  // Update pending road building action
  if (isFreeRoad && newState.pendingAction?.type === 'placeRoad') {
    const roadsLeft = (newState.pendingAction.roadsLeft ?? 1) - 1;
    newState = {
      ...newState,
      pendingAction: roadsLeft > 0 ? { type: 'placeRoad', roadsLeft } : null,
    };
  }

  newState = recalcLongestRoad(newState);
  return checkWin(newState);
}

function handleBuildCity(state: GameState, player: Player, vertexId: string): GameState {
  if (!state.diceRolled) throw new Error('Roll dice first');
  if (state.pendingAction) throw new Error('Resolve pending action first');
  if (!hasResources(player.resources, CITY_COST)) throw new Error('Not enough resources');
  if (player.cities <= 0) throw new Error('No cities left');

  const vertex = findVertex(state, vertexId);
  if (!vertex.building || vertex.building.type !== 'settlement' || vertex.building.playerId !== player.id) {
    throw new Error('No own settlement at that vertex');
  }

  const updatedVertices = state.board.vertices.map(v =>
    v.id === vertexId ? { ...v, building: { type: 'city' as BuildingType, playerId: player.id } } : v,
  );
  const newState: GameState = {
    ...state,
    players: updatePlayer(state.players, player.id, p => ({
      ...p,
      resources: subResources(p.resources, CITY_COST),
      settlements: p.settlements + 1, // settlement piece goes back
      cities: p.cities - 1,
    })),
    board: { ...state.board, vertices: updatedVertices },
    log: [...state.log, `${player.name} built a city.`],
    updatedAt: Date.now(),
  };
  return checkWin(newState);
}

function handleBuyDevCard(state: GameState, player: Player): GameState {
  if (!state.diceRolled) throw new Error('Roll dice first');
  if (state.pendingAction) throw new Error('Resolve pending action first');
  if (!hasResources(player.resources, DEV_CARD_COST)) throw new Error('Not enough resources');
  if (state.devDeck.length === 0) throw new Error('Development card deck is empty');

  const [card, ...rest] = state.devDeck;
  const newState: GameState = {
    ...state,
    devDeck: rest,
    players: updatePlayer(state.players, player.id, p => ({
      ...p,
      resources: subResources(p.resources, DEV_CARD_COST),
      devCards: [...p.devCards, card],
      justBoughtDevCard: card,
    })),
    log: [...state.log, `${player.name} bought a development card.`],
    updatedAt: Date.now(),
  };
  return checkWin(newState);
}

function handlePlayDevCard(
  state: GameState,
  player: Player,
  card: DevCardType,
  params?: DevCardParams,
): GameState {
  if (!player.devCards.includes(card)) throw new Error('You do not have that card');
  if (player.devCardPlayedThisTurn && card !== 'victoryPoint') {
    throw new Error('Can only play one development card per turn');
  }
  if (player.justBoughtDevCard === card && card !== 'victoryPoint') {
    // Bought this card this turn — it can't be played (very edge case: if they have 2 of same type, we block all)
    const sameTypeCount = player.devCards.filter(c => c === card).length;
    if (sameTypeCount <= 1) throw new Error('Cannot play a card bought this turn');
  }

  const cardIdx = player.devCards.indexOf(card);
  const newDevCards = [...player.devCards.slice(0, cardIdx), ...player.devCards.slice(cardIdx + 1)];
  const basePlayer = { ...player, devCards: newDevCards, devCardPlayedThisTurn: card !== 'victoryPoint' ? true : player.devCardPlayedThisTurn };

  let newState: GameState = {
    ...state,
    players: updatePlayer(state.players, player.id, () => basePlayer),
    updatedAt: Date.now(),
  };

  switch (card) {
    case 'knight': {
      newState = {
        ...newState,
        players: updatePlayer(newState.players, player.id, p => ({ ...p, playedKnights: p.playedKnights + 1 })),
        pendingAction: { type: 'moveRobber' },
        log: [...newState.log, `${player.name} played a Knight card.`],
      };
      newState = recalcLargestArmy(newState);
      break;
    }
    case 'roadBuilding': {
      const roadsAvail = Math.min(2, player.roads);
      if (roadsAvail === 0) throw new Error('No roads left to place');
      newState = {
        ...newState,
        pendingAction: { type: 'placeRoad', roadsLeft: roadsAvail },
        log: [...newState.log, `${player.name} played Road Building — place ${roadsAvail} road(s).`],
      };
      break;
    }
    case 'yearOfPlenty': {
      if (!params || !('resource1' in params)) throw new Error('Specify two resources');
      const { resource1, resource2 } = params as { resource1: Resource; resource2: Resource };
      newState = {
        ...newState,
        players: updatePlayer(newState.players, player.id, p => {
          const res = { ...p.resources };
          res[resource1] = (res[resource1] ?? 0) + 1;
          res[resource2] = (res[resource2] ?? 0) + 1;
          return { ...p, resources: res };
        }),
        log: [...newState.log, `${player.name} played Year of Plenty: +1 ${resource1}, +1 ${resource2}.`],
      };
      break;
    }
    case 'monopoly': {
      if (!params || !('resource' in params)) throw new Error('Specify a resource');
      const { resource } = params as { resource: Resource };
      let totalStealed = 0;
      const updatedPlayers = newState.players.map(p => {
        if (p.id === player.id) return p;
        const amount = p.resources[resource] ?? 0;
        totalStealed += amount;
        return { ...p, resources: { ...p.resources, [resource]: 0 } };
      });
      newState = {
        ...newState,
        players: updatePlayer(updatedPlayers, player.id, p => ({
          ...p,
          resources: { ...p.resources, [resource]: (p.resources[resource] ?? 0) + totalStealed },
        })),
        log: [...newState.log, `${player.name} played Monopoly on ${resource}: received ${totalStealed}.`],
      };
      break;
    }
    case 'victoryPoint': {
      newState = {
        ...newState,
        log: [...newState.log, `${player.name} revealed a Victory Point card!`],
      };
      break;
    }
  }

  return checkWin(newState);
}

function handleTradeBank(state: GameState, player: Player, give: Resource, want: Resource): GameState {
  if (!state.diceRolled) throw new Error('Roll dice first');
  if (state.pendingAction) throw new Error('Resolve pending action first');
  if (give === want) throw new Error('Cannot trade a resource for itself');

  const ratio = getPlayerTradeRatio(player, give, state.board.vertices);
  if (player.resources[give] < ratio) throw new Error(`Need ${ratio} ${give} to trade`);

  // Check bank has enough
  const bankAmount = calcBankAmount(state, want);
  if (bankAmount < 1) throw new Error('Bank has no more of that resource');

  const newState: GameState = {
    ...state,
    players: updatePlayer(state.players, player.id, p => {
      const res = { ...p.resources };
      res[give] -= ratio;
      res[want] += 1;
      return { ...p, resources: res };
    }),
    log: [...state.log, `${player.name} traded ${ratio} ${give} → 1 ${want} with the bank.`],
    updatedAt: Date.now(),
  };
  return newState;
}

function calcBankAmount(state: GameState, resource: Resource): number {
  const totalInPlay = state.players.reduce((sum, p) => {
    sum += p.resources[resource];
    // count dev card cost — dev deck drew from bank already, so just count player hands
    return sum;
  }, 0);
  return BANK_MAX - totalInPlay;
}

function handleTradeOffer(state: GameState, player: Player, give: Resources, want: Resources): GameState {
  if (!state.diceRolled) throw new Error('Roll dice first');
  if (state.pendingAction) throw new Error('Resolve pending action first');
  if (state.tradeOffer) throw new Error('A trade offer is already active');
  if (!hasResources(player.resources, give)) throw new Error('Not enough resources to offer');

  const responses: Record<string, 'pending' | 'accept' | 'decline'> = {};
  for (const p of state.players) {
    if (p.id !== player.id) responses[p.id] = 'pending';
  }

  return {
    ...state,
    tradeOffer: { fromPlayerId: player.id, give, want, responses },
    log: [...state.log, `${player.name} made a trade offer.`],
    updatedAt: Date.now(),
  };
}

// ── Dice-off (starting roll) ──────────────────────────────────────────────────

function handleDiceOffRoll(state: GameState, playerId: string): GameState {
  if (state.phase !== 'diceOff') throw new Error('Not in dice-off phase');
  const active = state.diceOffActive ?? state.players.map(p => p.id);
  const rolls = state.diceOffRolls ?? {};

  if (!active.includes(playerId)) throw new Error('You are not in the current roll-off');
  if (rolls[playerId] !== null && rolls[playerId] !== undefined) throw new Error('You already rolled this round');

  const player = state.players.find(p => p.id === playerId);
  if (!player) throw new Error('Player not found');

  const d1 = (Math.floor(Math.random() * 6) + 1) as 1|2|3|4|5|6;
  const d2 = (Math.floor(Math.random() * 6) + 1) as 1|2|3|4|5|6;
  const newRolls: Record<string, [number, number] | null> = { ...rolls, [playerId]: [d1, d2] };

  // Check if all active players have rolled
  const allRolled = active.every(pid => newRolls[pid] !== null);
  if (!allRolled) {
    return {
      ...state,
      diceOffRolls: newRolls,
      log: [...state.log, `${player.name} kastade ${d1 + d2} (${d1}+${d2}).`],
      updatedAt: Date.now(),
    };
  }

  // All rolled — evaluate
  const sums = active.map(pid => ({ pid, sum: newRolls[pid]![0] + newRolls[pid]![1] }));
  const maxSum = Math.max(...sums.map(s => s.sum));
  const winners = sums.filter(s => s.sum === maxSum);
  const resultLine = active.map(pid => {
    const r = newRolls[pid]!;
    const pName = state.players.find(p => p.id === pid)?.name ?? pid;
    return `${pName} ${r[0]+r[1]}`;
  }).join(', ');

  if (winners.length === 1) {
    const winnerIdx = state.players.findIndex(p => p.id === winners[0].pid);
    const winnerName = state.players[winnerIdx].name;
    return {
      ...state,
      phase: 'setup',
      currentPlayerIndex: winnerIdx,
      diceOffRolls: undefined,
      diceOffActive: undefined,
      setupRound: 1,
      setupDirection: 'forward',
      setupStep: 'settlement',
      turnDeadline: nextDeadline(),
      log: [...state.log,
        `${player.name} kastade ${d1 + d2} (${d1}+${d2}). Resultat: ${resultLine}. ${winnerName} börjar!`,
      ],
      updatedAt: Date.now(),
    };
  }

  // Tie — keep tied players and re-roll
  const tiedIds = winners.map(w => w.pid);
  const tiedNames = tiedIds.map(pid => state.players.find(p => p.id === pid)?.name ?? pid).join(' och ');
  const tieRolls: Record<string, [number, number] | null> = {};
  tiedIds.forEach(pid => { tieRolls[pid] = null; });
  return {
    ...state,
    diceOffRolls: tieRolls,
    diceOffActive: tiedIds,
    turnDeadline: nextDeadline(),
    log: [...state.log,
      `${player.name} kastade ${d1 + d2} (${d1}+${d2}). Resultat: ${resultLine}. Oavgjort mellan ${tiedNames} — kasta om!`,
    ],
    updatedAt: Date.now(),
  };
}

// ── Force end turn (timer expiry) ─────────────────────────────────────────────

function handleForceEndTurn(state: GameState): GameState {
  if (state.winner) throw new Error('Game is over');
  if (state.turnDeadline === null) throw new Error('No active timer');
  if (Date.now() <= state.turnDeadline) throw new Error('Turn not yet expired');

  // diceOff: auto-roll for any still-active players who haven't rolled
  if (state.phase === 'diceOff') {
    let s = state;
    const active = s.diceOffActive ?? [];
    for (const pid of active) {
      const rolls = s.diceOffRolls ?? {};
      if (rolls[pid] === null || rolls[pid] === undefined) {
        s = handleDiceOffRoll(s, pid);
      }
    }
    return s;
  }

  // Setup: skip the AFK player's setup turn (no settlement/road placed).
  // Round 1 missed → no starting resources; round 2 missed → same. They lose pieces? No, just skip.
  if (state.phase === 'setup') {
    const skippedName = state.players[state.currentPlayerIndex]?.name ?? 'Spelaren';
    const skipped: GameState = {
      ...state,
      setupStep: state.setupStep === 'settlement' ? 'road' : state.setupStep,
      log: [...state.log, `${skippedName} hann inte placera — turen hoppas över.`],
    };
    // advanceSetupTurn assumes road just placed; we mimic that by calling it directly
    return advanceSetupTurn(skipped);
  }

  // Playing: skip to next player
  const currentName = state.players[state.currentPlayerIndex]?.name ?? 'Spelaren';
  const next = (state.currentPlayerIndex + 1) % state.players.length;
  return {
    ...state,
    currentPlayerIndex: next,
    diceRolled: false,
    dice: null,
    pendingAction: null,
    tradeOffer: null,
    turnDeadline: nextDeadline(),
    players: state.players.map(p => p.id === state.players[state.currentPlayerIndex].id
      ? { ...p, devCardPlayedThisTurn: false, justBoughtDevCard: null }
      : p),
    log: [...state.log, `${currentName}s tid gick ut — turen går vidare.`],
    updatedAt: Date.now(),
  };
}

function handleTradeRespond(state: GameState, playerId: string, accept: boolean): GameState {
  if (!state.tradeOffer) throw new Error('No active trade offer');
  if (state.tradeOffer.fromPlayerId === playerId) throw new Error('Cannot respond to your own offer');
  if (!(playerId in state.tradeOffer.responses)) throw new Error('Not a valid responder');

  // Check if accepting player has the wanted resources
  if (accept) {
    const responder = state.players.find(p => p.id === playerId);
    if (!responder || !hasResources(responder.resources, state.tradeOffer.want)) {
      throw new Error('You do not have the requested resources');
    }
  }

  const newResponses = { ...state.tradeOffer.responses, [playerId]: accept ? 'accept' as const : 'decline' as const };
  const responderName = state.players.find(p => p.id === playerId)?.name ?? playerId;

  // If everyone has declined (no pending, no accept left) — auto-cancel the offer
  const allDeclined = Object.values(newResponses).every(r => r === 'decline');
  if (allDeclined) {
    return {
      ...state,
      tradeOffer: null,
      log: [...state.log, `${responderName} declined the trade. Offer cancelled.`],
      updatedAt: Date.now(),
    };
  }

  return {
    ...state,
    tradeOffer: { ...state.tradeOffer, responses: newResponses },
    log: [...state.log, `${responderName} ${accept ? 'accepted' : 'declined'} the trade.`],
    updatedAt: Date.now(),
  };
}

function handleTradeComplete(state: GameState, player: Player, acceptingPlayerId: string): GameState {
  if (!state.tradeOffer) throw new Error('No active trade offer');
  if (state.tradeOffer.fromPlayerId !== player.id) throw new Error('Only the offeror can complete the trade');
  if (state.tradeOffer.responses[acceptingPlayerId] !== 'accept') {
    throw new Error('That player has not accepted');
  }

  const { give, want } = state.tradeOffer;
  if (!hasResources(player.resources, give)) throw new Error('Offeror no longer has enough resources');
  const acceptor = state.players.find(p => p.id === acceptingPlayerId);
  if (!acceptor || !hasResources(acceptor.resources, want)) throw new Error('Acceptor no longer has enough resources');

  const acceptorName = acceptor.name;
  return {
    ...state,
    players: state.players.map(p => {
      if (p.id === player.id) return { ...p, resources: addResources(subResources(p.resources, give), want) };
      if (p.id === acceptingPlayerId) return { ...p, resources: addResources(subResources(p.resources, want), give) };
      return p;
    }),
    tradeOffer: null,
    log: [...state.log, `${player.name} and ${acceptorName} completed a trade.`],
    updatedAt: Date.now(),
  };
}

function handleTradeCancel(state: GameState, player: Player): GameState {
  if (!state.tradeOffer) throw new Error('No active trade offer');
  if (state.tradeOffer.fromPlayerId !== player.id) throw new Error('Only the offeror can cancel the trade');
  return {
    ...state,
    tradeOffer: null,
    log: [...state.log, `${player.name} cancelled the trade offer.`],
    updatedAt: Date.now(),
  };
}

function handleEndTurn(state: GameState, player: Player): GameState {
  if (!state.diceRolled) throw new Error('Roll dice first');
  if (state.pendingAction) throw new Error('Resolve pending action first');
  if (state.tradeOffer) throw new Error('Cancel trade offer first');

  const next = (state.currentPlayerIndex + 1) % state.players.length;
  return {
    ...state,
    currentPlayerIndex: next,
    diceRolled: false,
    dice: null,
    turnDeadline: nextDeadline(),
    players: updatePlayer(state.players, player.id, p => ({
      ...p,
      devCardPlayedThisTurn: false,
      justBoughtDevCard: null,
    })),
    log: [...state.log, `${player.name} ended their turn.`],
    updatedAt: Date.now(),
  };
}

// ── VP & win condition ────────────────────────────────────────────────────────

export function countVP(player: Player, state: GameState): number {
  const settlements = state.board.vertices.filter(
    v => v.building?.playerId === player.id && v.building.type === 'settlement',
  ).length;
  const cities = state.board.vertices.filter(
    v => v.building?.playerId === player.id && v.building.type === 'city',
  ).length;
  const vpCards = player.devCards.filter(c => c === 'victoryPoint').length;
  const longestRoad = player.hasLongestRoad ? 2 : 0;
  const largestArmy = player.hasLargestArmy ? 2 : 0;
  return settlements + cities * 2 + vpCards + longestRoad + largestArmy;
}

function checkWin(state: GameState): GameState {
  for (const player of state.players) {
    if (countVP(player, state) >= 10) {
      return {
        ...state,
        phase: 'ended',
        winner: player.id,
        log: [...state.log, `${player.name} wins!`],
      };
    }
  }
  return state;
}

// ── Longest road ──────────────────────────────────────────────────────────────

function recalcLongestRoad(state: GameState): GameState {
  const lengths = new Map<string, number>();
  for (const player of state.players) {
    lengths.set(player.id, calcLongestRoad(state, player.id));
  }

  let maxLength = Math.max(state.longestRoadLength, 4); // minimum 5 to claim
  let holderId = state.longestRoadPlayerId;

  for (const [pid, len] of lengths) {
    if (len >= 5 && len > maxLength) {
      maxLength = len;
      holderId = pid;
    }
  }

  // If current holder lost the longest road (their length dropped), recalculate
  if (holderId && (lengths.get(holderId) ?? 0) < maxLength) {
    maxLength = 0;
    holderId = null;
    for (const [pid, len] of lengths) {
      if (len >= 5 && len > maxLength) {
        maxLength = len;
        holderId = pid;
      }
    }
  }

  const newPlayers = state.players.map(p => ({
    ...p,
    hasLongestRoad: p.id === holderId,
  }));

  return {
    ...state,
    players: newPlayers,
    longestRoadLength: maxLength,
    longestRoadPlayerId: holderId,
  };
}

function calcLongestRoad(state: GameState, playerId: string): number {
  const playerEdges = state.board.edges.filter(e => e.road?.playerId === playerId);
  if (playerEdges.length === 0) return 0;

  let maxLength = 0;

  for (const startEdge of playerEdges) {
    const visited = new Set<string>();
    visited.add(startEdge.id);
    const len1 = dfsRoad(state, playerId, startEdge.v1, startEdge.v2, visited);
    visited.clear();
    visited.add(startEdge.id);
    const len2 = dfsRoad(state, playerId, startEdge.v2, startEdge.v1, visited);
    maxLength = Math.max(maxLength, 1 + len1 + len2);
  }

  return maxLength;
}

function dfsRoad(
  state: GameState,
  playerId: string,
  fromVertex: string,
  _toVertex: string,
  visitedEdges: Set<string>,
): number {
  // Check if this vertex is blocked by an opponent's building
  const vertex = state.board.vertices.find(v => v.id === fromVertex);
  if (vertex?.building && vertex.building.playerId !== playerId) return 0;

  let best = 0;
  const adjacentEdges = state.board.edges.filter(
    e => e.road?.playerId === playerId && !visitedEdges.has(e.id) &&
      (e.v1 === fromVertex || e.v2 === fromVertex),
  );

  for (const edge of adjacentEdges) {
    const nextVertex = edge.v1 === fromVertex ? edge.v2 : edge.v1;
    visitedEdges.add(edge.id);
    const len = dfsRoad(state, playerId, nextVertex, fromVertex, visitedEdges);
    best = Math.max(best, 1 + len);
    visitedEdges.delete(edge.id);
  }

  return best;
}

// ── Largest army ──────────────────────────────────────────────────────────────

function recalcLargestArmy(state: GameState): GameState {
  let maxKnights = Math.max(state.largestArmyCount, 2); // minimum 3 to claim
  let holderId = state.largestArmyPlayerId;

  for (const player of state.players) {
    if (player.playedKnights >= 3 && player.playedKnights > maxKnights) {
      maxKnights = player.playedKnights;
      holderId = player.id;
    }
  }

  const newPlayers = state.players.map(p => ({
    ...p,
    hasLargestArmy: p.id === holderId,
  }));

  return {
    ...state,
    players: newPlayers,
    largestArmyCount: maxKnights,
    largestArmyPlayerId: holderId,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function findVertex(state: GameState, vertexId: string): Vertex {
  const v = state.board.vertices.find(v => v.id === vertexId);
  if (!v) throw new Error(`Vertex ${vertexId} not found`);
  return v;
}

function findEdge(state: GameState, edgeId: string): Edge {
  const e = state.board.edges.find(e => e.id === edgeId);
  if (!e) throw new Error(`Edge ${edgeId} not found`);
  return e;
}

function distanceRuleOk(state: GameState, vertexId: string): boolean {
  // Check that no adjacent vertex has a building
  const adjacentVertexIds = new Set<string>();
  for (const edge of state.board.edges) {
    if (edge.v1 === vertexId) adjacentVertexIds.add(edge.v2);
    if (edge.v2 === vertexId) adjacentVertexIds.add(edge.v1);
  }
  for (const adjId of adjacentVertexIds) {
    const adj = state.board.vertices.find(v => v.id === adjId);
    if (adj?.building) return false;
  }
  return true;
}

function canPlaceRoad(state: GameState, playerId: string, edgeId: string): boolean {
  const edge = state.board.edges.find(e => e.id === edgeId);
  if (!edge) return false;

  for (const vid of [edge.v1, edge.v2]) {
    const vertex = state.board.vertices.find(v => v.id === vid);
    // If vertex has an opponent's building, it blocks passage from that vertex only
    if (vertex?.building && vertex.building.playerId !== playerId) continue;
    // Check if any adjacent road or settlement of mine touches this vertex
    const hasOwnBuilding = vertex?.building?.playerId === playerId;
    const hasAdjacentRoad = state.board.edges.some(
      e => e.id !== edgeId && e.road?.playerId === playerId && (e.v1 === vid || e.v2 === vid),
    );
    if (hasOwnBuilding || hasAdjacentRoad) return true;
  }
  return false;
}

function getPlayerTradeRatio(player: Player, resource: Resource, vertices: Vertex[]): number {
  let ratio = 4;
  for (const v of vertices) {
    if (!v.harbor) continue;
    if (!v.building || v.building.playerId !== player.id) continue;
    if (v.harbor === 'any' && ratio > 3) ratio = 3;
    if (v.harbor === resource) ratio = 2;
  }
  return ratio;
}

export { getPlayerTradeRatio };

function hasResources(have: Resources, need: Resources): boolean {
  for (const r of Object.keys(need) as Resource[]) {
    if ((have[r] ?? 0) < (need[r] ?? 0)) return false;
  }
  return true;
}

function addResources(a: Resources, b: Resources): Resources {
  return {
    wood: a.wood + b.wood,
    brick: a.brick + b.brick,
    grain: a.grain + b.grain,
    ore: a.ore + b.ore,
    wool: a.wool + b.wool,
  };
}

function subResources(a: Resources, b: Resources): Resources {
  return {
    wood: a.wood - b.wood,
    brick: a.brick - b.brick,
    grain: a.grain - b.grain,
    ore: a.ore - b.ore,
    wool: a.wool - b.wool,
  };
}

function totalResources(r: Resources): number {
  return r.wood + r.brick + r.grain + r.ore + r.wool;
}

function resourceList(r: Resources): Resource[] {
  const list: Resource[] = [];
  for (const res of ['wood', 'brick', 'grain', 'ore', 'wool'] as Resource[]) {
    for (let i = 0; i < r[res]; i++) list.push(res);
  }
  return list;
}

function updatePlayer(players: Player[], playerId: string, fn: (p: Player) => Player): Player[] {
  return players.map(p => (p.id === playerId ? fn(p) : p));
}
