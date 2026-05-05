import { useEffect, useMemo, useState } from 'react';
import type { Friend } from '../../data/friends';
import { useLocalState } from '../../hooks/useViberHooks';

interface LeaderboardSectionProps {
  friends: Friend[];
  edit: boolean;
  siteContent: Record<string, string>;
  updateContent: (key: string, value: string) => Promise<void>;
}

export function LeaderboardSection({ friends, edit, siteContent, updateContent }: LeaderboardSectionProps) {
  const seedOrder = useMemo(
    () => [...friends].sort((a, b) => a.rank - b.rank).map((f) => f.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [friends.length],
  );

  // Canonical order lives in the DB (site_content key 'lb_order').
  // Fall back to rank-sorted seed on first use.
  const dbOrder = useMemo<string[] | null>(() => {
    const raw = siteContent['lb_order'];
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as string[];
      if (Array.isArray(parsed) && parsed.length) return parsed;
    } catch { /* fall through */ }
    return null;
  }, [siteContent]);

  const [order, setOrder] = useState<string[]>(() => dbOrder ?? seedOrder);

  // Sync when DB value first arrives (or changes from another device).
  useEffect(() => {
    if (dbOrder) setOrder(dbOrder);
  }, [dbOrder]);

  // Heal: keep order in sync with the friends list (add newcomers, drop unknowns).
  useEffect(() => {
    const ids = friends.map((f) => f.id);
    setOrder((prev) => {
      const kept = prev.filter((id) => ids.includes(id));
      const missing = ids.filter((id) => !kept.includes(id));
      if (!missing.length && kept.length === prev.length) return prev;
      return [...kept, ...missing];
    });
  }, [friends.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const [notes] = useLocalState<Record<string, string>>('vr.lbNotes', {});
  const byId = useMemo(() => Object.fromEntries(friends.map((f) => [f.id, f])), [friends]);

  async function moveToPosition(id: string, newPos: number) {
    const from = order.indexOf(id);
    const to = newPos - 1;
    if (from === to || to < 0 || to >= order.length) return;
    const arr = [...order];
    arr.splice(from, 1);
    arr.splice(to, 0, id);
    setOrder(arr);
    await updateContent('lb_order', JSON.stringify(arr));
  }

  return (
    <section className="section container" id="leaderboard" data-screen-label="02 Jobblistan">
      <header className="section-header">
        <div>
          <div className="section-eyebrow reveal">Section II · Jobblistan updated 2026</div>
          <h2 className="reveal" data-d="1"><em>Jobblistan</em></h2>
          <p className="reveal" data-d="2">
            {edit
              ? 'Dra slidern för att sätta positionen 1–16. Sparas direkt.'
              : 'Den officiella ranken.'}
          </p>
        </div>
        <div className="section-num reveal" data-d="3">II</div>
      </header>
      <div className="leaderboard" data-edit={edit}>
        {order.map((id, idx) => {
          const f = byId[id];
          if (!f) return null;
          const rank = idx + 1;
          const photo = (f.photos || [])[0]?.url;
          return (
            <div
              key={id}
              className="lb-row reveal"
              data-d={Math.min(idx, 8)}
              data-rank={rank}
            >
              <div className="lb-rank">{rank}</div>
              <div className="lb-avatar">
                {photo ? <img src={photo} alt={f.name} /> : <span>{f.name[0]}</span>}
              </div>
              <div className="lb-info">
                <div className="lb-name">{f.name}</div>
                {edit ? (
                  <div className="lb-note" style={{ color: 'var(--mute)', fontSize: 12 }}>
                    {notes[id] || ''}
                  </div>
                ) : (
                  <div className="lb-note">{notes[id] || ''}</div>
                )}
              </div>
              {edit && (
                <SliderControl
                  rank={rank}
                  total={order.length}
                  onCommit={(pos) => moveToPosition(id, pos)}
                />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

interface SliderControlProps {
  rank: number;
  total: number;
  onCommit: (pos: number) => void;
}

function SliderControl({ rank, total, onCommit }: SliderControlProps) {
  const [dragging, setDragging] = useState<number | null>(null);
  const display = dragging ?? rank;

  return (
    <div className="lb-slider-wrap">
      <span className="lb-slider-num">#{display}</span>
      <input
        className="lb-slider"
        type="range"
        min={1}
        max={total}
        value={display}
        onChange={(e) => setDragging(Number(e.target.value))}
        onPointerUp={(e) => {
          const val = Number((e.target as HTMLInputElement).value);
          setDragging(null);
          if (val !== rank) onCommit(val);
        }}
        onPointerCancel={() => setDragging(null)}
      />
    </div>
  );
}
