import type { ClientGameState, ClientPlayer, Resource, Resources, DevCardType } from './types';

const RESOURCE_EMOJI: Record<Resource, string> = {
  wood: '🌲',
  brick: '🧱',
  grain: '🌾',
  ore: '⛏️',
  wool: '🐑',
};

const RESOURCES: Resource[] = ['wood', 'brick', 'grain', 'ore', 'wool'];

const DEV_CARD_LABELS: Record<DevCardType, string> = {
  knight: '⚔️ Riddare',
  roadBuilding: '🛤️ Vägbygge',
  yearOfPlenty: '🎁 Riklighetens år',
  monopoly: '💰 Monopol',
  victoryPoint: '⭐ Segerspoäng',
};

const BUILDING_COSTS: Record<string, Resources> = {
  settlement: { wood: 1, brick: 1, grain: 1, wool: 1, ore: 0 },
  road: { wood: 1, brick: 1, grain: 0, wool: 0, ore: 0 },
  city: { wood: 0, brick: 0, grain: 2, wool: 0, ore: 3 },
  devCard: { wood: 0, brick: 0, grain: 1, wool: 1, ore: 1 },
};

function canAfford(resources: Resources, cost: Resources): boolean {
  return RESOURCES.every(r => resources[r] >= cost[r]);
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

function DieFace({ value }: { value: number }) {
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

export function Sidebar({ state, myPlayer, onAction, onOpenTrade, onOpenDevCard, buildMode, setBuildMode }: SidebarProps) {
  const isMyTurn = state.players[state.currentPlayerIndex]?.id === myPlayer.id;
  const isPlaying = state.phase === 'playing';
  const isSetup = state.phase === 'setup';
  const res = myPlayer.resources;
  const myDevCards = Array.isArray(myPlayer.devCards) ? myPlayer.devCards : [];
  const totalRes = totalResources(res);
  const pendingType = state.pendingAction?.type;

  const canBuildSettlement = canAfford(res, BUILDING_COSTS.settlement);
  const canBuildRoad = canAfford(res, BUILDING_COSTS.road);
  const canBuildCity = canAfford(res, BUILDING_COSTS.city);
  const canBuyDev = canAfford(res, BUILDING_COSTS.devCard) && state.devDeckSize > 0;

  const handleRollDice = () => {
    if (buildMode) setBuildMode(null);
    onAction({ type: 'rollDice' });
  };

  const handleEndTurn = () => {
    setBuildMode(null);
    onAction({ type: 'endTurn' });
  };

  const toggleBuild = (mode: string) => {
    setBuildMode(buildMode === mode ? null : mode);
  };

  const recentLog = state.log.slice(-5).reverse();

  return (
    <div className="catan-sidebar">
      {/* Players overview */}
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
                  {isCurrent && <span className="catan-turn-badge">Din tur!</span>}
                  {p.id === myPlayer.id && !isCurrent && <span className="catan-me-badge">Du</span>}
                </div>
                <div className="catan-player-stats">
                  <span title="VP">⭐{p.vp}</span>
                  <span title="Resurser">🃏{Array.isArray(p.devCards) ? totalResources(p.resources) : Object.values(p.resources).reduce((a, b) => a + b, 0)}</span>
                  <span title="Riddare">⚔️{p.playedKnights}</span>
                  <span title="Dev-kort">🂠{devCount}</span>
                  {p.hasLargestArmy && <span title="Störst armé">🏆A</span>}
                  {p.hasLongestRoad && <span title="Längsta väg">🏆V</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* My resources */}
      <div className="catan-sidebar-section">
        <h3 className="catan-sidebar-heading">Resurser ({totalRes})</h3>
        <div className="catan-resources">
          {RESOURCES.map(r => (
            <div key={r} className={`catan-resource-chip${res[r] > 0 ? ' has-res' : ''}`}>
              <span className="catan-resource-icon">{RESOURCE_EMOJI[r]}</span>
              <span className="catan-resource-count">{res[r]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Dev cards */}
      {myDevCards.length > 0 && (
        <div className="catan-sidebar-section">
          <h3 className="catan-sidebar-heading">Dev-kort</h3>
          <button className="catan-btn catan-btn-secondary catan-btn-sm" onClick={onOpenDevCard}>
            Spela dev-kort ({myDevCards.length})
          </button>
        </div>
      )}

      {/* Dice */}
      {state.dice && (
        <div className="catan-sidebar-section">
          <h3 className="catan-sidebar-heading">Tärningar</h3>
          <div className="catan-dice-row">
            <DieFace value={state.dice[0]} />
            <DieFace value={state.dice[1]} />
            <span className="catan-dice-sum">= {state.dice[0] + state.dice[1]}</span>
          </div>
        </div>
      )}

      {/* Actions */}
      {(isMyTurn || isSetup) && (
        <div className="catan-sidebar-section">
          <h3 className="catan-sidebar-heading">Åtgärder</h3>
          <div className="catan-actions">
            {/* Setup phase */}
            {isSetup && isMyTurn && (
              <p className="catan-muted" style={{ fontSize: 13 }}>
                Placera {state.setupStep === 'settlement' ? 'bosättning' : 'väg'} på kartan
              </p>
            )}

            {/* Playing phase */}
            {isPlaying && isMyTurn && !pendingType && (
              <>
                {!state.diceRolled && (
                  <button className="catan-btn catan-btn-primary" onClick={handleRollDice}>
                    🎲 Kasta tärningar
                  </button>
                )}
                {state.diceRolled && (
                  <>
                    <button
                      className={`catan-btn${buildMode === 'settlement' ? ' catan-btn-active' : ' catan-btn-secondary'}`}
                      disabled={!canBuildSettlement}
                      onClick={() => toggleBuild('settlement')}
                      title="Kostar 🌲🧱🌾🐑"
                    >
                      🏠 Bosättning {!canBuildSettlement && '(har ej råd)'}
                    </button>
                    <button
                      className={`catan-btn${buildMode === 'road' ? ' catan-btn-active' : ' catan-btn-secondary'}`}
                      disabled={!canBuildRoad}
                      onClick={() => toggleBuild('road')}
                      title="Kostar 🌲🧱"
                    >
                      🛤️ Väg {!canBuildRoad && '(har ej råd)'}
                    </button>
                    <button
                      className={`catan-btn${buildMode === 'city' ? ' catan-btn-active' : ' catan-btn-secondary'}`}
                      disabled={!canBuildCity}
                      onClick={() => toggleBuild('city')}
                      title="Kostar 🌾🌾⛏️⛏️⛏️"
                    >
                      🏙️ Stad {!canBuildCity && '(har ej råd)'}
                    </button>
                    <button
                      className="catan-btn catan-btn-secondary"
                      disabled={!canBuyDev}
                      onClick={() => onAction({ type: 'buyDevCard' })}
                      title="Kostar 🌾🐑⛏️"
                    >
                      🂠 Köp dev-kort {!canBuyDev && '(har ej råd)'}
                    </button>
                    <button
                      className="catan-btn catan-btn-secondary"
                      onClick={onOpenTrade}
                    >
                      🔄 Handla
                    </button>
                    {myDevCards.length > 0 && !myPlayer.devCardPlayedThisTurn && (
                      <button
                        className="catan-btn catan-btn-secondary"
                        onClick={onOpenDevCard}
                      >
                        {DEV_CARD_LABELS.knight.split(' ')[0]} Spela dev-kort
                      </button>
                    )}
                    <button
                      className="catan-btn catan-btn-primary"
                      onClick={handleEndTurn}
                    >
                      ✅ Avsluta tur
                    </button>
                  </>
                )}
              </>
            )}

            {pendingType === 'moveRobber' && isMyTurn && (
              <p className="catan-muted" style={{ fontSize: 13 }}>
                Klicka på en hex för att flytta rövaren
              </p>
            )}
            {pendingType === 'steal' && isMyTurn && (
              <div>
                <p className="catan-muted" style={{ fontSize: 13 }}>
                  Välj spelare att stjäla ifrån:
                </p>
                {state.pendingAction?.stealFrom?.map(pid => {
                  const pp = state.players.find(p => p.id === pid);
                  return pp ? (
                    <button
                      key={pid}
                      className={`catan-btn catan-btn-secondary player-${pp.color}`}
                      onClick={() => onAction({ type: 'steal', fromPlayerId: pid })}
                    >
                      Stjäl från {pp.name}
                    </button>
                  ) : null;
                })}
              </div>
            )}
            {pendingType === 'placeRoad' && isMyTurn && (
              <p className="catan-muted" style={{ fontSize: 13 }}>
                Placera väg ({state.pendingAction?.roadsLeft} kvar)
              </p>
            )}
            {pendingType === 'yearOfPlenty' && isMyTurn && (
              <p className="catan-muted" style={{ fontSize: 13 }}>
                Välj resurser (via dev-kort-menyn)
              </p>
            )}
            {pendingType === 'monopoly' && isMyTurn && (
              <p className="catan-muted" style={{ fontSize: 13 }}>
                Välj resurs att ta alla av (via dev-kort-menyn)
              </p>
            )}
          </div>
        </div>
      )}

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
                    <button className="catan-btn catan-btn-primary" onClick={() => onAction({ type: 'respondTrade', accept: true })}>
                      ✅ Acceptera
                    </button>
                    <button className="catan-btn catan-btn-secondary" onClick={() => onAction({ type: 'respondTrade', accept: false })}>
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
                        onClick={() => onAction({ type: 'completeTrade', withPlayerId: p.id })}
                      >
                        Välj {p.name}
                      </button>
                    ))}
                  </>
                ) : (
                  <p className="catan-muted" style={{ fontSize: 13 }}>Väntar på svar…</p>
                )}
                <button className="catan-btn catan-btn-ghost" onClick={() => onAction({ type: 'cancelTrade' })}>
                  Avbryt
                </button>
              </div>
            );
          })()}
        </div>
      )}

      {/* Game log */}
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
