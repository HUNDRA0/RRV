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
