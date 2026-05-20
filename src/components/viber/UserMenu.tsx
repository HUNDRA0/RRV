// Unified "person" button + dropdown in the nav.
//
// Replaces the three-way branching we used to have (key icon / unlock /
// username chip). Single SVG silhouette opens a small dropdown whose
// contents depend on auth state:
//   - logged out  → Logga in, Skapa konto, ev. Tema-toggle
//   - user        → Inloggad som <name>, Tema, Logga ut
//   - admin       → Admin · <…>, Öppna admin console, Tema, Logga ut admin
//
// We DON'T duplicate the dark-mode toggle here when it's already in the
// nav row on desktop — but on mobile the dark-mode button is hidden, so
// the user can still flip it from this menu.

import { useEffect, useRef, useState } from 'react';
import type { ApiUser } from '../../lib/api';

interface UserMenuProps {
  isAdmin: boolean;
  currentUser: ApiUser | null;
  onLoginClick: () => void;
  onRegisterClick: () => void;
  onRecoverClick: () => void;
  onOpenAdminConsole: () => void;
  onLogoutUser: () => Promise<void> | void;
  onLogoutAdmin: () => Promise<void> | void;
}

export function UserMenu({
  isAdmin, currentUser,
  onLoginClick, onRegisterClick, onRecoverClick,
  onOpenAdminConsole, onLogoutUser, onLogoutAdmin,
}: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (anchorRef.current && !anchorRef.current.contains(target)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointer);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('pointerdown', onPointer); };
  }, [open]);

  const close = () => setOpen(false);

  // Status line at top of the menu.
  let head: React.ReactNode;
  if (isAdmin) {
    head = (
      <div className="user-menu-head">
        <span className="user-menu-eyebrow">Inloggad</span>
        <strong>Admin{currentUser ? ` · ${currentUser.username}` : ''}</strong>
      </div>
    );
  } else if (currentUser) {
    head = (
      <div className="user-menu-head">
        <span className="user-menu-eyebrow">Inloggad som</span>
        <strong>{currentUser.username}</strong>
      </div>
    );
  } else {
    head = (
      <div className="user-menu-head">
        <span className="user-menu-eyebrow">Konto</span>
        <strong>Inte inloggad</strong>
      </div>
    );
  }

  return (
    <div className="nav-anchor user-menu-anchor" ref={anchorRef}>
      <button
        type="button"
        className="user-menu-trigger"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={currentUser ? `Konto: ${currentUser.username}` : 'Logga in'}
        title={currentUser ? `Inloggad som ${currentUser.username}` : 'Logga in / skapa konto'}
        data-state={isAdmin ? 'admin' : currentUser ? 'user' : 'guest'}
      >
        <PersonIcon />
        {currentUser && <span className="user-menu-dot" aria-hidden="true" />}
      </button>
      {open && (
        <div className="nav-menu user-menu" role="menu">
          {head}

          {!isAdmin && !currentUser && (
            <>
              <button className="user-menu-item" onClick={() => { close(); onLoginClick(); }}>
                <span className="user-menu-ico">→</span> Logga in
              </button>
              <button className="user-menu-item" onClick={() => { close(); onRegisterClick(); }}>
                <span className="user-menu-ico">+</span> Skapa konto
              </button>
              <button className="user-menu-item" onClick={() => { close(); onRecoverClick(); }}>
                <span className="user-menu-ico">?</span> Glömt lösenord
              </button>
            </>
          )}

          {isAdmin && (
            <button className="user-menu-item" onClick={() => { close(); onOpenAdminConsole(); }}>
              <span className="user-menu-ico">⚙</span> Admin Console
            </button>
          )}

          {(isAdmin || currentUser) && <div className="user-menu-divider" role="separator" />}

          {currentUser && !isAdmin && (
            <button
              className="user-menu-item user-menu-danger"
              onClick={() => { close(); void onLogoutUser(); }}
            >
              <span className="user-menu-ico">↪</span> Logga ut
            </button>
          )}
          {isAdmin && (
            <button
              className="user-menu-item user-menu-danger"
              onClick={() => { close(); void onLogoutAdmin(); }}
            >
              <span className="user-menu-ico">↪</span> Logga ut admin
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Inline SVG so we control color via currentColor, and avoid an extra fetch.
function PersonIcon() {
  return (
    <svg className="user-menu-icon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12Zm0 2.4c-3.3 0-9.7 1.6-9.7 4.9v1.5c0 .5.4.9.9.9h17.6c.5 0 .9-.4.9-.9V19.3c0-3.3-6.4-4.9-9.7-4.9Z" />
    </svg>
  );
}
