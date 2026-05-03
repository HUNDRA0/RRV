import type { Friend } from '../../data/friends';
import { TierSection } from './TierSection';
import { TIER_ORDER_VIBER } from './tier-map';

interface RankingsSectionProps {
  friends: Friend[];
  edit: boolean;
  onOpen: (id: string) => void;
  onRemovePhoto: (id: string, position: number) => void;
}

export function RankingsSection({ friends, edit, onOpen, onRemovePhoto }: RankingsSectionProps) {
  return (
    <section className="section container" id="rankings" data-screen-label="01 Rankings">
      <header className="section-header">
        <div>
          <div className="section-eyebrow reveal">Section I · Den officiella tier-listan</div>
          <h2 className="reveal" data-d="1"><em>Rankings</em></h2>
          <p className="reveal" data-d="2">
            16 namn. Tre tiers. Öppna ett kort för att se profilen — bilder, bio, allt.
          </p>
        </div>
        <div className="section-num reveal" data-d="3">I</div>
      </header>
      {TIER_ORDER_VIBER.map((t) => (
        <TierSection key={t} tierId={t} friends={friends} edit={edit} onOpen={onOpen} onRemovePhoto={onRemovePhoto} />
      ))}
    </section>
  );
}
