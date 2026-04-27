import { useFriendsList } from '../lib/state';

interface Props {
  friendId: string;
}

export function GLessCard({ friendId }: Props) {
  const { findFriend } = useFriendsList();
  const friend = findFriend(friendId);
  if (!friend) return null;

  // Why are they alone? Three possible reasons:
  //   - The geocoder couldn't find their address (lat/lon null)
  //   - They got pushed out of greedy matching (no compatible neighbour left)
  //   - The total friend count is odd (one friend always unpaired)
  const ungeocoded = friend.lat == null || friend.lon == null;
  const fullAddress = `${friend.address.street}, ${friend.address.city}`;
  const note = ungeocoded
    ? 'Adressen kunde inte geokodas — visas inte på kartan ännu'
    : 'Hittade ingen tillräckligt nära granne';

  return (
    <div className="gmap-gless-card">
      <div className="gmap-avatar gless-av">
        {friend.photoUrl ? <img src={friend.photoUrl} alt={friend.name} /> : <div className="gmap-av-ph">👤</div>}
      </div>
      <div className="gmap-gless-info">
        <div className="gmap-gless-name">{friend.name}</div>
        <div className="gmap-gless-addr">{fullAddress}</div>
        <div className="gmap-gless-note">{note}</div>
      </div>
    </div>
  );
}
