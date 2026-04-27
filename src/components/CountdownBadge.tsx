import { useEffect, useState } from 'react';

const TARGET = new Date('2027-12-31T23:59:59').getTime();
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function format(now: number): string {
  const diff = TARGET - now;
  if (diff <= 0) return '🔓 Resultat släppta!';
  const days = Math.floor(diff / DAY);
  const hours = Math.floor((diff % DAY) / HOUR);
  return `⏳ ${days} dagar, ${hours}h kvar — 31 dec 2027`;
}

export function CountdownBadge() {
  const [text, setText] = useState(() => format(Date.now()));

  useEffect(() => {
    const id = setInterval(() => setText(format(Date.now())), 60_000);
    return () => clearInterval(id);
  }, []);

  return <div className="moves-countdown">{text}</div>;
}
