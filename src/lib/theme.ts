// Admin-controlled theme overrides — applied as CSS custom properties on
// :root so they cascade everywhere. Stored in `site_content` so the whole
// gang sees the same look (no per-user theming yet).
//
// Defaults match the values baked into index.css. The "Reset" button in
// the editor empties each key.
//
// New keys are additive: any override the admin hasn't touched falls
// back to the stylesheet default. Bad values are rejected at the apply
// boundary so the worst case is "this control did nothing".

export interface ThemeOverrides {
  // ── Base palette ────────────────────────────────────────────────
  accent?: string;        // primary purple
  accent2?: string;       // secondary purple-2 (for gradients/highlights)
  ink?: string;           // primary text color
  paper?: string;         // surface / card color
  bgColor?: string;       // body background color
  bgImageUrl?: string;    // optional bg image url
  bgImageOpacity?: string; // 0 .. 1

  // ── Typography ─────────────────────────────────────────────────
  fontScale?: string;      // 0.85 .. 1.25
  fontPreset?: FontPreset; // named display+body+mono combo

  // ── Geometry ───────────────────────────────────────────────────
  radius?: string;     // border-radius multiplier 0 .. 2
  spacing?: string;    // section padding multiplier 0.75 .. 1.5

  // ── Effects ────────────────────────────────────────────────────
  glassBlur?: string;    // nav/card backdrop-filter blur in px (0-30)
  glassOpacity?: string; // background opacity behind blur (0-1)
  shadowDepth?: string;  // 'none' | 'soft' | 'normal' | 'dramatic'
  motion?: string;       // 'full' | 'reduced' | 'off'
}

export type FontPreset =
  | 'editorial' // Fraunces + Inter + JetBrains Mono  (current default)
  | 'classic'   // Playfair Display + Source Sans + IBM Plex Mono
  | 'modern'    // Space Grotesk + Inter + JetBrains Mono
  | 'playful'   // Caveat + Quicksand + JetBrains Mono
  | 'newspaper' // Lora + Merriweather + Courier Prime
  | 'tech';     // Sora + Sora + JetBrains Mono

interface FontPresetConfig {
  label: string;
  // CSS font-family stacks
  display: string;
  body: string;
  mono: string;
  // Google Fonts URL fragment (family=...) to load — concatenated with the
  // base &display=swap. null means use the default link in index.html.
  google: string | null;
}

export const FONT_PRESETS: Record<FontPreset, FontPresetConfig> = {
  editorial: {
    label: 'Editorial (standard)',
    display: '"Fraunces", "Times New Roman", serif',
    body: '"Inter", system-ui, sans-serif',
    mono: '"JetBrains Mono", ui-monospace, monospace',
    google: null,
  },
  classic: {
    label: 'Klassiskt',
    display: '"Playfair Display", "Times New Roman", serif',
    body: '"Source Sans 3", system-ui, sans-serif',
    mono: '"IBM Plex Mono", ui-monospace, monospace',
    google: 'family=Playfair+Display:wght@400;500;600;700&family=Source+Sans+3:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500',
  },
  modern: {
    label: 'Modernt',
    display: '"Space Grotesk", system-ui, sans-serif',
    body: '"Inter", system-ui, sans-serif',
    mono: '"JetBrains Mono", ui-monospace, monospace',
    google: 'family=Space+Grotesk:wght@400;500;600;700',
  },
  playful: {
    label: 'Lekfullt',
    display: '"Caveat", cursive',
    body: '"Quicksand", system-ui, sans-serif',
    mono: '"JetBrains Mono", ui-monospace, monospace',
    google: 'family=Caveat:wght@500;700&family=Quicksand:wght@400;500;600',
  },
  newspaper: {
    label: 'Tidning',
    display: '"Lora", "Times New Roman", serif',
    body: '"Merriweather", "Times New Roman", serif',
    mono: '"Courier Prime", "Courier New", monospace',
    google: 'family=Lora:wght@400;500;600;700&family=Merriweather:wght@400;700&family=Courier+Prime',
  },
  tech: {
    label: 'Tech',
    display: '"Sora", system-ui, sans-serif',
    body: '"Sora", system-ui, sans-serif',
    mono: '"JetBrains Mono", ui-monospace, monospace',
    google: 'family=Sora:wght@400;500;600;700',
  },
};

// The keys we touch in site_content. All under `theme_` so it's clear
// in the DB which entries belong to the editor.
export const THEME_KEYS = {
  accent: 'theme_accent',
  accent2: 'theme_accent2',
  ink: 'theme_ink',
  paper: 'theme_paper',
  bgColor: 'theme_bg_color',
  bgImageUrl: 'theme_bg_image_url',
  bgImageOpacity: 'theme_bg_image_opacity',
  fontScale: 'theme_font_scale',
  fontPreset: 'theme_font_preset',
  radius: 'theme_radius',
  spacing: 'theme_spacing',
  glassBlur: 'theme_glass_blur',
  glassOpacity: 'theme_glass_opacity',
  shadowDepth: 'theme_shadow_depth',
  motion: 'theme_motion',
} as const;

export function readThemeFromContent(content: Record<string, string>): ThemeOverrides {
  return {
    accent: content[THEME_KEYS.accent] || undefined,
    accent2: content[THEME_KEYS.accent2] || undefined,
    ink: content[THEME_KEYS.ink] || undefined,
    paper: content[THEME_KEYS.paper] || undefined,
    bgColor: content[THEME_KEYS.bgColor] || undefined,
    bgImageUrl: content[THEME_KEYS.bgImageUrl] || undefined,
    bgImageOpacity: content[THEME_KEYS.bgImageOpacity] || undefined,
    fontScale: content[THEME_KEYS.fontScale] || undefined,
    fontPreset: (content[THEME_KEYS.fontPreset] as FontPreset) || undefined,
    radius: content[THEME_KEYS.radius] || undefined,
    spacing: content[THEME_KEYS.spacing] || undefined,
    glassBlur: content[THEME_KEYS.glassBlur] || undefined,
    glassOpacity: content[THEME_KEYS.glassOpacity] || undefined,
    shadowDepth: content[THEME_KEYS.shadowDepth] || undefined,
    motion: content[THEME_KEYS.motion] || undefined,
  };
}

// Apply overrides as CSS custom properties on :root. Pass undefined to
// unset (back to stylesheet default).
export function applyTheme(t: ThemeOverrides) {
  const root = document.documentElement;
  const set = (name: string, value: string | undefined) => {
    if (value && value.length > 0) root.style.setProperty(name, value);
    else root.style.removeProperty(name);
  };

  // Palette
  set('--purple', t.accent);
  set('--purple-2', t.accent2);
  set('--ink', t.ink);
  set('--paper', t.paper);
  if (t.paper) set('--paper-rgb', hexToRgbString(t.paper) ?? '');
  set('--bg', t.bgColor);

  // Typography — preset selects the actual font-family bundles, scale
  // adjusts size.
  set('--font-scale', t.fontScale);
  if (t.fontPreset && FONT_PRESETS[t.fontPreset]) {
    const preset = FONT_PRESETS[t.fontPreset];
    set('--font-display', preset.display);
    set('--font-body', preset.body);
    set('--font-mono', preset.mono);
    if (preset.google) ensureGoogleFontLoaded(t.fontPreset, preset.google);
  } else {
    set('--font-display', undefined);
    set('--font-body', undefined);
    set('--font-mono', undefined);
  }

  // Geometry
  set('--radius-scale', t.radius);
  set('--spacing-scale', t.spacing);

  // Glass effect (navbar + cards). The actual CSS already references
  // these vars — see index.css.
  set('--glass-blur', t.glassBlur ? `${t.glassBlur}px` : undefined);
  set('--glass-opacity', t.glassOpacity);

  // Shadow depth — a named scale. CSS reads this via the data attribute.
  if (t.shadowDepth) {
    root.dataset.themeShadow = t.shadowDepth;
  } else {
    delete root.dataset.themeShadow;
  }

  // Motion toggle: if 'off', force a CSS variable that disables transitions.
  // 'reduced' just suppresses transforms/scale, matching prefers-reduced-motion.
  if (t.motion === 'off') {
    root.dataset.motion = 'off';
  } else if (t.motion === 'reduced') {
    root.dataset.motion = 'reduced';
  } else {
    delete root.dataset.motion;
  }

  // Background image (with safe URL check)
  if (t.bgImageUrl && safeUrl(t.bgImageUrl)) {
    set('--bg-image', `url("${cssEscape(t.bgImageUrl)}")`);
    set('--bg-image-opacity', t.bgImageOpacity ?? '0.5');
  } else {
    set('--bg-image', undefined);
    set('--bg-image-opacity', undefined);
  }
}

// Dynamically inject a <link> for a Google Fonts preset once per session.
const loadedFontPresets = new Set<string>();
function ensureGoogleFontLoaded(preset: FontPreset, googleQuery: string) {
  if (loadedFontPresets.has(preset)) return;
  loadedFontPresets.add(preset);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?${googleQuery}&display=swap`;
  link.dataset.themeFont = preset;
  document.head.appendChild(link);
}

// Convert "#a1b2c3" → "161,178,195" for use in rgba() literals.
function hexToRgbString(hex: string): string | null {
  const m = /^#?([a-fA-F0-9]{6})$/.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return `${(n >> 16) & 0xff},${(n >> 8) & 0xff},${n & 0xff}`;
}

function safeUrl(v: string): boolean {
  try {
    const u = new URL(v);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

function cssEscape(v: string): string {
  return v.replace(/["\\\n\r]/g, '');
}
