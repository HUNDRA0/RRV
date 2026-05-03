export function Hero() {
  return (
    <section className="hero" id="top">
      <div className="hero-inner container">
        <div className="hero-eyebrow reveal">
          <span className="live" />
          16 G's · Södertälje · {new Date().getFullYear()}
        </div>
        <h1 className="reveal" data-d="1">
          <span className="viber">Viber</span> Rankings
        </h1>
        <p className="hero-lede reveal" data-d="2">
          Eliten och resten, jobblistan och G by Girans official site
        </p>
        <div className="hero-meta reveal" data-d="3">
          <span><b>16</b> namn</span>
          <span><b>3</b> tiers</span>
          <span><b>1</b> karta</span>
          <span><b>∞</b> drama</span>
        </div>
        <button
          className="hero-cta reveal"
          data-d="4"
          onClick={() =>
            document.getElementById('rankings')?.scrollIntoView({ behavior: 'smooth' })
          }
        >
          Scrolla ner <span className="arrow">↓</span>
        </button>
      </div>
    </section>
  );
}
