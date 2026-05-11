import { useState, useRef } from 'react';
import type { ClientGameState, ClientPlayer, Resources } from './types';
import { Board } from './Board';
import type { DiceAnimPhase } from './Board';
import { TradeModal } from './TradeModal';
import { RobberModal } from './RobberModal';
import { DevCardModal } from './DevCardModal';
import {
  canAfford,
  getValidSettlementPlacements,
  getValidRoadPlacements,
  getValidCityPlacements,
  getValidRobberHexes,
} from './gameHelpers';

const RESOURCE_EMOJI: Record<string, string> = {
  wood: '🌲', brick: '🧱', grain: '🌾', ore: '⛏️', wool: '🐑',
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

  const handleEndTurn = () => {
    setBuildMode(null);
    onAction({ type: 'endTurn' });
  };

  const toggleBuild = (mode: string) => {
    setBuildMode(buildMode === mode ? null : mode);
  };

  return (
    <div className="catan-action-bar">
      {/* Actions section */}
      <div className="catan-bar-actions">
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
              className={`catan-bar-icon-btn${buildMode === 'settlement' ? ' active' : ''}`}
              disabled={!canBuildSettlement}
              onClick={() => toggleBuild('settlement')}
              title="Bosättning (🌲🧱🌾🐑)"
            >
              🏠
            </button>
            <button
              className={`catan-bar-icon-btn${buildMode === 'road' ? ' active' : ''}`}
              disabled={!canBuildRoad}
              onClick={() => toggleBuild('road')}
              title="Väg (🌲🧱)"
            >
              🛤️
            </button>
            <button
              className={`catan-bar-icon-btn${buildMode === 'city' ? ' active' : ''}`}
              disabled={!canBuildCity}
              onClick={() => toggleBuild('city')}
              title="Stad (🌾🌾⛏️⛏️⛏️)"
            >
              🏙️
            </button>
            <button
              className="catan-bar-icon-btn"
              disabled={!canBuyDev}
              onClick={() => onAction({ type: 'buyDevCard' })}
              title="Köp utvecklingskort (🌾🐑⛏️)"
            >
              🂠
            </button>
            <button
              className="catan-bar-icon-btn"
              onClick={onOpenTrade}
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

  // Dice animation state
  const [diceAnimPhase, setDiceAnimPhase] = useState<DiceAnimPhase>('idle');
  const [animDisplayDice, setAnimDisplayDice] = useState<[number, number]>([1, 1]);
  const diceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const diceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const currentPlayer = state.players[state.currentPlayerIndex];
  const recentMessages = (state.chatMessages ?? []).slice(-3);

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
          {state.phase !== 'ended' && currentPlayer && (
            <span className="catan-turn-info">
              {currentPlayer.id === myPlayer.id
                ? '🎯 Din tur!'
                : `⏳ ${currentPlayer.name}s tur`}
            </span>
          )}
        </div>
      </div>

      {actionError && (
        <div className="catan-action-error">{actionError}</div>
      )}

      {/* ── Trade offer card — sits above chat, always fully visible ── */}
      {state.tradeOffer && state.tradeOffer.fromPlayerId !== myPlayer.id && (() => {
        const offer = state.tradeOffer!;
        const from = state.players.find(p => p.id === offer.fromPlayerId);
        const myResponse = offer.responses[myPlayer.id];
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
            {myResponse === 'pending' ? (
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
            ) : (
              <p className="catan-trade-card-status">
                Du har {myResponse === 'accept' ? 'accepterat ✅' : 'nekat ❌'}
              </p>
            )}
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
        <div className="catan-chat-messages">
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

      {isMyTurn && pendingType === 'moveRobber' && (
        <RobberModal
          state={state}
          onAction={(action) => void dispatch(action)}
          onClose={() => {/* closes automatically when pendingAction clears */}}
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
