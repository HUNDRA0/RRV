import { useState } from 'react';
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
  onLeave: () => void;
}

export function Game({ state, sendAction, onLeave }: GameProps) {
  const [buildMode, setBuildMode] = useState<string | null>(null);
  const [showTrade, setShowTrade] = useState(false);
  const [showDevCard, setShowDevCard] = useState(false);
  const [showRobber, setShowRobber] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

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

  const currentPlayer = state.players[state.currentPlayerIndex];

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
        <button className="catan-btn catan-btn-ghost catan-btn-sm" onClick={onLeave}>
          Lämna
        </button>
      </div>

      {actionError && (
        <div className="catan-action-error">{actionError}</div>
      )}

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
    </div>
  );
}
