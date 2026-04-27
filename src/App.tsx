import { useState } from 'react';
import { BgDecoration } from './components/BgDecoration';
import { TopNav } from './components/TopNav';
import type { PageId } from './components/TopNav';
import { Masthead } from './components/Masthead';
import { TierSection } from './components/TierSection';
import { GMapPage } from './components/GMapPage';
import { MovesPage } from './components/MovesPage';
import { Marquee } from './components/Marquee';
import { TIER_ORDER } from './data/friends';
import { useFriendsList } from './lib/state';

const TICKER_GOLD = [
  'Real Rankings Viber',
  '2026 · Currently 2027 Inc!',
  "H'ah",
  'All Rights Reserved',
  'Official Edition',
  'Stockholm · Topp 16',
  'Officiell Ranking · Established 2025',
  'The Committee Has Spoken',
  'Inga Refunder · Inga Undantag',
  'Tier-List Certified',
];
const TICKER_MOVES = [
  'Making Moves 2027',
  '2026 · Currently 2027 Inc!',
  'The Prediction Game · Official',
  'Champion: TBD · 31 Dec 2027',
  'Lägg din gissning · All Rights Reserved',
  'Ingen pardon · Inga refunder',
  "H'ah",
];
const TICKER_GMAP = [
  'Real Rankings Viber · G Map',
  'Geografisk Proximity · Official',
  'G-Mapped · 2026',
  '16 är hem · Alla har en G',
  'Distanser ljuger aldrig',
  "H'ah · All Rights Reserved",
];

const PAGE_NUMERAL: Record<PageId, string> = {
  tierlist: 'I',
  moves: 'II',
  gmap: 'III',
};

export function App() {
  const [currentPage, setCurrentPage] = useState<PageId>('tierlist');
  const { loading, loadError, friends, refresh } = useFriendsList();

  const ticker =
    currentPage === 'moves' ? TICKER_MOVES :
    currentPage === 'gmap'  ? TICKER_GMAP :
                              TICKER_GOLD;
  const tone =
    currentPage === 'moves' ? 'moves' :
    currentPage === 'gmap'  ? 'gmap'  :
                              'gold';

  const ready = !loadError && friends.length > 0;

  return (
    <>
      <BgDecoration />
      <TopNav currentPage={currentPage} onNavigate={setCurrentPage} />
      <Marquee items={ticker} tone={tone} />

      {loadError && (
        <div className="load-error">
          <p>⚠️ Kunde inte ladda data från servern.</p>
          <p className="load-error-detail">{loadError}</p>
          <button type="button" className="nav-btn" onClick={() => { refresh(); }}>
            Försök igen
          </button>
        </div>
      )}

      {loading && friends.length === 0 && !loadError && (
        <div className="page-loading">Laddar…</div>
      )}

      {ready && currentPage === 'tierlist' && (
        <div id="page-tierlist" className="page active">
          <span className="section-numeral" aria-hidden>{PAGE_NUMERAL.tierlist}</span>
          <Masthead />
          <div className="tier-page-wrap">
            {TIER_ORDER.map(tierId => (
              <TierSection key={tierId} tierId={tierId} />
            ))}
          </div>
        </div>
      )}
      {ready && currentPage === 'moves' && (
        <div className="numeral-wrap">
          <span className="section-numeral" aria-hidden>{PAGE_NUMERAL.moves}</span>
          <MovesPage />
        </div>
      )}
      {ready && currentPage === 'gmap' && (
        <div className="numeral-wrap">
          <span className="section-numeral" aria-hidden>{PAGE_NUMERAL.gmap}</span>
          <GMapPage />
        </div>
      )}

      <div className="page-footer">
        <div className="footer-logo">
          The Real<span>Rankings</span>
        </div>
        <span className="footer-note">© {new Date().getFullYear()} · Alla rankingar är slutgiltiga · Vol. I</span>
      </div>
    </>
  );
}
