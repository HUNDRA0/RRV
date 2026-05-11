interface RulesModalProps {
  onClose: () => void;
}

export function RulesModal({ onClose }: RulesModalProps) {
  return (
    <div className="catan-modal-overlay" onClick={onClose}>
      <div
        className="catan-modal"
        onClick={e => e.stopPropagation()}
        style={{ maxHeight: '85vh', overflowY: 'auto', maxWidth: 560 }}
      >
        <div className="catan-modal-header">
          <h2 className="catan-modal-title">📖 Regler – Catan</h2>
          <button className="catan-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="catan-rules-body">

          <section className="catan-rules-section">
            <h3>🏆 Mål</h3>
            <p>Först till <strong>10 segerpoäng</strong> vinner.</p>
          </section>

          <section className="catan-rules-section">
            <h3>🗺️ Setup – placeringsfasen</h3>
            <p>
              Spelarna placerar bosättningar och vägar i ormbordets ordning:
              spelarna placerar i tur (1→2→3→4) och sedan baklänges (4→3→2→1).
              Den andra bosättningen ger resurser från angränsande hexar.
            </p>
          </section>

          <section className="catan-rules-section">
            <h3>🎲 Din tur</h3>
            <ol>
              <li>Slå tärningar (valfritt: spela Riddare <em>innan</em>)</li>
              <li>Resurser delas ut baserat på siffran</li>
              <li>Bygg, köp och handla hur mycket du vill</li>
              <li>Avsluta din tur</li>
            </ol>
          </section>

          <section className="catan-rules-section">
            <h3>🌲 Resurser</h3>
            <ul className="catan-rules-resources">
              <li>🌲 <strong>Virke</strong> – skog</li>
              <li>🧱 <strong>Tegel</strong> – lerhögar</li>
              <li>🐑 <strong>Får (Ull)</strong> – betesmark</li>
              <li>🌾 <strong>Vete</strong> – åkrar</li>
              <li>⛏️ <strong>Malm</strong> – berg</li>
            </ul>
          </section>

          <section className="catan-rules-section">
            <h3>🔨 Bygg</h3>
            <table className="catan-rules-table">
              <tbody>
                <tr>
                  <td>🏠 <strong>Bosättning</strong></td>
                  <td>🌲 + 🧱 + 🐑 + 🌾</td>
                  <td>= <strong>1p</strong></td>
                </tr>
                <tr>
                  <td>🏙️ <strong>Stad</strong> <em>(uppgradering)</em></td>
                  <td>🌾🌾 + ⛏️⛏️⛏️</td>
                  <td>= <strong>2p</strong></td>
                </tr>
                <tr>
                  <td>🛤️ <strong>Väg</strong></td>
                  <td>🌲 + 🧱</td>
                  <td>= <strong>0p</strong></td>
                </tr>
                <tr>
                  <td>🂠 <strong>Utvecklingskort</strong></td>
                  <td>🐑 + 🌾 + ⛏️</td>
                  <td>= varierar</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="catan-rules-section">
            <h3>🦹 Rövaren (vid 7:a)</h3>
            <p>
              Slår du (eller någon annan) <strong>7</strong>: spelare med fler än 7 resurskort
              måste kasta hälften (avrundat nedåt). Sedan <strong>flyttar du rövaren</strong> till
              en ny hex och <strong>stjäl 1 kort</strong> från en spelare med bosättning/stad där.
              Hexen blockeras – den ger inga resurser medan rövaren står där.
            </p>
          </section>

          <section className="catan-rules-section">
            <h3>⚓ Hamnar</h3>
            <ul>
              <li><strong>3:1</strong> – ge 3 av <em>valfri</em> resurs, få 1 valfri tillbaka</li>
              <li><strong>2:1</strong> – ge 2 av den <em>specifika</em> resursen, få 1 valfri tillbaka</li>
            </ul>
            <p className="catan-muted" style={{ fontSize: 13 }}>
              Du måste ha en bosättning eller stad vid hamnens hörnpunkter.
            </p>
          </section>

          <section className="catan-rules-section">
            <h3>🔄 Handelserbjudanden</h3>
            <p>
              Under din tur kan du erbjuda andra spelare en affär. De väljer att
              <strong> acceptera</strong> eller <strong>avvisa</strong>. Du väljer sedan
              vem du byter med.
            </p>
          </section>

          <section className="catan-rules-section">
            <h3>🂠 Utvecklingskort</h3>
            <ul>
              <li>⚔️ <strong>Riddare</strong> – flytta rövaren och stjäl ett kort</li>
              <li>🛤️ <strong>Vägbygge</strong> – placera 2 vägar gratis</li>
              <li>🎁 <strong>Överflödets år</strong> – ta 2 valfria resurser från banken</li>
              <li>💰 <strong>Monopol</strong> – ta <em>alla</em> kort av en vald resurs från övriga spelare</li>
              <li>⭐ <strong>Segerpoäng</strong> – ger +1p direkt (räknas när du vinner)</li>
            </ul>
            <p className="catan-muted" style={{ fontSize: 13 }}>
              Riddare kan spelas <em>innan</em> tärningskastet. Övriga kort bara <em>efter</em>.
              Bara ett kort per tur.
            </p>
          </section>

          <section className="catan-rules-section">
            <h3>🎖️ Bonuspoäng</h3>
            <ul>
              <li>
                🏆 <strong>Längsta vägen</strong> – sammanhängande väg med minst 5 segment: <strong>+2p</strong>.
                Tas av den som bygger längst.
              </li>
              <li>
                🏆 <strong>Största armén</strong> – minst 3 spelade riddare: <strong>+2p</strong>.
                Tas av den med flest spelade riddare.
              </li>
            </ul>
          </section>

        </div>
      </div>
    </div>
  );
}
