import { useEffect, useMemo, useState } from 'react';
import { AuroraBg } from './components/viber/AuroraBg';
import { StickyNav } from './components/viber/StickyNav';
import { Hero } from './components/viber/Hero';
import { QuoteTicker, QUOTES_SEED } from './components/viber/QuoteTicker';
import { RankingsSection } from './components/viber/RankingsSection';
import { LeaderboardSection } from './components/viber/LeaderboardSection';
import { GMapSection } from './components/viber/GMapSection';
import { MovesSection } from './components/viber/MovesSection';
import { EventsSection, EVENTS_SEED, type EventItem } from './components/viber/EventsSection';
import { PersonModal } from './components/viber/PersonModal';
import { EditBanner } from './components/viber/EditBanner';
import { AdminLoginModal } from './components/viber/AdminLoginModal';
import { AdminConsole } from './components/viber/AdminConsole';
import {
  useActiveSection,
  useGlobalReveal,
  useLocalState,
  dayOfYear,
} from './hooks/useViberHooks';
import { useFriendsList } from './lib/state';

const SECTION_IDS = ['rankings', 'leaderboard', 'gmap', 'moves', 'events'];

export function App() {
  const {
    loading, loadError, refresh,
    friends, findFriend,
    isAdmin, isEditing, toggleEditMode,
    tryLogin, loginError,
    siteContent, updateContent,
    updateFriend, uploadPhoto, deletePhoto,
  } = useFriendsList();

  const [openId, setOpenId] = useState<string | null>(null);
  const [adminLoginOpen, setAdminLoginOpen] = useState(false);
  const [adminConsoleOpen, setAdminConsoleOpen] = useState(false);
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

  const quotes = useMemo(() => {
    const raw = siteContent['viber_quotes'];
    if (raw) {
      const lines = raw.split('\n').map((s) => s.trim()).filter(Boolean);
      if (lines.length) return lines;
    }
    return QUOTES_SEED;
  }, [siteContent]);

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

  const manualGmapPairs = useMemo<Array<{a: string; b: string}> | null>(() => {
    const raw = siteContent['gmap_pairs'];
    if (!raw) return null;
    try { return JSON.parse(raw) as Array<{a: string; b: string}>; }
    catch { return null; }
  }, [siteContent]);

  const todaysQuote = quotes[dayOfYear() % Math.max(1, quotes.length)] || 'Vibe responsibly.';
  const openFriend = openId ? findFriend(openId) : null;

  const onToggleEdit = () => {
    if (!isAdmin) { setAdminLoginOpen(true); return; }
    toggleEditMode();
  };
  const onAdminClick = () => {
    if (isAdmin) { setAdminConsoleOpen(true); return; }
    setAdminLoginOpen(true);
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

  return (
    <div className="app" data-edit={isEditing}>
      <AuroraBg />
      <StickyNav
        active={active}
        edit={isEditing}
        isAdmin={isAdmin}
        onToggleEdit={onToggleEdit}
        onAdminClick={onAdminClick}
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
          <button className="btn btn-purple" onClick={() => { refresh(); }}>
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
          <EventsSection events={events} />
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

      {adminLoginOpen && (
        <AdminLoginModal
          onClose={() => setAdminLoginOpen(false)}
          onLogin={tryLogin}
          loginError={loginError}
        />
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
