export type Resource = 'wood' | 'brick' | 'grain' | 'ore' | 'wool';
export type TerrainType = Resource | 'desert';
export type Harbor = 'any' | Resource;
export type DevCardType = 'knight' | 'roadBuilding' | 'yearOfPlenty' | 'monopoly' | 'victoryPoint';
export type PlayerColor = 'red' | 'blue' | 'orange' | 'white';
export type BuildingType = 'settlement' | 'city';
export type GamePhase = 'lobby' | 'diceOff' | 'setup' | 'playing' | 'ended';
export type Resources = Record<Resource, number>;

export interface HexTile {
  id: string; // `${q},${r}`
  q: number;
  r: number;
  terrain: TerrainType;
  number: number | null; // null for desert
  hasRobber: boolean;
}

export interface Vertex {
  id: string;
  x: number;
  y: number; // pixel coords for SVG rendering
  hexIds: string[];
  building: { type: BuildingType; playerId: string } | null;
  harbor: Harbor | null;
}

export interface Edge {
  id: string;
  v1: string;
  v2: string; // vertex IDs
  hexIds: string[];
  road: { playerId: string } | null;
}

export interface Player {
  id: string;
  name: string;
  color: PlayerColor;
  resources: Resources;
  devCards: DevCardType[]; // in hand (hidden from others)
  playedKnights: number;
  settlements: number; // pieces remaining
  cities: number;
  roads: number;
  hasLargestArmy: boolean;
  hasLongestRoad: boolean;
  devCardPlayedThisTurn: boolean;
  justBoughtDevCard: DevCardType | null; // can't play same turn
}

export interface TradeOffer {
  fromPlayerId: string;
  give: Resources;
  want: Resources;
  responses: Record<string, 'pending' | 'accept' | 'decline'>;
}

export interface PendingAction {
  type: 'moveRobber' | 'steal' | 'placeRoad' | 'yearOfPlenty' | 'monopoly';
  roadsLeft?: number; // for roadBuilding
  stealFrom?: string[]; // player IDs to steal from (after robber placement)
  resourcesPicked?: Resource[]; // for yearOfPlenty progress
}

export interface GameState {
  id: string;
  code: string; // 6-char uppercase room code
  phase: GamePhase;
  hostId: string;
  players: Player[];
  board: { hexes: HexTile[]; vertices: Vertex[]; edges: Edge[] };
  currentPlayerIndex: number;
  setupRound: number; // 1 or 2
  setupDirection: 'forward' | 'backward';
  setupStep: 'settlement' | 'road';
  diceRolled: boolean;
  dice: [number, number] | null;
  devDeck: DevCardType[];
  longestRoadLength: number;
  longestRoadPlayerId: string | null;
  largestArmyCount: number;
  largestArmyPlayerId: string | null;
  tradeOffer: TradeOffer | null;
  pendingAction: PendingAction | null;
  diceOffRolls?: Record<string, [number, number] | null>; // playerId → dice or null = not yet rolled
  diceOffActive?: string[]; // player IDs still competing (shrinks during tie-breaks)
  turnDeadline: number | null; // ms timestamp; null = no active timer (lobby/diceOff/ended)
  log: string[];
  chatMessages: Array<{ playerId: string; playerName: string; text: string; ts: number; system?: boolean }>;
  winner: string | null;
  updatedAt: number;
}
