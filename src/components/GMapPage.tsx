import { useFriendsList } from '../lib/state';
import { GPairCard } from './GPairCard';
import { GLessCard } from './GLessCard';

export function GMapPage() {
  const { gmap, friends } = useFriendsList();

  if (!gmap) {
    return (
      <div id="page-gmap" className="page active">
        <div className="page-loading">Beräknar avstånd…</div>
      </div>
    );
  }

  const totalForCopy = friends.length;

  return (
    <div id="page-gmap" className="page active">
      <div className="gmap-masthead">
        <div className="gmap-badge">Geografisk Proximity Ranking</div>
        <h2>
          G Map<span>Who's your neighbour G?</span>
        </h2>
        <p className="gmap-sub">
          Alla {totalForCopy} personer parade ihop baserat på närmaste granne — riktiga avstånd
          från geokodade adresser. Klicka på kartlänken för att se rutten via Google Maps.
        </p>
      </div>
      <div className="gmap-page-wrap">
        <div className="gmap-section-header">
          <div className="gmap-section-title">
            Official <em>G's</em>
          </div>
          <div className="gmap-section-sub">
            {gmap.pairs.length} par · sorterade närmast → längst
          </div>
        </div>
        <div className="gmap-pairs-list">
          {gmap.pairs.map(pair => (
            <GPairCard key={pair.rank} pair={pair} />
          ))}
        </div>

        {gmap.gLessIds.length > 0 && (
          <>
            <div className="gmap-gless-header">
              <div className="gmap-gless-title">😬 G Less</div>
              <div className="gmap-section-sub">
                {gmap.gLessIds.length === 1 ? 'Ingen G-partner' : `${gmap.gLessIds.length} utan G-partner`}
              </div>
            </div>
            <div className="gmap-gless-cards">
              {gmap.gLessIds.map(id => (
                <GLessCard key={id} friendId={id} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
