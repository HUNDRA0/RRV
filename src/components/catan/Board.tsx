import type { ClientGameState, HexTile, Vertex, PlayerColor, Resource } from './types';

const RESOURCE_EMOJI_BOARD: Record<Resource, string> = {
  wood: '🌲',
  brick: '🧱',
  grain: '🌾',
  ore: '🪨',
  wool: '🐑',
};
const RESOURCES_ORDER: Resource[] = ['wood', 'brick', 'grain', 'wool', 'ore'];

// Dark base colour (radial gradient edge)
const TERRAIN_COLORS: Record<string, string> = {
  wood:   '#1a4a18',
  grain:  '#b88010',
  wool:   '#4a8c18',
  ore:    '#404e58',
  brick:  '#7a2808',
  desert: '#b89848',
};

// Light centre colour (radial gradient highlight)
const TERRAIN_COLORS_LIGHT: Record<string, string> = {
  wood:   '#2e7028',
  grain:  '#dca818',
  wool:   '#6ab028',
  ore:    '#6a848e',
  brick:  '#b03818',
  desert: '#d8b868',
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

// Emoji for specific harbor types (shown inside the harbor icon)
const HARBOR_EMOJI: Record<string, string> = {
  wood: '🌲', grain: '🌾', wool: '🐑', ore: '🪨', brick: '🧱',
};

// Probability dots for number tokens
const PROB_DOTS: Record<number, number> = {
  2: 1, 3: 2, 4: 3, 5: 4, 6: 5,
  8: 5, 9: 4, 10: 3, 11: 2, 12: 1,
};

// Dot positions for in-SVG die faces (percentage of die size)
const SVG_DIE_DOTS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[25, 25], [75, 75]],
  3: [[25, 25], [50, 50], [75, 75]],
  4: [[25, 25], [75, 25], [25, 75], [75, 75]],
  5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
  6: [[25, 22], [75, 22], [25, 50], [75, 50], [25, 78], [75, 78]],
};

export type DiceAnimPhase = 'idle' | 'rolling' | 'showing';

interface BoardProps {
  state: ClientGameState;
  myPlayerId: string;
  onRollDice?: () => void;
  diceAnimPhase?: DiceAnimPhase;
  animDisplayDice?: [number, number];
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
          {HARBOR_EMOJI[harbor] ?? ''}
        </text>
      )}
    </g>
  );
}

export function Board({
  state, myPlayerId, onRollDice,
  diceAnimPhase = 'idle', animDisplayDice = [1, 1],
  validVertices, validEdges, validHexes,
  onVertexClick, onEdgeClick, onHexClick,
}: BoardProps) {
  const { hexes, vertices, edges } = state.board;

  const xs = vertices.map(v => v.x);
  const ys = vertices.map(v => v.y);
  const padTop = 44;
  const padSide = 44;
  const padBottom = 80;
  const minX = Math.min(...xs) - padSide;
  const minY = Math.min(...ys) - padTop;
  const maxX = Math.max(...xs) + padSide;
  const maxY = Math.max(...ys) + padBottom;
  const vbWidth = maxX - minX;
  const vbHeight = maxY - minY;

  const vertexMap = new Map<string, Vertex>();
  vertices.forEach(v => vertexMap.set(v.id, v));

  const playerColorMap = new Map<string, PlayerColor>();
  state.players.forEach(p => playerColorMap.set(p.id, p.color));

  const HEX_SIZE = 86;

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
          <radialGradient id="ocean-grad" cx="50%" cy="45%" r="70%">
            <stop offset="0%" stopColor="#64b5f6" />
            <stop offset="60%" stopColor="#1e88e5" />
            <stop offset="100%" stopColor="#0d47a1" />
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
          // Two polygon shapes: outer parchment border + inner terrain
          const hexOuterPts = hexCorners(cx, cy, HEX_SIZE - 1);
          const terrainPts  = hexCorners(cx, cy, HEX_SIZE - 11);
          const isValidRobber = validHexes.includes(hex.id);
          const col      = TERRAIN_COLORS[hex.terrain]      ?? '#ccc';
          const colLight = TERRAIN_COLORS_LIGHT[hex.terrain] ?? '#eee';
          const isRed = hex.number === 6 || hex.number === 8;
          const dots  = hex.number ? (PROB_DOTS[hex.number] ?? 0) : 0;
          // Vertical centre of terrain area (above number token)
          const emojiY = hex.number ? cy - 18 : cy;

          return (
            <g key={hex.id}
              onClick={isValidRobber ? () => onHexClick(hex.id) : undefined}
              style={isValidRobber ? { cursor: 'pointer' } : {}}
            >
              <defs>
                <radialGradient id={`hg-${hex.id}`} cx="38%" cy="32%" r="68%">
                  <stop offset="0%" stopColor={colLight} />
                  <stop offset="100%" stopColor={col} />
                </radialGradient>
              </defs>

              {/* Drop shadow (same geometry, offset) */}
              <polygon points={pointsStr(hexOuterPts)} fill="rgba(0,0,0,0.22)" transform="translate(2,4)" />

              {/* Parchment/cardboard border — mimics real tile edge */}
              <polygon points={pointsStr(hexOuterPts)}
                fill="#c8a44a"
                stroke="#8a6820"
                strokeWidth={1.5}
              />
              {/* Subtle inner shadow on the parchment ring */}
              <polygon points={pointsStr(terrainPts)}
                fill="none"
                stroke="rgba(0,0,0,0.18)"
                strokeWidth={3}
              />

              {/* Terrain surface */}
              <polygon points={pointsStr(terrainPts)} fill={`url(#hg-${hex.id})`} />

              {/* Robber valid highlight */}
              {isValidRobber && (
                <polygon points={pointsStr(terrainPts)} fill="rgba(255,152,0,0.22)"
                  stroke="#ff9800" strokeWidth={3}
                  filter="url(#glow-valid)"
                />
              )}

              {/* Terrain illustration — single centred emoji, big and clear */}
              <text
                x={cx} y={emojiY}
                textAnchor="middle" dominantBaseline="central"
                fontSize={hex.number ? 40 : 50}
                style={{ userSelect: 'none', pointerEvents: 'none' }}
              >
                {TERRAIN_EMOJI[hex.terrain]}
              </text>

              {/* Number token — centred beige circle like the real game */}
              {hex.number && !hex.hasRobber && (
                <g>
                  {/* Token shadow */}
                  <circle cx={cx} cy={cy + 23} r={22} fill="rgba(0,0,0,0.18)" />
                  {/* Token body */}
                  <circle cx={cx} cy={cy + 21} r={22}
                    fill="#f4e8c0"
                    stroke={isRed ? '#9a1a10' : '#8a7030'}
                    strokeWidth={2}
                  />
                  {/* Number */}
                  <text x={cx} y={cy + 19}
                    textAnchor="middle" dominantBaseline="central"
                    fontSize={isRed ? 19 : 17}
                    fontWeight="800"
                    fill={isRed ? '#9a1a10' : '#1c1208'}
                    fontFamily="Georgia, serif"
                  >
                    {hex.number}
                  </text>
                  {/* Probability dots */}
                  <ProbDots cx={cx} cy={cy + 34} count={dots} red={isRed} />
                </g>
              )}

              {/* Robber */}
              {hex.hasRobber && <RobberShape x={cx} y={cy + 10} />}
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
              {/* Valid edge highlight — outer glow + bright stripe + pulse */}
              {isValid && !roadColor && (
                <>
                  <line x1={v1.x} y1={v1.y} x2={v2.x} y2={v2.y}
                    stroke="rgba(255,220,0,0.22)" strokeWidth={22} strokeLinecap="round"
                    className="catan-road-valid-glow"
                  />
                  <line x1={v1.x} y1={v1.y} x2={v2.x} y2={v2.y}
                    stroke="#ffe033" strokeWidth={9} strokeLinecap="round"
                    filter="url(#glow-valid)"
                    className="catan-road-valid-glow"
                  />
                </>
              )}
              {/* Wide invisible hit area */}
              {isValid && (
                <line x1={v1.x} y1={v1.y} x2={v2.x} y2={v2.y}
                  stroke="transparent" strokeWidth={26} strokeLinecap="round"
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

        {/* ── Player corner cards ── */}
        {(() => {
          const CORNERS = [
            { x: minX + 10, y: minY + 10, anchorRight: false, anchorBottom: false },
            { x: maxX - 10, y: minY + 10, anchorRight: true,  anchorBottom: false },
            { x: maxX - 10, y: maxY - padBottom - 10, anchorRight: true,  anchorBottom: true },
            { x: minX + 10, y: maxY - padBottom - 10, anchorRight: false, anchorBottom: true },
          ];
          return state.players.slice(0, 4).map((p, idx) => {
            const corner = CORNERS[idx];
            if (!corner) return null;
            const isMe = p.id === myPlayerId;
            const isCurrent = idx === state.currentPlayerIndex;
            const cardW = isMe ? 185 : 156;
            const cardH = isMe ? 70 : 54;
            const cardX = corner.anchorRight ? corner.x - cardW : corner.x;
            const cardY = corner.anchorBottom ? corner.y - cardH : corner.y;
            const pc = PLAYER_COLORS[p.color] ?? '#888';
            const res = isMe ? (p.resources as Record<string, number>) : null;
            // Arrow sits just outside the card edge (below top cards, above bottom cards)
            const arrowY = corner.anchorBottom ? cardY - 10 : cardY + cardH + 10;
            const arrowChar = corner.anchorBottom ? '▲' : '▼';
            const arrowX = cardX + cardW / 2;

            return (
              <g key={p.id}>
                {/* Card background */}
                <rect
                  x={cardX} y={cardY} width={cardW} height={cardH}
                  rx={10}
                  fill="rgba(15,10,30,0.62)"
                  stroke={isCurrent ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.12)'}
                  strokeWidth={1}
                />
                {/* Pulsing gold border for current player */}
                {isCurrent && (
                  <rect
                    x={cardX} y={cardY} width={cardW} height={cardH}
                    rx={10}
                    fill="none"
                    stroke="#fbbf24"
                    strokeWidth={2.5}
                    className="catan-corner-pulse"
                  />
                )}
                {/* Color dot */}
                <circle cx={cardX + 16} cy={cardY + 18} r={7} fill={pc} />
                {/* Player name */}
                <text
                  x={cardX + 32} y={cardY + 24}
                  fontSize={14} fontWeight="700" fill="white"
                  fontFamily="var(--font-body)"
                  style={{ userSelect: 'none', pointerEvents: 'none' }}
                >
                  {p.name.length > 11 ? p.name.slice(0, 10) + '…' : p.name}
                </text>
                {/* VP */}
                <text
                  x={cardX + cardW - 8} y={cardY + 24}
                  textAnchor="end" fontSize={12} fill="rgba(255,255,255,0.70)"
                  fontFamily="var(--font-body)"
                  style={{ userSelect: 'none', pointerEvents: 'none' }}
                >
                  ⭐{p.vp}
                </text>
                {/* Hand count for other players */}
                {!isMe && (
                  <text
                    x={cardX + 10} y={cardY + cardH - 10}
                    fontSize={11} fill="rgba(255,255,255,0.60)"
                    fontFamily="var(--font-body)"
                    style={{ userSelect: 'none', pointerEvents: 'none' }}
                  >
                    🃏 {(p as {handSize?: number}).handSize ?? '?'}
                  </text>
                )}
                {/* Resource row (only for myself) */}
                {isMe && res && (
                  <text
                    x={cardX + 8} y={cardY + cardH - 10}
                    fontSize={11} fill="rgba(255,255,255,0.85)"
                    fontFamily="var(--font-body)"
                    style={{ userSelect: 'none', pointerEvents: 'none' }}
                  >
                    {RESOURCES_ORDER.map(r => `${RESOURCE_EMOJI_BOARD[r]}${res[r] ?? 0}`).join(' ')}
                  </text>
                )}
                {/* Directional arrow for current player */}
                {isCurrent && (
                  <text
                    x={arrowX} y={arrowY}
                    textAnchor="middle" fontSize={14} fill="#fbbf24"
                    fontFamily="var(--font-body)"
                    style={{ userSelect: 'none', pointerEvents: 'none' }}
                    className="catan-corner-pulse"
                  >
                    {arrowChar}
                  </text>
                )}
              </g>
            );
          });
        })()}

        {/* ── Dice area (bottom-center ocean) ── */}
        {(() => {
          const isMyTurn = state.players[state.currentPlayerIndex]?.id === myPlayerId;
          const DIE_SIZE = 36;
          const gap = 8;
          // Center dice pair at x=0 (board axial origin)
          // Two dice span: DIE_SIZE*2 + gap = 80px → start at -40
          const diceAreaX = -(DIE_SIZE + gap / 2);    // -40
          const diceAreaY = maxY - padBottom + 10;

          /** Render a single die face (dots) at position x,y with given size */
          const renderDieFace = (value: number, x: number, y: number, size: number) => {
            const clampedVal = Math.max(1, Math.min(6, Math.round(value))) as 1|2|3|4|5|6;
            const dots = SVG_DIE_DOTS[clampedVal] ?? [[50, 50]];
            return (
              <>
                <rect x={x} y={y} width={size} height={size}
                  rx={size * 0.22} fill="white" stroke="#d0c8b8" strokeWidth={1.5} />
                {dots.map(([px, py], i) => (
                  <circle key={i}
                    cx={x + (px / 100) * size}
                    cy={y + (py / 100) * size}
                    r={size * 0.096} fill="#1c1208"
                  />
                ))}
              </>
            );
          };

          // ── Phase: rolling ── animated shaking dice with cycling faces
          if (diceAnimPhase === 'rolling') {
            return (
              <g>
                <g className="catan-die-roll-1">
                  {renderDieFace(animDisplayDice[0], diceAreaX, diceAreaY, DIE_SIZE)}
                </g>
                <g className="catan-die-roll-2">
                  {renderDieFace(animDisplayDice[1], diceAreaX + DIE_SIZE + gap, diceAreaY, DIE_SIZE)}
                </g>
              </g>
            );
          }

          // ── Phase: showing ── dice pop in + result card + resource gains
          if (diceAnimPhase === 'showing' && state.dice) {
            const [d1, d2] = state.dice;
            const sum = d1 + d2;
            const isSeven = sum === 7;
            const sumX = diceAreaX + DIE_SIZE * 2 + gap * 2 + 8;

            // Calculate which players gain resources from this roll
            const gains: Array<{ name: string; line: string }> = [];
            if (!isSeven) {
              const gainMap = new Map<string, Record<string, number>>();
              for (const hex of hexes) {
                if (hex.number !== sum || hex.hasRobber || hex.terrain === 'desert') continue;
                for (const vertex of vertices) {
                  if (!vertex.hexIds.includes(hex.id) || !vertex.building) continue;
                  const { playerId, type: bt } = vertex.building;
                  const amount = bt === 'city' ? 2 : 1;
                  if (!gainMap.has(playerId)) gainMap.set(playerId, {});
                  const g = gainMap.get(playerId)!;
                  g[hex.terrain] = (g[hex.terrain] ?? 0) + amount;
                }
              }
              gainMap.forEach((res, pid) => {
                const player = state.players.find(p => p.id === pid);
                if (!player) return;
                const line = Object.entries(res)
                  .filter(([, n]) => n > 0)
                  .map(([r, n]) => `+${n}${RESOURCE_EMOJI_BOARD[r as Resource]}`)
                  .join(' ');
                const name = player.name.length > 12 ? player.name.slice(0, 11) + '…' : player.name;
                if (line) gains.push({ name, line });
              });
            }

            const gainsH = gains.length > 0 ? gains.length * 28 + 20 : 0;
            const gainsY = 66; // sits just below the result card (which ends at y=50)

            return (
              <g>
                {/* Corner dice — pop in */}
                <g className="catan-die-pop-1">
                  {renderDieFace(d1, diceAreaX, diceAreaY, DIE_SIZE)}
                </g>
                <g className="catan-die-pop-2">
                  {renderDieFace(d2, diceAreaX + DIE_SIZE + gap, diceAreaY, DIE_SIZE)}
                </g>
                {/* Sum text next to dice */}
                <g className="catan-die-pop-2" style={{ animationDelay: '0.20s' }}>
                  <text x={sumX} y={diceAreaY + 24} fontSize={18} fontWeight="800"
                    fill="white" fontFamily="var(--font-body)"
                    style={{ userSelect: 'none', pointerEvents: 'none' }}>
                    ={sum}
                  </text>
                </g>

                {/* Central result card */}
                <g className="catan-result-card">
                  <rect x={-90} y={-50} width={180} height={116}
                    rx={20} fill="rgba(0,0,0,0.40)" transform="translate(4,5)" />
                  <rect x={-90} y={-50} width={180} height={116}
                    rx={20} fill="rgba(14,8,32,0.92)"
                    stroke={isSeven ? '#f59e0b' : '#7c3aed'} strokeWidth={3}
                  />
                  <text x={0} y={18} textAnchor="middle"
                    fontSize={56} fontWeight="900"
                    fill={isSeven ? '#fbbf24' : 'white'}
                    fontFamily="var(--font-body)"
                    style={{ userSelect: 'none', pointerEvents: 'none' }}>
                    {isSeven ? '⚔️' : sum}
                  </text>
                  <text x={0} y={50} textAnchor="middle"
                    fontSize={15} fill="rgba(255,255,255,0.60)"
                    fontFamily="var(--font-body)"
                    style={{ userSelect: 'none', pointerEvents: 'none' }}>
                    {isSeven ? 'Rövaren aktiveras!' : `${d1} + ${d2}`}
                  </text>
                </g>

                {/* Resource gains card — one row per player who got something */}
                {gains.length > 0 && (
                  <g className="catan-result-card" style={{ animationDelay: '0.38s' }}>
                    <rect x={-112} y={gainsY} width={224} height={gainsH}
                      rx={14} fill="rgba(14,8,32,0.92)"
                      stroke="rgba(255,255,255,0.20)" strokeWidth={2}
                    />
                    {gains.map(({ name, line }, i) => (
                      <text key={i}
                        x={0} y={gainsY + 20 + i * 28}
                        textAnchor="middle" fontSize={16}
                        fontWeight="600"
                        fill="rgba(255,255,255,0.95)"
                        fontFamily="var(--font-body)"
                        style={{ userSelect: 'none', pointerEvents: 'none' }}>
                        {name}: {line}
                      </text>
                    ))}
                  </g>
                )}

                {/* "Ingen fick resurser" note when sum ≠ 7 but no gains */}
                {!isSeven && gains.length === 0 && (
                  <g className="catan-result-card" style={{ animationDelay: '0.38s' }}>
                    <rect x={-112} y={gainsY} width={224} height={44}
                      rx={14} fill="rgba(14,8,32,0.82)"
                      stroke="rgba(255,255,255,0.12)" strokeWidth={1.5}
                    />
                    <text x={0} y={gainsY + 17}
                      textAnchor="middle" fontSize={14}
                      fill="rgba(255,255,255,0.50)"
                      fontFamily="var(--font-body)"
                      style={{ userSelect: 'none', pointerEvents: 'none' }}>
                      Ingen fick resurser
                    </text>
                  </g>
                )}
              </g>
            );
          }

          // ── Phase: idle — show button or static dice ──
          if (state.phase === 'playing' && isMyTurn && !state.diceRolled && onRollDice) {
            // Centered button: 200px wide → from -100 to +100
            return (
              <g onClick={onRollDice} style={{ cursor: 'pointer' }}>
                {/* Button shadow */}
                <rect x={-101} y={diceAreaY + 2} width={202} height={46} rx={23}
                  fill="rgba(0,0,0,0.35)" />
                {/* Button */}
                <rect x={-101} y={diceAreaY} width={202} height={46} rx={23}
                  fill="#7c3aed" />
                <text x={0} y={diceAreaY + 29} textAnchor="middle"
                  fill="white" fontSize={17} fontWeight="800"
                  fontFamily="var(--font-body)"
                  style={{ userSelect: 'none', pointerEvents: 'none' }}>
                  🎲 Kasta tärning
                </text>
              </g>
            );
          }

          if (state.dice) {
            const [d1, d2] = state.dice;
            const sumX = diceAreaX + DIE_SIZE * 2 + gap * 2 + 8;
            return (
              <g>
                {renderDieFace(d1, diceAreaX, diceAreaY, DIE_SIZE)}
                {renderDieFace(d2, diceAreaX + DIE_SIZE + gap, diceAreaY, DIE_SIZE)}
                <text x={sumX} y={diceAreaY + 24} fontSize={18} fontWeight="800"
                  fill="white" fontFamily="var(--font-body)"
                  style={{ userSelect: 'none', pointerEvents: 'none' }}>
                  ={d1 + d2}
                </text>
              </g>
            );
          }

          return null;
        })()}
      </svg>
    </div>
  );
}
