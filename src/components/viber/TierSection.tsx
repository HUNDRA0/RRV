import { useMemo } from 'react';
import type { Friend, TierId } from '../../data/friends';
import { PersonCard } from './PersonCard';
import { TIER_CSS, parseTierDisplay } from './tier-map';
import { useFriendsList } from '../../lib/state';

interface TierSectionProps {
  tierId: TierId;
  friends: Friend[];
  edit: boolean;
  onOpen: (id: string) => void;
  onRemovePhoto: (id: string, position: number) => void;
}

export function TierSection({ tierId, friends, edit, onOpen, onRemovePhoto }: TierSectionProps) {
  const { siteContent } = useFriendsList();
  const tierDisplay = useMemo(() => parseTierDisplay(siteContent['tier_names']), [siteContent]);
  const t = tierDisplay[tierId];
  const items = friends.filter((f) => f.tier === tierId);
  return (
    <section className="tier" data-screen-label={`Tier ${t.label}`}>
      <header className="tier-header reveal">
        <div className="tier-letter" data-tier={TIER_CSS[tierId]}>{t.letter}</div>
        <div className="tier-title">
          <small>{t.sublabel}</small>
          <h3>{t.label}</h3>
        </div>
        <div className="tier-count">{items.length} pers.</div>
      </header>
      <div className="card-grid">
        {items.map((f, i) => (
          <PersonCard
            key={f.id}
            friend={f}
            edit={edit}
            rankWithinTier={i + 1}
            onOpen={() => onOpen(f.id)}
            onRemovePhoto={onRemovePhoto}
          />
        ))}
      </div>
    </section>
  );
}
