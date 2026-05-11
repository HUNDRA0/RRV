import { useState, useRef, useEffect } from 'react';
import type { ClientGameState, ClientPlayer, Resources } from './types';
import { Board } from './Board';
import type { DiceAnimPhase } from './Board';
import { TradeModal } from './TradeModal';
import { DevCardModal } from './DevCardModal';
import {
  canAfford,
  getValidSettlementPlacements,
  getValidRoadPlacements,
  getValidCityPlacements,
  getValidRobberHexes,
} from './gameHelpers';

const RESOURCE_EMOJI: Record<string, string> = {
  wood: '🌲', brick: '🧱', grain: '🌾', ore: '🪨', wool: '🐑',
};
const RESOURCES_LIST = ['wood', 'brick', 'grain', 'ore', 'wool'] as const;

function formatResources(r: Resources): string {
  return RESOURCES_LIST
    .filter(k => r[k] > 0)
    .map(k => `${r[k]}×${RESOURCE_EMOJI[k]}`)
    .join(' ') || '—';
}

// Building costs used by the action bar
const BUILDING_COSTS: Record<string, Resources> = {
  settlement: { wood: 1, brick: 1, grain: 1, wool: 1, ore: 0 },
  road:       { wood: 1, brick: 1, grain: 0, wool: 0, ore: 0 },
  city:       { wood: 0, brick: 0, grain: 2, wool: 0, ore: 3 },
  devCard:    { wood: 0, brick: 0, grain: 1, wool: 1, ore: 1 },
};

// ---- Action bar component ----
interface ActionBarProps {
  state: ClientGameState;
  myPlayer: ClientPlayer;
  buildMode: string | null;
  setBuildMode: (mode: string | null) => void;
  onAction: (action: object) => void;
  onOpenTrade: () => void;
  onOpenDevCard: () => void;
}

const RESOURCE_EMOJI_BAR: Record<string, string> = {
  wood: '🌲', brick: '🧱', grain: '🌾', ore: '🪨', wool: '🐑',
};

const BUILDING_INFO: Record<string, { name: string; emoji: string; cost: Resources }> = {
  settlement: { name: 'Bosättning', emoji: '🏠', cost: BUILDING_COSTS.settlement },
  road:       { name: 'Väg',        emoji: '🛤️', cost: BUILDING_COSTS.road },
  city:       { name: 'Stad',       emoji: '🏙️', cost: BUILDING_COSTS.city },
  devCard:    { name: 'Utvecklingskort', emoji: '🂠', cost: BUILDING_COSTS.devCard },
};

function ActionBar({ state, myPlayer, buildMode, setBuildMode, onAction, onOpenTrade, onOpenDevCard }: ActionBarProps) {
  const isMyTurn = state.players[state.currentPlayerIndex]?.id === myPlayer.id;
  const isPlaying = state.phase === 'playing';
  const isSetup = state.phase === 'setup';
  const res = myPlayer.resources;
  const myDevCards = Array.isArray(myPlayer.devCards) ? myPlayer.devCards : [];
  const pendingType = state.pendingAction?.type;

  const canBuildSettlement = canAfford(res, BUILDING_COSTS.settlement);
  const canBuildRoad = canAfford(res, BUILDING_COSTS.road);
  const canBuildCity = canAfford(res, BUILDING_COSTS.city);
  const canBuyDev = canAfford(res, BUILDING_COSTS.devCard) && state.devDeckSize > 0;

  const [costTooltip, setCostTooltip] = useState<string | null>(null);

  const handleEndTurn = () => {
    setBuildMode(null);
    setCostTooltip(null);
    onAction({ type: 'endTurn' });
  };

  const toggleBuild = (mode: string) => {
    setBuildMode(buildMode === mode ? null : mode);
  };

  /** Click handler for building buttons — toggle build mode if affordable, else show cost tooltip */
  const handleBuildClick = (mode: string, canAffordIt: boolean) => {
    if (canAffordIt) {
      setCostTooltip(null);
      toggleBuild(mode);
    } else {
      setCostTooltip(costTooltip === mode ? null : mode);
    }
  };

  const handleDevCardClick = () => {
    if (canBuyDev) {
      setCostTooltip(null);
      onAction({ type: 'buyDevCard' });
    } else {
      setCostTooltip(costTooltip === 'devCard' ? null : 'devCard');
    }
  };

  const tooltipInfo = costTooltip ? BUILDING_INFO[costTooltip] : null;

  return (
    <div className="catan-action-bar">
      {/* Cost tooltip — floats above the action bar */}
      {tooltipInfo && (
        <div className="catan-cost-tooltip">
          <span className="catan-cost-tooltip-title">{tooltipInfo.emoji} {tooltipInfo.name}</span>
          <div className="catan-cost-tooltip-rows">
            {(Object.entries(tooltipInfo.cost) as [string, number][])
              .filter(([, need]) => need > 0)
              .map(([resource, need]) => {
                const have = res[resource as keyof Resources] ?? 0;
                const ok = have >= need;
                return (
                  <span key={resource} className={`catan-cost-row${ok ? ' ok' : ' missing'}`}>
                    {RESOURCE_EMOJI_BAR[resource]} {have}/{need}
                  </span>
                );
              })}
          </div>
          <button className="catan-cost-tooltip-close" onClick={() => setCostTooltip(null)}>✕</button>
        </div>
      )}

      {/* Actions section */}
      <div className="catan-bar-actions">
        {/* Dice-off phase */}
        {state.phase === 'diceOff' && (
          <span className="catan-bar-status">🎲 Kasta tärning för att avgöra startspelare</span>
        )}

        {/* Setup phase */}
        {isSetup && isMyTurn && (
          <span className="catan-bar-status">
            Placera {state.setupStep === 'settlement' ? 'bosättning' : 'väg'} på kartan
          </span>
        )}

        {/* Playing phase — not rolled yet: show waiting status (dice button is on the board) */}
        {isPlaying && isMyTurn && !pendingType && !state.diceRolled && (
          <span className="catan-bar-status">🎲 Kasta tärningen på brädet</span>
        )}

        {/* Playing phase — rolled, can build */}
        {isPlaying && isMyTurn && !pendingType && state.diceRolled && (
          <>
            <button
              className={`catan-bar-icon-btn${buildMode === 'settlement' ? ' active' : ''}${!canBuildSettlement ? ' cant-afford' : ''}`}
              onClick={() => handleBuildClick('settlement', canBuildSettlement)}
            >
              🏠
            </button>
            <button
              className={`catan-bar-icon-btn${buildMode === 'road' ? ' active' : ''}${!canBuildRoad ? ' cant-afford' : ''}`}
              onClick={() => handleBuildClick('road', canBuildRoad)}
            >
              🛤️
            </button>
            <button
              className={`catan-bar-icon-btn${buildMode === 'city' ? ' active' : ''}${!canBuildCity ? ' cant-afford' : ''}`}
              onClick={() => handleBuildClick('city', canBuildCity)}
            >
              🏙️
            </button>
            <button
              className={`catan-bar-icon-btn${!canBuyDev ? ' cant-afford' : ''}`}
              onClick={handleDevCardClick}
            >
              🂠
            </button>
            <button
              className="catan-bar-icon-btn"
              onClick={() => { setCostTooltip(null); onOpenTrade(); }}
              title="Handla"
            >
              🔄
            </button>
            {myDevCards.length > 0 && !myPlayer.devCardPlayedThisTurn && (
              <button
                className="catan-bar-icon-btn"
                onClick={onOpenDevCard}
                title="Spela utvecklingskort"
              >
                ⚔️
              </button>
            )}
            <button className="catan-bar-primary" onClick={handleEndTurn}>
              ✅ Avsluta tur
            </button>
          </>
        )}

        {/* Pending: moveRobber */}
        {pendingType === 'moveRobber' && isMyTurn && (
          <span className="catan-bar-status">Klicka på en hex för att flytta rövaren</span>
        )}

        {/* Pending: steal */}
        {pendingType === 'steal' && isMyTurn && (
          <>
            <span className="catan-bar-status">Stjäl från:</span>
            {state.pendingAction?.stealFrom?.map(pid => {
              const pp = state.players.find(p => p.id === pid);
              return pp ? (
                <button
                  key={pid}
                  className={`catan-bar-icon-btn player-${pp.color}`}
                  onClick={() => onAction({ type: 'steal', targetPlayerId: pid })}
                  title={pp.name}
                  style={{ width: 'auto', padding: '0 10px', fontSize: 13, fontWeight: 700 }}
                >
                  {pp.name}
                </button>
              ) : null;
            })}
          </>
        )}

        {/* Pending: placeRoad */}
        {pendingType === 'placeRoad' && isMyTurn && (
          <span className="catan-bar-status">
            Placera väg ({state.pendingAction?.roadsLeft} kvar)
          </span>
        )}

        {/* Pending: yearOfPlenty / monopoly */}
        {(pendingType === 'yearOfPlenty' || pendingType === 'monopoly') && isMyTurn && (
          <button className="catan-bar-primary" onClick={onOpenDevCard}>
            {pendingType === 'yearOfPlenty' ? '🎁 Välj resurser' : '💰 Välj resurs'}
          </button>
        )}

        {/* Not my turn */}
        {!isMyTurn && (
          <span className="catan-bar-status">
            ⏳ {state.players[state.currentPlayerIndex]?.name}s tur
          </span>
        )}
      </div>
    </div>
  );
}

// ---- Main Game component ----
interface GameProps {
  state: ClientGameState;
  sendAction: (action: object) => Promise<void>;
  sendChat: (text: string) => Promise<void>;
  onLeave: () => void;
  gameId: string;
  token: string;
}

export function Game({ state, sendAction, sendChat, onLeave, gameId, token }: GameProps) {
  const [buildMode, setBuildMode] = useState<string | null>(null);
  const [showTrade, setShowTrade] = useState(false);
  const [showDevCard, setShowDevCard] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [chatText, setChatText] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const chatMessagesRef = useRef<HTMLDivElement>(null);

  // Dice animation state
  const [diceAnimPhase, setDiceAnimPhase] = useState<DiceAnimPhase>('idle');
  const [animDisplayDice, setAnimDisplayDice] = useState<[number, number]>([1, 1]);
  const diceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const diceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const diceAnimPhaseRef = useRef<DiceAnimPhase>('idle');
  diceAnimPhaseRef.current = diceAnimPhase;
  // undefined = not yet initialised (skip animation on first mount)
  const prevDiceRef = useRef<[number, number] | null | undefined>(undefined);

  // Show result card for ALL players when dice change (not just the roller)
  useEffect(() => {
    const dice = state.dice;
    if (!dice) { prevDiceRef.current = null; return; }
    const [d1, d2] = dice;
    if (prevDiceRef.current === undefined) {
      // First mount — don't animate stale dice from a previous turn
      prevDiceRef.current = [d1, d2];
      return;
    }
    const prev = prevDiceRef.current;
    if (!prev || prev[0] !== d1 || prev[1] !== d2) {
      prevDiceRef.current = [d1, d2];
      // Only trigger if this client didn't already start the animation (i.e. not the roller)
      if (diceAnimPhaseRef.current === 'idle') {
        setDiceAnimPhase('showing');
        if (diceTimerRef.current) clearTimeout(diceTimerRef.current);
        diceTimerRef.current = setTimeout(() => setDiceAnimPhase('idle'), 2800);
      }
    }
  }, [state.dice]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll chat to bottom when new messages arrive
  useEffect(() => {
    const el = chatMessagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [state.chatMessages?.length]);

  const myPlayer: ClientPlayer | undefined = state.players.find(p => p.id === state.myPlayerId);
  if (!myPlayer) {
    return (
      <div className="catan-game-wrap">
        <p className="catan-muted">Ansluter…</p>
      </div>
    );
  }

  const isMyTurn = state.players[state.currentPlayerIndex]?.id === myPlayer.id;
  const pendingType = state.pendingAction?.type;

  // Compute valid placements
  let validVertices: string[] = [];
  let validEdges: string[] = [];
  let validHexes: string[] = [];

  if (isMyTurn) {
    if (state.phase === 'setup') {
      if (state.setupStep === 'settlement') {
        validVertices = getValidSettlementPlacements(state, myPlayer.id);
      } else {
        validEdges = getValidRoadPlacements(state, myPlayer.id);
      }
    } else if (state.phase === 'playing') {
      if (pendingType === 'moveRobber') {
        validHexes = getValidRobberHexes(state);
      } else if (pendingType === 'placeRoad') {
        validEdges = getValidRoadPlacements(state, myPlayer.id);
      } else if (buildMode === 'settlement') {
        validVertices = getValidSettlementPlacements(state, myPlayer.id);
      } else if (buildMode === 'road') {
        validEdges = getValidRoadPlacements(state, myPlayer.id);
      } else if (buildMode === 'city') {
        validVertices = getValidCityPlacements(state, myPlayer.id);
      }
    }
  }

  const dispatch = async (action: object) => {
    setActionError(null);
    try {
      await sendAction(action);
      setBuildMode(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    }
  };

  /** Roll dice with animation: shake → settle on result → hide after 2.8 s */
  const handleRollDice = async () => {
    if (diceAnimPhase !== 'idle') return;
    // Start shaking with random cycling faces
    setDiceAnimPhase('rolling');
    diceIntervalRef.current = setInterval(() => {
      setAnimDisplayDice([
        (Math.ceil(Math.random() * 6)) as 1|2|3|4|5|6,
        (Math.ceil(Math.random() * 6)) as 1|2|3|4|5|6,
      ]);
    }, 75);
    try {
      setActionError(null);
      await sendAction({ type: 'rollDice' });
      // Stop cycling, show real result with pop
      if (diceIntervalRef.current) { clearInterval(diceIntervalRef.current); diceIntervalRef.current = null; }
      setDiceAnimPhase('showing');
      diceTimerRef.current = setTimeout(() => setDiceAnimPhase('idle'), 2800);
    } catch (err) {
      if (diceIntervalRef.current) { clearInterval(diceIntervalRef.current); diceIntervalRef.current = null; }
      setDiceAnimPhase('idle');
      setActionError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleVertexClick = (vertexId: string) => {
    if (!isMyTurn) return;
    if (state.phase === 'setup') {
      if (state.setupStep === 'settlement') {
        void dispatch({ type: 'placeSettlement', vertexId });
      }
    } else if (state.phase === 'playing') {
      if (buildMode === 'settlement') {
        // After placing a settlement, auto-enter road mode so valid spots are highlighted
        setActionError(null);
        sendAction({ type: 'buildSettlement', vertexId })
          .then(() => setBuildMode('road'))
          .catch(err => {
            setActionError(err instanceof Error ? err.message : String(err));
            setBuildMode(null);
          });
      } else if (buildMode === 'city') {
        void dispatch({ type: 'buildCity', vertexId });
      }
    }
  };

  const handleEdgeClick = (edgeId: string) => {
    if (!isMyTurn) return;
    if (state.phase === 'setup' && state.setupStep === 'road') {
      void dispatch({ type: 'placeRoad', edgeId });
    } else if (state.phase === 'playing' && (buildMode === 'road' || pendingType === 'placeRoad')) {
      void dispatch({ type: 'buildRoad', edgeId });
    }
  };

  const handleHexClick = (hexId: string) => {
    if (!isMyTurn) return;
    if (pendingType === 'moveRobber') {
      void dispatch({ type: 'moveRobber', hexId });
    }
  };

  const handleLeaveConfirmed = async () => {
    try {
      await fetch(`/api/catan/${gameId}/leave`, {
        method: 'POST',
        headers: { 'x-catan-token': token },
      });
    } catch {
      // ignore errors — still leave
    }
    onLeave();
  };

  const handleSendChat = async () => {
    const text = chatText.trim();
    if (!text || chatSending) return;
    setChatSending(true);
    setChatText('');
    try {
      await sendChat(text);
    } catch {
      // silently ignore chat errors
    } finally {
      setChatSending(false);
      chatInputRef.current?.focus();
    }
  };

  const handleChatKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void handleSendChat();
    }
  };

  const recentMessages = (state.chatMessages ?? []).slice(-50);

  return (
    <div className="catan-game-wrap">
      <div className="catan-game-header">
        <div className="catan-game-info">
          <span className="catan-room-code-sm">#{state.code}</span>
          {state.phase === 'ended' && state.winner && (
            <span className="catan-winner-badge">
              🏆 {state.players.find(p => p.id === state.winner)?.name ?? 'Okänd'} vann!
            </span>
          )}
        </div>
      </div>

      {actionError && (
        <div className="catan-action-error">{actionError}</div>
      )}

      {/* ── Dice-off panel ── */}
      {state.phase === 'diceOff' && state.diceOffRolls && (
        <div className="catan-diceoff-panel">
          <div className="catan-diceoff-header">
            <span className="catan-diceoff-title">🎲 Vem börjar?</span>
            {state.diceOffActive && state.diceOffActive.length < state.players.length && (
              <span className="catan-diceoff-tiebreak">Oavgjort — kasta om!</span>
            )}
          </div>
          <div className="catan-diceoff-rows">
            {state.players.map(p => {
              const roll = state.diceOffRolls![p.id];
              const isActive = state.diceOffActive?.includes(p.id);
              return (
                <div key={p.id} className={`catan-diceoff-row${isActive ? ' active' : ''}`}>
                  <span className={`catan-player-dot player-${p.color}`} style={{ width: 10, height: 10, borderRadius: '50%', display: 'inline-block', background: 'var(--pc)' }} />
                  <span className="catan-diceoff-name">{p.name}</span>
                  <span className="catan-diceoff-result">
                    {roll
                      ? `🎲 ${roll[0]} + ${roll[1]} = ${roll[0] + roll[1]}`
                      : isActive ? '⏳' : '—'}
                  </span>
                </div>
              );
            })}
          </div>
          {state.diceOffActive?.includes(myPlayer.id) && !state.diceOffRolls[myPlayer.id] && (
            <button
              className="catan-btn catan-btn-primary"
              style={{ marginTop: 10, width: '100%' }}
              onClick={() => void dispatch({ type: 'diceOffRoll' })}
            >
              🎲 Kasta tärning
            </button>
          )}
          {state.diceOffActive?.includes(myPlayer.id) && state.diceOffRolls[myPlayer.id] && (
            <p className="catan-muted" style={{ marginTop: 8, fontSize: 13 }}>Väntar på de andra…</p>
          )}
        </div>
      )}

      {/* ── Trade offer card — sits above chat, always fully visible ── */}
      {state.tradeOffer && state.tradeOffer.fromPlayerId !== myPlayer.id && (() => {
        const offer = state.tradeOffer!;
        const from = state.players.find(p => p.id === offer.fromPlayerId);
        const myResponse = offer.responses[myPlayer.id];

        // After responding, show a compact one-liner — no need to keep the full card
        if (myResponse !== 'pending') {
          return (
            <div className="catan-trade-card" style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 15 }}>🔄</span>
              <span style={{ fontSize: 13, color: 'var(--mute)', flex: 1 }}>
                {from?.name}: {myResponse === 'accept' ? 'accepterat ✅' : 'nekat ❌'} — väntar på värden
              </span>
            </div>
          );
        }

        return (
          <div className="catan-trade-card">
            <div className="catan-trade-card-header">
              <span className="catan-trade-card-icon">🔄</span>
              <span className="catan-trade-card-title">{from?.name} erbjuder ett byte</span>
            </div>
            <div className="catan-trade-card-resources">
              <span className="catan-trade-card-label">Ger</span>
              <span className="catan-trade-card-res">{formatResources(offer.give)}</span>
              <span className="catan-trade-card-arrow">→</span>
              <span className="catan-trade-card-label">Vill ha</span>
              <span className="catan-trade-card-res">{formatResources(offer.want)}</span>
            </div>
            <div className="catan-trade-card-actions">
              <button className="catan-btn catan-btn-primary catan-btn-sm"
                onClick={() => void dispatch({ type: 'tradeRespond', accept: true })}>
                ✅ Acceptera
              </button>
              <button className="catan-btn catan-btn-secondary catan-btn-sm"
                onClick={() => void dispatch({ type: 'tradeRespond', accept: false })}>
                ❌ Neka
              </button>
            </div>
          </div>
        );
      })()}

      {state.tradeOffer && state.tradeOffer.fromPlayerId === myPlayer.id && (() => {
        const offer = state.tradeOffer!;
        const acceptedPlayers = Object.entries(offer.responses)
          .filter(([, r]) => r === 'accept')
          .map(([pid]) => state.players.find(p => p.id === pid))
          .filter(Boolean) as ClientPlayer[];
        return (
          <div className="catan-trade-card catan-trade-card-mine">
            <div className="catan-trade-card-header">
              <span className="catan-trade-card-icon">🔄</span>
              <span className="catan-trade-card-title">Ditt erbjudande</span>
            </div>
            <div className="catan-trade-card-resources">
              <span className="catan-trade-card-label">Ger</span>
              <span className="catan-trade-card-res">{formatResources(offer.give)}</span>
              <span className="catan-trade-card-arrow">→</span>
              <span className="catan-trade-card-label">Vill ha</span>
              <span className="catan-trade-card-res">{formatResources(offer.want)}</span>
            </div>
            {acceptedPlayers.length > 0 ? (
              <div className="catan-trade-card-actions">
                {acceptedPlayers.map(p => (
                  <button key={p.id}
                    className={`catan-btn catan-btn-primary catan-btn-sm player-${p.color}`}
                    onClick={() => void dispatch({ type: 'tradeComplete', acceptingPlayerId: p.id })}>
                    Välj {p.name}
                  </button>
                ))}
              </div>
            ) : (
              <p className="catan-trade-card-status">Väntar på svar…</p>
            )}
            <button className="catan-btn catan-btn-ghost catan-btn-sm"
              style={{ marginTop: 6 }}
              onClick={() => void dispatch({ type: 'tradeCancel' })}>
              Avbryt handel
            </button>
          </div>
        );
      })()}

      {/* Chat panel */}
      <div className="catan-chat-wrap">
        <div className="catan-chat-messages" ref={chatMessagesRef}>
          {recentMessages.length === 0 ? (
            <p className="catan-chat-empty">Inga meddelanden än…</p>
          ) : (
            recentMessages.map((msg, i) => (
              <div
                key={`${msg.ts}-${i}`}
                className={`catan-chat-msg${msg.system ? ' system' : ''}`}
              >
                {!msg.system && (
                  <span className="catan-chat-name">{msg.playerName}: </span>
                )}
                {msg.text}
              </div>
            ))
          )}
        </div>
        <div className="catan-chat-input-row">
          <input
            ref={chatInputRef}
            className="catan-chat-input"
            type="text"
            placeholder="Skriv ett meddelande…"
            value={chatText}
            onChange={e => setChatText(e.target.value)}
            onKeyDown={handleChatKeyDown}
            maxLength={200}
          />
          <button
            className="catan-chat-send"
            onClick={() => void handleSendChat()}
            disabled={chatSending || !chatText.trim()}
          >
            Skicka
          </button>
        </div>
      </div>

      {/* Board — full width, no sidebar */}
      <Board
        state={state}
        myPlayerId={myPlayer.id}
        onRollDice={isMyTurn && state.phase === 'playing' && !state.diceRolled && diceAnimPhase === 'idle'
          ? () => void handleRollDice()
          : undefined}
        diceAnimPhase={diceAnimPhase}
        animDisplayDice={animDisplayDice}
        validVertices={validVertices}
        validEdges={validEdges}
        validHexes={validHexes}
        onVertexClick={handleVertexClick}
        onEdgeClick={handleEdgeClick}
        onHexClick={handleHexClick}
      />

      {/* Fixed action bar — always visible */}
      <ActionBar
        state={state}
        myPlayer={myPlayer}
        buildMode={buildMode}
        setBuildMode={setBuildMode}
        onAction={(action) => void dispatch(action)}
        onOpenTrade={() => setShowTrade(true)}
        onOpenDevCard={() => setShowDevCard(true)}
      />

      {/* Leave button below the action bar */}
      <div className="catan-leave-btn-wrap">
        <button
          className="catan-btn catan-btn-ghost catan-btn-sm catan-leave-btn"
          onClick={() => setShowLeaveConfirm(true)}
        >
          Lämna spel
        </button>
      </div>

      {/* Modals */}
      {showTrade && (
        <TradeModal
          state={state}
          myPlayer={myPlayer}
          onAction={(action) => void dispatch(action)}
          onClose={() => setShowTrade(false)}
        />
      )}

      {showDevCard && Array.isArray(myPlayer.devCards) && (
        <DevCardModal
          devCards={myPlayer.devCards}
          devCardPlayedThisTurn={myPlayer.devCardPlayedThisTurn}
          diceRolled={state.diceRolled}
          onAction={(action) => void dispatch(action)}
          onClose={() => setShowDevCard(false)}
        />
      )}

      {/* Leave confirmation modal */}
      {showLeaveConfirm && (
        <div className="catan-confirm-overlay" onClick={() => setShowLeaveConfirm(false)}>
          <div className="catan-confirm-card" onClick={e => e.stopPropagation()}>
            <p className="catan-confirm-text">Är du säker på att du vill lämna spelet?</p>
            <div className="catan-confirm-actions">
              <button
                className="catan-btn catan-btn-secondary catan-btn-sm"
                onClick={() => setShowLeaveConfirm(false)}
              >
                Avbryt
              </button>
              <button
                className="catan-btn catan-btn-primary catan-btn-sm catan-confirm-leave-btn"
                onClick={() => void handleLeaveConfirmed()}
              >
                Ja, lämna
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
