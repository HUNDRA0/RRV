import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useScrolled } from '../../hooks/useViberHooks';

const TABS: [string, string][] = [
  ['rankings', 'Tier'],
  ['leaderboard', 'Jobblistan'],
  ['gmap', "G's"],
  ['moves', 'Making Moves'],
  ['events', 'Events'],
  ['lunch', 'Lunch 🎟'],
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
      ind.style.width = `${eR.width}px`;
      ind.style.transform = `translateX(${left}px)`;
      ind.offsetHeight;
      ind.style.transition = '';
      settledRef.current = true;
    } else {
      ind.style.width = `${eR.width}px`;
      ind.style.transform = `translateX(${left}px)`;
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
  onToggleEdit: () => void;
  onAdminClick: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export function StickyNav({ active, edit, isAdmin, onToggleEdit, onAdminClick, theme, onToggleTheme }: StickyNavProps) {
  const scrolled = useScrolled(20);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuAnchorRef = useRef<HTMLDivElement | null>(null);

  // Label of the currently active section — shown on mobile in the navbar
  const activeLabel = TABS.find(([id]) => id === active)?.[1] ?? '';

  const jump = (id: string) => {
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

          {/* Admin / settings — direct click, no dropdown needed */}
          <button
            className="nav-edit nav-admin"
            onClick={onAdminClick}
            title={isAdmin ? 'Admin console' : 'Admin-login'}
          >
            {isAdmin ? '🔓' : '⚙'}
          </button>

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
