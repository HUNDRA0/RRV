// Renders a friend's socials as a row of colored circular chips with
// platform icons. Tap → open native app if installed (mobile) and fall
// back to the web URL after 600ms if the app didn't take over.

import { PLATFORMS, buildPrimaryUrl, buildWebUrl, isMobile, type SocialEntry } from '../../lib/socials';

interface SocialChipsProps {
  socials: SocialEntry[];
  size?: 'sm' | 'md';
}

export function SocialChips({ socials, size = 'md' }: SocialChipsProps) {
  if (!socials || socials.length === 0) return null;
  return (
    <div className={`social-chips${size === 'sm' ? ' social-chips-sm' : ''}`}>
      {socials.map((s) => {
        const meta = PLATFORMS[s.platform];
        if (!meta) return null;
        return (
          <a
            key={s.platform}
            className="social-chip"
            href={buildPrimaryUrl(s.platform, s.handle)}
            onClick={(e) => {
              // On mobile, try the deep link. If nothing happens after 600ms,
              // assume the app isn't installed and open the web fallback.
              if (!isMobile() || !meta.app) return;
              const fallback = buildWebUrl(s.platform, s.handle);
              const t = setTimeout(() => { window.location.href = fallback; }, 600);
              // If the page is hidden (app opened) cancel the fallback.
              const onVis = () => { if (document.hidden) clearTimeout(t); };
              document.addEventListener('visibilitychange', onVis, { once: true });
              // Don't prevent the default — let the deep link fire too.
              void e;
            }}
            target={isMobile() && meta.app ? undefined : '_blank'}
            rel="noopener noreferrer"
            style={{ background: meta.color }}
            title={`${meta.label} · ${s.handle}`}
            aria-label={`${meta.label}: ${s.handle}`}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d={meta.iconPath} />
            </svg>
          </a>
        );
      })}
    </div>
  );
}
