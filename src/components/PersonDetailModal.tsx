// Detail modal — single-column layout:
//   Top: peek carousel (84% slide width, 8% peeking each side)
//   Bottom: info section (rank, name, bio, meta, admin controls)
//
// Closes on Escape, backdrop click, or the X button.
// Carousel: programmatic scroll with peek effect, directional slide-in animation.

import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent, type FocusEvent, type KeyboardEvent, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import type { Friend } from '../data/friends';
import { TIERS } from '../data/friends';
import { useFriendsList } from '../lib/state';

interface Props {
  friend: Friend;
  onClose: () => void;
}

export function PersonDetailModal({ friend, onClose }: Props) {
  const { isAdmin, updateFriend, uploadPhoto, deletePhoto } = useFriendsList();
  const [photoIdx, setPhotoIdx] = useState(0);
  const [coordLat, setCoordLat] = useState(friend.lat?.toString() ?? '');
  const [coordLon, setCoordLon] = useState(friend.lon?.toString() ?? '');
  const [coordSaving, setCoordSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const outerRef = useRef<HTMLDivElement>(null);
  const prevFocus = useRef<HTMLElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [slideW, setSlideW] = useState(0);

  const tier = TIERS[friend.tier];
  const photos = friend.photos.length > 0 ? friend.photos : null;
  const safeIdx = photos ? Math.min(photoIdx, photos.length - 1) : 0;
  const currentPhoto = photos ? photos[safeIdx] : null;

  // Measure slide width once outer mounts, update on resize.
  useLayoutEffect(() => {
    const measure = () => {
      if (outerRef.current) setSlideW(outerRef.current.clientWidth * 0.84);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (outerRef.current) ro.observe(outerRef.current);
    return () => ro.disconnect();
  }, []);

  // Scroll carousel to active slide whenever index or slideW changes.
  useEffect(() => {
    const track = trackRef.current;
    if (!track || !photos || slideW === 0) return;
    const gap = 10;
    track.scrollTo({ left: safeIdx * (slideW + gap), behavior: 'smooth' });
  }, [safeIdx, photos, slideW]);

  // Mount → animate in on next frame.
  useEffect(() => {
    prevFocus.current = document.activeElement as HTMLElement | null;
    const id = requestAnimationFrame(() => setOpen(true));
    return () => {
      cancelAnimationFrame(id);
      prevFocus.current?.focus?.();
    };
  }, []);

  // Lock body scroll while open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Keyboard: Esc closes, ←/→ navigate carousel (skip when typing).
  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      const inEditable = t?.isContentEditable || t?.tagName === 'INPUT' || t?.tagName === 'TEXTAREA';
      if (e.key === 'Escape') { onClose(); return; }
      if (inEditable || !photos) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, photos]);

  function startClose() {
    setOpen(false);
    setTimeout(onClose, 220);
  }
  function next() {
    if (!photos) return;
    setPhotoIdx(i => (i + 1) % photos.length);
  }
  function prev() {
    if (!photos) return;
    setPhotoIdx(i => (i - 1 + photos.length) % photos.length);
  }
  function jumpTo(i: number) {
    setPhotoIdx(i);
  }

  function onBioBlur(e: FocusEvent<HTMLDivElement>) {
    if (!isAdmin) return;
    const next = (e.currentTarget.textContent ?? '').trim();
    if (next === friend.bio) return;
    updateFriend(friend.id, { bio: next }).catch(err => {
      alert(`Update failed: ${String(err.message ?? err)}`);
      e.currentTarget.textContent = friend.bio;
    });
  }
  function onNameBlur(e: FocusEvent<HTMLDivElement>) {
    if (!isAdmin) return;
    const next = (e.currentTarget.textContent ?? '').trim();
    if (!next) { e.currentTarget.textContent = friend.name; return; }
    if (next === friend.name) return;
    updateFriend(friend.id, { name: next }).catch(err => {
      alert(`Update failed: ${String(err.message ?? err)}`);
      e.currentTarget.textContent = friend.name;
    });
  }
  function onEditableKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' && e.currentTarget.dataset.field === 'name') {
      e.preventDefault();
      e.currentTarget.blur();
    }
  }

  function onPhotoUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') return;
      uploadPhoto(friend.id, result).catch(err =>
        alert(`Photo upload failed: ${String(err.message ?? err)}`),
      );
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  async function onCoordSave(e: FormEvent) {
    e.preventDefault();
    const lat = parseFloat(coordLat);
    const lon = parseFloat(coordLon);
    if (isNaN(lat) || isNaN(lon)) { alert('Ogiltiga koordinater'); return; }
    setCoordSaving(true);
    try {
      await updateFriend(friend.id, { lat, lon });
    } catch (err) {
      alert(`Kunde inte spara: ${String((err as Error).message ?? err)}`);
    } finally {
      setCoordSaving(false);
    }
  }

  function onPhotoDelete() {
    if (!currentPhoto) return;
    if (!confirm(`Ta bort bild ${currentPhoto.position} av ${friend.name}?`)) return;
    deletePhoto(friend.id, currentPhoto.position).catch(err =>
      alert(`Delete failed: ${String(err.message ?? err)}`),
    );
    setPhotoIdx(0);
  }

  return createPortal(
    <div
      className={`pdm-scrim${open ? ' is-open' : ''}`}
      onClick={(e) => { if (e.target === e.currentTarget) startClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={`${friend.name} — detaljer`}
    >
      <div ref={dialogRef} className={`pdm-card tier-${friend.tier}`}>
        <button type="button" className="pdm-close" onClick={startClose} aria-label="Stäng">
          <span aria-hidden>×</span>
        </button>

        {/* ── Peek carousel ── */}
        <div className="pdm-carousel-outer" ref={outerRef}>
          <div className="pdm-carousel-track" ref={trackRef}>
            {photos ? photos.map((p) => (
              <div key={p.position} className="pdm-carousel-slide">
                <img src={p.url} alt={`${friend.name} — bild ${p.position}`} />
              </div>
            )) : (
              <div className="pdm-carousel-slide">
                <div className="pdm-photo-empty">
                  <span>👤</span>
                  <p>Inga bilder ännu</p>
                </div>
              </div>
            )}
          </div>

          {/* Transparent arrows overlaid on carousel */}
          {photos && photos.length > 1 && (
            <>
              <button type="button" className="pdm-arrow pdm-arrow-prev" onClick={prev} aria-label="Föregående bild">
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 6L9 12L15 18"/>
                </svg>
              </button>
              <button type="button" className="pdm-arrow pdm-arrow-next" onClick={next} aria-label="Nästa bild">
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 6L15 12L9 18"/>
                </svg>
              </button>
            </>
          )}
        </div>

        {/* Dots */}
        {photos && photos.length > 1 && (
          <div className="pdm-dots" role="tablist" aria-label="Bildnavigering">
            {photos.map((p, i) => (
              <button
                key={p.position}
                type="button"
                className={`pdm-dot${i === safeIdx ? ' active' : ''}`}
                onClick={() => jumpTo(i)}
                aria-label={`Bild ${p.position}`}
                aria-selected={i === safeIdx}
              />
            ))}
          </div>
        )}

        {/* ── Info section ── */}
        <div className="pdm-info-col">
          <div className="pdm-header-row">
            <span className="pdm-rank">#{friend.rank}</span>
            <div
              className="pdm-name"
              data-field="name"
              contentEditable={isAdmin}
              suppressContentEditableWarning
              onBlur={onNameBlur}
              onKeyDown={onEditableKeyDown}
            >
              {friend.name}
            </div>
          </div>
          <div className="pdm-tier">{tier.title}</div>

          <div className="pdm-divider" />

          <div className="pdm-bio-label">Varför #{friend.rank}?</div>
          <div
            className={`pdm-bio${friend.bio ? '' : ' empty'}`}
            data-field="bio"
            contentEditable={isAdmin}
            suppressContentEditableWarning
            onBlur={onBioBlur}
            onKeyDown={onEditableKeyDown}
          >
            {friend.bio || (isAdmin ? 'Klicka för att skriva en bio…' : '(Bio saknas än så länge.)')}
          </div>

          <div className="pdm-meta">
            <div className="pdm-meta-row">
              <span className="pdm-meta-key">Adress</span>
              <span className="pdm-meta-val">{friend.address.street}, {friend.address.postcode} {friend.address.city}</span>
            </div>
            {friend.area && (
              <div className="pdm-meta-row">
                <span className="pdm-meta-key">Område</span>
                <span className="pdm-meta-val">{friend.area}</span>
              </div>
            )}
            <div className="pdm-meta-row">
              <span className="pdm-meta-key">Bilder</span>
              <span className="pdm-meta-val">{friend.photos.length} st</span>
            </div>
          </div>

          {isAdmin && (
            <div className="pdm-photo-admin">
              <button type="button" className="nav-btn" onClick={() => fileInputRef.current?.click()}>
                + Lägg till bild
              </button>
              {currentPhoto && (
                <button type="button" className="nav-btn danger" onClick={onPhotoDelete}>
                  Ta bort denna
                </button>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onPhotoUpload} />
            </div>
          )}

          {isAdmin && (
            <form className="pdm-coord-editor" onSubmit={onCoordSave}>
              <div className="pdm-coord-title">📍 Koordinater (G Map)</div>
              <div className="pdm-coord-row">
                <label className="pdm-coord-label">Lat
                  <input
                    className="pdm-coord-input"
                    type="text"
                    inputMode="decimal"
                    placeholder="59.1951"
                    value={coordLat}
                    onChange={e => setCoordLat(e.target.value)}
                  />
                </label>
                <label className="pdm-coord-label">Lon
                  <input
                    className="pdm-coord-input"
                    type="text"
                    inputMode="decimal"
                    placeholder="17.6253"
                    value={coordLon}
                    onChange={e => setCoordLon(e.target.value)}
                  />
                </label>
                <button type="submit" className="nav-btn primary" disabled={coordSaving}>
                  {coordSaving ? '…' : 'Spara'}
                </button>
              </div>
              <p className="pdm-coord-hint">
                Högerklicka på Google Maps → "Vad finns här?" → kopiera lat,lon
              </p>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
