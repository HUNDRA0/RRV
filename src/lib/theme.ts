// Admin-controlled theme overrides — applied as CSS custom properties on
// :root so they cascade everywhere. Stored in `site_content` so the whole
// gang sees the same look (no per-user theming yet).
//
// Defaults match the values baked into index.css. The "Reset" button in the
// editor just empties each key.

export interface ThemeOverrides {
  accent?: string;       // primary purple hex
  fontScale?: string;    // 0.85 .. 1.25
  radius?: string;       // 0 .. 32 px
  bgColor?: string;      // body bg color
  bgImageUrl?: string;   // optional bg image url
  bgImageOpacity?: string; // 0 .. 1
}

// The keys we touch in site_content. Keeping them all under a `theme_`
// prefix so it's clear in the DB which entries belong to the editor.
export const THEME_KEYS = {
  accent: 'theme_accent',
  fontScale: 'theme_font_scale',
  radius: 'theme_radius',
  bgColor: 'theme_bg_color',
  bgImageUrl: 'theme_bg_image_url',
  bgImageOpacity: 'theme_bg_image_opacity',
} as const;

export function readThemeFromContent(content: Record<string, string>): ThemeOverrides {
  return {
    accent: content[THEME_KEYS.accent] || undefined,
    fontScale: content[THEME_KEYS.fontScale] || undefined,
    radius: content[THEME_KEYS.radius] || undefined,
    bgColor: content[THEME_KEYS.bgColor] || undefined,
    bgImageUrl: content[THEME_KEYS.bgImageUrl] || undefined,
    bgImageOpacity: content[THEME_KEYS.bgImageOpacity] || undefined,
  };
}

// Apply overrides as CSS custom properties on :root.
// Pass undefined for any field to "unset" it (back to stylesheet default).
export function applyTheme(t: ThemeOverrides) {
  const root = document.documentElement;
  const set = (name: string, value: string | undefined) => {
    if (value && value.length > 0) root.style.setProperty(name, value);
    else root.style.removeProperty(name);
  };
  set('--purple', t.accent);
  // For derivatives (purple-2, purple-3, purple-soft) we leave them alone —
  // the base purple is what most surfaces use.
  set('--font-scale', t.fontScale);
  set('--radius-scale', t.radius);
  set('--bg', t.bgColor);

  if (t.bgImageUrl && safeUrl(t.bgImageUrl)) {
    set('--bg-image', `url("${cssEscape(t.bgImageUrl)}")`);
    set('--bg-image-opacity', t.bgImageOpacity ?? '0.5');
  } else {
    set('--bg-image', undefined);
    set('--bg-image-opacity', undefined);
  }
}

// Reject anything that isn't a real http(s) URL — defense in depth so a
// malformed value can't break out of the `url("...")` CSS literal.
function safeUrl(v: string): boolean {
  try {
    const u = new URL(v);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

function cssEscape(v: string): string {
  // Strip control chars and quotes to keep us inside the url() literal.
  return v.replace(/["\\\n\r]/g, '');
}
