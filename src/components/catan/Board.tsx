import type { ClientGameState, HexTile, Vertex, PlayerColor } from './types';

const TERRAIN_COLORS: Record<string, string> = {
  wood: '#3d8b37',
  grain: '#e8c832',
  wool: '#8bc34a',
  ore: '#78909c',
  brick: '#bf5c2c',
  desert: '#d4b483',
};

const PLAYER_COLORS: Record<PlayerColor, string> = {
  red: '#e53935',
  blue: '#1e88e5',
  orange: '#fb8c00',
  white: '#e0e0e0',
};

const RESOURCE_LABEL: Record<string, string> = {
  wood: '🌲',
  grain: '🌾',
  wool: '🐑',
  ore: '⛏️',
  brick: '🧱',
  desert: '🏜️',
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
  const cx = hexSize * (Math.sqrt(3) * hex.q + Math.sqrt(3) / 2 * hex.r);
  const cy = hexSize * (3 / 2 * hex.r);
  return { cx, cy };
}

function hexCorners(cx: number, cy: number, size: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    pts.push(`${cx + size * Math.cos(angle)},${cy + size * Math.sin(angle)}`);
  }
  return pts.join(' ');
}

function SettlementShape({ x, y, color, city }: { x: number; y: number; color: string; city: boolean }) {
  if (city) {
    return (
      <g transform={`translate(${x},${y})`}>
        <rect x={-10} y={-14} width={20} height={18} fill={color} stroke="#fff" strokeWidth={1.5} rx={2} />
        <rect x={-6} y={-20} width={12} height={10} fill={color} stroke="#fff" strokeWidth={1.5} rx={1} />
        <polygon points="0,-26 -6,-20 6,-20" fill={color} stroke="#fff" strokeWidth={1.5} />
      </g>
    );
  }
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={-7} y={-10} width={14} height={12} fill={color} stroke="#fff" strokeWidth={1.5} rx={2} />
      <polygon points="0,-16 -7,-10 7,-10" fill={color} stroke="#fff" strokeWidth={1.5} />
    </g>
  );
}

export function Board({ state, validVertices, validEdges, validHexes, onVertexClick, onEdgeClick, onHexClick }: BoardProps) {
  const { hexes, vertices, edges } = state.board;

  // Compute bounding box from vertex coords
  const xs = vertices.map(v => v.x);
  const ys = vertices.map(v => v.y);
  const minX = Math.min(...xs) - 60;
  const minY = Math.min(...ys) - 60;
  const maxX = Math.max(...xs) + 60;
  const maxY = Math.max(...ys) + 60;
  const width = maxX - minX;
  const height = maxY - minY;

  // Build vertex lookup
  const vertexMap = new Map<string, Vertex>();
  vertices.forEach(v => vertexMap.set(v.id, v));

  // Build player lookup for colors
  const playerColorMap = new Map<string, PlayerColor>();
  state.players.forEach(p => playerColorMap.set(p.id, p.color));

  const HEX_SIZE = 60;

  return (
    <div className="catan-board-wrap">
      <svg
        className="catan-board-svg"
        viewBox={`${minX} ${minY} ${width} ${height}`}
        style={{ width: '100%', maxWidth: 820, display: 'block', margin: '0 auto' }}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Ocean background */}
        <rect x={minX} y={minY} width={width} height={height} fill="#b8d4e8" rx={24} />

        {/* Hex tiles */}
        {hexes.map(hex => {
          const { cx, cy } = hexCenter(hex, HEX_SIZE);
          const pts = hexCorners(cx, cy, HEX_SIZE - 2);
          const color = TERRAIN_COLORS[hex.terrain] ?? '#ccc';
          const isValidRobber = validHexes.includes(hex.id);
          return (
            <g key={hex.id} onClick={isValidRobber ? () => onHexClick(hex.id) : undefined} style={isValidRobber ? { cursor: 'pointer' } : {}}>
              <polygon
                points={pts}
                fill={color}
                stroke={isValidRobber ? '#ff9800' : '#00000033'}
                strokeWidth={isValidRobber ? 3 : 1.5}
              />
              {hex.number && (
                <g>
                  <circle cx={cx} cy={cy} r={18} fill="rgba(255,255,255,0.9)" />
                  <text
                    x={cx} y={cy}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={13}
                    fontWeight={hex.number === 6 || hex.number === 8 ? 'bold' : 'normal'}
                    fill={hex.number === 6 || hex.number === 8 ? '#c0392b' : '#333'}
                  >
                    {hex.number}
                  </text>
                </g>
              )}
              {/* Robber */}
              {hex.hasRobber && (
                <circle cx={cx} cy={cy + (hex.number ? 26 : 0)} r={10} fill="#333" opacity={0.85} />
              )}
              {/* Terrain icon for desert */}
              {hex.terrain === 'desert' && (
                <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize={22}>
                  {RESOURCE_LABEL.desert}
                </text>
              )}
            </g>
          );
        })}

        {/* Harbor indicators */}
        {vertices.filter(v => v.harbor).map(v => (
          <g key={`harbor-${v.id}`}>
            <circle cx={v.x} cy={v.y} r={8} fill="#1565c0" opacity={0.7} />
            <text x={v.x} y={v.y} textAnchor="middle" dominantBaseline="central" fontSize={7} fill="#fff" fontWeight="bold">
              {v.harbor === 'any' ? '3:1' : '2:1'}
            </text>
          </g>
        ))}

        {/* Edges (roads) */}
        {edges.map(edge => {
          const v1 = vertexMap.get(edge.v1);
          const v2 = vertexMap.get(edge.v2);
          if (!v1 || !v2) return null;
          const isValid = validEdges.includes(edge.id);
          const playerColor = edge.road ? (PLAYER_COLORS[playerColorMap.get(edge.road.playerId) ?? 'white'] ?? '#999') : null;
          return (
            <line
              key={edge.id}
              x1={v1.x} y1={v1.y}
              x2={v2.x} y2={v2.y}
              stroke={playerColor ?? (isValid ? 'rgba(255,152,0,0.5)' : 'transparent')}
              strokeWidth={playerColor ? 6 : (isValid ? 8 : 4)}
              strokeLinecap="round"
              onClick={isValid ? () => onEdgeClick(edge.id) : undefined}
              style={isValid ? { cursor: 'pointer' } : {}}
            />
          );
        })}

        {/* Vertices (settlements/cities/clickable spots) */}
        {vertices.map(v => {
          const isValid = validVertices.includes(v.id);
          const building = v.building;
          const bColor = building ? (PLAYER_COLORS[playerColorMap.get(building.playerId) ?? 'white'] ?? '#999') : null;

          if (building && bColor) {
            return (
              <SettlementShape
                key={v.id}
                x={v.x}
                y={v.y}
                color={bColor}
                city={building.type === 'city'}
              />
            );
          }

          if (isValid) {
            return (
              <circle
                key={v.id}
                cx={v.x} cy={v.y}
                r={10}
                fill="rgba(255,152,0,0.7)"
                stroke="#ff9800"
                strokeWidth={2}
                style={{ cursor: 'pointer' }}
                onClick={() => onVertexClick(v.id)}
              />
            );
          }

          return (
            <circle
              key={v.id}
              cx={v.x} cy={v.y}
              r={4}
              fill="rgba(0,0,0,0.15)"
            />
          );
        })}
      </svg>
    </div>
  );
}
