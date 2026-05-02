import { useMemo } from 'react';
import type { Friend } from '../../data/friends';
import { TIER_CSS, TIER_DISPLAY } from './tier-map';

interface GMapSectionProps {
  friends: Friend[];
}

function haversine(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function formatDistance(km: number) {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

interface PairInfo { a: string; b: string; km: number }

function pairFriends(friends: Array<Friend & { lat: number; lon: number }>) {
  const used = new Set<string>();
  const pairs: PairInfo[] = [];
  const sorted = friends
    .map((f) => {
      let best: { id: string; km: number } | null = null;
      for (const g of friends) {
        if (g.id === f.id) continue;
        const d = haversine(f, g);
        if (!best || d < best.km) best = { id: g.id, km: d };
      }
      return { id: f.id, nearest: best };
    })
    .sort((a, b) => (a.nearest?.km ?? Infinity) - (b.nearest?.km ?? Infinity));
  for (const item of sorted) {
    if (used.has(item.id) || !item.nearest || used.has(item.nearest.id)) continue;
    used.add(item.id);
    used.add(item.nearest.id);
    pairs.push({ a: item.id, b: item.nearest.id, km: item.nearest.km });
  }
  return { pairs, lonely: friends.filter((f) => !used.has(f.id)).map((f) => f.id) };
}

export function GMapSection({ friends }: GMapSectionProps) {
  const geo = friends.filter(
    (f): f is Friend & { lat: number; lon: number } => f.lat != null && f.lon != null,
  );

  const result = useMemo(() => pairFriends(geo), [geo]);
  const byId = useMemo(() => Object.fromEntries(geo.map((f) => [f.id, f])), [geo]);

  const bounds = useMemo(() => {
    if (!geo.length) return { minLat: 0, maxLat: 1, minLon: 0, maxLon: 1 };
    const lats = geo.map((f) => f.lat);
    const lons = geo.map((f) => f.lon);
    const pad = 0.012;
    return {
      minLat: Math.min(...lats) - pad,
      maxLat: Math.max(...lats) + pad,
      minLon: Math.min(...lons) - pad,
      maxLon: Math.max(...lons) + pad,
    };
  }, [geo]);

  const project = (f: { lat: number; lon: number }) => ({
    x: ((f.lon - bounds.minLon) / (bounds.maxLon - bounds.minLon)) * 100,
    y: (1 - (f.lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * 100,
  });

  return (
    <section className="section container" id="gmap" data-screen-label="03 G Map">
      <header className="section-header">
        <div>
          <div className="section-eyebrow reveal">Section III · Neighbour status</div>
          <h2 className="reveal" data-d="1">G <em>Map</em></h2>
          <p className="reveal" data-d="2">
            Vem bor närmast vem? Greedy-parade per närmaste granne. Distans i fågelvägen.
          </p>
        </div>
        <div className="section-num reveal" data-d="3">III</div>
      </header>

      <div className="gmap-canvas reveal zoom" data-d="2">
        <div className="gmap-grid" />
        <svg viewBox="0 0 100 100" preserveAspectRatio="none">
          {result.pairs.map((p, i) => {
            const a = project(byId[p.a]);
            const b = project(byId[p.b]);
            return (
              <line
                key={i}
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke="rgba(139, 92, 246, 0.55)"
                strokeWidth="0.3"
                strokeDasharray="0.6 0.6"
                vectorEffect="non-scaling-stroke"
              >
                <animate attributeName="stroke-dashoffset" from="0" to="-1.2" dur="3s" repeatCount="indefinite" />
              </line>
            );
          })}
        </svg>
        {geo.map((f, i) => {
          const p = project(f);
          return (
            <div
              key={f.id}
              className="gmap-pin"
              data-tier={TIER_CSS[f.tier]}
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                animation: `pinIn 600ms var(--ease-spring) ${i * 60}ms both`,
              }}
            >
              <div className="dot" />
              <div className="label">{f.name}</div>
            </div>
          );
        })}
        <div className="gmap-compass">
          <div>N ↑</div>
          <div>Södertälje · Rönninge</div>
        </div>
        <div className="gmap-legend">
          <span><span className="swatch gold" />Eliten</span>
          <span><span className="swatch purple" />Normal</span>
          <span><span className="swatch mute" />I dunno</span>
        </div>
      </div>

      <div className="pairs-grid">
        {[...result.pairs].sort((a, b) => a.km - b.km).map((p, i) => {
          const a = byId[p.a];
          const b = byId[p.b];
          return (
            <div className="pair reveal" data-d={Math.min(i, 8)} key={i}>
              <div className="pair-side">
                <div className="pair-tier">{TIER_DISPLAY[a.tier].label}</div>
                <div className="pair-name">{a.name}</div>
              </div>
              <div className="pair-link">
                <div className="line" />
                <div className="dist">{formatDistance(p.km)}</div>
                <div className="line" />
              </div>
              <div className="pair-side" data-align="right">
                <div className="pair-tier">{TIER_DISPLAY[b.tier].label}</div>
                <div className="pair-name">{b.name}</div>
              </div>
            </div>
          );
        })}
      </div>

      {result.lonely.length > 0 && (
        <div className="lonely-list reveal" data-d="6">
          <span className="pair-tier">G-less:</span>
          {result.lonely.map((id) => (
            <span className="lonely-tag" key={id}>{byId[id].name}</span>
          ))}
        </div>
      )}

      <style>{`@keyframes pinIn { from { opacity: 0; transform: translate(-50%, -50%) scale(0.4); } to { opacity: 1; transform: translate(-50%, -50%) scale(1); } }`}</style>
    </section>
  );
}
