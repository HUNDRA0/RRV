import { useEffect, useMemo, useRef, useState } from 'react';
import type { Friend } from '../../data/friends';
import { useEsc, useLockBody, useLocalState, dayOfYear } from '../../hooks/useViberHooks';
import { useFriendsList } from '../../lib/state';
import { listUsers, updateUserRoleLink, type ApiAdminUserRow, type ApiUserRole } from '../../lib/api';
import { parseTierConfig, getTierCss, type TierConfig } from './tier-map';
import { QUOTES_SEED } from './QuoteTicker';
import { EVENTS_SEED, type EventItem } from './EventsSection';
import { parseLunchData, type LunchData, type LunchDebt } from './LunchSection';
import { PhotoCropModal } from './PhotoCropModal';

type Tab = 'people' | 'roles' | 'leaderboard' | 'moves' | 'quotes' | 'gmap' | 'events' | 'lunch' | 'tiers' | 'design' | 'desktop-design' | 'data';

const TABS: [Tab, string][] = [
  ['people',         'Personer'],
  ['roles',          'Roller'],
  ['leaderboard',    'Jobblistan'],
  ['moves',          'Moves'],
  ['quotes',         'Citat'],
  ['gmap',           'G Map'],
  ['events',         'Events'],
  ['lunch',          'Lunch 🎟'],
  ['tiers',          'Tiers'],
  ['design',         'Design'],
  ['desktop-design', 'Desktop design'],
  ['data',           'Data'],
];

interface AdminConsoleProps {
  onClose: () => void;
  // When set, the console runs in restricted "editor" mode: no admin tabs,
  // just a bio/photo editor for the friends the current role may touch.
  //   'all'        → Court (every friend)
  //   string[]     → Stronk (only their linked friend ids)
  // Undefined → full admin console.
  editorScope?: 'all' | string[];
}

export function AdminConsole({ onClose, editorScope }: AdminConsoleProps) {
  const {
    friends, siteContent, updateContent,
    updateFriend, swapFriends, uploadPhoto, deletePhoto, updateSocials,
    logout, gmap, logoutUser,
  } = useFriendsList();
  const [tab, setTab] = useState<Tab>('people');

  useEsc(onClose, true);
  useLockBody(true);

  // ── Restricted editor mode (Court / Stronk) ─────────────────────────
  // Render a stripped console: only a list of editable people, each with
  // a bio + photo editor and an explicit Save button.
  if (editorScope) {
    const editable = editorScope === 'all'
      ? [...friends].sort((a, b) => a.rank - b.rank)
      : [...friends].filter(f => editorScope.includes(f.id)).sort((a, b) => a.rank - b.rank);
    return (
      <div className="admin-overlay" onClick={onClose}>
        <div className="admin-shell" onClick={(e) => e.stopPropagation()}>
          <header className="admin-header">
            <div>
              <div className="section-eyebrow">Redigera</div>
              <h2><em>Mina</em> redigeringar</h2>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost" onClick={() => { void logoutUser(); onClose(); }}>
                Logga ut
              </button>
              <button className="modal-close" onClick={onClose} aria-label="Stäng">✕</button>
            </div>
          </header>
          <div className="admin-body">
            <p className="card-meta" style={{ marginBottom: 16 }}>
              {editorScope === 'all'
                ? 'Du kan redigera bio och bilder för alla. Tryck Spara för att bekräfta.'
                : 'Du kan redigera din egen bio och dina bilder. Tryck Spara för att bekräfta.'}
            </p>
            {editable.length === 0 ? (
              <p className="card-meta">Inget att redigera — be admin koppla ditt konto till en person.</p>
            ) : (
              <div className="admin-grid">
                {editable.map((f) => (
                  <PersonEditor
                    key={f.id}
                    friend={f}
                    note=""
                    onNoteChange={() => { /* notes are admin-only */ }}
                    updateFriend={updateFriend}
                    swapFriends={swapFriends}
                    prevInTier={null}
                    nextInTier={null}
                    uploadPhoto={uploadPhoto}
                    deletePhoto={deletePhoto}
                    updateSocials={updateSocials}
                    restricted
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

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
              swapFriends={swapFriends}
              uploadPhoto={uploadPhoto}
              deletePhoto={deletePhoto}
              updateSocials={updateSocials}
            />
          )}

          {tab === 'roles' && <RolesTab friends={friends} />}

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

          {tab === 'tiers' && (
            <TiersTab siteContent={siteContent} updateContent={updateContent} />
          )}

          {tab === 'design' && (
            <DesignTab siteContent={siteContent} updateContent={updateContent} />
          )}

          {tab === 'desktop-design' && (
            <DesktopDesignTab siteContent={siteContent} updateContent={updateContent} />
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
              <p className="card-meta" style={{ marginTop: 16, marginBottom: 28 }}>
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
  updateFriend: (id: string, patch: { name?: string; note?: string; bio?: string; currentMove?: string; tier?: string; rank?: number }) => Promise<void>;
  swapFriends: (idA: string, idB: string) => Promise<void>;
  uploadPhoto: (id: string, dataUrl: string) => Promise<void>;
  deletePhoto: (id: string, position: number) => Promise<void>;
  updateSocials: (id: string, socials: { platform: string; handle: string }[]) => Promise<void>;
}

function PeopleTab({ friends, notes, setNote, updateFriend, swapFriends, uploadPhoto, deletePhoto, updateSocials }: PeopleTabProps) {
  const sorted = useMemo(() => [...friends].sort((a, b) => a.rank - b.rank), [friends]);
  const { createFriend, siteContent: sc } = useFriendsList();
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="admin-grid">
      <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 12, justifyContent: 'flex-end', marginBottom: 4 }}>
        <button className="btn btn-purple" onClick={() => setAddOpen(true)}>
          + Ny person
        </button>
      </div>
      {addOpen && (
        <AddFriendModal
          tierConfig={sc['tier_config']}
          existingIds={new Set(friends.map(f => f.id))}
          onClose={() => setAddOpen(false)}
          onCreate={createFriend}
          onUploadPhoto={uploadPhoto}
        />
      )}
      {sorted.map((f) => {
        const tierMates = sorted.filter(x => x.tier === f.tier);
        const pos = tierMates.findIndex(x => x.id === f.id);
        const prev = tierMates[pos - 1] ?? null;
        const next = tierMates[pos + 1] ?? null;
        return (
          <PersonEditor
            key={f.id}
            friend={f}
            note={notes[f.id] || ''}
            onNoteChange={(v) => setNote(f.id, v)}
            updateFriend={updateFriend}
            swapFriends={swapFriends}
            prevInTier={prev}
            nextInTier={next}
            uploadPhoto={uploadPhoto}
            deletePhoto={deletePhoto}
            updateSocials={updateSocials}
          />
        );
      })}
    </div>
  );
}

interface PersonEditorProps {
  friend: Friend;
  note: string;
  onNoteChange: (v: string) => void;
  updateFriend: (id: string, patch: { name?: string; bio?: string; currentMove?: string; tier?: string }) => Promise<void>;
  swapFriends: (idA: string, idB: string) => Promise<void>;
  prevInTier: Friend | null;
  nextInTier: Friend | null;
  uploadPhoto: (id: string, dataUrl: string) => Promise<void>;
  deletePhoto: (id: string, position: number) => Promise<void>;
  updateSocials: (id: string, socials: { platform: string; handle: string }[]) => Promise<void>;
  // Restricted = Court/Stronk editor: only bio, making move + photos.
  // No name / tier / position / note / socials / delete.
  restricted?: boolean;
}

function PersonEditor({ friend, note, onNoteChange, updateFriend, swapFriends, prevInTier, nextInTier, uploadPhoto, deletePhoto, updateSocials, restricted = false }: PersonEditorProps) {
  const { siteContent: sc, deleteFriend } = useFriendsList();
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [pendingCropDataUrl, setPendingCropDataUrl] = useState<string | null>(null);
  const allTiers = useMemo(() => parseTierConfig(sc['tier_config']), [sc]);
  const [name, setName] = useState(friend.name);
  const [bio, setBio] = useState(friend.bio || '');
  const [move, setMove] = useState(friend.currentMove || '');
  const [tier, setTier] = useState<string>(friend.tier);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function save() {
    setSaving(true);
    const patch: { name?: string; bio?: string; currentMove?: string } = {};
    const trimmedName = name.trim();
    if (trimmedName && trimmedName !== friend.name) patch.name = trimmedName;
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

  function saveTier(v: string) {
    setTier(v);
    updateFriend(friend.id, { tier: v }).catch(() => { /* surface later */ });
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      alert('Bilden är för stor (max 8 MB).');
      e.target.value = '';
      return;
    }
    const r = new FileReader();
    r.onload = () => {
      // Open the crop editor instead of uploading raw. The crop result
      // is what we actually persist.
      setPendingCropDataUrl(String(r.result));
    };
    r.readAsDataURL(file);
    e.target.value = '';
  }

  const tierCss = getTierCss(friend.tier);
  const arr = friend.photos || [];

  return (
    <div className="admin-person">
      <div className="admin-person-head">
        <div className="admin-avatar" data-tier={tierCss}>
          {arr[0] ? <img src={arr[0].url} alt={friend.name} loading="lazy" decoding="async" /> : <span>{friend.name[0]}</span>}
        </div>
        <div>
          <div className="lb-name">{friend.name}</div>
          <div className="card-meta">{allTiers.find((t) => t.id === tier)?.label ?? tier}</div>
        </div>
      </div>

      {!restricted && (
        <label className="admin-field">
          <span>Namn</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
      )}

      {!restricted && (
        <label className="admin-field">
          <span>Tier</span>
          <select value={tier} onChange={(e) => saveTier(e.target.value)}>
            {allTiers.map((t) => (
              <option key={t.id} value={t.id}>{t.letter} — {t.label}</option>
            ))}
          </select>
        </label>
      )}

      {!restricted && (
        <div className="admin-field">
          <span>Plats i tier</span>
          <div className="tier-swap">
            <button
              type="button"
              className="tier-swap-btn"
              disabled={!prevInTier}
              onClick={() => prevInTier && void swapFriends(friend.id, prevInTier.id)}
              aria-label={prevInTier ? `Byt plats med ${prevInTier.name}` : 'Redan först i tier'}
            >
              <span className="tier-swap-arrow" aria-hidden="true">←</span>
              <span className="tier-swap-meta">
                <span className="tier-swap-action">Byt med</span>
                <span className="tier-swap-name">{prevInTier?.name ?? '— först'}</span>
              </span>
            </button>
            <button
              type="button"
              className="tier-swap-btn"
              disabled={!nextInTier}
              onClick={() => nextInTier && void swapFriends(friend.id, nextInTier.id)}
              aria-label={nextInTier ? `Byt plats med ${nextInTier.name}` : 'Redan sist i tier'}
            >
              <span className="tier-swap-meta tier-swap-meta-right">
                <span className="tier-swap-action">Byt med</span>
                <span className="tier-swap-name">{nextInTier?.name ?? '— sist'}</span>
              </span>
              <span className="tier-swap-arrow" aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      )}

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

      {!restricted && (
        <label className="admin-field">
          <span>Jobblistan-anteckning</span>
          <input
            type="text"
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            placeholder="Varför här?"
          />
        </label>
      )}

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
              <img src={p.url} alt="" loading="lazy" decoding="async" />
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

      {!restricted && <SocialsEditor friend={friend} updateSocials={updateSocials} />}

      {!restricted && (
        <button
          className="btn btn-ghost admin-delete-friend"
          onClick={() => setConfirmDeleteOpen(true)}
        >
          🗑 Ta bort {friend.name}
        </button>
      )}

      {confirmDeleteOpen && (
        <ConfirmDeleteFriend
          friend={friend}
          onClose={() => setConfirmDeleteOpen(false)}
          onConfirm={async () => {
            try { await deleteFriend(friend.id); }
            catch { /* surface later */ }
          }}
        />
      )}

      {pendingCropDataUrl && (
        <PhotoCropModal
          sourceDataUrl={pendingCropDataUrl}
          onCancel={() => setPendingCropDataUrl(null)}
          onAccept={(dataUrl) => {
            setPendingCropDataUrl(null);
            uploadPhoto(friend.id, dataUrl).catch(() => { /* surface later */ });
          }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Permanent-delete confirmation modal.
// Browser confirm() is too easy to dismiss with an accidental Enter
// keypress. This modal requires the admin to TYPE the friend's name
// before the Delete button enables — same pattern as GitHub repo delete.
// ─────────────────────────────────────────────────────────────────────

function ConfirmDeleteFriend({
  friend, onClose, onConfirm,
}: {
  friend: Friend;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  useLockBody(true);
  useEsc(onClose, !busy);

  const matches = typed.trim().toLowerCase() === friend.name.toLowerCase();
  const photoCount = friend.photos?.length ?? 0;
  const socialCount = friend.socials?.length ?? 0;

  async function handleConfirm() {
    if (!matches || busy) return;
    setBusy(true);
    try { await onConfirm(); onClose(); }
    finally { setBusy(false); }
  }

  return (
    <div className="modal-backdrop" onClick={busy ? undefined : onClose}>
      <div
        className="modal confirm-delete-modal"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-labelledby="confirm-delete-title"
        aria-describedby="confirm-delete-body"
      >
        <div className="modal-info" style={{ padding: '28px 28px 24px' }}>
          <div className="confirm-delete-icon" aria-hidden="true">⚠️</div>
          <h2 id="confirm-delete-title" className="confirm-delete-title">
            Ta bort <em>{friend.name}</em> permanent?
          </h2>
          <p id="confirm-delete-body" className="confirm-delete-body">
            Detta går <strong>inte</strong> att ångra. Följande försvinner också:
          </p>
          <ul className="confirm-delete-list">
            <li>{photoCount} bild{photoCount === 1 ? '' : 'er'}</li>
            <li>{socialCount} sociala länk{socialCount === 1 ? '' : 'ar'}</li>
            <li>Alla Making Moves-gissningar om {friend.name.split(' ')[0]}</li>
            <li>Alla lunch-skulder kopplade till {friend.name.split(' ')[0]}</li>
          </ul>

          <label className="admin-field confirm-delete-field">
            <span>
              Skriv <strong>{friend.name}</strong> för att bekräfta
            </span>
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && matches) { e.preventDefault(); void handleConfirm(); } }}
              autoFocus
              placeholder={friend.name}
              aria-invalid={typed.length > 0 && !matches}
            />
          </label>

          <div className="modal-photo-controls" style={{ marginTop: 14 }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
              disabled={busy}
            >
              Avbryt
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={handleConfirm}
              disabled={!matches || busy}
            >
              {busy ? 'Tar bort…' : `🗑 Ja, ta bort ${friend.name.split(' ')[0]}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SocialsEditor({
  friend, updateSocials,
}: {
  friend: Friend;
  updateSocials: (id: string, socials: { platform: string; handle: string }[]) => Promise<void>;
}) {
  const [rows, setRows] = useState<{ platform: string; handle: string }[]>(
    () => (friend.socials || []).map(s => ({ platform: s.platform, handle: s.handle })),
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // platforms list mirrors lib/socials.ts (kept in sync manually for now).
  const PLATFORMS = [
    'instagram', 'facebook', 'linkedin', 'x', 'tiktok',
    'github', 'youtube', 'snapchat', 'discord', 'twitch', 'threads', 'website',
  ];

  const setRow = (i: number, patch: Partial<{ platform: string; handle: string }>) => {
    setRows(prev => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };
  const addRow = () => setRows(prev => [...prev, { platform: 'instagram', handle: '' }]);
  const removeRow = (i: number) => setRows(prev => prev.filter((_, idx) => idx !== i));

  async function save() {
    setSaving(true);
    const clean = rows
      .map(r => ({ platform: r.platform.trim(), handle: r.handle.trim() }))
      .filter(r => r.handle.length > 0);
    try { await updateSocials(friend.id, clean); setSaved(true); setTimeout(() => setSaved(false), 2000); }
    catch { /* error surfaced via state */ }
    finally { setSaving(false); }
  }

  return (
    <div className="admin-field">
      <span>Sociala medier ({rows.length})</span>
      <div className="admin-socials-grid">
        {rows.map((r, i) => (
          <div className="admin-social-row" key={i}>
            <select value={r.platform} onChange={(e) => setRow(i, { platform: e.target.value })}>
              {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <input
              value={r.handle}
              onChange={(e) => setRow(i, { handle: e.target.value })}
              placeholder="@användarnamn eller fullständig URL"
            />
            <button type="button" className="admin-social-remove" onClick={() => removeRow(i)} aria-label="Ta bort">✕</button>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button type="button" className="btn btn-ghost" onClick={addRow}>+ Lägg till</button>
          <button type="button" className="btn btn-purple" onClick={save} disabled={saving} style={{ fontSize: 13, padding: '6px 16px' }}>
            {saving ? 'Sparar…' : 'Spara'}
          </button>
          {saved && <span style={{ fontSize: 12, color: 'var(--purple-2)', alignSelf: 'center' }}>✓ Sparat</span>}
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
    <div className="admin-row admin-gmap-row">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 10, width: 8, height: 8, borderRadius: '50%', background: hasCoords ? 'var(--purple-2)' : '#ccc', display: 'inline-block', flexShrink: 0 }} />
        <span className="lb-name admin-gmap-name" style={{ fontSize: 14 }}>{friend.name}</span>
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
    <div className="admin-row admin-move-row">
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
    setDebts((prev) => [...prev, { id, debtor: a, creditors: [{ creditor: b, amount: 1 }], note: '' }]);
  }

  function removeDebt(id: string) {
    setDebts((prev) => prev.filter((d) => d.id !== id));
  }

  function updateDebt(id: string, patch: Partial<LunchDebt>) {
    setDebts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }

  // Operations on the creditors array inside a single debt.
  function addCreditor(debtId: string) {
    const fallback = friends[0]?.id ?? '';
    setDebts((prev) => prev.map((d) =>
      d.id === debtId ? { ...d, creditors: [...d.creditors, { creditor: fallback, amount: 1 }] } : d,
    ));
  }
  function removeCreditor(debtId: string, idx: number) {
    setDebts((prev) => prev.map((d) =>
      d.id === debtId
        ? { ...d, creditors: d.creditors.filter((_, i) => i !== idx) }
        : d,
    ));
  }
  function updateCreditor(debtId: string, idx: number, patch: Partial<{ creditor: string; amount: number }>) {
    setDebts((prev) => prev.map((d) =>
      d.id === debtId
        ? { ...d, creditors: d.creditors.map((c, i) => (i === idx ? { ...c, ...patch } : c)) }
        : d,
    ));
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
        <div key={d.id} className="lunch-debt-card">
          <div className="lunch-debt-head">
            <div className="lunch-debt-debtor">
              <select
                value={d.debtor}
                onChange={(e) => updateDebt(d.id, { debtor: e.target.value })}
                className="lunch-debt-select lunch-debt-debtor-select"
                aria-label="Vem är skyldig"
              >
                {friends.map((f) => <option key={f.id} value={f.id}>{f.name.split(' ')[0]}</option>)}
              </select>
              <span className="lunch-debt-label">är skyldig 🎟 till:</span>
            </div>
            <button
              onClick={() => removeDebt(d.id)}
              className="lunch-debt-remove"
              aria-label="Ta bort hela skulden"
            >✕</button>
          </div>

          <div className="lunch-creditors">
            {d.creditors.map((c, idx) => (
              <div key={idx} className="lunch-creditor-row">
                <select
                  value={c.creditor}
                  onChange={(e) => updateCreditor(d.id, idx, { creditor: e.target.value })}
                  className="lunch-debt-select"
                  aria-label="Mottagare"
                >
                  {friends.map((f) => <option key={f.id} value={f.id}>{f.name.split(' ')[0]}</option>)}
                </select>
                <input
                  type="number"
                  min={1}
                  value={c.amount}
                  onChange={(e) => updateCreditor(d.id, idx, { amount: Math.max(1, parseInt(e.target.value) || 1) })}
                  className="lunch-debt-amount"
                  aria-label="Antal tickets"
                />
                <span style={{ color: 'var(--mute)', fontSize: 12 }}>🎟</span>
                {d.creditors.length > 1 && (
                  <button
                    onClick={() => removeCreditor(d.id, idx)}
                    className="lunch-creditor-remove"
                    aria-label="Ta bort mottagare"
                  >✕</button>
                )}
              </div>
            ))}
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => addCreditor(d.id)}
              style={{ fontSize: 12, padding: '6px 12px', marginTop: 4 }}
            >
              + Lägg till mottagare
            </button>
          </div>

          <input
            type="text"
            value={d.note}
            onChange={(e) => updateDebt(d.id, { note: e.target.value })}
            placeholder="Anledning (t.ex. flytthjälp)"
            className="lunch-debt-note"
          />
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

// ─────────────────────────────────────────────────────────────────────
// Tiers tab — add/remove/rename/reorder tiers, stored as JSON in site_content
// ─────────────────────────────────────────────────────────────────────

interface TiersTabProps {
  siteContent: Record<string, string>;
  updateContent: (key: string, value: string) => Promise<void>;
}

function TiersTab({ siteContent, updateContent }: TiersTabProps) {
  const [tiers, setTiers] = useState(() => parseTierConfig(siteContent['tier_config']));
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(newTiers = tiers) {
    setSaving(true);
    await updateContent('tier_config', JSON.stringify(newTiers));
    setSaving(false);
    setSavedAt(Date.now());
    setTimeout(() => setSavedAt(null), 2500);
  }

  function addTier() {
    const id = `t${Date.now().toString(36).slice(-4)}`;
    setTiers((prev) => [...prev, { id, letter: '?', label: 'Ny tier', sublabel: '' }]);
  }

  function removeTier(id: string) {
    setTiers((prev) => prev.filter((t) => t.id !== id));
  }

  function updateTier(id: string, patch: Partial<TierConfig>) {
    setTiers((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  function moveUp(idx: number) {
    if (idx === 0) return;
    setTiers((prev) => { const a = [...prev]; [a[idx - 1], a[idx]] = [a[idx], a[idx - 1]]; return a; });
  }

  function moveDown(idx: number) {
    setTiers((prev) => { if (idx >= prev.length - 1) return prev; const a = [...prev]; [a[idx + 1], a[idx]] = [a[idx], a[idx + 1]]; return a; });
  }

  return (
    <div className="admin-list">
      <p className="card-meta" style={{ marginBottom: 16 }}>
        Ändra namn, bokstav och beskrivning. Lägg till eller ta bort tiers. Flytta folk till rätt tier innan du tar bort en.
      </p>
      {tiers.map((t, idx) => (
        <div key={t.id} className="admin-tiers-row">
          <input
            type="text"
            value={t.letter}
            onChange={(e) => updateTier(t.id, { letter: e.target.value })}
            placeholder="S"
            style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)', fontSize: 14, textAlign: 'center', fontWeight: 700 }}
          />
          <input
            type="text"
            value={t.label}
            onChange={(e) => updateTier(t.id, { label: e.target.value })}
            placeholder="Namn"
            style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)', fontSize: 13 }}
          />
          <input
            type="text"
            value={t.sublabel}
            onChange={(e) => updateTier(t.id, { sublabel: e.target.value })}
            placeholder="Beskrivning"
            style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)', fontSize: 13 }}
          />
          <input
            type="color"
            title="Tier-färg"
            value={t.color ?? '#888888'}
            onChange={(e) => updateTier(t.id, { color: e.target.value })}
            style={{ width: 36, height: 32, padding: 2, borderRadius: 6, border: '1px solid var(--line)', cursor: 'pointer' }}
          />
          <button className="lb-arrow" disabled={idx === 0} onClick={() => moveUp(idx)}>▲</button>
          <button className="lb-arrow" disabled={idx === tiers.length - 1} onClick={() => moveDown(idx)}>▼</button>
          <button onClick={() => removeTier(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mute)', fontSize: 18, padding: '0 4px' }}>✕</button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 16 }}>
        <button className="btn btn-ghost" onClick={addTier}>+ Ny tier</button>
        <button className="btn btn-purple" onClick={() => save()} disabled={saving}>
          {saving ? 'Sparar…' : 'Spara'}
        </button>
        {savedAt && <span className="card-meta" style={{ color: 'var(--purple-2)' }}>✓ Sparat</span>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Design tab — admin-controlled theme overrides. Saved to site_content
// keys (theme_*) so all visitors see the same look. Live preview applies
// each change to documentElement via CSS custom properties.
// ─────────────────────────────────────────────────────────────────────

interface DesignTabProps {
  siteContent: Record<string, string>;
  updateContent: (key: string, value: string) => Promise<void>;
}

// All theme keys this tab manages. Reset = empty every key.
const ALL_THEME_KEYS = [
  'theme_accent', 'theme_accent2', 'theme_ink', 'theme_paper',
  'theme_bg_color', 'theme_bg_image_url', 'theme_bg_image_opacity',
  'theme_font_scale', 'theme_font_preset',
  'theme_radius', 'theme_spacing',
  'theme_glass_blur', 'theme_glass_opacity',
  'theme_shadow_depth', 'theme_motion',
  'theme_mobile_tiers_cols', 'theme_mobile_moves_cols',
  'theme_mobile_gmap_cols', 'theme_mobile_events_cols',
  'theme_desktop_tiers_cols', 'theme_desktop_moves_cols',
  'theme_desktop_gmap_cols', 'theme_desktop_events_cols',
];

const FONT_OPTIONS: { value: string; label: string }[] = [
  { value: '',           label: 'Standard (Editorial)' },
  { value: 'editorial',  label: 'Editorial — Fraunces · Inter' },
  { value: 'classic',    label: 'Klassiskt — Playfair · Source Sans' },
  { value: 'modern',     label: 'Modernt — Space Grotesk · Inter' },
  { value: 'playful',    label: 'Lekfullt — Caveat · Quicksand' },
  { value: 'newspaper',  label: 'Tidning — Lora · Merriweather' },
  { value: 'tech',       label: 'Tech — Sora' },
];

function DesignTab({ siteContent, updateContent }: DesignTabProps) {
  // Single big state object so we can iterate when resetting / saving all.
  const [vals, setVals] = useState<Record<string, string>>(() =>
    Object.fromEntries(ALL_THEME_KEYS.map(k => [k, siteContent[k] ?? ''])),
  );
  const [saving, setSaving] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const v = (k: string) => vals[k] ?? '';
  const setV = (k: string, value: string) => setVals(prev => ({ ...prev, [k]: value }));

  function flashSaved(key: string) {
    setSaving(null);
    setSavedAt(key);
    setTimeout(() => setSavedAt(null), 1500);
  }
  async function persist(key: string, value: string) {
    setSaving(key);
    try { await updateContent(key, value); flashSaved(key); }
    catch { setSaving(null); }
  }

  async function resetAll() {
    if (!confirm('Återställ all design till original? Detta påverkar alla.')) return;
    setVals(Object.fromEntries(ALL_THEME_KEYS.map(k => [k, ''])));
    // Also remove the dynamically-loaded font <link> tags so reset is visible
    // without a refresh.
    document.querySelectorAll('link[data-theme-font]').forEach(el => el.remove());
    await Promise.all(ALL_THEME_KEYS.map(k => updateContent(k, ''))).catch(() => {});
  }

  // Row + SaveBtn are stable module-level components (see end of file).
  // Defining them inline here would give them a new identity every
  // keystroke; React would then unmount + remount the whole form, which
  // resets the admin shell's scroll position back to the top. That was
  // the bug behind "jag skickas till toppen direkt".

  return (
    <div className="admin-design">
      <p className="card-meta" style={{ marginBottom: 18 }}>
        Ändringar syns omedelbart för dig. När du sparar slår de igenom för alla.
        Tryck <strong>↺ Återställ till original</strong> om något ser knepigt ut.
      </p>

      <div className="section-eyebrow" style={{ margin: '8px 0 6px' }}>Färger</div>

      <Row label="Accentfärg">
        <input type="color" value={v('theme_accent') || '#8B5CF6'} onChange={(e) => setV('theme_accent', e.target.value)} />
        <input type="text" value={v('theme_accent')} onChange={(e) => setV('theme_accent', e.target.value)} placeholder="tom = standard" style={{ width: 110 }} />
        <SaveBtn k="theme_accent" saving={saving} savedAt={savedAt} onSave={() => persist("theme_accent", v("theme_accent"))} />
      </Row>

      <Row label="Andra accent (gradient)">
        <input type="color" value={v('theme_accent2') || '#A78BFA'} onChange={(e) => setV('theme_accent2', e.target.value)} />
        <input type="text" value={v('theme_accent2')} onChange={(e) => setV('theme_accent2', e.target.value)} placeholder="tom = standard" style={{ width: 110 }} />
        <SaveBtn k="theme_accent2" saving={saving} savedAt={savedAt} onSave={() => persist("theme_accent2", v("theme_accent2"))} />
      </Row>

      <Row label="Textfärg">
        <input type="color" value={v('theme_ink') || '#1c1612'} onChange={(e) => setV('theme_ink', e.target.value)} />
        <input type="text" value={v('theme_ink')} onChange={(e) => setV('theme_ink', e.target.value)} placeholder="tom = standard" style={{ width: 110 }} />
        <SaveBtn k="theme_ink" saving={saving} savedAt={savedAt} onSave={() => persist("theme_ink", v("theme_ink"))} />
      </Row>

      <Row label="Kort-/yta-färg">
        <input type="color" value={v('theme_paper') || '#fdf9f0'} onChange={(e) => setV('theme_paper', e.target.value)} />
        <input type="text" value={v('theme_paper')} onChange={(e) => setV('theme_paper', e.target.value)} placeholder="tom = standard" style={{ width: 110 }} />
        <SaveBtn k="theme_paper" saving={saving} savedAt={savedAt} onSave={() => persist("theme_paper", v("theme_paper"))} />
      </Row>

      <Row label="Bakgrundsfärg">
        <input type="color" value={v('theme_bg_color') || '#f3ecdf'} onChange={(e) => setV('theme_bg_color', e.target.value)} />
        <input type="text" value={v('theme_bg_color')} onChange={(e) => setV('theme_bg_color', e.target.value)} placeholder="tom = standard" style={{ width: 110 }} />
        <SaveBtn k="theme_bg_color" saving={saving} savedAt={savedAt} onSave={() => persist("theme_bg_color", v("theme_bg_color"))} />
      </Row>

      <Row label="Bakgrundsbild (URL)">
        <input
          type="url"
          value={v('theme_bg_image_url')}
          onChange={(e) => setV('theme_bg_image_url', e.target.value)}
          placeholder="https://..."
          style={{ flex: 1, minWidth: 0 }}
        />
        <SaveBtn k="theme_bg_image_url" saving={saving} savedAt={savedAt} onSave={() => persist("theme_bg_image_url", v("theme_bg_image_url"))} />
      </Row>

      {v('theme_bg_image_url') && (
        <Row label="Bild-opacitet" hint={`(${v('theme_bg_image_opacity') || '0.5'})`}>
          <input type="range" min="0" max="1" step="0.05" value={v('theme_bg_image_opacity') || '0.5'} onChange={(e) => setV('theme_bg_image_opacity', e.target.value)} />
          <SaveBtn k="theme_bg_image_opacity" saving={saving} savedAt={savedAt} onSave={() => persist("theme_bg_image_opacity", v("theme_bg_image_opacity"))} />
        </Row>
      )}

      <div className="section-eyebrow" style={{ margin: '20px 0 6px' }}>Typografi</div>

      <Row label="Font-preset">
        <select
          value={v('theme_font_preset')}
          onChange={(e) => setV('theme_font_preset', e.target.value)}
          style={{ flex: 1, minWidth: 0 }}
        >
          {FONT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <SaveBtn k="theme_font_preset" saving={saving} savedAt={savedAt} onSave={() => persist("theme_font_preset", v("theme_font_preset"))} />
      </Row>

      <Row label="Textstorlek" hint={`(${v('theme_font_scale') || '1'}×)`}>
        <input type="range" min="0.85" max="1.25" step="0.05" value={v('theme_font_scale') || '1'} onChange={(e) => setV('theme_font_scale', e.target.value)} />
        <SaveBtn k="theme_font_scale" saving={saving} savedAt={savedAt} onSave={() => persist("theme_font_scale", v("theme_font_scale"))} />
      </Row>

      <div className="section-eyebrow" style={{ margin: '20px 0 6px' }}>Form & känsla</div>

      <Row label="Hörnradius" hint={`(${v('theme_radius') || '1'}×)`}>
        <input type="range" min="0" max="2" step="0.1" value={v('theme_radius') || '1'} onChange={(e) => setV('theme_radius', e.target.value)} />
        <SaveBtn k="theme_radius" saving={saving} savedAt={savedAt} onSave={() => persist("theme_radius", v("theme_radius"))} />
      </Row>

      <Row label="Sektionsavstånd" hint={`(${v('theme_spacing') || '1'}×)`}>
        <input type="range" min="0.75" max="1.5" step="0.05" value={v('theme_spacing') || '1'} onChange={(e) => setV('theme_spacing', e.target.value)} />
        <SaveBtn k="theme_spacing" saving={saving} savedAt={savedAt} onSave={() => persist("theme_spacing", v("theme_spacing"))} />
      </Row>

      <Row label="Glaseffekt (blur)" hint={`(${v('theme_glass_blur') || '18'}px)`}>
        <input type="range" min="0" max="30" step="1" value={v('theme_glass_blur') || '18'} onChange={(e) => setV('theme_glass_blur', e.target.value)} />
        <SaveBtn k="theme_glass_blur" saving={saving} savedAt={savedAt} onSave={() => persist("theme_glass_blur", v("theme_glass_blur"))} />
      </Row>

      <Row label="Glas-opacitet" hint={`(${v('theme_glass_opacity') || '0.55'})`}>
        <input type="range" min="0.1" max="1" step="0.05" value={v('theme_glass_opacity') || '0.55'} onChange={(e) => setV('theme_glass_opacity', e.target.value)} />
        <SaveBtn k="theme_glass_opacity" saving={saving} savedAt={savedAt} onSave={() => persist("theme_glass_opacity", v("theme_glass_opacity"))} />
      </Row>

      <Row label="Skuggor">
        <select value={v('theme_shadow_depth')} onChange={(e) => setV('theme_shadow_depth', e.target.value)} style={{ flex: 1 }}>
          <option value="">Standard</option>
          <option value="none">Inga skuggor</option>
          <option value="soft">Mjuk</option>
          <option value="normal">Normal</option>
          <option value="dramatic">Dramatiskt</option>
        </select>
        <SaveBtn k="theme_shadow_depth" saving={saving} savedAt={savedAt} onSave={() => persist("theme_shadow_depth", v("theme_shadow_depth"))} />
      </Row>

      <Row label="Animationer">
        <select value={v('theme_motion')} onChange={(e) => setV('theme_motion', e.target.value)} style={{ flex: 1 }}>
          <option value="">Fullt (standard)</option>
          <option value="reduced">Dämpat (för känsliga ögon)</option>
          <option value="off">Av helt</option>
        </select>
        <SaveBtn k="theme_motion" saving={saving} savedAt={savedAt} onSave={() => persist("theme_motion", v("theme_motion"))} />
      </Row>

      <div className="section-eyebrow" style={{ margin: '20px 0 6px' }}>Mobil-layout</div>

      <Row label="Tier-kort per rad (mobil)">
        <select value={v('theme_mobile_tiers_cols')} onChange={(e) => setV('theme_mobile_tiers_cols', e.target.value)} style={{ flex: 1 }}>
          <option value="">3 per rad (standard)</option>
          <option value="2">2 per rad — större kort</option>
          <option value="3">3 per rad</option>
          <option value="4">4 per rad — kompakt</option>
        </select>
        <SaveBtn k="theme_mobile_tiers_cols" saving={saving} savedAt={savedAt} onSave={() => persist("theme_mobile_tiers_cols", v("theme_mobile_tiers_cols"))} />
      </Row>

      <Row label="Moves-kort per rad (mobil)">
        <select value={v('theme_mobile_moves_cols')} onChange={(e) => setV('theme_mobile_moves_cols', e.target.value)} style={{ flex: 1 }}>
          <option value="">4 per rad (standard)</option>
          <option value="2">2 per rad — större kort</option>
          <option value="3">3 per rad</option>
          <option value="4">4 per rad</option>
          <option value="5">5 per rad — kompakt</option>
        </select>
        <SaveBtn k="theme_mobile_moves_cols" saving={saving} savedAt={savedAt} onSave={() => persist("theme_mobile_moves_cols", v("theme_mobile_moves_cols"))} />
      </Row>

      <Row label="G Map-par per rad (mobil)">
        <select value={v('theme_mobile_gmap_cols')} onChange={(e) => setV('theme_mobile_gmap_cols', e.target.value)} style={{ flex: 1 }}>
          <option value="">2 per rad (standard)</option>
          <option value="1">1 per rad — bred layout</option>
          <option value="2">2 per rad</option>
          <option value="3">3 per rad — kompakt</option>
        </select>
        <SaveBtn k="theme_mobile_gmap_cols" saving={saving} savedAt={savedAt} onSave={() => persist("theme_mobile_gmap_cols", v("theme_mobile_gmap_cols"))} />
      </Row>

      <Row label="Events per rad (mobil)">
        <select value={v('theme_mobile_events_cols')} onChange={(e) => setV('theme_mobile_events_cols', e.target.value)} style={{ flex: 1 }}>
          <option value="">1 per rad (standard, bred)</option>
          <option value="1">1 per rad</option>
          <option value="2">2 per rad — kort blir kompakta</option>
          <option value="3">3 per rad — kompakt</option>
        </select>
        <SaveBtn k="theme_mobile_events_cols" saving={saving} savedAt={savedAt} onSave={() => persist("theme_mobile_events_cols", v("theme_mobile_events_cols"))} />
      </Row>

      <p className="card-meta" style={{ marginTop: 20, padding: '12px 14px', background: 'color-mix(in srgb, var(--purple) 5%, transparent)', borderRadius: 10 }}>
        Letar du efter desktop-kolumninställningar? De ligger i fliken <strong>Desktop design</strong>.
      </p>

      <div className="design-row" style={{ marginTop: 24, borderTop: '1px solid var(--line)', paddingTop: 18 }}>
        <button className="btn btn-ghost" onClick={resetAll} style={{ color: 'var(--rose)' }}>
          ↺ Återställ allt till original
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Add-friend modal — admin creates a new person. Optional first photo
// is uploaded right after the friend row is created.
// ─────────────────────────────────────────────────────────────────────

interface AddFriendModalProps {
  tierConfig: string | undefined;
  existingIds: Set<string>;
  onClose: () => void;
  onCreate: (input: { name: string; id?: string; tier?: string; rank?: number; street?: string; postcode?: string; city?: string; bio?: string; currentMove?: string }) => Promise<Friend>;
  onUploadPhoto: (id: string, dataUrl: string) => Promise<void>;
}

function AddFriendModal({ tierConfig, existingIds, onClose, onCreate, onUploadPhoto }: AddFriendModalProps) {
  const tiers = useMemo(() => parseTierConfig(tierConfig), [tierConfig]);

  const [name, setName] = useState('');
  const [customId, setCustomId] = useState('');
  const [tier, setTier] = useState<string>(tiers[0]?.id ?? 'a');
  const [street, setStreet] = useState('');
  const [postcode, setPostcode] = useState('');
  const [city, setCity] = useState('Södertälje');
  const [bio, setBio] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useLockBody(true);
  useEsc(onClose, true);

  // Auto-derive id preview from name.
  const slugPreview = (customId.trim() || name)
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 40);
  const idTaken = slugPreview.length >= 2 && existingIds.has(slugPreview);

  // After the user picks a file we stash the raw data URL for the crop
  // modal to consume. photoDataUrl holds the FINAL (cropped) result that
  // gets uploaded post-create.
  const [pendingCropRaw, setPendingCropRaw] = useState<string | null>(null);

  function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      setErr('Bilden är för stor (max 8 MB).');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPendingCropRaw(String(reader.result));
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!name.trim()) { setErr('Skriv ett namn.'); return; }
    if (slugPreview.length < 2) { setErr('Kunde inte skapa ett id från namnet — skriv ett manuellt id.'); return; }
    if (idTaken) { setErr(`Id "${slugPreview}" finns redan. Välj ett annat.`); return; }

    setBusy(true);
    try {
      const created = await onCreate({
        name: name.trim(),
        id: customId.trim() || undefined,
        tier,
        street: street.trim() || undefined,
        postcode: postcode.trim() || undefined,
        city: city.trim() || undefined,
        bio: bio.trim() || undefined,
      });
      // If a photo was picked, upload it right away.
      if (photoDataUrl) {
        try { await onUploadPhoto(created.id, photoDataUrl); }
        catch { /* photo failure shouldn't block the create */ }
      }
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'kunde inte skapa');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal add-friend-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Lägg till person"
      >
        <button className="modal-close" onClick={onClose} aria-label="Stäng">✕</button>
        <form className="modal-info" onSubmit={submit} style={{ padding: '32px 32px 28px' }}>
          <div className="section-eyebrow">Lägg till</div>
          <h2 className="modal-name" style={{ fontSize: 26, marginBottom: 16 }}>Ny person</h2>

          <label className="admin-field">
            <span>Namn *</span>
            <input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="t.ex. Erik Andersson" />
          </label>

          <label className="admin-field">
            <span>Id <span style={{ color: 'var(--mute)' }}>({slugPreview || '—'})</span></span>
            <input
              value={customId}
              onChange={(e) => setCustomId(e.target.value)}
              placeholder="auto från namnet om tomt"
            />
          </label>

          <label className="admin-field">
            <span>Tier</span>
            <select value={tier} onChange={(e) => setTier(e.target.value)}>
              {tiers.map(t => <option key={t.id} value={t.id}>{t.letter} — {t.label}</option>)}
            </select>
          </label>

          <div className="admin-field" style={{ display: 'grid', gap: 8 }}>
            <span>Adress</span>
            <input value={street} onChange={(e) => setStreet(e.target.value)} placeholder="Gata + nummer" />
            <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 8 }}>
              <input value={postcode} onChange={(e) => setPostcode(e.target.value)} placeholder="Postnr" />
              <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Stad" />
            </div>
          </div>

          <label className="admin-field">
            <span>Bio (valfri)</span>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} placeholder="Roligt om personen…" />
          </label>

          <label className="admin-field">
            <span>Första bild (valfri)</span>
            <div className="add-friend-photo">
              {photoDataUrl ? (
                <>
                  <img src={photoDataUrl} alt="" />
                  <button type="button" className="btn btn-ghost" onClick={() => setPhotoDataUrl(null)} style={{ fontSize: 12 }}>Ta bort</button>
                </>
              ) : (
                <label className="add-friend-photo-pick">
                  + Välj bild
                  <input type="file" accept="image/*" hidden onChange={onPickPhoto} />
                </label>
              )}
            </div>
          </label>

          {err && <div className="login-error">{err}</div>}

          <div className="modal-photo-controls">
            <button type="submit" className="btn btn-purple" disabled={busy}>
              {busy ? 'Skapar…' : 'Skapa person'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Avbryt</button>
          </div>
        </form>
      </div>

      {pendingCropRaw && (
        <PhotoCropModal
          sourceDataUrl={pendingCropRaw}
          onCancel={() => setPendingCropRaw(null)}
          onAccept={(dataUrl) => {
            setPhotoDataUrl(dataUrl);
            setPendingCropRaw(null);
          }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Stable helpers for DesignTab. MUST live at module scope so React keeps
// the same component identity across DesignTab re-renders — otherwise
// every keystroke unmounts and remounts these and the admin-shell
// scrolls back to top.
// ─────────────────────────────────────────────────────────────────────

function Row({ label, hint, children }: { label: React.ReactNode; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="design-row">
      <label className="design-label">{label}{hint && <span className="card-meta"> {hint}</span>}</label>
      <div className="design-control">{children}</div>
    </div>
  );
}

function SaveBtn({
  k, saving, savedAt, onSave,
}: {
  k: string;
  saving: string | null;
  savedAt: string | null;
  onSave: () => void;
}) {
  return (
    <>
      <button className="btn btn-ghost" onClick={onSave} disabled={saving === k}>
        {saving === k ? 'Sparar…' : 'Spara'}
      </button>
      {savedAt === k && <span className="design-saved">✓</span>}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Desktop design tab — column counts for tiers / moves / G Map / events
// at desktop widths. Mirrors the mobile-layout block on the main Design
// tab but lives in its own tab so the desktop knobs are easy to find.
// ─────────────────────────────────────────────────────────────────────

const DESKTOP_THEME_KEYS = [
  'theme_desktop_tiers_cols', 'theme_desktop_moves_cols',
  'theme_desktop_gmap_cols', 'theme_desktop_events_cols',
];

interface DesktopDesignTabProps {
  siteContent: Record<string, string>;
  updateContent: (key: string, value: string) => Promise<void>;
}

function DesktopDesignTab({ siteContent, updateContent }: DesktopDesignTabProps) {
  const [vals, setVals] = useState<Record<string, string>>(() =>
    Object.fromEntries(DESKTOP_THEME_KEYS.map(k => [k, siteContent[k] ?? ''])),
  );
  const [saving, setSaving] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const v = (k: string) => vals[k] ?? '';
  const setV = (k: string, value: string) => setVals(prev => ({ ...prev, [k]: value }));

  function flashSaved(k: string) {
    setSaving(null);
    setSavedAt(k);
    setTimeout(() => setSavedAt(null), 1500);
  }
  async function persist(key: string, value: string) {
    setSaving(key);
    try { await updateContent(key, value); flashSaved(key); }
    catch { setSaving(null); }
  }
  async function resetAll() {
    if (!confirm('Återställ desktop-layouten till standardvärden?')) return;
    setVals(Object.fromEntries(DESKTOP_THEME_KEYS.map(k => [k, ''])));
    await Promise.all(DESKTOP_THEME_KEYS.map(k => updateContent(k, ''))).catch(() => {});
  }

  return (
    <div className="admin-design">
      <p className="card-meta" style={{ marginBottom: 18 }}>
        Justera hur kompakta sektionerna ser ut på dator. Färger, fonter och
        andra övergripande designvärden ligger kvar i fliken <strong>Design</strong>.
        Mobil-layouten styrs där också.
      </p>

      <Row label="Tier-kort per rad">
        <select value={v('theme_desktop_tiers_cols')} onChange={(e) => setV('theme_desktop_tiers_cols', e.target.value)} style={{ flex: 1 }}>
          <option value="">3 per rad (standard)</option>
          <option value="2">2 per rad — stora kort</option>
          <option value="3">3 per rad</option>
          <option value="4">4 per rad</option>
          <option value="5">5 per rad — kompakt</option>
        </select>
        <SaveBtn k="theme_desktop_tiers_cols" saving={saving} savedAt={savedAt} onSave={() => persist("theme_desktop_tiers_cols", v("theme_desktop_tiers_cols"))} />
      </Row>

      <Row label="Moves-kort per rad">
        <select value={v('theme_desktop_moves_cols')} onChange={(e) => setV('theme_desktop_moves_cols', e.target.value)} style={{ flex: 1 }}>
          <option value="">3 per rad (standard)</option>
          <option value="2">2 per rad</option>
          <option value="3">3 per rad</option>
          <option value="4">4 per rad</option>
          <option value="5">5 per rad</option>
          <option value="6">6 per rad</option>
        </select>
        <SaveBtn k="theme_desktop_moves_cols" saving={saving} savedAt={savedAt} onSave={() => persist("theme_desktop_moves_cols", v("theme_desktop_moves_cols"))} />
      </Row>

      <Row label="G Map-par per rad">
        <select value={v('theme_desktop_gmap_cols')} onChange={(e) => setV('theme_desktop_gmap_cols', e.target.value)} style={{ flex: 1 }}>
          <option value="">2 per rad (standard)</option>
          <option value="1">1 per rad — bred</option>
          <option value="2">2 per rad</option>
          <option value="3">3 per rad</option>
          <option value="4">4 per rad</option>
        </select>
        <SaveBtn k="theme_desktop_gmap_cols" saving={saving} savedAt={savedAt} onSave={() => persist("theme_desktop_gmap_cols", v("theme_desktop_gmap_cols"))} />
      </Row>

      <Row label="Events per rad">
        <select value={v('theme_desktop_events_cols')} onChange={(e) => setV('theme_desktop_events_cols', e.target.value)} style={{ flex: 1 }}>
          <option value="">1 per rad (standard, bred)</option>
          <option value="1">1 per rad</option>
          <option value="2">2 per rad</option>
          <option value="3">3 per rad</option>
          <option value="4">4 per rad — kompakt</option>
        </select>
        <SaveBtn k="theme_desktop_events_cols" saving={saving} savedAt={savedAt} onSave={() => persist("theme_desktop_events_cols", v("theme_desktop_events_cols"))} />
      </Row>

      <div className="design-row" style={{ marginTop: 24, borderTop: '1px solid var(--line)', paddingTop: 18 }}>
        <button className="btn btn-ghost" onClick={resetAll} style={{ color: 'var(--rose)' }}>
          ↺ Återställ desktop-layout
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Roles tab — admin assigns role + linked friend to user accounts
// ─────────────────────────────────────────────────────────────────────

const ROLE_OPTIONS: [ApiUserRole, string, string][] = [
  ['admin',   'Admin',   'Full kontroll'],
  ['court',   'Court',   'Kan ändra allas bio/bild + radera HoF-inlägg'],
  ['stronk',  'Stronk',  'Kan bara redigera sitt eget kort'],
  ['peasant', 'Peasant', 'Inga extra rättigheter'],
  ['user',    'User',    'Vanlig användare (kommentera/gilla)'],
];

function RolesTab({ friends }: { friends: Friend[] }) {
  const [rows, setRows] = useState<ApiAdminUserRow[] | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try { setRows(await listUsers()); }
      catch (e) { setErr(e instanceof Error ? e.message : 'fel'); }
    })();
  }, []);

  async function patch(id: string, body: { role?: ApiUserRole; linkedFriendId?: string | null }) {
    setSavingId(id);
    setErr(null);
    try {
      const updated = await updateUserRoleLink(id, body);
      setRows(prev => prev?.map(r => r.id === id ? updated : r) ?? null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'kunde inte spara');
    } finally {
      setSavingId(null);
    }
  }

  if (err && !rows) return <div className="login-error">{err}</div>;
  if (!rows) return <div className="card-meta">Laddar…</div>;
  if (rows.length === 0) return <div className="card-meta">Inga registrerade användare ännu.</div>;

  return (
    <div className="admin-list admin-roles">
      <p className="card-meta" style={{ marginTop: 0 }}>
        Tilldela en roll till varje konto. Court och Admin kan redigera alla kort
        (utom adress, som är admin-bara). Stronk får bara redigera sitt egna
        länkade kort. Peasant och User har inga extra rättigheter på korten.
      </p>
      {err && <div className="login-error" style={{ marginBottom: 12 }}>{err}</div>}
      <table className="admin-roles-table">
        <thead>
          <tr>
            <th>Användare</th>
            <th>Roll</th>
            <th>Länkad person</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id}>
              <td>
                <strong>{r.username}</strong>
              </td>
              <td>
                <select
                  value={r.role}
                  disabled={savingId === r.id}
                  onChange={(e) => void patch(r.id, { role: e.target.value as ApiUserRole })}
                >
                  {ROLE_OPTIONS.map(([v, label, hint]) => (
                    <option key={v} value={v} title={hint}>{label}</option>
                  ))}
                </select>
              </td>
              <td>
                <select
                  value={r.linkedFriendId ?? ''}
                  disabled={savingId === r.id}
                  onChange={(e) => void patch(r.id, { linkedFriendId: e.target.value || null })}
                >
                  <option value="">— ingen —</option>
                  {friends.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
