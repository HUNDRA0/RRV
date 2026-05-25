// User-facing settings modal. Today it only handles the profile picture
// (set + clear), but it's structured so we can add more rows later
// (display name, email, etc.) without another component.
//
// Crop flow: pick a file → PhotoCropModal opens → "Använd bild" calls
// onAccept with a square 800×800 JPEG data URL → we POST it. Same pipeline
// as friend photos.

import { useState } from 'react';
import { useEsc, useLockBody } from '../../hooks/useViberHooks';
import { useFriendsList } from '../../lib/state';
import { PhotoCropModal } from './PhotoCropModal';

const MAX_PICK_BYTES = 8 * 1024 * 1024;
const ALLOWED_PICK_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export function ProfileSettingsModal({ onClose }: { onClose: () => void }) {
  const { currentUser, setMyAvatar, clearMyAvatar } = useFriendsList();
  const [pendingCropDataUrl, setPendingCropDataUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useLockBody(true);
  useEsc(onClose, !busy);

  if (!currentUser) {
    // Shouldn't happen — UserMenu only surfaces this when logged in.
    return null;
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    setErr(null);
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_PICK_BYTES) {
      setErr(`Bilden är för stor (max ${Math.round(MAX_PICK_BYTES / 1024 / 1024)} MB).`);
      e.target.value = '';
      return;
    }
    if (!ALLOWED_PICK_MIMES.includes(f.type.toLowerCase())) {
      setErr('Bara bildfiler stöds (jpg, png, webp, gif).');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPendingCropDataUrl(String(reader.result));
    reader.readAsDataURL(f);
    e.target.value = '';
  }

  async function onAcceptCrop(dataUrl: string) {
    setPendingCropDataUrl(null);
    setErr(null);
    setBusy(true);
    try { await setMyAvatar(dataUrl); }
    catch (e) { setErr(e instanceof Error ? e.message : 'kunde inte spara bilden'); }
    finally { setBusy(false); }
  }

  async function onRemove() {
    if (!confirm('Ta bort din profilbild?')) return;
    setBusy(true);
    setErr(null);
    try { await clearMyAvatar(); }
    catch (e) { setErr(e instanceof Error ? e.message : 'kunde inte ta bort'); }
    finally { setBusy(false); }
  }

  return (
    <div className="modal-backdrop" onClick={busy ? undefined : onClose}>
      <div
        className="modal profile-settings-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Mitt konto"
      >
        <button className="modal-close" onClick={onClose} aria-label="Stäng">✕</button>
        <div className="modal-info" style={{ padding: '28px 28px 24px' }}>
          <div className="section-eyebrow">Mitt konto</div>
          <h2 className="modal-name" style={{ fontSize: 24, marginBottom: 14 }}>
            <em style={{ fontStyle: 'italic' }}>{currentUser.username}</em>
          </h2>

          <div className="profile-avatar-row">
            <div className="profile-avatar-preview" aria-hidden="true">
              {currentUser.avatarUrl
                ? <img src={currentUser.avatarUrl} alt="" />
                : <span>{currentUser.username[0]?.toUpperCase() ?? '?'}</span>}
            </div>
            <div className="profile-avatar-actions">
              <label className="btn btn-purple profile-avatar-pick">
                {currentUser.avatarUrl ? 'Byt profilbild' : 'Lägg till profilbild'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  hidden
                  onChange={onPickFile}
                  disabled={busy}
                />
              </label>
              {currentUser.avatarUrl && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={onRemove}
                  disabled={busy}
                  style={{ color: 'var(--rose)' }}
                >
                  Ta bort
                </button>
              )}
            </div>
          </div>

          <p className="card-meta" style={{ marginTop: 12 }}>
            Bilden visas på dina inlägg i Hall of Fame och kring ditt namn på sidan.
            Max 8 MB. JPG, PNG, WEBP eller GIF.
          </p>

          {err && <div className="login-error" style={{ marginTop: 12 }}>{err}</div>}

          <div className="modal-photo-controls" style={{ marginTop: 18 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>Stäng</button>
          </div>
        </div>
      </div>

      {pendingCropDataUrl && (
        <PhotoCropModal
          sourceDataUrl={pendingCropDataUrl}
          onCancel={() => setPendingCropDataUrl(null)}
          onAccept={onAcceptCrop}
        />
      )}
    </div>
  );
}
