import type { Friend } from '../../data/friends';
import { TIER_CSS } from './tier-map';

interface PhotoCellProps {
  friend: Friend;
  onClick: (e: React.MouseEvent) => void;
}

export function PhotoCell({ friend, onClick }: PhotoCellProps) {
  const arr = friend.photos || [];
  const main = arr[0]?.url;
  const tierCss = TIER_CSS[friend.tier];
  return (
    <div
      className="card-photo"
      data-tier={tierCss}
      onClick={onClick}
      role="button"
      tabIndex={0}
    >
      {main ? (
        <img src={main} alt={friend.name} />
      ) : (
        <div className="placeholder">{(friend.name[0] || '?').toUpperCase()}</div>
      )}
      {arr.length > 1 && (
        <div className="carousel-peek" aria-hidden="true">
          <div className="peek peek-1" style={{ backgroundImage: `url(${arr[1].url})` }} />
          {arr[2] && (
            <div className="peek peek-2" style={{ backgroundImage: `url(${arr[2].url})` }} />
          )}
        </div>
      )}
      {arr.length > 1 && <div className="photo-count">{arr.length} bilder</div>}
      <div className="open-hint">Öppna →</div>
    </div>
  );
}
