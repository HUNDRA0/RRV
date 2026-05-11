import { useEffect, useRef, useState } from 'react';
import type { ClientGameState } from './types';
import { createGame, joinGame, startGame } from './hooks/useGame';

interface LobbyProps {
  onGameStart: (gameId: string, token: string) => void;
}

interface PlayerInfo {
  id: string;
  name: string;
  color: string;
}

export function Lobby({ onGameStart }: LobbyProps) {
  const [mode, setMode] = useState<'home' | 'waiting'>('home');
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [gameId, setGameId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [players, setPlayers] = useState<PlayerInfo[]>([]);
  const [phase, setPhase] = useState<string>('lobby');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Restore from sessionStorage on mount
  useEffect(() => {
    const savedGameId = sessionStorage.getItem('catan_game_id');
    const savedToken = sessionStorage.getItem('catan_token');
    const savedCode = sessionStorage.getItem('catan_code');
    const savedIsHost = sessionStorage.getItem('catan_is_host') === 'true';
    if (savedGameId && savedToken) {
      setGameId(savedGameId);
      setToken(savedToken);
      setCode(savedCode);
      setIsHost(savedIsHost);
      setMode('waiting');
    }
  }, []);

  // Poll for players in waiting room
  useEffect(() => {
    if (mode !== 'waiting' || !gameId) return;
    const poll = async () => {
      try {
        const res = await fetch(`/api/catan/${gameId}/players`);
        if (res.ok) {
          const data = await res.json() as PlayerInfo[];
          setPlayers(data);
        }
        // Also check if game started
        const stateRes = await fetch(`/api/catan/${gameId}`, {
          headers: token ? { 'x-catan-token': token } : {},
        });
        if (stateRes.ok) {
          const state = await stateRes.json() as ClientGameState;
          setPhase(state.phase);
          if (state.phase !== 'lobby' && gameId && token) {
            onGameStart(gameId, token);
          }
        }
      } catch {
        // ignore poll errors
      }
    };
    void poll();
    pollRef.current = setInterval(() => void poll(), 2000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [mode, gameId, token, onGameStart]);

  const handleCreate = async () => {
    if (!playerName.trim()) { setError('Ange ditt namn'); return; }
    setLoading(true);
    setError(null);
    try {
      const result = await createGame(playerName.trim());
      sessionStorage.setItem('catan_game_id', result.gameId);
      sessionStorage.setItem('catan_token', result.token);
      sessionStorage.setItem('catan_code', result.code);
      sessionStorage.setItem('catan_is_host', 'true');
      setGameId(result.gameId);
      setToken(result.token);
      setCode(result.code);
      setIsHost(true);
      setMode('waiting');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!playerName.trim()) { setError('Ange ditt namn'); return; }
    if (!roomCode.trim()) { setError('Ange rumskod'); return; }
    setLoading(true);
    setError(null);
    try {
      const result = await joinGame(roomCode.trim(), playerName.trim());
      sessionStorage.setItem('catan_game_id', result.gameId);
      sessionStorage.setItem('catan_token', result.token);
      sessionStorage.setItem('catan_is_host', 'false');
      setGameId(result.gameId);
      setToken(result.token);
      setIsHost(false);
      setMode('waiting');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async () => {
    if (!gameId || !token) return;
    setLoading(true);
    setError(null);
    try {
      await startGame(gameId, token);
      onGameStart(gameId, token);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleLeave = () => {
    sessionStorage.removeItem('catan_game_id');
    sessionStorage.removeItem('catan_token');
    sessionStorage.removeItem('catan_code');
    sessionStorage.removeItem('catan_is_host');
    setMode('home');
    setGameId(null);
    setToken(null);
    setCode(null);
    setIsHost(false);
    setPlayers([]);
    setPhase('lobby');
  };

  if (mode === 'waiting') {
    return (
      <div className="catan-lobby">
        <div className="catan-lobby-card">
          <h2 className="catan-lobby-title">Väntar på spelare</h2>
          {code && (
            <div className="catan-room-code-wrap">
              <span className="catan-room-code-label">Rumskod</span>
              <span className="catan-room-code">{code}</span>
            </div>
          )}
          <div className="catan-players-list">
            {players.map(p => (
              <div key={p.id} className={`catan-lobby-player player-${p.color}`}>
                <span className="catan-player-dot" />
                {p.name}
              </div>
            ))}
            {players.length === 0 && (
              <p className="catan-muted">Inga spelare ännu…</p>
            )}
          </div>
          {error && <p className="catan-error">{error}</p>}
          <div className="catan-lobby-actions">
            {isHost && (
              <button
                className="catan-btn catan-btn-primary"
                onClick={() => void handleStart()}
                disabled={loading || players.length < 2 || phase !== 'lobby'}
              >
                {loading ? 'Startar…' : 'Starta spel'}
              </button>
            )}
            {!isHost && (
              <p className="catan-muted">Väntar på värden att starta spelet…</p>
            )}
            <button className="catan-btn catan-btn-ghost" onClick={handleLeave}>
              Lämna
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="catan-lobby">
      <div className="catan-lobby-card">
        <h2 className="catan-lobby-title">Catan 🎲</h2>
        <p className="catan-muted" style={{ marginBottom: 24 }}>
          Bygg, handla och erövra!
        </p>

        <div className="catan-form-group">
          <label className="catan-label">Ditt namn</label>
          <input
            className="catan-input"
            type="text"
            placeholder="Ange namn…"
            value={playerName}
            onChange={e => setPlayerName(e.target.value)}
            maxLength={20}
          />
        </div>

        <button
          className="catan-btn catan-btn-primary"
          style={{ width: '100%', marginBottom: 16 }}
          onClick={() => void handleCreate()}
          disabled={loading}
        >
          {loading ? 'Skapar…' : 'Skapa spel'}
        </button>

        <div className="catan-divider"><span>eller</span></div>

        <div className="catan-form-group">
          <label className="catan-label">Rumskod</label>
          <input
            className="catan-input"
            type="text"
            placeholder="XXXXXX"
            value={roomCode}
            onChange={e => setRoomCode(e.target.value.toUpperCase())}
            maxLength={6}
          />
        </div>

        <button
          className="catan-btn catan-btn-secondary"
          style={{ width: '100%' }}
          onClick={() => void handleJoin()}
          disabled={loading}
        >
          {loading ? 'Ansluter…' : 'Gå med i spel'}
        </button>

        {error && <p className="catan-error">{error}</p>}
      </div>
    </div>
  );
}
