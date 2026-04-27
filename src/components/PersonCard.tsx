// Card preview — clean, tappable. Click anywhere to open the detail modal.
// Inline editing of name/note moved to the modal so the card stays a preview.

import { useState, type KeyboardEvent } from 'react';
import type { Friend } from '../data/friends';
import { TIERS } from '../data/friends';
import { PersonDetailModal } from './PersonDetailModal';

interface Props {
  friend: Friend;
}

export function PersonCard({ friend }: Props) {
  const [open, setOpen] = useState(false);
  const tier = TIERS[friend.tier];
  const photoCount = friend.photos.length;

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen(true);
    }
  }

  return (
    <>
      <div
        className="person-card"
        data-name={friend.name}
        data-tier={friend.tier}
        role="button"
        tabIndex={0}
        aria-label={`Öppna detaljer för ${friend.name}`}
        onClick={() => setOpen(true)}
        onKeyDown={onKeyDown}
      >
        {/* Photo fills top of card */}
        <div className="c-photo-top">
          {friend.photoUrl ? (
            <img className="c-photo" src={friend.photoUrl} alt={friend.name} />
          ) : (
            <div className="no-photo"><span>👤</span></div>
          )}
          <div className="c-rank">#{friend.rank}</div>
          {photoCount > 1 && (
            <div className="c-photo-count" aria-hidden>
              <span>{photoCount}</span>
              <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden>
                <path d="M4 7H20M4 12H20M4 17H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
          )}
        </div>
        {/* Text below */}
        <div className="c-card-body">
          <div className="c-name">{friend.name}</div>
          <div className="c-sublabel">{tier.cardLabel}</div>
          {friend.bio && <p className="c-bio">{friend.bio}</p>}
          <div className="c-open-hint" aria-hidden>Öppna →</div>
        </div>
      </div>
      {open && <PersonDetailModal friend={friend} onClose={() => setOpen(false)} />}
    </>
  );
}
