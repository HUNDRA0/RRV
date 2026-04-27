import type { ApiGMapPair } from '../lib/api';
import { useFriendsList } from '../lib/state';

interface Props {
  pair: ApiGMapPair;
}

export function GPairCard({ pair }: Props) {
  const { findFriend } = useFriendsList();
  const left = findFriend(pair.friends[0]);
  const right = findFriend(pair.friends[1]);
  if (!left || !right) return null;

  // The distance label IS already human-readable ('152 m' / '1.3 km' / 'Samma adress').
  // The proximity label adds Swedish flavor ('Grannar', 'Promenadavstånd'). Show
  // the latter only when it's not redundant with the former.
  const showSubLabel = pair.distanceLabel !== pair.proximityLabel;

  return (
    <div className={`gmap-pair-card tier-${pair.proximity}`}>
      <div className="gmap-pair-num">{pair.rank}</div>
      <div className="gmap-pair-avatars">
        <div className="gmap-avatar">
          {left.photoUrl ? (
            <img src={left.photoUrl} alt={left.name} />
          ) : (
            <div className="gmap-av-ph">👤</div>
          )}
        </div>
        <div className="gmap-crown">{pair.emoji}</div>
        <div className="gmap-avatar">
          {right.photoUrl ? (
            <img src={right.photoUrl} alt={right.name} />
          ) : (
            <div className="gmap-av-ph">👤</div>
          )}
        </div>
      </div>
      <div className="gmap-pair-info">
        <div className="gmap-pair-names">
          {left.name} <span className="amp">&amp;</span> {right.name}
        </div>
        {pair.area && <div className="gmap-pair-area">{pair.area}</div>}
        <div className="gmap-pair-dist" style={{ color: pair.proximityColor }}>
          {pair.distanceLabel}
          {showSubLabel && (
            <span style={{ opacity: 0.55, marginLeft: 6, fontWeight: 400, letterSpacing: '0.05em' }}>
              · {pair.proximityLabel}
            </span>
          )}
        </div>
      </div>
      <a className="gmap-map-btn" href={pair.mapsUrl} target="_blank" rel="noopener">
        🗺 Se exakt avstånd
      </a>
    </div>
  );
}
