import { useState, useEffect } from 'react';
import { useFriendsList } from '../lib/state';

export function JobLeaderboardPage() {
  const { friends, jobLeaderboard, updateJobLeaderboard, isAdmin } = useFriendsList();

  // Local draft order — array of friend ids, index = position-1
  const [draft, setDraft] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (jobLeaderboard.length > 0) {
      setDraft(jobLeaderboard);
      setDirty(false);
    }
  }, [jobLeaderboard]);

  if (draft.length === 0) return null;

  const friendMap = new Map(friends.map(f => [f.id, f]));

  function swapToPosition(fromIndex: number, toPosition: number) {
    const toIndex = toPosition - 1;
    if (fromIndex === toIndex) return;
    const next = [...draft];
    const tmp = next[toIndex];
    next[toIndex] = next[fromIndex];
    next[fromIndex] = tmp;
    setDraft(next);
    setDirty(true);
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    try {
      await updateJobLeaderboard(draft);
      setDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setDraft(jobLeaderboard);
    setDirty(false);
    setSaved(false);
  }

  const medals: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

  return (
    <div id="page-joblb" className="page active">
      <div className="joblb-masthead">
        <div className="joblb-badge">Officiell Karriär-Ranking</div>
        <h2>Job<span>Leaderboard</span></h2>
        <p className="joblb-sub">Vem har det bästa jobbet? Rankingen talar för sig själv.</p>
      </div>

      {isAdmin && (
        <div className="joblb-admin-hint">
          Välj ny plats i rullgardinen för att byta — tryck sedan Spara.
        </div>
      )}

      <div className="joblb-list">
        {draft.map((friendId, idx) => {
          const pos = idx + 1;
          const friend = friendMap.get(friendId);
          if (!friend) return null;
          return (
            <div key={friendId} className={`joblb-row${pos <= 3 ? ' joblb-row--podium' : ''}`}>
              <span className="joblb-pos">
                {medals[pos] ?? pos}
              </span>
              {friend.photoUrl && (
                <img className="joblb-avatar" src={friend.photoUrl} alt={friend.name} />
              )}
              {!friend.photoUrl && (
                <div className="joblb-avatar joblb-avatar--placeholder">
                  {friend.name.charAt(0)}
                </div>
              )}
              <span className="joblb-name">{friend.name}</span>
              {isAdmin && (
                <select
                  className="joblb-pos-select"
                  value={pos}
                  onChange={e => swapToPosition(idx, Number(e.target.value))}
                >
                  {draft.map((_, i) => (
                    <option key={i + 1} value={i + 1}>→ #{i + 1}</option>
                  ))}
                </select>
              )}
            </div>
          );
        })}
      </div>

      {isAdmin && (
        <div className="joblb-save-bar">
          {dirty && (
            <button type="button" className="joblb-btn joblb-btn--ghost" onClick={reset}>
              Ångra
            </button>
          )}
          <button
            type="button"
            className={`joblb-btn joblb-btn--primary${!dirty ? ' joblb-btn--inactive' : ''}`}
            onClick={save}
            disabled={saving || !dirty}
          >
            {saving ? 'Sparar…' : saved ? '✓ Sparat' : 'Spara ordning'}
          </button>
        </div>
      )}
    </div>
  );
}
