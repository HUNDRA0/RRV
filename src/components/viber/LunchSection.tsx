import type { Friend } from '../../data/friends';

// One creditor entry inside a multi-creditor debt.
// Example: Mario flyttade och fick hjälp av Jacob (1) och Adam (1) →
// debt.creditors === [{ creditor: 'jacob', amount: 1 }, { creditor: 'adam', amount: 1 }]
export interface DebtCreditor {
  creditor: string;
  amount: number;
}

export interface LunchDebt {
  id: string;
  debtor: string;            // friend id — who owes
  creditors: DebtCreditor[]; // one or more people they owe
  note: string;
}

// Old single-creditor shape kept around for the parser to migrate.
interface LegacyLunchDebt {
  id: string;
  debtor: string;
  creditor: string;
  amount: number;
  note: string;
}

export interface LunchData {
  balances: Record<string, number>; // friend id → tickets held physically
  debts: LunchDebt[];
}

export const LUNCH_EMPTY: LunchData = { balances: {}, debts: [] };

export function parseLunchData(raw: string | undefined): LunchData {
  if (!raw) return LUNCH_EMPTY;
  try {
    const p = JSON.parse(raw) as { balances?: Record<string, number>; debts?: unknown[] };
    if (!p || typeof p !== 'object') return LUNCH_EMPTY;
    const balances = p.balances ?? {};
    // Migrate each debt: if it has the old single-creditor shape, wrap it.
    const debts: LunchDebt[] = (p.debts ?? []).map((raw) => {
      const d = raw as LunchDebt & LegacyLunchDebt;
      if (Array.isArray(d.creditors)) {
        return {
          id: d.id,
          debtor: d.debtor,
          creditors: d.creditors.map((c) => ({
            creditor: c.creditor,
            amount: Math.max(1, Number(c.amount) || 1),
          })),
          note: d.note ?? '',
        };
      }
      // Legacy: { creditor, amount } → wrap in creditors[].
      return {
        id: d.id,
        debtor: d.debtor,
        creditors: [{ creditor: d.creditor, amount: Math.max(1, Number(d.amount) || 1) }],
        note: d.note ?? '',
      };
    });
    return { balances, debts };
  } catch {
    return LUNCH_EMPTY;
  }
}

function Avatar({ friend }: { friend: Friend }) {
  const photo = (friend.photos || [])[0]?.url;
  return (
    <div className="lunch-avatar">
      {photo ? <img src={photo} alt={friend.name} loading="lazy" decoding="async" /> : <span>{friend.name[0]}</span>}
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
    for (const c of d.creditors) {
      net[c.creditor] = (net[c.creditor] ?? 0) + c.amount;
      net[d.debtor]   = (net[d.debtor]   ?? 0) - c.amount;
    }
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
                  {/* Negative-net smiley removed on purpose — having physical
                      tickets while still owing somebody is a normal state,
                      and the 😔 made it look like the person was unhappy. */}
                </div>
              );
            })}
          </div>

          {/* Arrow-style debt rows.
              One LunchDebt = one event = one row. Multi-creditor debts show
              all recipients side-by-side on the right so it's visually clear
              that Mario is owing both Adam AND Jacob from the same occasion. */}
          {data.debts.length > 0 && (
            <div className="lunch-debts">
              <div className="section-eyebrow" style={{ marginBottom: 20 }}>Aktiva skulder</div>
              <div className="lunch-arrows">
                {data.debts.map((d, dIdx) => {
                  const debtor = byId[d.debtor];
                  if (!debtor) return null;
                  const validCreditors = d.creditors
                    .map(c => ({ ...c, friend: byId[c.creditor] }))
                    .filter(c => c.friend);
                  if (validCreditors.length === 0) return null;

                  // If every creditor gets the same amount, show one label
                  // (e.g. "🎟 ×1 var"). Otherwise list amounts per person.
                  const amounts = validCreditors.map(c => c.amount);
                  const allSame = amounts.every(a => a === amounts[0]);
                  const amountLabel = allSame
                    ? `🎟 ×${amounts[0]}${validCreditors.length > 1 ? ' var' : ''}`
                    : `🎟 ${validCreditors.map(c => `×${c.amount} ${c.friend!.name.split(' ')[0]}`).join(', ')}`;

                  return (
                    <div
                      key={d.id}
                      className="lunch-arrow-row reveal"
                      data-d={Math.min(dIdx, 5)}
                      data-multi={validCreditors.length > 1 ? 'true' : 'false'}
                    >
                      <div className="lunch-arrow-person lunch-arrow-debtor">
                        <Avatar friend={debtor} />
                        <span className="lunch-arrow-name">{debtor.name.split(' ')[0]}</span>
                      </div>
                      <div className="lunch-arrow-mid">
                        <div className="lunch-arrow-amount">{amountLabel}</div>
                        <div className="lunch-arrow-line">
                          <div className="lunch-arrow-track" />
                          <div className="lunch-arrow-head">›</div>
                        </div>
                        {d.note && <div className="lunch-arrow-note">{d.note}</div>}
                      </div>
                      <div className="lunch-arrow-creditors">
                        {validCreditors.map((c) => (
                          <div className="lunch-arrow-person lunch-arrow-creditor" key={c.creditor}>
                            <Avatar friend={c.friend!} />
                            <span className="lunch-arrow-name">{c.friend!.name.split(' ')[0]}</span>
                            {!allSame && <span className="lunch-creditor-share">×{c.amount}</span>}
                          </div>
                        ))}
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
