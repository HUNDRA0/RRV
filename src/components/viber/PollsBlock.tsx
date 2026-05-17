// Polls UI inside the Events section.
//
// - Logged-out users: read-only. Sees question + counts.
// - Logged-in users: can vote (and change their vote) + create new polls.
// - Owner or admin: can delete a poll.
//
// Polls are sorted newest-first. Each poll optionally links to an event id —
// when shown next to the event list it surfaces a small "↳ Midsommar" pill.

import { useState } from 'react';
import { useFriendsList } from '../../lib/state';
import { useEsc, useLockBody } from '../../hooks/useViberHooks';
import type { ApiPoll } from '../../lib/api';
import type { EventItem } from './EventsSection';

interface PollsBlockProps {
  events: EventItem[];
  onRequestLogin: () => void;
}

export function PollsBlock({ events, onRequestLogin }: PollsBlockProps) {
  const { polls, currentUser, isAdmin, votePoll, deletePoll } = useFriendsList();
  const [createOpen, setCreateOpen] = useState(false);

  const canCreate = !!currentUser; // admin must register a user account too

  const eventTitle = (id: string | null) => {
    if (!id) return null;
    return events.find(e => e.id === id)?.title ?? null;
  };

  return (
    <>
      <div className="polls-block">
        <header className="polls-header">
          <div>
            <div className="section-eyebrow">Omröstningar</div>
            <h3 className="polls-title">Vad tycker gänget?</h3>
          </div>
          {canCreate ? (
            <button className="btn btn-purple" onClick={() => setCreateOpen(true)}>
              + Skapa omröstning
            </button>
          ) : (
            <button className="btn btn-ghost" onClick={onRequestLogin}>
              Logga in för att skapa
            </button>
          )}
        </header>

        {polls.length === 0 ? (
          <p className="polls-empty">Inga omröstningar ännu. Skapa den första!</p>
        ) : (
          <div className="polls-list">
            {polls.map((p) => (
              <PollCard
                key={p.id}
                poll={p}
                eventTitle={eventTitle(p.eventId)}
                canVote={!!currentUser}
                canDelete={!!currentUser && (currentUser.id === p.createdBy || currentUser.role === 'admin' || isAdmin)}
                onVote={(optId) => { void votePoll(p.id, optId); }}
                onDelete={() => { if (confirm('Ta bort omröstningen?')) void deletePoll(p.id); }}
                onRequestLogin={onRequestLogin}
              />
            ))}
          </div>
        )}
      </div>

      {createOpen && (
        <CreatePollModal events={events} onClose={() => setCreateOpen(false)} />
      )}
    </>
  );
}

// ── Individual poll card ──────────────────────────────────────────────

function PollCard({
  poll, eventTitle, canVote, canDelete, onVote, onDelete, onRequestLogin,
}: {
  poll: ApiPoll;
  eventTitle: string | null;
  canVote: boolean;
  canDelete: boolean;
  onVote: (optionId: number) => void;
  onDelete: () => void;
  onRequestLogin: () => void;
}) {
  const total = poll.options.reduce((s, o) => s + o.votes, 0);
  const [expandedOption, setExpandedOption] = useState<number | null>(null);
  return (
    <article className="poll-card">
      <header className="poll-card-head">
        <div className="poll-card-meta">
          <span className="poll-author">av {poll.author}</span>
          {eventTitle && <span className="poll-event-pill">↳ {eventTitle}</span>}
        </div>
        {canDelete && (
          <button className="poll-delete" onClick={onDelete} aria-label="Ta bort omröstning">✕</button>
        )}
      </header>
      <h4 className="poll-question">{poll.question}</h4>
      <ul className="poll-options">
        {poll.options.map((o) => {
          const pct = total === 0 ? 0 : Math.round((o.votes / total) * 100);
          const isMine = poll.myVote === o.id;
          const isExpanded = expandedOption === o.id;
          // Count is clickable separately from the vote button to reveal voters.
          return (
            <li key={o.id} className={`poll-option${isMine ? ' is-mine' : ''}`}>
              <div className="poll-option-row">
                <button
                  className="poll-option-btn"
                  onClick={() => (canVote ? onVote(o.id) : onRequestLogin())}
                  aria-pressed={isMine}
                >
                  <span className="poll-option-fill" style={{ width: `${pct}%` }} />
                  <span className="poll-option-label">{o.label}</span>
                </button>
                <button
                  type="button"
                  className="poll-option-count-btn"
                  onClick={() => {
                    if (!canVote) { onRequestLogin(); return; }
                    setExpandedOption(prev => (prev === o.id ? null : o.id));
                  }}
                  aria-expanded={isExpanded}
                  aria-label={`Visa vilka som röstat på ${o.label}`}
                  disabled={o.votes === 0}
                >
                  {o.votes} · {pct}%
                </button>
              </div>
              {isExpanded && (
                <div className="poll-option-voters">
                  {o.voters.length === 0 ? (
                    <span className="poll-voter-empty">Ingen ännu</span>
                  ) : (
                    o.voters.map((v) => (
                      <span key={v} className="poll-voter-chip">{v}</span>
                    ))
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <footer className="poll-card-foot">
        <span>{total} {total === 1 ? 'röst' : 'röster'}</span>
        {poll.myVote !== null && <span>Du röstade ✓</span>}
      </footer>
    </article>
  );
}

// ── Create-poll modal ─────────────────────────────────────────────────

const PRESET_OPTIONS = [
  'Ja',
  'Nej',
  'Kanske',
  'Vet ej',
  'Ja, jag kommer',
  'Nej, kan inte',
  'Säger till senare',
  'Beror på vädret',
];

function CreatePollModal({ events, onClose }: { events: EventItem[]; onClose: () => void }) {
  const { createPoll } = useFriendsList();
  const [question, setQuestion] = useState('');
  const [eventId, setEventId] = useState<string>('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useLockBody(true);
  useEsc(onClose, true);

  const setOpt = (i: number, value: string) => {
    setOptions(prev => prev.map((v, idx) => (idx === i ? value : v)));
  };
  const addOpt = () => setOptions(prev => (prev.length < 8 ? [...prev, ''] : prev));
  const removeOpt = (i: number) => setOptions(prev => (prev.length > 2 ? prev.filter((_, idx) => idx !== i) : prev));

  // Adds a preset chip: fills the first empty slot, otherwise appends.
  // Ignores duplicates (case-insensitive) so the same chip isn't added twice.
  const addPreset = (preset: string) => {
    setOptions(prev => {
      const already = prev.some(o => o.trim().toLowerCase() === preset.toLowerCase());
      if (already) return prev;
      const emptyIdx = prev.findIndex(o => o.trim() === '');
      if (emptyIdx >= 0) {
        return prev.map((v, i) => (i === emptyIdx ? preset : v));
      }
      if (prev.length >= 8) return prev;
      return [...prev, preset];
    });
  };

  const usedPresets = new Set(options.map(o => o.trim().toLowerCase()));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      // Snap closesAt to the day after the linked event so the poll auto-disappears.
      // Standalone polls (no eventId) stay forever until manually deleted.
      let closesAt: string | null = null;
      if (eventId) {
        const ev = events.find(e => e.id === eventId);
        if (ev) {
          const d = new Date(`${ev.date}T00:00:00`);
          d.setDate(d.getDate() + 1);
          closesAt = d.toISOString();
        }
      }
      const id = await createPoll({
        question,
        options: options.map(o => o.trim()).filter(Boolean),
        eventId: eventId || null,
        closesAt,
      });
      if (id) onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'kunde inte skapa');
    } finally {
      setBusy(false);
    }
  }

  const cleanCount = options.map(o => o.trim()).filter(Boolean).length;
  const valid = question.trim().length >= 4 && cleanCount >= 2;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal create-poll-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Skapa omröstning"
      >
        <button className="modal-close" onClick={onClose} aria-label="Stäng">✕</button>
        <form className="modal-info" onSubmit={submit} style={{ padding: '32px 32px 28px' }}>
          <div className="section-eyebrow">Ny omröstning</div>
          <h2 className="modal-name" style={{ fontSize: 26, marginBottom: 16 }}>Skapa omröstning</h2>

          <label className="admin-field">
            <span>Fråga</span>
            <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="t.ex. Vilka kommer på midsommar?" autoFocus />
          </label>

          <label className="admin-field">
            <span>Koppla till event (valfritt)</span>
            <select value={eventId} onChange={(e) => setEventId(e.target.value)}>
              <option value="">— Ingen koppling —</option>
              {events.map(ev => (
                <option key={ev.id} value={ev.id}>{ev.title} · {ev.date}</option>
              ))}
            </select>
          </label>

          <div className="admin-field">
            <span>Snabba förslag (klicka för att lägga till)</span>
            <div className="poll-preset-chips">
              {PRESET_OPTIONS.map(p => {
                const used = usedPresets.has(p.toLowerCase());
                return (
                  <button
                    key={p}
                    type="button"
                    className="poll-preset-chip"
                    data-used={used}
                    disabled={used || options.length >= 8}
                    onClick={() => addPreset(p)}
                  >
                    {used ? `✓ ${p}` : `+ ${p}`}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="admin-field">
            <span>Alternativ (2–8) — skriv egna eller använd förslagen</span>
            <div className="poll-option-edits">
              {options.map((o, i) => (
                <div key={i} className="poll-option-edit-row">
                  <input
                    value={o}
                    onChange={(e) => setOpt(i, e.target.value)}
                    placeholder={`Alternativ ${i + 1} — t.ex. "Njaaaeeee"`}
                  />
                  {options.length > 2 && (
                    <button type="button" className="poll-option-remove" onClick={() => removeOpt(i)} aria-label="Ta bort">✕</button>
                  )}
                </div>
              ))}
              {options.length < 8 && (
                <button type="button" className="btn btn-ghost" onClick={addOpt}>+ Tomt fält</button>
              )}
            </div>
          </div>

          {err && <div className="login-error">{err}</div>}
          <div className="modal-photo-controls">
            <button type="submit" className="btn btn-purple" disabled={busy || !valid}>
              {busy ? 'Skapar…' : 'Skapa omröstning'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Avbryt</button>
          </div>
        </form>
      </div>
    </div>
  );
}
