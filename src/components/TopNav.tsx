import { useState, type KeyboardEvent } from 'react';
import { useFriendsList } from '../lib/state';

export type PageId = 'tierlist' | 'moves' | 'gmap' | 'joblb';

interface Props {
  currentPage: PageId;
  onNavigate: (id: PageId) => void;
}

// Reset is intentionally gone in Phase 2 — it used to wipe localStorage, but
// data is now server-side and a destructive admin endpoint deserves its own
// design (confirmations, audit logging) before we expose it.
export function TopNav({ currentPage, onNavigate }: Props) {
  const { isAdmin, loginError, tryLogin, logout } = useFriendsList();
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);

  async function submitLogin() {
    setBusy(true);
    try {
      const ok = await tryLogin(pw);
      if (ok) setPw('');
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') submitLogin();
  }

  return (
    <div className="top-nav">
      <div className="nav-gold-rule" />
      <div className="nav-inner">
        <div className="nav-logo">
          Real Rankings<span>Viber</span>
          <small>Stockholm · 2026</small>
        </div>
        <div className="nav-tabs">
          <button
            type="button"
            className={`nav-tab${currentPage === 'tierlist' ? ' active' : ''}`}
            onClick={() => onNavigate('tierlist')}
          >
            🏆 Rankings
          </button>
          <button
            type="button"
            className={`nav-tab moves-tab${currentPage === 'moves' ? ' active' : ''}`}
            onClick={() => onNavigate('moves')}
          >
            🎯 Moves 2027
          </button>
          <button
            type="button"
            className={`nav-tab gmap-tab${currentPage === 'gmap' ? ' active' : ''}`}
            onClick={() => onNavigate('gmap')}
          >
            📍 G Map
          </button>
          <button
            type="button"
            className={`nav-tab joblb-tab${currentPage === 'joblb' ? ' active' : ''}`}
            onClick={() => onNavigate('joblb')}
          >
            💼 Jobs
          </button>
        </div>
        {isAdmin ? (
          <div className="nav-right">
            <div className="mode-pill">
              <span className="dot" /> Admin
            </div>
            <button type="button" className="nav-btn" onClick={() => { logout(); }}>
              Lock
            </button>
          </div>
        ) : (
          <div className="nav-right">
            <input
              id="pw-input"
              type="password"
              placeholder="Admin…"
              autoComplete="off"
              value={pw}
              onChange={e => setPw(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={busy}
            />
            <button type="button" className="nav-btn primary" onClick={submitLogin} disabled={busy}>
              {busy ? '…' : 'Login'}
            </button>
            {loginError && <span className="login-err">{loginError}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
