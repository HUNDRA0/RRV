import type { ClientGameState, HexTile, Vertex, PlayerColor } from './types';

const TERRAIN_COLORS: Record<string, string> = {
  wood:   '#2d6e28',
  grain:  '#d4a820',
  wool:   '#6aaa2e',
  ore:    '#607d8b',
  brick:  '#a03a18',
  desert: '#c8a96e',
};

const TERRAIN_COLORS_LIGHT: Record<string, string> = {
  wood:   '#4a9e42',
  grain:  '#f0cc3a',
  wool:   '#8dcc48',
  ore:    '#8fa8b4',
  brick:  '#cc5228',
  desert: '#dfc08a',
};

const PLAYER_COLORS: Record<PlayerColor, string> = {
  red:    '#e53935',
  blue:   '#1565c0',
  orange: '#e65100',
  white:  '#eeeeee',
};

const PLAYER_STROKE: Record<PlayerColor, string> = {
  red:    '#b71c1c',
  blue:   '#0d47a1',
  orange: '#bf360c',
  white:  '#9e9e9e',
};

const TERRAIN_EMOJI: Record<string, string> = {
  wood:   '🌲',
  grain:  '🌾',
  wool:   '🐑',
  ore:    '🪨',
  brick:  '🧱',
  desert: '🏜️',
};

const HARBOR_LABEL: Record<string, string> = {
  any:    '3:1',
  wood:   '2:1\n🌲',
  grain:  '2:1\n🌾',
  wool:   '2:1\n🐑',
  ore:    '2:1\n🪨',
  brick:  '2:1\n🧱',
};

// Probability dots for number tokens
const PROB_DOTS: Record<number, number> = {
  2: 1, 3: 2, 4: 3, 5: 4, 6: 5,
  8: 5, 9: 4, 10: 3, 11: 2, 12: 1,
};

interface BoardProps {
  state: ClientGameState;
  validVertices: string[];
  validEdges: string[];
  validHexes: string[];
  onVertexClick: (id: string) => void;
  onEdgeClick: (id: string) => void;
  onHexClick: (id: string) => void;
}

function hexCenter(hex: HexTile, hexSize: number): { cx: number; cy: number } {
  return {
    cx: hexSize * (Math.sqrt(3) * hex.q + (Math.sqrt(3) / 2) * hex.r),
    cy: hexSize * 1.5 * hex.r,
  };
}

function hexCorners(cx: number, cy: number, size: number): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    pts.push([cx + size * Math.cos(angle), cy + size * Math.sin(angle)]);
  }
  return pts;
}

function pointsStr(pts: [number, number][]): string {
  return pts.map(([x, y]) => `${x},${y}`).join(' ');
}

function ProbDots({ cx, cy, count, red }: { cx: number; cy: number; count: number; red: boolean }) {
  const total = count;
  const spacing = 5;
  const startX = cx - ((total - 1) * spacing) / 2;
  return (
    <g>
      {Array.from({ length: total }).map((_, i) => (
        <circle
          key={i}
          cx={startX + i * spacing}
          cy={cy}
          r={2}
          fill={red ? '#c0392b' : '#555'}
        />
      ))}
    </g>
  );
}

function SettlementShape({ x, y, color, stroke, city }: { x: number; y: number; color: string; stroke: string; city: boolean }) {
  if (city) {
    return (
      <g transform={`translate(${x},${y})`} style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.4))' }}>
        <rect x={-11} y={-13} width={22} height={18} fill={color} stroke={stroke} strokeWidth={1.5} rx={2} />
        <rect x={-7} y={-21} width={14} height={11} fill={color} stroke={stroke} strokeWidth={1.5} rx={1} />
        <polygon points={`0,-28 -7,-21 7,-21`} fill={color} stroke={stroke} strokeWidth={1.5} />
        {/* Windows */}
        <rect x={-4} y={-10} width={3} height={4} fill={stroke} opacity={0.4} rx={1} />
        <rect x={2} y={-10} width={3} height={4} fill={stroke} opacity={0.4} rx={1} />
      </g>
    );
  }
  return (
    <g transform={`translate(${x},${y})`} style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.35))' }}>
      <rect x={-8} y={-9} width={16} height={13} fill={color} stroke={stroke} strokeWidth={1.5} rx={2} />
      <polygon points={`0,-18 -9,-9 9,-9`} fill={color} stroke={stroke} strokeWidth={1.5} />
      {/* Door */}
      <rect x={-3} y={-3} width={6} height={7} fill={stroke} opacity={0.35} rx={1} />
    </g>
  );
}

function RobberShape({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`} style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.6))' }}>
      {/* Body */}
      <ellipse cx={0} cy={4} rx={8} ry={10} fill="#1a1a2e" />
      {/* Head */}
      <circle cx={0} cy={-8} r={8} fill="#1a1a2e" />
      {/* Hat */}
      <rect x={-9} y={-16} width={18} height={5} fill="#333" rx={2} />
      <rect x={-5} y={-26} width={10} height={12} fill="#222" rx={2} />
      {/* Eyes */}
      <circle cx={-3} cy={-9} r={1.5} fill="#ff6b6b" />
      <circle cx={3} cy={-9} r={1.5} fill="#ff6b6b" />
    </g>
  );
}

function HarborIcon({ x, y, harbor }: { x: number; y: number; harbor: string }) {
  const isSpecific = harbor !== 'any';
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={-18} y={-14} width={36} height={28} rx={6}
        fill={isSpecific ? '#1a3a5c' : '#0d2137'}
        stroke="#4fc3f7" strokeWidth={1.5}
        opacity={0.9}
      />
      <text textAnchor="middle" dominantBaseline="central" y={-4} fontSize={8} fill="#e3f2fd" fontWeight="bold">
        {harbor === 'any' ? '3:1' : '2:1'}
      </text>
      {isSpecific && (
        <text textAnchor="middle" dominantBaseline="central" y={7} fontSize={9}>
          {HARBOR_LABEL[harbor]?.split('\n')[1] ?? ''}
        </text>
      )}
    </g>
  );
}

export function Board({ state, validVertices, validEdges, validHexes, onVertexClick, onEdgeClick, onHexClick }: BoardProps) {
  const { hexes, vertices, edges } = state.board;

  const xs = vertices.map(v => v.x);
  const ys = vertices.map(v => v.y);
  const pad = 80;
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;
  const maxX = Math.max(...xs) + pad;
  const maxY = Math.max(...ys) + pad;
  const vbWidth = maxX - minX;
  const vbHeight = maxY - minY;

  const vertexMap = new Map<string, Vertex>();
  vertices.forEach(v => vertexMap.set(v.id, v));

  const playerColorMap = new Map<string, PlayerColor>();
  state.players.forEach(p => playerColorMap.set(p.id, p.color));

  const HEX_SIZE = 76;

  // Deduplicate harbor vertices — show one icon per harbor edge midpoint
  const harborPairs: Array<{ mx: number; my: number; harbor: string }> = [];
  const seenHarbors = new Set<string>();
  vertices.filter(v => v.harbor).forEach(v => {
    const key = v.harbor + ':' + Math.round(v.x);
    if (!seenHarbors.has(key)) {
      seenHarbors.add(key);
      // Find another vertex with same harbor nearby
      const partner = vertices.find(u => u.id !== v.id && u.harbor === v.harbor && Math.hypot(u.x - v.x, u.y - v.y) < HEX_SIZE * 1.2);
      if (partner) {
        const pairKey = [v.id, partner.id].sort().join('|');
        if (!seenHarbors.has(pairKey)) {
          seenHarbors.add(pairKey);
          // Place icon slightly outside the board
          const mx = (v.x + partner.x) / 2;
          const my = (v.y + partner.y) / 2;
          const dx = mx;
          const dy = my;
          const len = Math.hypot(dx, dy) || 1;
          harborPairs.push({
            mx: mx + (dx / len) * 28,
            my: my + (dy / len) * 28,
            harbor: v.harbor!,
          });
        }
      }
    }
  });

  return (
    <div className="catan-board-wrap">
      <svg
        className="catan-board-svg"
        viewBox={`${minX} ${minY} ${vbWidth} ${vbHeight}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <filter id="glow-valid">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="drop-shadow">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.3" />
          </filter>
          <radialGradient id="ocean-grad" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="#90caf9" />
            <stop offset="100%" stopColor="#1565c0" />
          </radialGradient>
        </defs>

        {/* Ocean */}
        <rect x={minX} y={minY} width={vbWidth} height={vbHeight} fill="url(#ocean-grad)" rx={32} />

        {/* Wave texture lines */}
        {Array.from({ length: 8 }).map((_, i) => (
          <line key={i}
            x1={minX + 20} y1={minY + 30 + i * 30}
            x2={minX + 80} y2={minY + 30 + i * 30}
            stroke="rgba(255,255,255,0.12)" strokeWidth={1.5} strokeLinecap="round"
          />
        ))}

        {/* Hex tiles */}
        {hexes.map(hex => {
          const { cx, cy } = hexCenter(hex, HEX_SIZE);
          const outerPts = hexCorners(cx, cy, HEX_SIZE - 1);
          const innerPts = hexCorners(cx, cy, HEX_SIZE - 4);
          const isValidRobber = validHexes.includes(hex.id);
          const col = TERRAIN_COLORS[hex.terrain] ?? '#ccc';
          const colLight = TERRAIN_COLORS_LIGHT[hex.terrain] ?? '#eee';
          const isRed = hex.number === 6 || hex.number === 8;
          const dots = hex.number ? (PROB_DOTS[hex.number] ?? 0) : 0;

          return (
            <g key={hex.id}
              onClick={isValidRobber ? () => onHexClick(hex.id) : undefined}
              style={isValidRobber ? { cursor: 'pointer' } : {}}
            >
              {/* Shadow */}
              <polygon points={pointsStr(outerPts)} fill="rgba(0,0,0,0.18)" transform="translate(2,3)" />

              {/* Hex body with gradient effect */}
              <defs>
                <radialGradient id={`hg-${hex.id}`} cx="40%" cy="35%" r="65%">
                  <stop offset="0%" stopColor={colLight} />
                  <stop offset="100%" stopColor={col} />
                </radialGradient>
              </defs>
              <polygon points={pointsStr(outerPts)} fill={`url(#hg-${hex.id})`} />
              <polygon points={pointsStr(innerPts)} fill="none"
                stroke={isValidRobber ? '#ff9800' : 'rgba(255,255,255,0.15)'}
                strokeWidth={isValidRobber ? 3 : 1}
              />
              {/* Outer border */}
              <polygon points={pointsStr(outerPts)} fill="none"
                stroke={isValidRobber ? '#ff9800' : 'rgba(0,0,0,0.25)'}
                strokeWidth={isValidRobber ? 4 : 1.5}
                filter={isValidRobber ? 'url(#glow-valid)' : undefined}
              />

              {/* Terrain emoji */}
              <text x={cx} y={hex.number ? cy - 18 : cy + 6}
                textAnchor="middle" dominantBaseline="central"
                fontSize={hex.terrain === 'desert' ? 26 : 22}
                style={{ userSelect: 'none', pointerEvents: 'none' }}
              >
                {TERRAIN_EMOJI[hex.terrain]}
              </text>

              {/* Number token */}
              {hex.number && !hex.hasRobber && (
                <g>
                  <circle cx={cx} cy={cy + 14} r={20}
                    fill="rgba(255,253,240,0.97)"
                    stroke={isRed ? '#c0392b' : 'rgba(0,0,0,0.15)'}
                    strokeWidth={isRed ? 1.5 : 1}
                    filter="url(#drop-shadow)"
                  />
                  <text x={cx} y={cy + 12}
                    textAnchor="middle" dominantBaseline="central"
                    fontSize={isRed ? 16 : 15}
                    fontWeight="bold"
                    fill={isRed ? '#c0392b' : '#2c2c2c'}
                    fontFamily="var(--font-body)"
                  >
                    {hex.number}
                  </text>
                  <ProbDots cx={cx} cy={cy + 26} count={dots} red={isRed} />
                </g>
              )}

              {/* Robber */}
              {hex.hasRobber && <RobberShape x={cx} y={cy + 10} />}

              {/* Robber valid indicator */}
              {isValidRobber && (
                <polygon points={pointsStr(outerPts)} fill="rgba(255,152,0,0.15)" />
              )}
            </g>
          );
        })}

        {/* Harbor icons */}
        {harborPairs.map((h, i) => (
          <HarborIcon key={i} x={h.mx} y={h.my} harbor={h.harbor} />
        ))}

        {/* Harbor connector lines */}
        {vertices.filter(v => v.harbor).map(v => {
          const partner = vertices.find(u => u.id !== v.id && u.harbor === v.harbor && Math.hypot(u.x - v.x, u.y - v.y) < HEX_SIZE * 1.2);
          if (!partner || v.id > partner.id) return null;
          return (
            <line key={`hline-${v.id}-${partner.id}`}
              x1={v.x} y1={v.y} x2={partner.x} y2={partner.y}
              stroke="#4fc3f7" strokeWidth={2} strokeDasharray="4,3" opacity={0.6}
            />
          );
        })}

        {/* Edges — invisible wide hit area + visible line */}
        {edges.map(edge => {
          const v1 = vertexMap.get(edge.v1);
          const v2 = vertexMap.get(edge.v2);
          if (!v1 || !v2) return null;
          const isValid = validEdges.includes(edge.id);
          const pc = edge.road ? playerColorMap.get(edge.road.playerId) : null;
          const roadColor = pc ? PLAYER_COLORS[pc] : null;
          const roadStroke = pc ? PLAYER_STROKE[pc] : null;

          return (
            <g key={edge.id}>
              {/* Visible road */}
              {roadColor && (
                <>
                  <line x1={v1.x} y1={v1.y} x2={v2.x} y2={v2.y}
                    stroke={roadStroke!} strokeWidth={9} strokeLinecap="round"
                  />
                  <line x1={v1.x} y1={v1.y} x2={v2.x} y2={v2.y}
                    stroke={roadColor} strokeWidth={6} strokeLinecap="round"
                  />
                </>
              )}
              {/* Valid edge highlight */}
              {isValid && !roadColor && (
                <line x1={v1.x} y1={v1.y} x2={v2.x} y2={v2.y}
                  stroke="rgba(255,193,7,0.6)" strokeWidth={7} strokeLinecap="round"
                  filter="url(#glow-valid)"
                />
              )}
              {/* Wide invisible hit area */}
              {isValid && (
                <line x1={v1.x} y1={v1.y} x2={v2.x} y2={v2.y}
                  stroke="transparent" strokeWidth={22} strokeLinecap="round"
                  style={{ cursor: 'pointer' }}
                  onClick={() => onEdgeClick(edge.id)}
                />
              )}
              {/* Subtle edge line when neither road nor valid */}
              {!roadColor && !isValid && (
                <line x1={v1.x} y1={v1.y} x2={v2.x} y2={v2.y}
                  stroke="rgba(255,255,255,0.08)" strokeWidth={2} strokeLinecap="round"
                />
              )}
            </g>
          );
        })}

        {/* Vertices */}
        {vertices.map(v => {
          const isValid = validVertices.includes(v.id);
          const building = v.building;
          const pc = building ? playerColorMap.get(building.playerId) : null;
          const bColor = pc ? PLAYER_COLORS[pc] : null;
          const bStroke = pc ? PLAYER_STROKE[pc] : null;

          if (building && bColor && bStroke) {
            return (
              <SettlementShape
                key={v.id}
                x={v.x} y={v.y}
                color={bColor} stroke={bStroke}
                city={building.type === 'city'}
              />
            );
          }

          if (isValid) {
            return (
              <g key={v.id} onClick={() => onVertexClick(v.id)} style={{ cursor: 'pointer' }}>
                {/* Pulse ring */}
                <circle cx={v.x} cy={v.y} r={18}
                  fill="none"
                  stroke="rgba(255,193,7,0.4)"
                  strokeWidth={3}
                  className="catan-valid-pulse"
                />
                {/* Main dot */}
                <circle cx={v.x} cy={v.y} r={11}
                  fill="#ffc107"
                  stroke="#e65100"
                  strokeWidth={2}
                  filter="url(#glow-valid)"
                />
                <circle cx={v.x} cy={v.y} r={5}
                  fill="rgba(255,255,255,0.8)"
                />
              </g>
            );
          }

          return (
            <circle key={v.id}
              cx={v.x} cy={v.y} r={3}
              fill="rgba(255,255,255,0.12)"
            />
          );
        })}
      </svg>
    </div>
  );
}
