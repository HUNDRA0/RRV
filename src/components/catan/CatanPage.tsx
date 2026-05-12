import { useState, useEffect } from 'react';
import { Lobby } from './Lobby';
import { Game } from './Game';
import { RulesModal } from './RulesModal';
import { useGame } from './hooks/useGame';
import './catan.css';

export function CatanPage() {
  const [gameId, setGameId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [showRules, setShowRules] = useState(false);

  // Restore from sessionStorage on mount
  useEffect(() => {
    const savedGameId = sessionStorage.getItem('catan_game_id');
    const savedToken = sessionStorage.getItem('catan_token');
    if (savedGameId && savedToken) {
      setGameId(savedGameId);
      setToken(savedToken);
    }
  }, []);

  const { state, error, sendAction, sendChat } = useGame(gameId, token);

  const handleGameStart = (gId: string, tok: string) => {
    setGameId(gId);
    setToken(tok);
  };

  const handleLeave = () => {
    sessionStorage.removeItem('catan_game_id');
    sessionStorage.removeItem('catan_token');
    sessionStorage.removeItem('catan_code');
    sessionStorage.removeItem('catan_is_host');
    setGameId(null);
    setToken(null);
  };

  const isInGame = gameId && token && state && state.phase !== 'lobby';

  return (
    <div className="catan-page">
      {/* In lobby, surface the rules button top-right. In game, Game.tsx
          renders its own Lämna-button and inline Regler button next to the room code. */}
      {!isInGame && (
        <div className="catan-page-header">
          <span />
          <button
            className="catan-rules-btn"
            onClick={() => setShowRules(true)}
            aria-label="Visa spelregler"
          >
            Regler
          </button>
        </div>
      )}

      {error && <div className="catan-global-error">⚠️ {error}</div>}

      {isInGame ? (
        <Game
          state={state}
          sendAction={sendAction}
          sendChat={sendChat}
          onLeave={handleLeave}
          onShowRules={() => setShowRules(true)}
          gameId={gameId}
          token={token}
        />
      ) : (
        <Lobby onGameStart={handleGameStart} />
      )}

      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
    </div>
  );
}
