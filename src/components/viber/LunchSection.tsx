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

function Avatar({ friend }: { friend: Friend }) {
  const photo = (friend.photos || [])[0]?.url;
  return (
    <div className="lunch-avatar">
      {photo ? <img src={photo} alt={friend.name} /> : <span>{friend.name[0]}</span>}
    </div>
  );
}

interface LunchSectionProps {
  friends: Friend[];
  data: LunchData;
}

export function LunchSection({ friends, data }: LunchSectionProps) {
  const byId = Object.fromEntries(friends.map((f) => [f.id, f]));

  // Net per person: physical tickets + credits - debts
  const net: Record<string, number> = {};
  for (const f of friends) net[f.id] = data.balances[f.id] ?? 0;
  for (const d of data.debts) {
    net[d.creditor] = (net[d.creditor] ?? 0) + d.amount;
    net[d.debtor]   = (net[d.debtor]   ?? 0) - d.amount;
  }

  const hasAnyData =
    Object.values(data.balances).some((v) => v !== 0) || data.debts.length > 0;

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
          {/* Per-person ticket count cards */}
          <div className="lunch-grid">
            {displayFriends.map((f, i) => {
              const held = data.balances[f.id] ?? 0;
              const netVal = net[f.id] ?? 0;
              return (
                <div key={f.id} className="lunch-card reveal" data-d={Math.min(i, 7)}>
                  <Avatar friend={f} />
                  <div className="lunch-name">{f.name.split(' ')[0]}</div>
                  <div className="lunch-held">
                    {held > 0 ? `🎟 ×${held}` : '—'}
                  </div>
                  {netVal > 0 && (
                    <div className="lunch-net" data-pos="true">+{netVal} luncher</div>
                  )}
                  {netVal < 0 && (
                    <div className="lunch-sad" title={`Skyldig ${Math.abs(netVal)} lunch${Math.abs(netVal) !== 1 ? 'er' : ''}`}>😔</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Arrow-style debt rows */}
          {data.debts.length > 0 && (
            <div className="lunch-debts">
              <div className="section-eyebrow" style={{ marginBottom: 20 }}>Aktiva skulder</div>
              <div className="lunch-arrows">
                {data.debts.map((d, i) => {
                  const debtor   = byId[d.debtor];
                  const creditor = byId[d.creditor];
                  if (!debtor || !creditor) return null;
                  return (
                    <div key={d.id} className="lunch-arrow-row reveal" data-d={Math.min(i, 5)}>
                      {/* Who owes */}
                      <div className="lunch-arrow-person lunch-arrow-debtor">
                        <Avatar friend={debtor} />
                        <span className="lunch-arrow-name">{debtor.name.split(' ')[0]}</span>
                      </div>

                      {/* Arrow + amount */}
                      <div className="lunch-arrow-mid">
                        <div className="lunch-arrow-amount">🎟 ×{d.amount}</div>
                        <div className="lunch-arrow-line">
                          <div className="lunch-arrow-track" />
                          <div className="lunch-arrow-head">›</div>
                        </div>
                        {d.note && <div className="lunch-arrow-note">{d.note}</div>}
                      </div>

                      {/* Who receives */}
                      <div className="lunch-arrow-person lunch-arrow-creditor">
                        <Avatar friend={creditor} />
                        <span className="lunch-arrow-name">{creditor.name.split(' ')[0]}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
