import { useState } from 'react';
import { TIERS } from '../data/friends';
import { useFriendsList } from '../lib/state';

export function MovesSubmitForm() {
  const { friends, submitPrediction } = useFriendsList();
  const [guesser, setGuesser] = useState('');
  const [friendId, setFriendId] = useState('');
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    const g = guesser.trim();
    const t = text.trim();
    if (!g) return setError('Skriv ditt namn');
    if (!friendId) return setError('Välj en person');
    if (t.length < 5) return setError('Skriv en riktig gissning!');
    setError('');
    setSubmitting(true);
    try {
      await submitPrediction({ guesser: g, friendId, text: t });
      setGuesser('');
      setFriendId('');
      setText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'kunde inte skicka gissningen');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="moves-submit-section">
      <div className="moves-submit-title">🎯 Lägg din gissning</div>
      <p className="moves-submit-sub">
        Välj en person, skriv ditt namn och din gissning. Allt sparas och räknas av vid årets slut.
      </p>
      <div className="moves-form-row">
        <div className="moves-form-group">
          <label className="moves-label">Ditt namn</label>
          <input
            className="moves-input"
            type="text"
            placeholder="T.ex. Marcus"
            maxLength={24}
            value={guesser}
            onChange={e => setGuesser(e.target.value)}
          />
        </div>
        <div className="moves-form-group">
          <label className="moves-label">Vem gissar du på?</label>
          <select
            className="moves-select"
            value={friendId}
            onChange={e => setFriendId(e.target.value)}
          >
            <option value="">— Välj person —</option>
            {friends.map(f => (
              <option key={f.id} value={f.id}>
                {f.name} ({TIERS[f.tier].pickerLabel})
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="moves-form-row">
        <div className="moves-form-group" style={{ flex: 2, minWidth: 180 }}>
          <label className="moves-label">Deras move 2027</label>
          <textarea
            className="moves-textarea"
            placeholder="T.ex. Flyttar äntligen hemifrån…"
            maxLength={200}
            value={text}
            onChange={e => setText(e.target.value)}
          />
        </div>
      </div>
      <button type="button" className="moves-submit-btn" onClick={onSubmit} disabled={submitting}>
        {submitting ? 'Skickar…' : 'Skicka gissning →'}
      </button>
      {error && <span className="guess-error">{error}</span>}
    </div>
  );
}
