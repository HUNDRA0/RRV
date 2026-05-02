import type { Friend } from '../../data/friends';
import { Editable } from './Editable';

interface MovesSectionProps {
  friends: Friend[];
  edit: boolean;
  onSetMove: (id: string, value: string) => void;
}

export function MovesSection({ friends, edit, onSetMove }: MovesSectionProps) {
  return (
    <section className="section container" id="moves" data-screen-label="04 Making Moves">
      <header className="section-header">
        <div>
          <div className="section-eyebrow reveal">Section IV · Vad händer just nu</div>
          <h2 className="reveal" data-d="1">Making <em>Moves</em></h2>
          <p className="reveal" data-d="2">
            Vem gör vad? Klicka på texten för att redigera. "To be continued" tills någon faktiskt gör nåt.
          </p>
        </div>
        <div className="section-num reveal" data-d="3">IV</div>
      </header>
      <div className="moves-grid">
        {friends.map((f, i) => {
          const text = f.currentMove || 'To be continued';
          const isActive = !!text && text !== 'To be continued';
          return (
            <div
              className="move reveal zoom"
              data-d={Math.min(i, 8)}
              key={f.id}
              data-active={isActive}
            >
              <div className="move-status">
                <span className="led" />
                {isActive ? 'Making moves' : 'Idle'}
              </div>
              <div className="move-name">{f.name}</div>
              <Editable
                className="move-text"
                value={text}
                onChange={(v) => onSetMove(f.id, v.trim() || 'To be continued')}
                edit={edit}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
