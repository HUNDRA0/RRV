interface EventItem {
  id: string;
  date: string;        // ISO yyyy-mm-dd
  title: string;
  host: string;
  preliminary?: boolean;
}

const EVENTS: EventItem[] = [
  { id: 'midsommar', date: '2026-06-19', title: 'Midsommar',          host: 'Hos Mario',  preliminary: true },
  { id: 'andre',     date: '2026-08-01', title: 'Andres bröllop',     host: 'Save the date' },
  { id: 'joseph',    date: '2026-08-14', title: 'Josephs förlovning', host: 'Save the date' },
];

const MONTH_SV = ['jan','feb','mar','apr','maj','jun','jul','aug','sep','okt','nov','dec'];
const WEEKDAY_SV = ['sön','mån','tis','ons','tors','fre','lör'];

function fmtDay(iso: string) {
  const d = new Date(iso);
  return String(d.getDate());
}
function fmtMonth(iso: string) {
  const d = new Date(iso);
  return MONTH_SV[d.getMonth()];
}
function fmtWeekday(iso: string) {
  const d = new Date(iso);
  return WEEKDAY_SV[d.getDay()];
}
function daysUntil(iso: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(iso);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}
function countdownLabel(iso: string) {
  const n = daysUntil(iso);
  if (n < 0) return 'Avklarat';
  if (n === 0) return 'Idag';
  if (n === 1) return 'Imorgon';
  if (n < 30) return `${n} dagar`;
  const months = Math.round(n / 30);
  return `${months} mån`;
}

export function EventsSection() {
  return (
    <section className="section container" id="events" data-screen-label="05 Events">
      <header className="section-header">
        <div>
          <div className="section-eyebrow reveal">Section V · Save the date</div>
          <h2 className="reveal" data-d="1"><em>Events</em></h2>
          <p className="reveal" data-d="2">
            Vad som händer i kalendern. Dyk upp eller bli utfryst.
          </p>
        </div>
        <div className="section-num reveal" data-d="3">V</div>
      </header>

      <div className="events-list">
        {EVENTS.map((e, i) => (
          <article
            key={e.id}
            className="event reveal"
            data-d={Math.min(i + 1, 8)}
            data-preliminary={e.preliminary}
          >
            <div className="event-date">
              <div className="event-day">{fmtDay(e.date)}</div>
              <div className="event-month">{fmtMonth(e.date)}</div>
              <div className="event-weekday">{fmtWeekday(e.date)}</div>
            </div>
            <div className="event-info">
              <div className="event-eyebrow">
                {e.preliminary ? 'Preliminärt' : 'Save the date'}
              </div>
              <h3 className="event-title">{e.title}</h3>
              <div className="event-meta">{e.host}</div>
            </div>
            <div className="event-countdown">
              <div className="event-countdown-num">{countdownLabel(e.date)}</div>
              <div className="event-countdown-label">till dess</div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
