import { useEffect, useMemo, useRef, useState } from 'react';
import { AuroraBg } from './components/viber/AuroraBg';
import { StickyNav } from './components/viber/StickyNav';
import { Hero } from './components/viber/Hero';
import { QuoteTicker } from './components/viber/QuoteTicker';
import { RankingsSection } from './components/viber/RankingsSection';
import { LeaderboardSection } from './components/viber/LeaderboardSection';
import { GMapSection } from './components/viber/GMapSection';
import { MovesSection } from './components/viber/MovesSection';
import { EventsSection, EVENTS_SEED, type EventItem } from './components/viber/EventsSection';
import { LunchSection, parseLunchData } from './components/viber/LunchSection';
import { PersonModal } from './components/viber/PersonModal';
import { EditBanner } from './components/viber/EditBanner';
import { LoginModal } from './components/viber/LoginModal';
import { AdminConsole } from './components/viber/AdminConsole';
import {
  useActiveSection,
  useGlobalReveal,
  useLocalState,
} from './hooks/useViberHooks';
import { useFriendsList } from './lib/state';

const SECTION_IDS = ['rankings', 'leaderboard', 'gmap', 'moves', 'events', 'lunch'];

export function App() {
  const {
    loading, loadError, refresh,
    friends, findFriend,
    isAdmin, isEditing, toggleEditMode,
    siteContent, updateContent, dailyQuote,
    updateFriend, uploadPhoto, deletePhoto,
    currentUser, logoutUser,
  } = useFriendsList();

  const [openId, setOpenId] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [adminConsoleOpen, setAdminConsoleOpen] = useState(false);

  // Auto-open admin console the first time isAdmin flips on (post-login).
  const wasAdmin = useRef(false);
  useEffect(() => {
    if (isAdmin && !wasAdmin.current) setAdminConsoleOpen(true);
    wasAdmin.current = isAdmin;
  }, [isAdmin]);
  const [bannerOpen, setBannerOpen] = useLocalState('vr.banner', true);
  const [theme, setTheme] = useLocalState<'light' | 'dark'>('vr.theme', 'light');

  const active = useActiveSection(SECTION_IDS);
  useGlobalReveal([friends.length, active]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    return () => { delete document.documentElement.dataset.theme; };
  }, [theme]);

  // Re-show the edit banner whenever editing turns back on.
  useEffect(() => { if (isEditing) setBannerOpen(true); }, [isEditing, setBannerOpen]);

  // dailyQuote is picked server-side in /api/bootstrap — stable for the whole UTC day.

  const events = useMemo<EventItem[]>(() => {
    const raw = siteContent['viber_events'];
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as EventItem[];
        if (Array.isArray(parsed) && parsed.length) return parsed;
      } catch { /* fall through */ }
    }
    return EVENTS_SEED;
  }, [siteContent]);

  const lunchData = useMemo(() => parseLunchData(siteContent['lunch_tickets']), [siteContent]);

  const manualGmapPairs = useMemo<Array<{a: string; b: string}> | null>(() => {
    const raw = siteContent['gmap_pairs'];
    if (!raw) return null;
    try { return JSON.parse(raw) as Array<{a: string; b: string}>; }
    catch { return null; }
  }, [siteContent]);

  const todaysQuote = dailyQuote || 'Vibe responsibly.';
  const openFriend = openId ? findFriend(openId) : null;

  const onToggleEdit = () => {
    if (!isAdmin) { setLoginOpen(true); return; }
    toggleEditMode();
  };
  const onLoginClick = () => {
    if (isAdmin) { setAdminConsoleOpen(true); return; }
    setLoginOpen(true);
  };

  const onSetMove = async (id: string, value: string) => {
    if (!isAdmin) return;
    try { await updateFriend(id, { currentMove: value }); }
    catch { /* surface later */ }
  };
  const onBioChange = async (id: string, bio: string) => {
    if (!isAdmin) return;
    try { await updateFriend(id, { bio }); }
    catch { /* surface later */ }
  };
  const onAddPhoto = async (id: string, dataUrl: string) => {
    if (!isAdmin) return;
    try { await uploadPhoto(id, dataUrl); }
    catch { /* surface later */ }
  };
  const onRemovePhoto = async (id: string, position: number) => {
    if (!isAdmin) return;
    try { await deletePhoto(id, position); }
    catch { /* surface later */ }
  };

  const ready = !loadError && friends.length > 0;

  // Show a splash screen until the first bootstrap response arrives.
  // This prevents the "flash of default content" (wrong quote, empty nav, etc.)
  if (loading && friends.length === 0 && !loadError) {
    return (
      <div className="app">
        <AuroraBg />
        <div className="splash">
          <p className="splash-wordmark">Viber Rankings</p>
          <div className="splash-dots">
            <span /><span /><span />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app" data-edit={isEditing}>
      <AuroraBg />
      <StickyNav
        active={active}
        edit={isEditing}
        isAdmin={isAdmin}
        currentUser={currentUser}
        onToggleEdit={onToggleEdit}
        onLoginClick={onLoginClick}
        onLogoutUser={logoutUser}
        theme={theme}
        onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      />

      <QuoteTicker quote={todaysQuote} />
      <Hero />

      {loadError && (
        <div className="container" style={{ padding: '40px 32px', textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 22 }}>
            ⚠️ Kunde inte ladda data från servern.
          </p>
          <p className="card-meta">{loadError}</p>
          <button className="btn btn-purple" onClick={() => { refresh(true); }}>
            Försök igen
          </button>
        </div>
      )}

      {loading && friends.length === 0 && !loadError && (
        <div className="container" style={{ padding: '40px 32px', textAlign: 'center', color: 'var(--mute)' }}>
          Laddar…
        </div>
      )}

      {ready && (
        <>
          <RankingsSection friends={friends} edit={isEditing} onOpen={setOpenId} onRemovePhoto={onRemovePhoto} />
          <LeaderboardSection friends={friends} edit={isEditing} siteContent={siteContent} updateContent={updateContent} />
          <GMapSection friends={friends} manualPairs={manualGmapPairs} />
          <MovesSection friends={friends} edit={isEditing} onSetMove={onSetMove} />
          <EventsSection events={events} onRequestLogin={() => setLoginOpen(true)} />
          <LunchSection friends={friends} data={lunchData} />
        </>
      )}

      <footer className="foot container">
        <div>VR · Viber Rankings · {new Date().getFullYear()}</div>
        <div>Södertälje · 16 G's</div>
      </footer>

      {openFriend && (
        <PersonModal
          friend={openFriend}
          edit={isEditing}
          onClose={() => setOpenId(null)}
          onBioChange={onBioChange}
          onAddPhoto={onAddPhoto}
          onRemovePhoto={onRemovePhoto}
        />
      )}

      {loginOpen && (
        <LoginModal onClose={() => setLoginOpen(false)} />
      )}

      {adminConsoleOpen && isAdmin && (
        <AdminConsole onClose={() => setAdminConsoleOpen(false)} />
      )}

      {isEditing && bannerOpen && (
        <EditBanner onClose={() => setBannerOpen(false)} />
      )}
    </div>
  );
}
