import { CountdownBadge } from './CountdownBadge';
import { MovesSubmitForm } from './MovesSubmitForm';
import { MovesBoard } from './MovesBoard';
import { MovesCurrentBoard } from './MovesCurrentBoard';

export function MovesPage() {
  return (
    <div id="page-moves" className="page active">
      <div className="moves-masthead">
        <div className="moves-year-badge">The Official Prediction Game</div>
        <h2>
          Making Moves<span>2027</span>
        </h2>
        <p className="moves-sub">
          Vad ska din kille göra i år? Lägg din gissning — resultaten avslöjas vid årets slut.
          Den som gissade rätt blir Champion.
        </p>
        <CountdownBadge />
      </div>
      <div className="moves-page-wrap">
        <MovesCurrentBoard />
        <MovesSubmitForm />
        <MovesBoard />
      </div>
    </div>
  );
}
