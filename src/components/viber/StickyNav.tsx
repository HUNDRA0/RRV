import { useLayoutEffect, useRef, useState } from 'react';
import { useScrolled } from '../../hooks/useViberHooks';

const TABS: [string, string][] = [
  ['rankings', 'Rankings'],
  ['leaderboard', 'Leaderboard'],
  ['gmap', "G's"],
  ['moves', 'Making Moves'],
];

interface NavTabsProps {
  active: string;
  onJump: (id: string) => void;
}

function NavTabs({ active, onJump }: NavTabsProps) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [ind, setInd] = useState({ left: 0, width: 0 });

  useLayoutEffect(() => {
    const targetId = hoverId || active;
    const el = refs.current[targetId];
    const wrap = wrapRef.current;
    if (!el || !wrap) return;
    const eR = el.getBoundingClientRect();
    const wR = wrap.getBoundingClientRect();
    setInd({ left: eR.left - wR.left, width: eR.width });
  }, [active, hoverId]);

  return (
    <div className="nav-tabs" ref={wrapRef} onMouseLeave={() => setHoverId(null)}>
      <div className="indicator" style={{ transform: `translateX(${ind.left}px)`, width: ind.width }} />
      {TABS.map(([id, label]) => (
        <button
          key={id}
          ref={(r) => { refs.current[id] = r; }}
          className="nav-tab"
          aria-selected={active === id}
          onMouseEnter={() => setHoverId(id)}
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
          VR
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
