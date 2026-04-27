import type { TierId } from '../data/friends';
import { TIERS } from '../data/friends';
import { useFriendsList } from '../lib/state';
import { MagneticLetter } from './MagneticLetter';
import { PersonCard } from './PersonCard';

interface Props {
  tierId: TierId;
}

export function TierSection({ tierId }: Props) {
  const { friendsByTier } = useFriendsList();
  const tier = TIERS[tierId];
  const friends = friendsByTier(tierId);
  return (
    <div className={`tier-section tier-${tierId}`}>
      <div className="tier-header">
        <div className="tier-header-left">
          <div className="tier-kicker">{tier.kicker}</div>
          <div className="tier-title">{tier.title}</div>
        </div>
        <div className="tier-letter">
          <MagneticLetter strength={14}>{tier.letter}</MagneticLetter>
        </div>
      </div>
      <div className="card-grid">
        {friends.map(f => (
          <PersonCard key={f.id} friend={f} />
        ))}
      </div>
    </div>
  );
}
