export type TierId = string;

export interface TierConfig {
  id: string;
  letter: string;
  label: string;
  sublabel: string;
  color?: string;  // optional custom CSS color for the tier letter
}

export const DEFAULT_TIERS: TierConfig[] = [
  { id: 's', letter: 'S', label: 'Eliten',             sublabel: 'S-tier — toppskiktet' },
  { id: 'a', letter: 'A', label: 'Normal people tier', sublabel: 'A-tier — solid stock' },
  { id: 'i', letter: '?', label: 'I dunno',            sublabel: 'Vi får se vart det landar' },
];

export function parseTierConfig(raw: string | undefined): TierConfig[] {
  if (!raw) return DEFAULT_TIERS;
  try {
    const p = JSON.parse(raw) as TierConfig[];
    if (Array.isArray(p) && p.length > 0) return p;
  } catch { /* fall through */ }
  return DEFAULT_TIERS;
}

export function getTierCss(id: string): 'eliten' | 'normal' | 'idunno' {
  if (id === 's') return 'eliten';
  if (id === 'a') return 'normal';
  return 'idunno';
}

export function findTier(config: TierConfig[], id: string): TierConfig {
  return config.find((t) => t.id === id) ?? { id, letter: id.toUpperCase(), label: id, sublabel: '' };
}

// Legacy aliases kept to avoid breaking other imports — remove after full migration
export const TIER_CSS = { s: 'eliten' as const, a: 'normal' as const, i: 'idunno' as const };
export const TIER_DISPLAY = {
  s: { letter: 'S', label: 'Eliten',             sublabel: 'S-tier — toppskiktet' },
  a: { letter: 'A', label: 'Normal people tier', sublabel: 'A-tier — solid stock' },
  i: { letter: '?', label: 'I dunno',            sublabel: 'Vi får se vart det landar' },
};
export const TIER_ORDER_VIBER: string[] = ['s', 'a', 'i'];
// Legacy parseTierDisplay kept for any code still importing it
export function parseTierDisplay(_raw: string | undefined) { return TIER_DISPLAY; }
export interface TierDisplay { letter: string; label: string; sublabel: string; }
export function buildTierDisplay(_c: unknown) { return TIER_DISPLAY; }
