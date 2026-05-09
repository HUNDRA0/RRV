import { useMemo } from 'react';
import type { Friend } from '../../data/friends';
import { PhotoCell } from './PhotoCell';
import { parseTierConfig, findTier } from './tier-map';
import { useFriendsList } from '../../lib/state';

interface PersonCardProps {
  friend: Friend;
  edit: boolean;
  onOpen: () => void;
  rankWithinTier: number;
  onRemovePhoto: (id: string, position: number) => void;
}

export function PersonCard({ friend, edit, onOpen, rankWithinTier, onRemovePhoto }: PersonCardProps) {
  const { siteContent } = useFriendsList();
  const tiers = useMemo(() => parseTierConfig(siteContent['tier_config']), [siteContent]);
  const tierInfo = findTier(tiers, friend.tier);
  const bio = friend.bio || '';
  return (
    <div
      className="card reveal zoom"
      data-d={Math.min(rankWithinTier, 8)}
      data-edit={edit}
      onClick={onOpen}
    >
      <PhotoCell
        friend={friend}
        edit={edit}
        onClick={(e) => { e.stopPropagation(); onOpen(); }}
        onRemovePhoto={onRemovePhoto}
      />
      <div className="card-body">
        <div className="card-rank">#{rankWithinTier} · {tierInfo.label}</div>
        <div className="card-name">{friend.name}</div>
        <div className="card-meta">
          {friend.address.street} · {friend.address.postcode} {friend.address.city}
        </div>
        <div className="card-bio" data-empty={!bio || undefined}>
          {bio}
        </div>
      </div>
    </div>
  );
}
