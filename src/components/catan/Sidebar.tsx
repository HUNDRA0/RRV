import type { ClientGameState, ClientPlayer, Resource, Resources } from './types';

const RESOURCE_EMOJI: Record<Resource, string> = {
  wood: '🌲',
  brick: '🧱',
  grain: '🌾',
  ore: '⛏️',
  wool: '🐑',
};

const RESOURCES: Resource[] = ['wood', 'brick', 'grain', 'ore', 'wool'];

export function DieFace({ value }: { value: number }) {
  const DIE_DOTS: Record<number, [number, number][]> = {
    1: [[50, 50]],
    2: [[25, 25], [75, 75]],
    3: [[25, 25], [50, 50], [75, 75]],
    4: [[25, 25], [75, 25], [25, 75], [75, 75]],
    5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
    6: [[25, 22], [75, 22], [25, 50], [75, 50], [25, 78], [75, 78]],
  };
  const dots: [number, number][] = DIE_DOTS[value] ?? [[50, 50]];

  return (
    <svg width={40} height={40} viewBox="0 0 100 100">
      <rect x={5} y={5} width={90} height={90} rx={16} fill="var(--paper)" stroke="var(--line-strong)" strokeWidth={5} />
      {dots.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={10} fill="var(--ink)" />
      ))}
    </svg>
  );
}

function totalResources(r: Resources): number {
  return RESOURCES.reduce((s, k) => s + r[k], 0);
}

interface SidebarProps {
  state: ClientGameState;
  myPlayer: ClientPlayer;
  onAction: (action: object) => void;
  onOpenTrade: () => void;
  onOpenDevCard: () => void;
  buildMode: string | null;
  setBuildMode: (mode: string | null) => void;
}

export function Sidebar({ state, myPlayer, onAction }: SidebarProps) {
  const recentLog = state.log.slice(-3).reverse();

  return (
    <div className="catan-sidebar">
      {/* Players overview — compact */}
      <div className="catan-sidebar-section">
        <h3 className="catan-sidebar-heading">Spelare</h3>
        {state.players.map((p, idx) => {
          const isCurrent = idx === state.currentPlayerIndex;
          const devCount = Array.isArray(p.devCards) ? p.devCards.length : p.devCards;
          return (
            <div key={p.id} className={`catan-player-row player-${p.color}${isCurrent ? ' is-current' : ''}${p.id === myPlayer.id ? ' is-me' : ''}`}>
              <span className="catan-player-color-dot" />
              <div className="catan-player-info">
                <div className="catan-player-name-row">
                  <span className="catan-player-name">{p.name}</span>
                  {isCurrent && <span className="catan-turn-badge">▶</span>}
                  {p.id === myPlayer.id && !isCurrent && <span className="catan-me-badge">Du</span>}
                </div>
                <div className="catan-player-stats">
                  <span title="Segerpoäng">⭐{p.vp}</span>
                  <span title="Resurser">🃏{totalResources(p.resources)}</span>
                  <span title="Spelade riddare">⚔️{p.playedKnights}</span>
                  <span title="Utvecklingskort">🂠{devCount}</span>
                  {p.hasLargestArmy && <span title="Största armén">🏆A</span>}
                  {p.hasLongestRoad && <span title="Längsta vägen">🏆V</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Trade offer from others */}
      {state.tradeOffer && state.tradeOffer.fromPlayerId !== myPlayer.id && (
        <div className="catan-sidebar-section catan-trade-offer">
          <h3 className="catan-sidebar-heading">Handelserbjudande</h3>
          {(() => {
            const offer = state.tradeOffer!;
            const from = state.players.find(p => p.id === offer.fromPlayerId);
            const myResponse = offer.responses[myPlayer.id];
            return (
              <div>
                <p className="catan-muted" style={{ fontSize: 13 }}>
                  <strong>{from?.name}</strong> erbjuder:
                </p>
                <div className="catan-trade-row">
                  <span>Ger: {RESOURCES.filter(r => offer.give[r] > 0).map(r => `${offer.give[r]}×${RESOURCE_EMOJI[r]}`).join(' ')}</span>
                  <span>Vill ha: {RESOURCES.filter(r => offer.want[r] > 0).map(r => `${offer.want[r]}×${RESOURCE_EMOJI[r]}`).join(' ')}</span>
                </div>
                {myResponse === 'pending' && (
                  <div className="catan-actions">
                    <button className="catan-btn catan-btn-primary" onClick={() => onAction({ type: 'tradeRespond', accept: true })}>
                      ✅ Acceptera
                    </button>
                    <button className="catan-btn catan-btn-secondary" onClick={() => onAction({ type: 'tradeRespond', accept: false })}>
                      ❌ Neka
                    </button>
                  </div>
                )}
                {myResponse && myResponse !== 'pending' && (
                  <p className="catan-muted" style={{ fontSize: 13 }}>
                    Du har {myResponse === 'accept' ? 'accepterat' : 'nekat'}
                  </p>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Accept responses (if I'm the trader) */}
      {state.tradeOffer && state.tradeOffer.fromPlayerId === myPlayer.id && (
        <div className="catan-sidebar-section catan-trade-offer">
          <h3 className="catan-sidebar-heading">Mitt erbjudande</h3>
          {(() => {
            const offer = state.tradeOffer!;
            const acceptedPlayers = Object.entries(offer.responses)
              .filter(([, r]) => r === 'accept')
              .map(([pid]) => state.players.find(p => p.id === pid))
              .filter(Boolean);
            return (
              <div>
                {acceptedPlayers.length > 0 ? (
                  <>
                    <p className="catan-muted" style={{ fontSize: 13 }}>Accepterade:</p>
                    {acceptedPlayers.map(p => p && (
                      <button
                        key={p.id}
                        className={`catan-btn catan-btn-secondary player-${p.color}`}
                        onClick={() => onAction({ type: 'tradeComplete', acceptingPlayerId: p.id })}
                      >
                        Välj {p.name}
                      </button>
                    ))}
                  </>
                ) : (
                  <p className="catan-muted" style={{ fontSize: 13 }}>Väntar på svar…</p>
                )}
                <button className="catan-btn catan-btn-ghost" onClick={() => onAction({ type: 'tradeCancel' })}>
                  Avbryt
                </button>
              </div>
            );
          })()}
        </div>
      )}

      {/* Game log — last 3 entries */}
      <div className="catan-sidebar-section">
        <h3 className="catan-sidebar-heading">Logg</h3>
        <div className="catan-log">
          {recentLog.map((entry, i) => (
            <div key={i} className="catan-log-entry">{entry}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
