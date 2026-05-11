import type { ClientGameState, HexTile } from './types';

const TERRAIN_COLORS: Record<string, string> = {
  wood: '#3d8b37',
  grain: '#e8c832',
  wool: '#8bc34a',
  ore: '#78909c',
  brick: '#bf5c2c',
  desert: '#d4b483',
};

interface RobberModalProps {
  state: ClientGameState;
  onAction: (action: object) => void;
  onClose: () => void;
}

function miniHexCorners(cx: number, cy: number, size: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    pts.push(`${cx + size * Math.cos(angle)},${cy + size * Math.sin(angle)}`);
  }
  return pts.join(' ');
}

function hexCenter(hex: HexTile, hexSize: number): { cx: number; cy: number } {
  const cx = hexSize * (Math.sqrt(3) * hex.q + Math.sqrt(3) / 2 * hex.r);
  const cy = hexSize * (3 / 2 * hex.r);
  return { cx, cy };
}

export function RobberModal({ state, onAction, onClose }: RobberModalProps) {
  const { hexes } = state.board;
  const robberHexId = hexes.find(h => h.hasRobber)?.id;
  const HEX_SIZE = 36;

  const cxs = hexes.map(h => hexCenter(h, HEX_SIZE).cx);
  const cys = hexes.map(h => hexCenter(h, HEX_SIZE).cy);
  const minX = Math.min(...cxs) - HEX_SIZE;
  const minY = Math.min(...cys) - HEX_SIZE;
  const maxX = Math.max(...cxs) + HEX_SIZE;
  const maxY = Math.max(...cys) + HEX_SIZE;

  const handleHexClick = (hex: HexTile) => {
    if (hex.id === robberHexId) return;
    onAction({ type: 'moveRobber', hexId: hex.id });
    onClose();
  };

  return (
    <div className="catan-modal-overlay" onClick={onClose}>
      <div className="catan-modal" onClick={e => e.stopPropagation()}>
        <div className="catan-modal-header">
          <h2 className="catan-modal-title">Flytta rövaren 🦹</h2>
          <button className="catan-modal-close" onClick={onClose}>✕</button>
        </div>
        <p className="catan-muted" style={{ fontSize: 13, marginBottom: 12 }}>
          Klicka på en hex för att flytta rövaren dit. Du kan inte flytta dit den redan står.
        </p>
        <svg
          viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`}
          style={{ width: '100%', maxHeight: 340, display: 'block' }}
          preserveAspectRatio="xMidYMid meet"
        >
          <rect x={minX} y={minY} width={maxX - minX} height={maxY - minY} fill="#b8d4e8" rx={12} />
          {hexes.map(hex => {
            const { cx, cy } = hexCenter(hex, HEX_SIZE);
            const pts = miniHexCorners(cx, cy, HEX_SIZE - 1);
            const isRobber = hex.id === robberHexId;
            const color = TERRAIN_COLORS[hex.terrain] ?? '#ccc';
            return (
              <g
                key={hex.id}
                onClick={() => handleHexClick(hex)}
                style={{ cursor: isRobber ? 'not-allowed' : 'pointer' }}
              >
                <polygon
                  points={pts}
                  fill={color}
                  stroke={isRobber ? '#666' : '#ff9800'}
                  strokeWidth={isRobber ? 1 : 2}
                  opacity={isRobber ? 0.5 : 1}
                />
                {isRobber && (
                  <circle cx={cx} cy={cy} r={8} fill="#333" />
                )}
                {hex.number && !isRobber && (
                  <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize={9} fill="#333" fontWeight="bold">
                    {hex.number}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
