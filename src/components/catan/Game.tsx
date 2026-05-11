import { useState, useRef } from 'react';
import type { ClientGameState, ClientPlayer } from './types';
import { Board } from './Board';
import { Sidebar } from './Sidebar';
import { TradeModal } from './TradeModal';
import { RobberModal } from './RobberModal';
import { DevCardModal } from './DevCardModal';
import {
  getValidSettlementPlacements,
  getValidRoadPlacements,
  getValidCityPlacements,
  getValidRobberHexes,
} from './gameHelpers';

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
  const [showRobber, setShowRobber] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [chatText, setChatText] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const chatInputRef = useRef<HTMLInputElement>(null);

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

  const handleVertexClick = (vertexId: string) => {
    if (!isMyTurn) return;
    if (state.phase === 'setup') {
      if (state.setupStep === 'settlement') {
        void dispatch({ type: 'placeSettlement', vertexId });
      }
    } else if (state.phase === 'playing') {
      if (buildMode === 'settlement') {
        void dispatch({ type: 'buildSettlement', vertexId });
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
      await sendChat(text); // updates state immediately from response
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

      {/* Chat panel above the board */}
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

      <div className="catan-game-layout">
        <Board
          state={state}
          validVertices={validVertices}
          validEdges={validEdges}
          validHexes={validHexes}
          onVertexClick={handleVertexClick}
          onEdgeClick={handleEdgeClick}
          onHexClick={handleHexClick}
        />

        <Sidebar
          state={state}
          myPlayer={myPlayer}
          onAction={(action) => void dispatch(action)}
          onOpenTrade={() => setShowTrade(true)}
          onOpenDevCard={() => setShowDevCard(true)}
          buildMode={buildMode}
          setBuildMode={setBuildMode}
        />
      </div>

      {/* Leave button below the game layout */}
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

      {(showRobber || (isMyTurn && pendingType === 'moveRobber')) && (
        <RobberModal
          state={state}
          onAction={(action) => void dispatch(action)}
          onClose={() => setShowRobber(false)}
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
