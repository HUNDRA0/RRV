import { useEffect, useMemo, useRef, useState } from 'react';
import type { Friend } from '../../data/friends';
import { useEsc, useLockBody, useLocalState, dayOfYear } from '../../hooks/useViberHooks';
import { useFriendsList } from '../../lib/state';
import { TIER_CSS, TIER_DISPLAY } from './tier-map';
import { QUOTES_SEED } from './QuoteTicker';

type Tab = 'people' | 'leaderboard' | 'moves' | 'quotes' | 'gmap' | 'data';

const TABS: [Tab, string][] = [
  ['people',      'Personer'],
  ['leaderboard', 'Jobblistan'],
  ['moves',       'Moves'],
  ['quotes',      'Citat'],
  ['gmap',        'G Map'],
  ['data',        'Data'],
];

interface AdminConsoleProps {
  onClose: () => void;
}

export function AdminConsole({ onClose }: AdminConsoleProps) {
  const {
    friends, siteContent, updateContent,
    updateFriend, uploadPhoto, deletePhoto,
    logout,
  } = useFriendsList();
  const [tab, setTab] = useState<Tab>('people');

  useEsc(onClose, true);
  useLockBody(true);

  // Quotes: stored as newline-separated string in siteContent['viber_quotes'].
  const initialQuotesRaw = siteContent['viber_quotes'] ?? QUOTES_SEED.join('\n');
  const [quotesDraft, setQuotesDraft] = useState(initialQuotesRaw);
  const [quotesSavedAt, setQuotesSavedAt] = useState<number | null>(null);

  // Leaderboard order + notes still localStorage-only — admin can edit them
  // here too so behavior is consistent across both surfaces.
  const seedOrder = useMemo(
    () => [...friends].sort((a, b) => a.rank - b.rank).map((f) => f.id),
    [friends],
  );
  const [order, setOrder] = useLocalState<string[]>('vr.lbOrder', seedOrder);
  const [notes, setNotes] = useLocalState<Record<string, string>>('vr.lbNotes', {});

  const byId = useMemo(() => Object.fromEntries(friends.map((f) => [f.id, f])), [friends]);
  const orderedFriends = order.map((id) => byId[id]).filter(Boolean);

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
                Använd pilarna här eller dra på huvudsidan. Sparas lokalt i din webbläsare.
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
                        const a = [...order];
                        [a[idx - 1], a[idx]] = [a[idx], a[idx - 1]];
                        setOrder(a);
                      }}
                    >▲</button>
                    <button
                      className="lb-arrow"
                      disabled={idx === order.length - 1}
                      onClick={() => {
                        const a = [...order];
                        [a[idx + 1], a[idx]] = [a[idx], a[idx + 1]];
                        setOrder(a);
                      }}
                    >▼</button>
                  </div>
                </div>
              ))}
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
            </div>
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
  updateFriend: (id: string, patch: { name?: string; note?: string; bio?: string; currentMove?: string }) => Promise<void>;
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
  updateFriend: (id: string, patch: { bio?: string; currentMove?: string }) => Promise<void>;
  uploadPhoto: (id: string, dataUrl: string) => Promise<void>;
  deletePhoto: (id: string, position: number) => Promise<void>;
}

function PersonEditor({ friend, note, onNoteChange, updateFriend, uploadPhoto, deletePhoto }: PersonEditorProps) {
  const [bio, setBio] = useState(friend.bio || '');
  const [move, setMove] = useState(friend.currentMove || '');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Save bio + move to backend on blur (cheap, no debounce needed).
  function saveBio() {
    if (bio !== (friend.bio || '')) {
      updateFriend(friend.id, { bio }).catch(() => { /* surface later */ });
    }
  }
  function saveMove() {
    const v = move.trim() || 'To be continued';
    if (v !== (friend.currentMove || '')) {
      updateFriend(friend.id, { currentMove: v }).catch(() => { /* surface later */ });
    }
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
          <div className="card-meta">{TIER_DISPLAY[friend.tier].label}</div>
        </div>
      </div>

      <label className="admin-field">
        <span>Bio</span>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          onBlur={saveBio}
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
          onBlur={saveMove}
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

  // Sync local state when backend value changes (e.g. via People tab).
  useEffect(() => { setV(friend.currentMove || ''); }, [friend.currentMove]);

  function save() {
    const next = v.trim() || 'To be continued';
    if (next !== (friend.currentMove || '')) {
      updateFriend(friend.id, { currentMove: next }).catch(() => { /* surface later */ });
    }
  }

  return (
    <div className="admin-row" style={{ gridTemplateColumns: '160px 1fr' }}>
      <div className="lb-name">{friend.name}</div>
      <input
        type="text"
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={save}
        placeholder="To be continued"
      />
    </div>
  );
}
