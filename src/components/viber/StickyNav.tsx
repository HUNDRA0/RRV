import { useEffect, useLayoutEffect, useRef } from 'react';
import { useScrolled } from '../../hooks/useViberHooks';

const TABS: [string, string][] = [
  ['rankings', 'Rankings'],
  ['leaderboard', 'Leaderboard'],
  ['gmap', "G's"],
  ['moves', 'Making Moves'],
  ['events', 'Events'],
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

  // Imperative measure — bypass React state so we don't fight CSS transitions.
  // First paint may have width 0 until fonts load; we re-measure aggressively
  // until we get a stable non-zero width, then keep observing.
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
      // Skip the slide-in animation on the very first paint so the pill just
      // appears under the active tab instead of zooming from x=0.
      ind.style.transition = 'none';
      ind.style.width = `${eR.width}px`;
      ind.style.transform = `translateX(${left}px)`;
      // force reflow then re-enable
      ind.offsetHeight;
      ind.style.transition = '';
      settledRef.current = true;
    } else {
      ind.style.width = `${eR.width}px`;
      ind.style.transform = `translateX(${left}px)`;
    }
  };

  // When the active section changes (scroll-driven), drop the sticky hover so
  // the indicator follows the page instead of staying parked on whatever tab
  // the cursor happened to be over last.
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
}

export function StickyNav({ active, edit, isAdmin, onToggleEdit, onAdminClick }: StickyNavProps) {
  const scrolled = useScrolled(20);
  const jump = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div className="nav-wrap" data-scrolled={scrolled}>
      <div className="nav">
        <div
          className="nav-brand"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          role="button"
          tabIndex={0}
        >
          <span className="nav-brand-v">V</span><span className="nav-brand-r">R</span>
        </div>
        <NavTabs active={active} onJump={jump} />
        <div className="nav-actions">
          <button
            className="nav-edit"
            data-on={edit}
            onClick={onToggleEdit}
            title={isAdmin ? 'Edit mode' : 'Logga in som admin'}
          >
            {edit ? '● Edit' : '○ Edit'}
          </button>
          <button
            className="nav-edit nav-admin"
            onClick={onAdminClick}
            title={isAdmin ? 'Logga ut' : 'Admin-login'}
          >
            ⚙
          </button>
        </div>
      </div>
    </div>
  );
}
