// "Making Moves 2026" — current-year status board.
// Shows all 16 friends with their current_move. Admins can edit inline.

import { type FocusEvent } from 'react';
import { TIERS } from '../data/friends';
import { useFriendsList } from '../lib/state';

export function MovesCurrentBoard() {
  const { friends, isAdmin, updateFriend } = useFriendsList();

  function onMoveBlur(friendId: string, currentValue: string, e: FocusEvent<HTMLSpanElement>) {
    if (!isAdmin) return;
    const next = (e.currentTarget.textContent ?? '').trim();
    if (next === currentValue) return;
    updateFriend(friendId, { currentMove: next }).catch(err => {
      alert(`Update failed: ${String(err.message ?? err)}`);
      e.currentTarget.textContent = currentValue;
    });
  }

  return (
    <section className="moves-current-section">
      <div className="moves-current-header">
        <span className="moves-current-year-badge">Making Moves 2026</span>
        <h3 className="moves-current-title">Nuläget</h3>
        <p className="moves-current-sub">Vad händer just nu i inrekretsens liv? Spoilers below.</p>
      </div>

      <div className="moves-current-grid">
        {friends.map(f => {
          const tier = TIERS[f.tier];
          const hasMove = f.currentMove && f.currentMove.trim().length > 0;
          return (
            <div key={f.id} className={`mc-row tier-${f.tier}`}>
              <div className="mc-photo-wrap">
                {f.photoUrl
                  ? <img src={f.photoUrl} alt={f.name} className="mc-photo" />
                  : <div className="mc-photo-placeholder">{f.name[0]}</div>
                }
              </div>
              <div className="mc-info">
                <span className="mc-rank">#{f.rank}</span>
                <span className="mc-name">{f.name}</span>
                <span className="mc-tier-label">{tier.pickerLabel}</span>
              </div>
              <div className="mc-move-wrap">
                <span
                  className={`mc-move${!hasMove ? ' empty' : ''}${isAdmin ? ' editable' : ''}`}
                  contentEditable={isAdmin}
                  suppressContentEditableWarning
                  onBlur={(e) => onMoveBlur(f.id, f.currentMove, e)}
                >
                  {hasMove
                    ? f.currentMove
                    : isAdmin ? 'Klicka för att skriva…' : '—'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
