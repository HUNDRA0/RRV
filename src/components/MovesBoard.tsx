import type { Friend } from '../data/friends';
import { TIERS } from '../data/friends';
import { useFriendsList } from '../lib/state';
import type { ApiPrediction } from '../lib/api';

const TIER_COLOR_VAR: Record<Friend['tier'], string> = {
  s: 'var(--gold)',
  a: 'var(--a)',
  i: 'var(--i)',
};

export function MovesBoard() {
  const { isAdmin, friends, predictions, toggleCorrect } = useFriendsList();
  const correctCount = predictions.filter(p => p.correct).length;
  const tally =
    `${predictions.length} gissning${predictions.length !== 1 ? 'ar' : ''} · ${correctCount} rätt`;

  const champions = isAdmin
    ? Array.from(new Set(predictions.filter(p => p.correct).map(p => p.guesser)))
    : [];

  return (
    <>
      <div className="moves-board-header">
        <div className="moves-board-title">
          The <em>Board</em>
        </div>
        <div className="moves-tally">{tally}</div>
      </div>
      {champions.length > 0 && (
        <div className="champion-banner">
          <h3>🏆 Champions</h3>
          <p>{champions.join(', ')} — gissade rätt. Respekt.</p>
        </div>
      )}
      <div className="moves-grid">
        {friends.map(friend => {
          const entries = predictions.filter(p => p.friendId === friend.id);
          return (
            <div key={friend.id} className="moves-person-col">
              <div className="moves-person-header">
                <div className="moves-avatar">
                  {friend.photoUrl ? (
                    <img src={friend.photoUrl} alt={friend.name} />
                  ) : (
                    <div className="av-ph">👤</div>
                  )}
                </div>
                <div>
                  <div className="moves-person-name">{friend.name}</div>
                  <div className="moves-person-tier" style={{ color: TIER_COLOR_VAR[friend.tier] }}>
                    {TIERS[friend.tier].pickerLabel}
                  </div>
                </div>
              </div>
              <div className="moves-entry-list">
                {entries.length === 0 ? (
                  <div className="moves-empty">Inga gissningar ännu</div>
                ) : (
                  entries.map(entry => (
                    <Entry key={entry.id} entry={entry} onToggle={toggleCorrect} />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function Entry({
  entry,
  onToggle,
}: {
  entry: ApiPrediction;
  onToggle: (id: number, current: boolean) => Promise<void>;
}) {
  return (
    <div className={`moves-entry${entry.correct ? ' correct' : ''}`}>
      <div className="entry-body">
        <div className="entry-guesser">{entry.guesser}</div>
        <div className="entry-guess">"{entry.text}"</div>
        <div className="entry-meta">{entry.createdAt.split(' ')[0]}</div>
      </div>
      {entry.correct && <span className="correct-badge">✓ Rätt</span>}
      <button
        type="button"
        className="mark-correct-btn"
        onClick={() => onToggle(entry.id, entry.correct).catch(err => alert(err.message ?? 'fel'))}
      >
        {entry.correct ? 'Avmarkera' : '✓ Rätt'}
      </button>
    </div>
  );
}
