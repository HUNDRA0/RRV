export type Resource = 'wood' | 'brick' | 'grain' | 'ore' | 'wool';
export type TerrainType = Resource | 'desert';
export type Harbor = 'any' | Resource;
export type DevCardType = 'knight' | 'roadBuilding' | 'yearOfPlenty' | 'monopoly' | 'victoryPoint';
export type PlayerColor = 'red' | 'blue' | 'orange' | 'white';
export type BuildingType = 'settlement' | 'city';
export type GamePhase = 'lobby' | 'diceOff' | 'setup' | 'playing' | 'ended';
export type Resources = Record<Resource, number>;

export interface HexTile {
  id: string;
  q: number;
  r: number;
  terrain: TerrainType;
  number: number | null;
  hasRobber: boolean;
}

export interface Vertex {
  id: string;
  x: number;
  y: number;
  hexIds: string[];
  building: { type: BuildingType; playerId: string } | null;
  harbor: Harbor | null;
}

export interface Edge {
  id: string;
  v1: string;
  v2: string;
  hexIds: string[];
  road: { playerId: string } | null;
}

export interface TradeOffer {
  fromPlayerId: string;
  give: Resources;
  want: Resources;
  responses: Record<string, 'pending' | 'accept' | 'decline'>;
}

export interface PendingAction {
  type: 'moveRobber' | 'steal' | 'placeRoad' | 'yearOfPlenty' | 'monopoly';
  roadsLeft?: number;
  stealFrom?: string[];
  resourcesPicked?: Resource[];
}

export interface ClientPlayer {
  id: string;
  name: string;
  color: PlayerColor;
  resources: Resources;
  devCards: DevCardType[] | number;
  playedKnights: number;
  settlements: number;
  cities: number;
  roads: number;
  hasLargestArmy: boolean;
  hasLongestRoad: boolean;
  devCardPlayedThisTurn: boolean;
  vp: number;
}

export interface ClientGameState {
  id: string;
  code: string;
  phase: GamePhase;
  hostId: string;
  myPlayerId: string;
  players: ClientPlayer[];
  board: {
    hexes: HexTile[];
    vertices: Vertex[];
    edges: Edge[];
  };
  currentPlayerIndex: number;
  setupStep: 'settlement' | 'road';
  diceRolled: boolean;
  dice: [number, number] | null;
  devDeckSize: number;
  longestRoadLength: number;
  longestRoadPlayerId: string | null;
  largestArmyCount: number;
  largestArmyPlayerId: string | null;
  tradeOffer: TradeOffer | null;
  pendingAction: PendingAction | null;
  diceOffRolls?: Record<string, [number, number] | null>;
  diceOffActive?: string[];
  diceOffWinnerId?: string | null;
  turnDeadline: number | null;
  timeoutBanner?: { expiredName: string; nextName: string; phase: GamePhase; ts: number } | null;
  log: string[];
  chatMessages: Array<{ playerId: string; playerName: string; text: string; ts: number; system?: boolean }>;
  winner: string | null;
  updatedAt: number;
}
