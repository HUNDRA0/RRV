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

/** Parse room code from hash: #catan?room=ABCDEF → 'ABCDEF' */
function getRoomFromHash(): string | null {
  const hash = window.location.hash; // e.g. "#catan?room=ABCDEF"
  const qIdx = hash.indexOf('?');
  if (qIdx === -1) return null;
  const params = new URLSearchParams(hash.slice(qIdx + 1));
  return params.get('room');
}

/** Build a shareable link for a given room code */
function buildShareLink(roomCode: string): string {
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}#catan?room=${roomCode}`;
}

export function Lobby({ onGameStart }: LobbyProps) {
  // If URL has ?room=XXX, start in 'join-link' mode (just ask for name)
  const linkRoom = getRoomFromHash();
  const [mode, setMode] = useState<'home' | 'join-link' | 'waiting'>(
    linkRoom ? 'join-link' : 'home',
  );
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState(linkRoom ?? '');
  const [gameId, setGameId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [players, setPlayers] = useState<PlayerInfo[]>([]);
  const [phase, setPhase] = useState<string>('lobby');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Restore from sessionStorage on mount (only if no link room)
  useEffect(() => {
    if (linkRoom) return; // joining via link takes priority
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll for game state — single request covers player list + phase check.
  // 5 s is fine in lobby (not time-sensitive). Pauses when tab hidden.
  useEffect(() => {
    if (mode !== 'waiting' || !gameId) return;
    let cancelled = false;

    const poll = async () => {
      if (cancelled || document.visibilityState === 'hidden') return;
      try {
        const res = await fetch(`/api/catan/${gameId}`, {
          headers: token ? { 'x-catan-token': token } : {},
        });
        if (!res.ok || cancelled) return;
        const gs = await res.json() as ClientGameState;
        setPlayers(gs.players.map(p => ({ id: p.id, name: p.name, color: p.color })));
        setPhase(gs.phase);
        if (gs.phase !== 'lobby' && gameId && token) onGameStart(gameId, token);
      } catch { /* ignore poll errors */ }
    };

    const onVisible = () => { if (document.visibilityState === 'visible') void poll(); };
    document.addEventListener('visibilitychange', onVisible);
    void poll();
    pollRef.current = setInterval(() => void poll(), 10000);
    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [mode, gameId, token, onGameStart]);

  const handleCreate = async () => {
    if (!playerName.trim()) { setError('Ange ditt namn'); return; }
    setLoading(true); setError(null);
    try {
      const result = await createGame(playerName.trim());
      sessionStorage.setItem('catan_game_id', result.gameId);
      sessionStorage.setItem('catan_token', result.token);
      sessionStorage.setItem('catan_code', result.code);
      sessionStorage.setItem('catan_is_host', 'true');
      // Update URL to include room code so host can also share from address bar
      window.history.replaceState(null, '', `#catan?room=${result.code}`);
      setGameId(result.gameId);
      setToken(result.token);
      setCode(result.code);
      setIsHost(true);
      setMode('waiting');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally { setLoading(false); }
  };

  const handleJoin = async (nameOverride?: string) => {
    const name = (nameOverride ?? playerName).trim();
    const codeToUse = roomCode.trim();
    if (!name) { setError('Ange ditt namn'); return; }
    if (!codeToUse) { setError('Ange rumskod'); return; }
    setLoading(true); setError(null);
    try {
      const result = await joinGame(codeToUse, name);
      sessionStorage.setItem('catan_game_id', result.gameId);
      sessionStorage.setItem('catan_token', result.token);
      sessionStorage.setItem('catan_is_host', 'false');
      setGameId(result.gameId);
      setToken(result.token);
      setCode(codeToUse);
      setIsHost(false);
      setMode('waiting');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally { setLoading(false); }
  };

  const handleStart = async () => {
    if (!gameId || !token) return;
    setLoading(true); setError(null);
    try {
      await startGame(gameId, token);
      onGameStart(gameId, token);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally { setLoading(false); }
  };

  const handleLeave = () => {
    sessionStorage.removeItem('catan_game_id');
    sessionStorage.removeItem('catan_token');
    sessionStorage.removeItem('catan_code');
    sessionStorage.removeItem('catan_is_host');
    window.history.replaceState(null, '', '#catan');
    setMode('home');
    setGameId(null); setToken(null); setCode(null);
    setIsHost(false); setPlayers([]); setPhase('lobby');
    setRoomCode('');
  };

  const handleCopyLink = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(buildShareLink(code));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select the text
      const input = document.getElementById('catan-share-input') as HTMLInputElement | null;
      input?.select();
    }
  };

  // ── Join-via-link screen ─────────────────────────────────────────────────────
  if (mode === 'join-link') {
    return (
      <div className="catan-lobby">
        <div className="catan-lobby-card">
          <h2 className="catan-lobby-title">Gå med i spel 🎲</h2>
          <p className="catan-muted" style={{ marginBottom: 20 }}>
            Du är inbjuden till rum <strong style={{ color: 'var(--purple)', fontFamily: 'var(--font-mono)' }}>{roomCode}</strong> — ange ditt namn för att gå med.
          </p>
          <div className="catan-form-group">
            <label className="catan-label">Ditt namn</label>
            <input
              className="catan-input"
              type="text"
              placeholder="Ange namn…"
              value={playerName}
              onChange={e => setPlayerName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void handleJoin(); }}
              maxLength={20}
              autoFocus
            />
          </div>
          {error && <p className="catan-error">{error}</p>}
          <div className="catan-lobby-actions">
            <button
              className="catan-btn catan-btn-primary"
              onClick={() => void handleJoin()}
              disabled={loading}
            >
              {loading ? 'Ansluter…' : 'Gå med →'}
            </button>
            <button className="catan-btn catan-btn-ghost" onClick={handleLeave}>
              Tillbaka
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Waiting room ─────────────────────────────────────────────────────────────
  if (mode === 'waiting') {
    const shareLink = code ? buildShareLink(code) : '';
    return (
      <div className="catan-lobby">
        <div className="catan-lobby-card">
          <h2 className="catan-lobby-title">Väntar på spelare</h2>

          {/* Room code + share */}
          {code && (
            <div className="catan-room-code-wrap">
              <span className="catan-room-code-label">Rumskod</span>
              <span className="catan-room-code">{code}</span>
            </div>
          )}

          {/* Share link */}
          {shareLink && (
            <div className="catan-share-wrap">
              <input
                id="catan-share-input"
                className="catan-share-input"
                readOnly
                value={shareLink}
                onFocus={e => e.target.select()}
              />
              <button
                className={`catan-btn catan-btn-sm ${copied ? 'catan-btn-active' : 'catan-btn-secondary'}`}
                onClick={() => void handleCopyLink()}
              >
                {copied ? '✅ Kopierad!' : '📋 Kopiera länk'}
              </button>
              <p className="catan-muted" style={{ fontSize: 12, marginTop: 4 }}>
                Skicka länken — vänner anger bara sitt namn och joinear direkt.
              </p>
            </div>
          )}

          {/* Player list */}
          <div className="catan-players-list">
            {players.map(p => (
              <div key={p.id} className={`catan-lobby-player player-${p.color}`}>
                <span className="catan-player-dot" />
                {p.name}
              </div>
            ))}
            {players.length === 0 && <p className="catan-muted">Inga spelare ännu…</p>}
          </div>

          {error && <p className="catan-error">{error}</p>}

          <div className="catan-lobby-actions">
            {isHost ? (
              <button
                className="catan-btn catan-btn-primary"
                onClick={() => void handleStart()}
                disabled={loading || players.length < 2 || phase !== 'lobby'}
              >
                {loading ? 'Startar…' : `Starta spel (${players.length}/4)`}
              </button>
            ) : (
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

  // ── Home screen ───────────────────────────────────────────────────────────────
  return (
    <div className="catan-lobby">
      <div className="catan-lobby-card">
        <h2 className="catan-lobby-title">Catan 🎲</h2>
        <p className="catan-muted" style={{ marginBottom: 24 }}>Bygg, handla och erövra!</p>

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
