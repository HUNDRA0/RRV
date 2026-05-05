import type { Friend } from '../../data/friends';

export interface LunchDebt {
  id: string;
  debtor: string;   // friend id — who owes
  creditor: string; // friend id — who is owed
  amount: number;
  note: string;
}

export interface LunchData {
  balances: Record<string, number>; // friend id → tickets held physically
  debts: LunchDebt[];
}

export const LUNCH_EMPTY: LunchData = { balances: {}, debts: [] };

export function parseLunchData(raw: string | undefined): LunchData {
  if (raw) {
    try {
      const p = JSON.parse(raw) as LunchData;
      if (p && typeof p === 'object') return { balances: p.balances ?? {}, debts: p.debts ?? [] };
    } catch { /* fall through */ }
  }
  return LUNCH_EMPTY;
}

interface LunchSectionProps {
  friends: Friend[];
  data: LunchData;
}

export function LunchSection({ friends, data }: LunchSectionProps) {
  const byId = Object.fromEntries(friends.map((f) => [f.id, f]));

  // Net per person: physical tickets + what others owe you - what you owe others
  const net: Record<string, number> = {};
  for (const f of friends) net[f.id] = data.balances[f.id] ?? 0;
  for (const d of data.debts) {
    net[d.creditor] = (net[d.creditor] ?? 0) + d.amount;
    net[d.debtor]   = (net[d.debtor]   ?? 0) - d.amount;
  }

  const hasAnyData =
    Object.values(data.balances).some((v) => v !== 0) || data.debts.length > 0;

  // Only show people who have something going on, but show all if admin added balances
  const relevantFriends = friends.filter(
    (f) => (data.balances[f.id] ?? 0) !== 0 || net[f.id] !== 0,
  );
  const displayFriends = relevantFriends.length > 0 ? relevantFriends : friends;

  return (
    <section className="section container" id="lunch" data-screen-label="VI Lunch Tickets">
      <header className="section-header">
        <div>
          <div className="section-eyebrow reveal">Section VI · Lunchtickets</div>
          <h2 className="reveal" data-d="1"><em>Lunch Tickets</em></h2>
          <p className="reveal" data-d="2">Vem har tickets, vem är skyldig vem.</p>
        </div>
        <div className="section-num reveal" data-d="3">VI</div>
      </header>

      {!hasAnyData && (
        <p className="card-meta" style={{ textAlign: 'center', marginTop: 32, marginBottom: 32 }}>
          Inga tickets inlagda ännu.
        </p>
      )}

      {hasAnyData && (
        <>
          <div className="lunch-grid">
            {displayFriends.map((f, i) => {
              const held = data.balances[f.id] ?? 0;
              const netVal = net[f.id] ?? 0;
              const photo = (f.photos || [])[0]?.url;
              return (
                <div key={f.id} className="lunch-card reveal" data-d={Math.min(i, 7)}>
                  <div className="lunch-avatar">
                    {photo
                      ? <img src={photo} alt={f.name} />
                      : <span>{f.name[0]}</span>}
                  </div>
                  <div className="lunch-name">{f.name.split(' ')[0]}</div>
                  <div
                    className="lunch-held"
                    title={`${held} ticket${held !== 1 ? 's' : ''} i plånboken`}
                  >
                    {held > 0 ? `🎟 ×${held}` : '—'}
                  </div>
                  {netVal !== 0 && (
                    <div
                      className="lunch-net"
                      data-pos={netVal > 0}
                      title={netVal > 0 ? 'Skyldig att få' : 'Skyldig att betala'}
                    >
                      {netVal > 0 ? `+${netVal} netto` : `${netVal} netto`}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {data.debts.length > 0 && (
            <div className="lunch-debts">
              <div className="section-eyebrow" style={{ marginBottom: 16 }}>Aktiva skulder</div>
              {data.debts.map((d) => {
                const debtor   = byId[d.debtor];
                const creditor = byId[d.creditor];
                if (!debtor || !creditor) return null;
                return (
                  <div key={d.id} className="lunch-debt-row">
                    <span className="lunch-debt-debtor">{debtor.name.split(' ')[0]}</span>
                    <span className="lunch-debt-owed">är skyldig</span>
                    <span className="lunch-debt-amount">🎟 ×{d.amount}</span>
                    <span className="lunch-debt-owed">till</span>
                    <span className="lunch-debt-creditor">{creditor.name.split(' ')[0]}</span>
                    {d.note && <span className="lunch-debt-note">· {d.note}</span>}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}
