import { useEffect, useRef, useState } from 'react';
import type { Friend } from '../../data/friends';
import { Editable } from './Editable';
import { getTierCss, findTier, parseTierConfig } from './tier-map';
import { useMemo } from 'react';
import { useFriendsList } from '../../lib/state';
import { useEsc, useLockBody } from '../../hooks/useViberHooks';

interface PersonModalProps {
  friend: Friend;
  edit: boolean;
  onClose: () => void;
  onBioChange: (id: string, bio: string) => void;
  onAddPhoto: (id: string, dataUrl: string) => void;
  onRemovePhoto: (id: string, position: number) => void;
}

export function PersonModal({
  friend, edit, onClose, onBioChange, onAddPhoto, onRemovePhoto,
}: PersonModalProps) {
  const arr = friend.photos || [];
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useLockBody(true);
  useEsc(onClose, true);

  useEffect(() => {
    if (idx >= arr.length) setIdx(Math.max(0, arr.length - 1));
  }, [arr.length, idx]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft')
        setIdx((i) => (arr.length ? (i - 1 + arr.length) % arr.length : 0));
      if (e.key === 'ArrowRight')
        setIdx((i) => (arr.length ? (i + 1) % arr.length : 0));
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [arr.length]);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => onAddPhoto(friend.id, String(r.result));
    r.readAsDataURL(f);
    e.target.value = '';
  }

  const { siteContent } = useFriendsList();
  const tiers = useMemo(() => parseTierConfig(siteContent['tier_config']), [siteContent]);
  const tierCss = getTierCss(friend.tier);
  const tierLabel = findTier(tiers, friend.tier).label;
  const currentUrl = arr[idx]?.url;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={friend.name}>
        <button className="modal-close" onClick={onClose} aria-label="Stäng">✕</button>

        <div className="modal-photo">
          {currentUrl ? (
            <img src={currentUrl} alt={friend.name} key={idx} />
          ) : (
            <div className="placeholder" data-tier={tierCss}>
              {(friend.name[0] || '?').toUpperCase()}
            </div>
          )}
          {arr.length > 1 && (
            <>
              <button
                className="carousel-btn prev"
                onClick={() => setIdx((i) => (i - 1 + arr.length) % arr.length)}
                aria-label="Föregående"
              >‹</button>
              <button
                className="carousel-btn next"
                onClick={() => setIdx((i) => (i + 1) % arr.length)}
                aria-label="Nästa"
              >›</button>
              <div className="carousel-dots">
                {arr.map((_, i) => (
                  <button
                    key={i}
                    className={`dot ${i === idx ? 'active' : ''}`}
                    onClick={() => setIdx(i)}
                    aria-label={`Bild ${i + 1}`}
                  />
                ))}
              </div>
            </>
          )}
          <div className="photo-meta">
            {arr.length ? `${idx + 1} / ${arr.length}` : '0 bilder'}
          </div>
        </div>

        <div className="modal-info">
          <div className="modal-tier" data-tier={tierCss}>{tierLabel}</div>
          <h2 className="modal-name">{friend.name}</h2>
          <div className="modal-meta">
            {friend.address.street} · {friend.address.postcode} {friend.address.city}
          </div>

          <div className="modal-section-label">Bio</div>
          <Editable
            className="modal-bio"
            value={friend.bio || ''}
            onChange={(v) => onBioChange(friend.id, v)}
            edit={edit}
            placeholder={edit ? 'Skriv en bio…' : 'Ingen bio än. Sätt på Edit mode för att skriva.'}
          />

          {edit && (
            <div className="modal-photo-controls">
              <button className="btn btn-purple" onClick={() => inputRef.current?.click()}>
                ＋ Lägg till bild
              </button>
              {arr.length > 0 && (
                <button
                  className="btn btn-ghost"
                  onClick={() => onRemovePhoto(friend.id, arr[idx].position)}
                >
                  Ta bort denna bild
                </button>
              )}
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={handleFile}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
