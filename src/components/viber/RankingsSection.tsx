import { useMemo } from 'react';
import type { Friend } from '../../data/friends';
import { TierSection } from './TierSection';
import { parseTierConfig } from './tier-map';
import { useFriendsList } from '../../lib/state';

interface RankingsSectionProps {
  friends: Friend[];
  edit: boolean;
  onOpen: (id: string) => void;
  onRemovePhoto: (id: string, position: number) => void;
}

export function RankingsSection({ friends, edit, onOpen, onRemovePhoto }: RankingsSectionProps) {
  const { siteContent } = useFriendsList();
  const tiers = useMemo(() => parseTierConfig(siteContent['tier_config']), [siteContent]);

  return (
    <section className="section container" id="rankings" data-screen-label="01 Tier">
      <header className="section-header">
        <div>
          <div className="section-eyebrow reveal">Section I · Den officiella tier-listan</div>
          <h2 className="reveal" data-d="1"><em>Tier</em></h2>
          <p className="reveal" data-d="2">
            16 namn. Tre tiers. Öppna ett kort för att se profilen — bilder, bio, allt.
          </p>
        </div>
        <div className="section-num reveal" data-d="3">I</div>
      </header>
      {tiers.map((tier) => (
        <TierSection key={tier.id} tier={tier} friends={friends} edit={edit} onOpen={onOpen} onRemovePhoto={onRemovePhoto} />
      ))}
    </section>
  );
}
