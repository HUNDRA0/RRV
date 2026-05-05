import { useEffect, useMemo, useRef, useState } from 'react';
import type { Friend } from '../../data/friends';
import { useEsc, useLockBody, useLocalState, dayOfYear } from '../../hooks/useViberHooks';
import { useFriendsList } from '../../lib/state';
import { TIER_CSS, TIER_DISPLAY } from './tier-map';
import { QUOTES_SEED } from './QuoteTicker';
import { EVENTS_SEED, type EventItem } from './EventsSection';
import { parseLunchData, type LunchData, type LunchDebt } from './LunchSection';

type Tab = 'people' | 'leaderboard' | 'moves' | 'quotes' | 'gmap' | 'events' | 'lunch' | 'data';

const TABS: [Tab, string][] = [
  ['people',      'Personer'],
  ['leaderboard', 'Jobblistan'],
  ['moves',       'Moves'],
  ['quotes',      'Citat'],
  ['gmap',        'G Map'],
  ['events',      'Events'],
  ['lunch',       'Lunch 🎟'],
  ['data',        'Data'],
];

interface AdminConsoleProps {
  onClose: () => void;
}

export function AdminConsole({ onClose }: AdminConsoleProps) {
  const {
    friends, siteContent, updateContent,
    updateFriend, uploadPhoto, deletePhoto,
    logout, gmap,
  } = useFriendsList();
  const [tab, setTab] = useState<Tab>('people');

  useEsc(onClose, true);
  useLockBody(true);

  // Quotes: stored as newline-separated string in siteContent['viber_quotes'].
  const initialQuotesRaw = siteContent['viber_quotes'] ?? QUOTES_SEED.join('\n');
  const [quotesDraft, setQuotesDraft] = useState(initialQuotesRaw);
  const [quotesSavedAt, setQuotesSavedAt] = useState<number | null>(null);

  const [notes, setNotes] = useLocalState<Record<string, string>>('vr.lbNotes', {});

  // Leaderboard order — read from DB (same source as the main page).
  const seedOrder = useMemo(
    () => [...friends].sort((a, b) => a.rank - b.rank).map((f) => f.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [friends.length],
  );
  const dbOrder = useMemo<string[] | null>(() => {
    const raw = siteContent['lb_order'];
    if (!raw) return null;
    try { const p = JSON.parse(raw) as string[]; if (Array.isArray(p) && p.length) return p; }
    catch { /* fall through */ }
    return null;
  }, [siteContent]);

  const [lbOrder, setLbOrder] = useState<string[]>(() => dbOrder ?? seedOrder);
  const [lbSavedAt, setLbSavedAt] = useState<number | null>(null);

  useEffect(() => { if (dbOrder) setLbOrder(dbOrder); }, [dbOrder]);

  async function saveLbOrder(newOrder: string[]) {
    setLbOrder(newOrder);
    await updateContent('lb_order', JSON.stringify(newOrder));
    setLbSavedAt(Date.now());
    setTimeout(() => setLbSavedAt(null), 2500);
  }

  const byId = useMemo(() => Object.fromEntries(friends.map((f) => [f.id, f])), [friends]);
  const orderedFriends = lbOrder.map((id) => byId[id]).filter(Boolean) as Friend[];

  async function saveQuotes() {
    const trimmed = quotesDraft.split('\n').map((s) => s.trimEnd()).join('\n');
    await updateContent('viber_quotes', trimmed);
    setQuotesSavedAt(Date.now());
  }

  return (
    <div className="admin-overlay" onClick={onClose}>
      <div className="admin-shell" onClick={(e) => e.stopPropagation()}>
        <header className="admin-header">
          <div>
            <div className="section-eyebrow">Admin Console</div>
            <h2><em>Viber</em> Rankings · Admin</h2>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" onClick={() => { logout(); onClose(); }}>
              Logga ut
            </button>
            <button className="modal-close" onClick={onClose} aria-label="Stäng">✕</button>
          </div>
        </header>

        <nav className="admin-tabs">
          {TABS.map(([id, label]) => (
            <button
              key={id}
              className="admin-tab"
              data-on={tab === id}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="admin-body">
          {tab === 'people' && (
            <PeopleTab
              friends={friends}
              notes={notes}
              setNote={(id, v) => setNotes({ ...notes, [id]: v })}
              updateFriend={updateFriend}
              uploadPhoto={uploadPhoto}
              deletePhoto={deletePhoto}
            />
          )}

          {tab === 'leaderboard' && (
            <div className="admin-list">
              <p className="card-meta" style={{ marginBottom: 16 }}>
                Flytta med pilarna, tryck sedan Spara. Syns direkt på Jobblistan.
              </p>
              {orderedFriends.map((f, idx) => (
                <div className="admin-row" key={f.id}>
                  <div className="lb-rank" style={{ fontSize: 28 }}>{idx + 1}</div>
                  <div className="lb-name">{f.name}</div>
                  <input
                    type="text"
                    value={notes[f.id] || ''}
                    onChange={(e) => setNotes({ ...notes, [f.id]: e.target.value })}
                    placeholder="Varför här?"
                  />
                  <div className="lb-controls">
                    <button
                      className="lb-arrow"
                      disabled={idx === 0}
                      onClick={() => {
                        const a = [...lbOrder];
                        [a[idx - 1], a[idx]] = [a[idx], a[idx - 1]];
                        setLbOrder(a);
                      }}
                    >▲</button>
                    <button
                      className="lb-arrow"
                      disabled={idx === lbOrder.length - 1}
                      onClick={() => {
                        const a = [...lbOrder];
                        [a[idx + 1], a[idx]] = [a[idx], a[idx + 1]];
                        setLbOrder(a);
                      }}
                    >▼</button>
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 16 }}>
                <button className="btn btn-purple" onClick={() => saveLbOrder(lbOrder)}>Spara ordning</button>
                {lbSavedAt && <span className="card-meta" style={{ color: 'var(--purple-2)' }}>✓ Sparat</span>}
              </div>
            </div>
          )}

          {tab === 'moves' && (
            <div className="admin-list">
              {friends.map((f) => (
                <MoveRow key={f.id} friend={f} updateFriend={updateFriend} />
              ))}
            </div>
          )}

          {tab === 'quotes' && (
            <div className="admin-quotes">
              <p className="card-meta">
                Ett citat per rad. Sajten visar ett per dag (deterministiskt baserat på datumet).
                Sparas i backend så alla ser samma citat.
              </p>
              <textarea
                value={quotesDraft}
                onChange={(e) => setQuotesDraft(e.target.value)}
                rows={Math.max(10, quotesDraft.split('\n').length)}
              />
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button className="btn btn-purple" onClick={saveQuotes}>Spara</button>
                {quotesSavedAt && (
                  <span className="card-meta" style={{ color: 'var(--purple-2)' }}>
                    ✓ Sparat
                  </span>
                )}
              </div>
              <div className="card-meta">
                Idag: <b>"{(quotesDraft.split('\n').filter(Boolean)[dayOfYear() % Math.max(1, quotesDraft.split('\n').filter(Boolean).length)]) || ''}"</b>
              </div>
            </div>
          )}

          {tab === 'gmap' && (
            <div className="admin-list">
              <p className="card-meta" style={{ marginBottom: 16 }}>
                Redigera koordinater manuellt. Sparas direkt i databasen och syns på G Map-sidan.
              </p>
              {friends.map((f) => (
                <GMapRow key={f.id} friend={f} updateFriend={updateFriend} />
              ))}
              <GMapPairsEditor
                friends={friends}
                siteContent={siteContent}
                updateContent={updateContent}
                autoPairs={gmap?.pairs.map(p => ({ a: p.friends[0], b: p.friends[1] })) ?? null}
              />
            </div>
          )}

          {tab === 'events' && (
            <EventsTab siteContent={siteContent} updateContent={updateContent} />
          )}

          {tab === 'lunch' && (
            <LunchTab friends={friends} siteContent={siteContent} updateContent={updateContent} />
          )}

          {tab === 'data' && (
            <div className="admin-data">
              <h3>Stats</h3>
              <ul className="admin-stats">
                <li>Vänner: <b>{friends.length}</b></li>
                <li>Bilder totalt: <b>{friends.reduce((s, f) => s + (f.photos?.length || 0), 0)}</b></li>
                <li>Bios skrivna: <b>{friends.filter((f) => f.bio?.trim()).length}/{friends.length}</b></li>
                <li>Moves aktiva: <b>{friends.filter((f) => f.currentMove && f.currentMove !== 'To be continued').length}/{friends.length}</b></li>
                <li>Citat: <b>{quotesDraft.split('\n').filter(Boolean).length}</b></li>
                <li>Geokodade (för G Map): <b>{friends.filter((f) => f.lat != null).length}/{friends.length}</b></li>
              </ul>
              <p className="card-meta" style={{ marginTop: 16 }}>
                För G Map-pins: kör <code>npm run geocode</code> i terminalen.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// People tab — per-friend editor with debounced bio/note saves so the
// API isn't hammered on every keystroke.
// ─────────────────────────────────────────────────────────────────────

interface PeopleTabProps {
  friends: Friend[];
  notes: Record<string, string>;
  setNote: (id: string, v: string) => void;
  updateFriend: (id: string, patch: { name?: string; note?: string; bio?: string; currentMove?: string; tier?: 's' | 'a' | 'i' }) => Promise<void>;
  uploadPhoto: (id: string, dataUrl: string) => Promise<void>;
  deletePhoto: (id: string, position: number) => Promise<void>;
}

function PeopleTab({ friends, notes, setNote, updateFriend, uploadPhoto, deletePhoto }: PeopleTabProps) {
  return (
    <div className="admin-grid">
      {friends.map((f) => (
        <PersonEditor
          key={f.id}
          friend={f}
          note={notes[f.id] || ''}
          onNoteChange={(v) => setNote(f.id, v)}
          updateFriend={updateFriend}
          uploadPhoto={uploadPhoto}
          deletePhoto={deletePhoto}
        />
      ))}
    </div>
  );
}

interface PersonEditorProps {
  friend: Friend;
  note: string;
  onNoteChange: (v: string) => void;
  updateFriend: (id: string, patch: { bio?: string; currentMove?: string; tier?: 's' | 'a' | 'i' }) => Promise<void>;
  uploadPhoto: (id: string, dataUrl: string) => Promise<void>;
  deletePhoto: (id: string, position: number) => Promise<void>;
}

function PersonEditor({ friend, note, onNoteChange, updateFriend, uploadPhoto, deletePhoto }: PersonEditorProps) {
  const [bio, setBio] = useState(friend.bio || '');
  const [move, setMove] = useState(friend.currentMove || '');
  const [tier, setTier] = useState<'s' | 'a' | 'i'>(friend.tier);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function save() {
    setSaving(true);
    const patch: { bio?: string; currentMove?: string } = {};
    if (bio !== (friend.bio || '')) patch.bio = bio;
    const trimmedMove = move.trim() || 'To be continued';
    if (trimmedMove !== (friend.currentMove || '')) patch.currentMove = trimmedMove;
    if (Object.keys(patch).length > 0) {
      await updateFriend(friend.id, patch).catch(() => {});
    }
    setSaving(false);
    setSavedAt(Date.now());
    setTimeout(() => setSavedAt(null), 2500);
  }

  function saveTier(v: 's' | 'a' | 'i') {
    setTier(v);
    updateFriend(friend.id, { tier: v }).catch(() => { /* surface later */ });
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      uploadPhoto(friend.id, String(r.result)).catch(() => { /* surface later */ });
    };
    r.readAsDataURL(file);
    e.target.value = '';
  }

  const tierCss = TIER_CSS[friend.tier];
  const arr = friend.photos || [];

  return (
    <div className="admin-person">
      <div className="admin-person-head">
        <div className="admin-avatar" data-tier={tierCss}>
          {arr[0] ? <img src={arr[0].url} alt={friend.name} /> : <span>{friend.name[0]}</span>}
        </div>
        <div>
          <div className="lb-name">{friend.name}</div>
          <div className="card-meta">{TIER_DISPLAY[tier].label}</div>
        </div>
      </div>

      <label className="admin-field">
        <span>Tier</span>
        <select value={tier} onChange={(e) => saveTier(e.target.value as 's' | 'a' | 'i')}>
          <option value="s">S — Eliten</option>
          <option value="a">A — Normal people tier</option>
          <option value="i">I — I dunno</option>
        </select>
      </label>

      <label className="admin-field">
        <span>Bio</span>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Skriv en bio…"
          rows={3}
        />
      </label>

      <label className="admin-field">
        <span>Making move</span>
        <input
          type="text"
          value={move}
          onChange={(e) => setMove(e.target.value)}
          placeholder="To be continued"
        />
      </label>

      <label className="admin-field">
        <span>Jobblistan-anteckning</span>
        <input
          type="text"
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder="Varför här?"
        />
      </label>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
        <button className="btn btn-purple" onClick={save} disabled={saving} style={{ fontSize: 13, padding: '6px 16px' }}>
          {saving ? 'Sparar…' : 'Spara'}
        </button>
        {savedAt && <span style={{ fontSize: 12, color: 'var(--purple-2)' }}>✓ Sparat</span>}
      </div>

      <div className="admin-photos">
        <span>Bilder ({arr.length})</span>
        <div className="admin-photo-strip">
          {arr.map((p) => (
            <div className="admin-photo-thumb" key={p.position}>
              <img src={p.url} alt="" />
              <button onClick={() => deletePhoto(friend.id, p.position)}>✕</button>
            </div>
          ))}
          <label className="admin-photo-add">
            ＋
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={onFile}
            />
          </label>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// G Map pairs editor — manual override of auto-computed pairs.
// ─────────────────────────────────────────────────────────────────────

interface GMapPair { a: string; b: string }

interface GMapPairsEditorProps {
  friends: Friend[];
  siteContent: Record<string, string>;
  updateContent: (key: string, value: string) => Promise<void>;
  autoPairs: GMapPair[] | null;
}

function GMapPairsEditor({ friends, siteContent, updateContent, autoPairs }: GMapPairsEditorProps) {
  const geo = friends.filter((f) => f.lat != null && f.lon != null);

  const initialPairs = useMemo<GMapPair[]>(() => {
    const raw = siteContent['gmap_pairs'];
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as GMapPair[];
        if (Array.isArray(parsed) && parsed.length) return parsed;
      } catch { /* fall through */ }
    }
    return autoPairs ?? [];
  }, [siteContent, autoPairs]);

  const [pairs, setPairs] = useState<GMapPair[]>(initialPairs);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const isManual = !!siteContent['gmap_pairs'];

  async function save() {
    await updateContent('gmap_pairs', JSON.stringify(pairs));
    setSavedAt(Date.now());
  }

  async function resetAuto() {
    await updateContent('gmap_pairs', '');
    setPairs(autoPairs ?? []);
    setSavedAt(Date.now());
  }

  function addPair() {
    const used = new Set(pairs.flatMap((p) => [p.a, p.b]));
    const free = geo.filter((f) => !used.has(f.id));
    const a = free[0]?.id ?? geo[0]?.id ?? '';
    const b = free[1]?.id ?? geo[1]?.id ?? '';
    if (a && b) setPairs((prev) => [...prev, { a, b }]);
  }

  function removePair(idx: number) {
    setPairs((prev) => prev.filter((_, i) => i !== idx));
  }

  function updatePair(idx: number, side: 'a' | 'b', val: string) {
    setPairs((prev) => prev.map((p, i) => i === idx ? { ...p, [side]: val } : p));
  }

  if (geo.length < 2) return null;

  return (
    <div style={{ marginTop: 32, borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span className="section-eyebrow" style={{ fontSize: 10 }}>
          Par-konfiguration {isManual ? '· manuell' : '· auto'}
        </span>
        <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }} onClick={resetAuto}>
          Återställ auto
        </button>
      </div>
      {pairs.map((p, idx) => (
        <div key={idx} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
          <select
            value={p.a}
            onChange={(e) => updatePair(idx, 'a', e.target.value)}
            style={{ flex: 1, padding: '6px 8px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.12)', background: 'var(--paper)', color: 'var(--ink)', fontSize: 13 }}
          >
            {geo.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          <span style={{ color: 'var(--purple-2)', fontWeight: 700, fontSize: 14 }}>↔</span>
          <select
            value={p.b}
            onChange={(e) => updatePair(idx, 'b', e.target.value)}
            style={{ flex: 1, padding: '6px 8px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.12)', background: 'var(--paper)', color: 'var(--ink)', fontSize: 13 }}
          >
            {geo.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          <button onClick={() => removePair(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mute)', fontSize: 16, padding: '0 4px' }}>✕</button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
        <button className="btn btn-ghost" onClick={addPair}>+ Lägg till par</button>
        <button className="btn btn-purple" onClick={save}>Spara par</button>
        {savedAt && <span className="card-meta" style={{ color: 'var(--purple-2)' }}>✓</span>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Events tab — add, edit and delete events stored in site_content.
// ─────────────────────────────────────────────────────────────────────

interface EventsTabProps {
  siteContent: Record<string, string>;
  updateContent: (key: string, value: string) => Promise<void>;
}

function EventsTab({ siteContent, updateContent }: EventsTabProps) {
  const initialEvents = useMemo<EventItem[]>(() => {
    const raw = siteContent['viber_events'];
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as EventItem[];
        if (Array.isArray(parsed) && parsed.length) return parsed;
      } catch { /* fall through */ }
    }
    return EVENTS_SEED;
  }, [siteContent]);

  const [events, setEvents] = useState<EventItem[]>(initialEvents);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  async function save() {
    await updateContent('viber_events', JSON.stringify(events));
    setSavedAt(Date.now());
    setTimeout(() => setSavedAt(null), 2500);
  }

  function addEvent() {
    const id = `evt-${Date.now()}`;
    const today = new Date().toISOString().split('T')[0];
    setEvents((prev) => [...prev, { id, date: today, title: '', host: '', preliminary: false }]);
  }

  function removeEvent(id: string) {
    setEvents((prev) => prev.filter((e) => e.id !== id));
  }

  function update(id: string, patch: Partial<EventItem>) {
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }

  return (
    <div className="admin-list">
      <p className="card-meta" style={{ marginBottom: 16 }}>
        Lägg till, redigera eller ta bort events. Sorteras automatiskt på datum.
      </p>
      {events.map((e) => (
        <div className="admin-person" key={e.id} style={{ gap: 8 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="date"
              value={e.date}
              onChange={(ev) => update(e.id, { date: ev.target.value })}
              style={{ flex: 1 }}
            />
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: 'var(--mute)', flexShrink: 0, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={!!e.preliminary}
                onChange={(ev) => update(e.id, { preliminary: ev.target.checked })}
              />
              Preliminärt
            </label>
            <button
              onClick={() => removeEvent(e.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mute)', fontSize: 18, padding: '0 4px', marginLeft: 'auto' }}
              aria-label="Ta bort event"
            >✕</button>
          </div>
          <input
            type="text"
            value={e.title}
            onChange={(ev) => update(e.id, { title: ev.target.value })}
            placeholder="Titel (t.ex. Midsommar)"
          />
          <input
            type="text"
            value={e.host}
            onChange={(ev) => update(e.id, { host: ev.target.value })}
            placeholder="Värd / info (t.ex. Hos Mario)"
          />
        </div>
      ))}
      <div style={{ display: 'flex', gap: 10, marginTop: 16, alignItems: 'center' }}>
        <button className="btn btn-ghost" onClick={addEvent}>+ Nytt event</button>
        <button className="btn btn-purple" onClick={save}>Spara events</button>
        {savedAt && <span className="card-meta" style={{ color: 'var(--purple-2)' }}>✓ Sparat</span>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Move row in the Moves tab — local input, push on blur.
// ─────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────
// G Map row — manual lat/lon editor, saves on blur.
// ─────────────────────────────────────────────────────────────────────

interface GMapRowProps {
  friend: Friend;
  updateFriend: (id: string, patch: { lat?: number; lon?: number }) => Promise<void>;
}

function GMapRow({ friend, updateFriend }: GMapRowProps) {
  const [lat, setLat] = useState(friend.lat != null ? String(friend.lat) : '');
  const [lon, setLon] = useState(friend.lon != null ? String(friend.lon) : '');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setLat(friend.lat != null ? String(friend.lat) : '');
    setLon(friend.lon != null ? String(friend.lon) : '');
  }, [friend.lat, friend.lon]);

  function save() {
    const latN = parseFloat(lat);
    const lonN = parseFloat(lon);
    if (!isFinite(latN) || !isFinite(lonN)) return;
    if (latN === friend.lat && lonN === friend.lon) return;
    updateFriend(friend.id, { lat: latN, lon: lonN })
      .then(() => { setSaved(true); setTimeout(() => setSaved(false), 2000); })
      .catch(() => {});
  }

  const hasCoords = friend.lat != null && friend.lon != null;

  return (
    <div className="admin-row" style={{ gridTemplateColumns: '130px 1fr 1fr auto', gap: 8, alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 10, width: 8, height: 8, borderRadius: '50%', background: hasCoords ? 'var(--purple-2)' : '#ccc', display: 'inline-block', flexShrink: 0 }} />
        <span className="lb-name" style={{ fontSize: 14 }}>{friend.name}</span>
      </div>
      <input
        type="text"
        inputMode="decimal"
        value={lat}
        onChange={(e) => setLat(e.target.value)}
        onBlur={save}
        placeholder="Lat (t.ex. 59.194)"
      />
      <input
        type="text"
        inputMode="decimal"
        value={lon}
        onChange={(e) => setLon(e.target.value)}
        onBlur={save}
        placeholder="Lon (t.ex. 17.624)"
      />
      <span style={{ fontSize: 11, color: 'var(--purple-2)', minWidth: 24 }}>
        {saved ? '✓' : ''}
      </span>
    </div>
  );
}

interface MoveRowProps {
  friend: Friend;
  updateFriend: (id: string, patch: { currentMove?: string }) => Promise<void>;
}

function MoveRow({ friend, updateFriend }: MoveRowProps) {
  const [v, setV] = useState(friend.currentMove || '');
  const [saved, setSaved] = useState(false);

  useEffect(() => { setV(friend.currentMove || ''); }, [friend.currentMove]);

  function save() {
    const next = v.trim() || 'To be continued';
    updateFriend(friend.id, { currentMove: next })
      .then(() => { setSaved(true); setTimeout(() => setSaved(false), 2000); })
      .catch(() => {});
  }

  return (
    <div className="admin-row" style={{ gridTemplateColumns: '160px 1fr auto auto', gap: 8, alignItems: 'center' }}>
      <div className="lb-name">{friend.name}</div>
      <input
        type="text"
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
        placeholder="To be continued"
      />
      <button className="btn btn-purple" onClick={save} style={{ fontSize: 13, padding: '4px 12px', whiteSpace: 'nowrap' }}>Spara</button>
      <span style={{ fontSize: 12, color: 'var(--purple-2)', minWidth: 16 }}>{saved ? '✓' : ''}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Lunch Tickets tab
// ─────────────────────────────────────────────────────────────────────

interface LunchTabProps {
  friends: Friend[];
  siteContent: Record<string, string>;
  updateContent: (key: string, value: string) => Promise<void>;
}

function LunchTab({ friends, siteContent, updateContent }: LunchTabProps) {
  const initial = useMemo<LunchData>(
    () => parseLunchData(siteContent['lunch_tickets']),
    [siteContent],
  );

  const [balances, setBalances] = useState<Record<string, number>>(initial.balances);
  const [debts, setDebts] = useState<LunchDebt[]>(initial.debts);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(newBalances = balances, newDebts = debts) {
    setSaving(true);
    const data: LunchData = { balances: newBalances, debts: newDebts };
    await updateContent('lunch_tickets', JSON.stringify(data));
    setSaving(false);
    setSavedAt(Date.now());
    setTimeout(() => setSavedAt(null), 2500);
  }

  function setBalance(id: string, val: number) {
    setBalances((prev) => ({ ...prev, [id]: Math.max(0, val) }));
  }

  function addDebt() {
    const id = `d-${Date.now()}`;
    const a = friends[0]?.id ?? '';
    const b = friends[1]?.id ?? '';
    setDebts((prev) => [...prev, { id, debtor: a, creditor: b, amount: 1, note: '' }]);
  }

  function removeDebt(id: string) {
    setDebts((prev) => prev.filter((d) => d.id !== id));
  }

  function updateDebt(id: string, patch: Partial<LunchDebt>) {
    setDebts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }

  return (
    <div className="admin-list">
      <p className="card-meta" style={{ marginBottom: 16 }}>
        Sätt antal tickets varje person håller fysiskt, och lägg till skulder mellan folk.
      </p>

      <div className="section-eyebrow" style={{ marginBottom: 10 }}>Tickets i plånboken</div>
      {friends.map((f) => (
        <div className="admin-row" key={f.id} style={{ gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center' }}>
          <div className="lb-name">{f.name}</div>
          <input
            className="lunch-admin-balance"
            type="number"
            min={0}
            value={balances[f.id] ?? 0}
            onChange={(e) => setBalance(f.id, parseInt(e.target.value) || 0)}
          />
        </div>
      ))}

      <div className="section-eyebrow" style={{ margin: '28px 0 12px' }}>Skulder</div>
      {debts.length === 0 && (
        <p className="card-meta">Inga skulder inlagda.</p>
      )}
      {debts.map((d) => (
        <div key={d.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
          <select
            value={d.debtor}
            onChange={(e) => updateDebt(d.id, { debtor: e.target.value })}
            style={{ flex: 1, minWidth: 90, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)', fontSize: 13 }}
          >
            {friends.map((f) => <option key={f.id} value={f.id}>{f.name.split(' ')[0]}</option>)}
          </select>
          <span style={{ color: 'var(--mute)', fontSize: 12, flexShrink: 0 }}>är skyldig 🎟</span>
          <input
            type="number"
            min={1}
            value={d.amount}
            onChange={(e) => updateDebt(d.id, { amount: Math.max(1, parseInt(e.target.value) || 1) })}
            style={{ width: 56, textAlign: 'center', padding: '6px 8px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)', fontSize: 13 }}
          />
          <span style={{ color: 'var(--mute)', fontSize: 12, flexShrink: 0 }}>till</span>
          <select
            value={d.creditor}
            onChange={(e) => updateDebt(d.id, { creditor: e.target.value })}
            style={{ flex: 1, minWidth: 90, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)', fontSize: 13 }}
          >
            {friends.map((f) => <option key={f.id} value={f.id}>{f.name.split(' ')[0]}</option>)}
          </select>
          <input
            type="text"
            value={d.note}
            onChange={(e) => updateDebt(d.id, { note: e.target.value })}
            placeholder="Anmärkning (valfri)"
            style={{ flex: 2, minWidth: 100, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)', fontSize: 13 }}
          />
          <button
            onClick={() => removeDebt(d.id)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mute)', fontSize: 18, padding: '0 4px', flexShrink: 0 }}
          >✕</button>
        </div>
      ))}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 20 }}>
        <button className="btn btn-ghost" onClick={addDebt}>+ Ny skuld</button>
        <button className="btn btn-purple" onClick={() => save()} disabled={saving}>
          {saving ? 'Sparar…' : 'Spara'}
        </button>
        {savedAt && <span className="card-meta" style={{ color: 'var(--purple-2)' }}>✓ Sparat</span>}
      </div>
    </div>
  );
}
