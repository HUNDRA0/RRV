import { useEffect, useMemo, useState } from 'react';
import type { Friend } from '../../data/friends';
import { Editable } from './Editable';
import { useLocalState } from '../../hooks/useViberHooks';

interface LeaderboardSectionProps {
  friends: Friend[];
}

export function LeaderboardSection({ friends }: LeaderboardSectionProps) {
  const seedOrder = useMemo(
    () => [...friends].sort((a, b) => a.rank - b.rank).map((f) => f.id),
    [friends],
  );
  const [order, setOrder] = useLocalState<string[]>('vr.lbOrder', seedOrder);
  const [notes, setNotes] = useLocalState<Record<string, string>>('vr.lbNotes', {});

  // Heal: drop unknown ids, append new ones at the bottom.
  useEffect(() => {
    const ids = friends.map((f) => f.id);
    const missing = ids.filter((id) => !order.includes(id));
    const extra = order.filter((id) => !ids.includes(id));
    if (missing.length || extra.length) {
      setOrder([...order.filter((id) => ids.includes(id)), ...missing]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friends.length]);

  const byId = useMemo(() => Object.fromEntries(friends.map((f) => [f.id, f])), [friends]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  function move(id: string, delta: number) {
    const idx = order.indexOf(id);
    const next = idx + delta;
    if (next < 0 || next >= order.length) return;
    const arr = [...order];
    [arr[idx], arr[next]] = [arr[next], arr[idx]];
    setOrder(arr);
  }
  function onDrop(e: React.DragEvent, id: string) {
    e.preventDefault();
    if (!dragId || dragId === id) { setDragId(null); return; }
    const from = order.indexOf(dragId);
    const to = order.indexOf(id);
    const arr = [...order];
    arr.splice(from, 1);
    arr.splice(to, 0, dragId);
    setOrder(arr);
    setDragId(null);
    setOverId(null);
  }
  function setNote(id: string, v: string) {
    setNotes({ ...notes, [id]: v });
  }

  return (
    <section className="section container" id="leaderboard" data-screen-label="02 Leaderboard">
      <header className="section-header">
        <div>
          <div className="section-eyebrow reveal">Section II · Personlig topplista</div>
          <h2 className="reveal" data-d="1"><em>Leaderboard</em></h2>
          <p className="reveal" data-d="2">
            Dra raderna eller använd pilarna för att ranka 1 till 16. Klicka på texten för att skriva varför.
          </p>
        </div>
        <div className="section-num reveal" data-d="3">II</div>
      </header>
      <div className="leaderboard">
        {order.map((id, idx) => {
          const f = byId[id];
          if (!f) return null;
          const rank = idx + 1;
          const photo = (f.photos || [])[0]?.url;
          return (
            <div
              key={id}
              className={`lb-row reveal ${dragId === id ? 'dragging' : ''} ${overId === id && dragId && dragId !== id ? 'drop-target' : ''}`}
              data-d={Math.min(idx, 8)}
              data-rank={rank}
              draggable
              onDragStart={(e) => { setDragId(id); e.dataTransfer.effectAllowed = 'move'; }}
              onDragOver={(e) => { e.preventDefault(); if (id !== overId) setOverId(id); }}
              onDragLeave={() => setOverId(null)}
              onDrop={(e) => onDrop(e, id)}
              onDragEnd={() => { setDragId(null); setOverId(null); }}
            >
              <div className="lb-rank">{rank}</div>
              <div className="lb-avatar">
                {photo ? <img src={photo} alt={f.name} /> : <span>{f.name[0]}</span>}
              </div>
              <div className="lb-info">
                <div className="lb-name">{f.name}</div>
                <Editable
                  className="lb-note"
                  value={notes[id] || ''}
                  onChange={(v) => setNote(id, v)}
                  edit
                />
              </div>
              <div className="lb-controls">
                <button className="lb-arrow" onClick={() => move(id, -1)} disabled={idx === 0}>▲</button>
                <button className="lb-arrow" onClick={() => move(id, +1)} disabled={idx === order.length - 1}>▼</button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
