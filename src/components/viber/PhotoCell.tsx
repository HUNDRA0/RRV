import type { Friend } from '../../data/friends';
import { TIER_CSS } from './tier-map';

interface PhotoCellProps {
  friend: Friend;
  onClick: (e: React.MouseEvent) => void;
  edit?: boolean;
  onRemovePhoto?: (id: string, position: number) => void;
}

export function PhotoCell({ friend, onClick, edit, onRemovePhoto }: PhotoCellProps) {
  const arr = friend.photos || [];
  const main = arr[0];
  const tierCss = TIER_CSS[friend.tier];
  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!main || !onRemovePhoto) return;
    if (confirm(`Ta bort denna bild för ${friend.name}?`)) {
      onRemovePhoto(friend.id, main.position);
    }
  };
  return (
    <div
      className="card-photo"
      data-tier={tierCss}
      onClick={onClick}
      role="button"
      tabIndex={0}
    >
      {main ? (
        <img src={main.url} alt={friend.name} />
      ) : (
        <div className="placeholder">{(friend.name[0] || '?').toUpperCase()}</div>
      )}
      {edit && main && onRemovePhoto && (
        <button
          type="button"
          className="card-photo-remove"
          onClick={handleRemove}
          aria-label={`Ta bort bild för ${friend.name}`}
          title="Ta bort denna bild"
        >✕</button>
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
