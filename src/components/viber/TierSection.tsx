import type { Friend } from '../../data/friends';
import { PersonCard } from './PersonCard';
import { getTierCss, type TierConfig } from './tier-map';

interface TierSectionProps {
  tier: TierConfig;
  friends: Friend[];
  edit: boolean;
  onOpen: (id: string) => void;
  onRemovePhoto: (id: string, position: number) => void;
}

export function TierSection({ tier, friends, edit, onOpen, onRemovePhoto }: TierSectionProps) {
  const items = friends.filter((f) => f.tier === tier.id);
  return (
    <section className="tier" data-screen-label={`Tier ${tier.label}`}>
      <header className="tier-header reveal">
        <div className="tier-letter" data-tier={getTierCss(tier.id)}>{tier.letter}</div>
        <div className="tier-title">
          <small>{tier.sublabel}</small>
          <h3>{tier.label}</h3>
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
