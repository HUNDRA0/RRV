import { useState, useEffect } from 'react';
import { Lobby } from './Lobby';
import { Game } from './Game';
import { useGame } from './hooks/useGame';
import './catan.css';

export function CatanPage() {
  const [gameId, setGameId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // Restore from sessionStorage on mount
  useEffect(() => {
    const savedGameId = sessionStorage.getItem('catan_game_id');
    const savedToken = sessionStorage.getItem('catan_token');
    if (savedGameId && savedToken) {
      setGameId(savedGameId);
      setToken(savedToken);
    }
  }, []);

  const { state, error, sendAction } = useGame(gameId, token);

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
    <section id="spel" className="catan-page">
      {error && (
        <div className="catan-global-error">⚠️ {error}</div>
      )}

      {isInGame ? (
        <Game
          state={state}
          sendAction={sendAction}
          onLeave={handleLeave}
        />
      ) : (
        <Lobby onGameStart={handleGameStart} />
      )}
    </section>
  );
}
