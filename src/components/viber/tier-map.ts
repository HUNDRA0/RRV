import type { TierId } from '../../data/friends';

// Viber prototype CSS uses `data-tier="eliten|normal|idunno"`. Map our backend
// tier ids (`s|a|i`) to those keys at the component boundary so the ported
// stylesheet stays untouched.
export const TIER_CSS: Record<TierId, 'eliten' | 'normal' | 'idunno'> = {
  s: 'eliten',
  a: 'normal',
  i: 'idunno',
};

export interface TierDisplay {
  letter: string;
  label: string;
  sublabel: string;
}

export const TIER_DISPLAY: Record<TierId, TierDisplay> = {
  s: { letter: 'S', label: 'Eliten',             sublabel: 'S-tier — toppskiktet' },
  a: { letter: 'A', label: 'Normal people tier', sublabel: 'A-tier — solid stock' },
  i: { letter: '?', label: 'I dunno',            sublabel: 'Vi får se vart det landar' },
};

export const TIER_ORDER_VIBER: TierId[] = ['s', 'a', 'i'];

export function buildTierDisplay(
  custom: Partial<Record<string, Partial<TierDisplay>>>,
): Record<TierId, TierDisplay> {
  const result = { ...TIER_DISPLAY };
  for (const tid of TIER_ORDER_VIBER) {
    if (custom[tid]) result[tid] = { ...result[tid], ...custom[tid] };
  }
  return result;
}

export function parseTierDisplay(raw: string | undefined): Record<TierId, TierDisplay> {
  if (!raw) return TIER_DISPLAY;
  try {
    return buildTierDisplay(JSON.parse(raw) as Partial<Record<string, Partial<TierDisplay>>>);
  } catch { return TIER_DISPLAY; }
}
