import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useScrolled } from '../../hooks/useViberHooks';

const TABS: [string, string][] = [
  ['rankings', 'Tier'],
  ['leaderboard', 'Jobblistan'],
  ['gmap', "G's"],
  ['moves', 'Making Moves'],
  ['events', 'Events'],
  ['lunch', 'Lunch 🎟'],
  ['spel', 'Catan 🎲'],
];

interface NavTabsProps {
  active: string;
  onJump: (id: string) => void;
}

function NavTabs({ active, onJump }: NavTabsProps) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const indRef = useRef<HTMLDivElement | null>(null);
  const hoverIdRef = useRef<string | null>(null);
  const settledRef = useRef(false);

  const measure = () => {
    const targetId = hoverIdRef.current || active;
    const el = refs.current[targetId];
    const ind = indRef.current;
    const wrap = wrapRef.current;
    if (!el || !ind || !wrap) return;
    const eR = el.getBoundingClientRect();
    const wR = wrap.getBoundingClientRect();
    if (eR.width === 0) return;
    const left = eR.left - wR.left;
    if (!settledRef.current) {
      ind.style.transition = 'none';
      ind.style.left = `${left}px`;
      ind.style.width = `${eR.width}px`;
      ind.offsetHeight;
      ind.style.transition = '';
      settledRef.current = true;
    } else {
      ind.style.left = `${left}px`;
      ind.style.width = `${eR.width}px`;
    }
  };

  useLayoutEffect(() => {
    hoverIdRef.current = null;
    measure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(() => {
    const timers = [50, 150, 400, 1000, 2000].map((ms) => setTimeout(measure, ms));
    const ro = new ResizeObserver(measure);
    Object.values(refs.current).forEach((el) => { if (el) ro.observe(el); });
    if (wrapRef.current) ro.observe(wrapRef.current);
    document.fonts?.ready.then(measure).catch(() => { /* unsupported */ });
    window.addEventListener('resize', measure);
    return () => { ro.disconnect(); timers.forEach(clearTimeout); window.removeEventListener('resize', measure); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="nav-tabs" ref={wrapRef} onMouseLeave={() => { hoverIdRef.current = null; measure(); }}>
      <div className="indicator" ref={indRef} />
      {TABS.map(([id, label]) => (
        <button
          key={id}
          ref={(r) => { refs.current[id] = r; }}
          className="nav-tab"
          aria-selected={active === id}
          onMouseEnter={() => { hoverIdRef.current = id; measure(); }}
          onClick={() => onJump(id)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

interface StickyNavProps {
  active: string;
  edit: boolean;
  isAdmin: boolean;
  currentUser: { username: string; role: 'user' | 'admin' } | null;
  onToggleEdit: () => void;
  onLoginClick: () => void;
  onLogoutUser: () => Promise<void> | void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export function StickyNav({ active, edit, isAdmin, currentUser, onToggleEdit, onLoginClick, onLogoutUser, theme, onToggleTheme }: StickyNavProps) {
  const scrolled = useScrolled(20);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuAnchorRef = useRef<HTMLDivElement | null>(null);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  // Label of the currently active section — shown on mobile in the navbar
  const activeLabel = TABS.find(([id]) => id === active)?.[1] ?? '';

  const jump = (id: string) => {
    if (id === 'spel') {
      window.location.hash = 'catan';
      setMenuOpen(false);
      return;
    }
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setMenuOpen(false);
  };

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (menuAnchorRef.current && !menuAnchorRef.current.contains(target)) setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointer);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('pointerdown', onPointer); };
  }, [menuOpen]);

  useEffect(() => {
    if (!userMenuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setUserMenuOpen(false); };
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (userMenuRef.current && !userMenuRef.current.contains(target)) setUserMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointer);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('pointerdown', onPointer); };
  }, [userMenuOpen]);

  return (
    <div className="nav-wrap" data-scrolled={scrolled} data-menu-open={menuOpen}>
      <div className="nav">
        <div
          className="nav-brand"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          role="button"
          tabIndex={0}
        >
          <span className="nav-brand-v">V</span><span className="nav-brand-r">R</span>
        </div>

        {/* Desktop: tab row — Mobile: active section label */}
        <NavTabs active={active} onJump={jump} />
        <span className="nav-active-label">{activeLabel}</span>

        <div className="nav-actions">
          {isAdmin && (
            <button
              className="nav-edit"
              data-on={edit}
              onClick={onToggleEdit}
              title="Edit mode"
            >
              {edit ? '● Edit' : '○ Edit'}
            </button>
          )}

          {/* Dark mode toggle — always visible, no dropdown */}
          <button
            className="nav-theme-btn"
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Byt till ljust läge' : 'Byt till mörkt läge'}
            aria-label={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          >
            {theme === 'dark' ? '🌙' : '☀︎'}
          </button>

          {/* Login — key icon. Becomes user-chip when logged in as user, unlock when admin. */}
          {isAdmin ? (
            <button
              className="nav-edit nav-admin"
              onClick={onLoginClick}
              title="Öppna admin console"
              aria-label="Admin console"
            >
              <span aria-hidden="true">🔓</span>
            </button>
          ) : currentUser ? (
            <div className="nav-anchor nav-user-anchor" ref={userMenuRef}>
              <button
                className="nav-edit nav-user"
                onClick={() => setUserMenuOpen((v) => !v)}
                title={`Inloggad som ${currentUser.username}`}
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
              >
                <span className="nav-user-name">{currentUser.username}</span>
                <span className="nav-user-caret" aria-hidden="true">▾</span>
              </button>
              {userMenuOpen && (
                <div className="nav-menu nav-user-menu" role="menu">
                  <div className="nav-user-menu-head">
                    Inloggad som<br />
                    <strong>{currentUser.username}</strong>
                  </div>
                  <button
                    className="nav-menu-item nav-menu-danger"
                    onClick={() => { setUserMenuOpen(false); void onLogoutUser(); }}
                  >
                    Logga ut
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              className="nav-edit nav-admin"
              onClick={onLoginClick}
              title="Logga in"
              aria-label="Logga in"
            >
              <span aria-hidden="true">🗝️</span>
              <span className="nav-login-label">Login</span>
            </button>
          )}

          {/* Hamburger (mobile only) */}
          <div className="nav-anchor" ref={menuAnchorRef}>
            <button
              className="nav-burger"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={menuOpen ? 'Stäng meny' : 'Öppna meny'}
              aria-expanded={menuOpen}
            >
              <span /><span /><span />
            </button>
            {menuOpen && (
              <div className="nav-menu" role="menu">
                {TABS.map(([id, label]) => (
                  <button
                    key={id}
                    className="nav-menu-item"
                    aria-current={active === id}
                    onClick={() => jump(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
