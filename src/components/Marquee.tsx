// Marquee/ticker strip — runs continuously, pauses on hover. Two duplicate
// halves so the loop is seamless. Pure CSS animation (off main thread, doesn't
// block during loads), linear easing — Emil's "constant motion" rule.

interface Props {
  items: string[];
  /** Tone affects the strip's color/weight — gold for editorial header,
   *  teal/gmap-gold for page-specific accent strips. */
  tone?: 'gold' | 'moves' | 'gmap' | 'joblb';
}

export function Marquee({ items, tone = 'gold' }: Props) {
  // Repeat the items twice in the DOM so when the first half scrolls fully off
  // screen the second half is exactly in place — no visible seam.
  const slot = (key: string) => (
    <div className="marquee-track" key={key}>
      {items.map((item, i) => (
        <span className="marquee-item" key={i}>
          {item}
          <span className="marquee-dot" aria-hidden>✦</span>
        </span>
      ))}
    </div>
  );

  return (
    <div className={`marquee marquee-${tone}`} aria-hidden>
      <div className="marquee-inner">
        {slot('a')}
        {slot('b')}
      </div>
    </div>
  );
}
