import type { HexTile, Vertex, Edge, TerrainType, Harbor } from './types.js';

const HEX_SIZE = 76;
const SQRT3 = Math.sqrt(3);

// Pointy-top hex pixel coords from axial (q, r)
function hexToPixel(q: number, r: number): { x: number; y: number } {
  return {
    x: HEX_SIZE * SQRT3 * (q + r / 2),
    y: HEX_SIZE * 1.5 * r,
  };
}

// Pointy-top vertex offsets (fraction of size, then multiply by HEX_SIZE)
const VERTEX_OFFSETS: [number, number][] = [
  [SQRT3 / 2, -0.5], // 0: NE
  [SQRT3 / 2, 0.5],  // 1: SE
  [0, 1.0],           // 2: S
  [-SQRT3 / 2, 0.5], // 3: SW
  [-SQRT3 / 2, -0.5],// 4: NW
  [0, -1.0],          // 5: N
];

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function vertexKey(x: number, y: number): string {
  return `${round1(x)},${round1(y)}`;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// All axial coords (q,r) where |q|<=2, |r|<=2, |q+r|<=2 (hex of radius 2 = 19 tiles)
function allHexCoords(): [number, number][] {
  const coords: [number, number][] = [];
  for (let q = -2; q <= 2; q++) {
    for (let r = -2; r <= 2; r++) {
      if (Math.abs(q + r) <= 2) coords.push([q, r]);
    }
  }
  return coords;
}

// Standard Catan number token spiral order (18 numbers for 18 non-desert hexes)
const NUMBER_TOKENS = [5, 2, 6, 3, 8, 10, 9, 12, 11, 4, 8, 10, 9, 4, 5, 6, 3, 11];

// Spiral ordering for hex of radius 2 — clockwise starting from top-left outer ring
// We'll use a deterministic spiral: ring 2 clockwise, then ring 1 clockwise, then center
function spiralOrder(coords: [number, number][]): [number, number][] {
  const center: [number, number][] = [[0, 0]];
  // Ring 1: |q|<=1, |r|<=1, |q+r|<=1
  const ring1: [number, number][] = [];
  // Ring 2: distance == 2
  const ring2: [number, number][] = [];

  for (const [q, r] of coords) {
    const dist = Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));
    if (dist === 0) continue;
    if (dist === 1) ring1.push([q, r]);
    if (dist === 2) ring2.push([q, r]);
  }

  // Sort each ring clockwise starting from top (r=-dist, q=0 direction)
  function clockwiseAngle(q: number, r: number): number {
    // Convert axial to angle. Pointy-top: angle = atan2(q, -r) adjusted for clockwise
    const { x, y } = hexToPixel(q, r);
    return Math.atan2(x, -y);
  }
  ring2.sort((a, b) => clockwiseAngle(a[0], a[1]) - clockwiseAngle(b[0], b[1]));
  ring1.sort((a, b) => clockwiseAngle(a[0], a[1]) - clockwiseAngle(b[0], b[1]));

  return [...ring2, ...ring1, ...center];
}

interface HarborSpec {
  q: number;
  r: number;
  vertexIndices: [number, number];
  harbor: Harbor;
}

const HARBORS: HarborSpec[] = [
  { q: 0, r: -2, vertexIndices: [4, 5], harbor: 'any' },
  { q: 1, r: -2, vertexIndices: [5, 0], harbor: 'grain' },
  { q: 2, r: -2, vertexIndices: [0, 1], harbor: 'any' },
  { q: 2, r: -1, vertexIndices: [1, 2], harbor: 'ore' },
  { q: 2, r: 0, vertexIndices: [1, 2], harbor: 'any' },
  { q: 1, r: 1, vertexIndices: [2, 3], harbor: 'wool' },
  { q: 0, r: 2, vertexIndices: [3, 4], harbor: 'any' },
  { q: -1, r: 2, vertexIndices: [3, 4], harbor: 'brick' },
  { q: -2, r: 1, vertexIndices: [4, 5], harbor: 'wood' },
];

export function generateBoard(): { hexes: HexTile[]; vertices: Vertex[]; edges: Edge[] } {
  const coords = allHexCoords();

  // Terrain distribution: 4 wood, 4 wheat, 4 wool, 3 ore, 3 brick, 1 desert
  const terrains: TerrainType[] = [
    'wood', 'wood', 'wood', 'wood',
    'grain', 'grain', 'grain', 'grain',
    'wool', 'wool', 'wool', 'wool',
    'ore', 'ore', 'ore',
    'brick', 'brick', 'brick',
    'desert',
  ];
  const shuffledTerrains = shuffle(terrains);

  // Build hexes
  const hexes: HexTile[] = coords.map(([q, r], i) => ({
    id: `${q},${r}`,
    q,
    r,
    terrain: shuffledTerrains[i],
    number: null,
    hasRobber: false,
  }));

  // Assign number tokens via spiral order to non-desert hexes
  const spiral = spiralOrder(coords);
  let tokenIdx = 0;
  for (const [sq, sr] of spiral) {
    const hex = hexes.find(h => h.q === sq && h.r === sr);
    if (!hex) continue;
    if (hex.terrain === 'desert') {
      hex.hasRobber = true;
      continue;
    }
    if (tokenIdx < NUMBER_TOKENS.length) {
      hex.number = NUMBER_TOKENS[tokenIdx++];
    }
  }

  // Build vertices map (deduplicated by pixel coord)
  const vertexMap = new Map<string, Vertex>();

  for (const hex of hexes) {
    const center = hexToPixel(hex.q, hex.r);
    for (let vi = 0; vi < 6; vi++) {
      const [dx, dy] = VERTEX_OFFSETS[vi];
      const vx = center.x + dx * HEX_SIZE;
      const vy = center.y + dy * HEX_SIZE;
      const key = vertexKey(vx, vy);
      if (!vertexMap.has(key)) {
        vertexMap.set(key, {
          id: key,
          x: round1(vx),
          y: round1(vy),
          hexIds: [],
          building: null,
          harbor: null,
        });
      }
      const v = vertexMap.get(key)!;
      if (!v.hexIds.includes(hex.id)) v.hexIds.push(hex.id);
    }
  }

  // Build hex→vertex index mapping for harbor and edge assignment
  const hexVertexKeys = new Map<string, string[]>(); // hexId → [6 vertex keys in order]
  for (const hex of hexes) {
    const center = hexToPixel(hex.q, hex.r);
    const keys: string[] = [];
    for (let vi = 0; vi < 6; vi++) {
      const [dx, dy] = VERTEX_OFFSETS[vi];
      const vx = center.x + dx * HEX_SIZE;
      const vy = center.y + dy * HEX_SIZE;
      keys.push(vertexKey(vx, vy));
    }
    hexVertexKeys.set(hex.id, keys);
  }

  // Assign harbors
  for (const spec of HARBORS) {
    const hexId = `${spec.q},${spec.r}`;
    const vKeys = hexVertexKeys.get(hexId);
    if (!vKeys) continue;
    for (const vi of spec.vertexIndices) {
      const v = vertexMap.get(vKeys[vi]);
      if (v) v.harbor = spec.harbor;
    }
  }

  // Build edges (deduplicated)
  const edgeMap = new Map<string, Edge>();

  for (const hex of hexes) {
    const vKeys = hexVertexKeys.get(hex.id)!;
    for (let i = 0; i < 6; i++) {
      const v1Key = vKeys[i];
      const v2Key = vKeys[(i + 1) % 6];
      const edgeId = [v1Key, v2Key].sort().join('|');
      if (!edgeMap.has(edgeId)) {
        edgeMap.set(edgeId, {
          id: edgeId,
          v1: v1Key < v2Key ? v1Key : v2Key,
          v2: v1Key < v2Key ? v2Key : v1Key,
          hexIds: [],
          road: null,
        });
      }
      const edge = edgeMap.get(edgeId)!;
      if (!edge.hexIds.includes(hex.id)) edge.hexIds.push(hex.id);
    }
  }

  return {
    hexes,
    vertices: Array.from(vertexMap.values()),
    edges: Array.from(edgeMap.values()),
  };
}
