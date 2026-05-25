// Hall of Fame — a feed of user-uploaded images, videos, and YouTube
// embeds. Vibey-Instagram + YouTube hybrid. Anyone logged in can post,
// owner or admin can delete.
//
// Rendering strategy:
//   - One card per post, biggest dimension is the media
//   - Author + timestamp above, caption + delete (if mine/admin) below
//   - Videos use native <video controls preload="metadata">
//   - YouTube uses <iframe> at the standard embed URL — CSP allows this
//
// The page is lazy-loaded from Root.tsx; this file is the heavy one
// (modal + feed) so we keep it out of the main bundle.

import { useCallback, useEffect, useState } from 'react';
import { useEsc, useLockBody } from '../../hooks/useViberHooks';
import { useFriendsList } from '../../lib/state';
import {
  CLIENT_ALLOWED_IMAGE,
  CLIENT_ALLOWED_VIDEO,
  CLIENT_MAX_BYTES,
  createHallPost,
  deleteHallPost,
  fetchHallPosts,
  type HallPost,
} from '../../lib/hallApi';

export function HallOfFamePage() {
  const { currentUser, isAdmin } = useFriendsList();
  const [posts, setPosts] = useState<HallPost[] | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try { setPosts(await fetchHallPosts()); }
    catch (e) { setError(e instanceof Error ? e.message : 'fel'); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function onDelete(id: string) {
    if (!confirm('Ta bort detta inlägg?')) return;
    try {
      await deleteHallPost(id);
      setPosts(prev => prev?.filter(p => p.id !== id) ?? null);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'kunde inte radera');
    }
  }

  return (
    <div className="hof-page">
      <header className="hof-page-header">
        <a
          href="#"
          className="catan-back-btn"
          onClick={(e) => { e.preventDefault(); location.hash = ''; }}
          aria-label="Tillbaka till Viber Rankings"
        >
          ← Tillbaka
        </a>
        <h1 className="hof-page-title"><em>Hall of</em> Fame</h1>
        {currentUser ? (
          <button className="btn btn-purple hof-upload-btn" onClick={() => setUploadOpen(true)}>
            + Ladda upp
          </button>
        ) : (
          <span />
        )}
      </header>

      {!currentUser && (
        <p className="hof-login-hint">
          Logga in för att ladda upp bilder, videor eller YouTube-klipp.
        </p>
      )}

      {error && <p className="login-error" style={{ margin: '0 auto', maxWidth: 600 }}>{error}</p>}

      <main className="hof-feed">
        {posts === null && <p className="hof-empty">Laddar…</p>}
        {posts && posts.length === 0 && (
          <p className="hof-empty">Inga inlägg ännu. Bli först!</p>
        )}
        {posts?.map((p) => {
          const canDelete = !!currentUser && (currentUser.id === p.userId || isAdmin || currentUser.role === 'admin');
          return <HofCard key={p.id} post={p} canDelete={canDelete} onDelete={() => onDelete(p.id)} />;
        })}
      </main>

      {uploadOpen && (
        <UploadModal
          onClose={() => setUploadOpen(false)}
          onCreated={(p) => {
            setPosts(prev => (prev ? [p, ...prev] : [p]));
            setUploadOpen(false);
          }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Feed card
// ─────────────────────────────────────────────────────────────────────

function HofCard({ post, canDelete, onDelete }: { post: HallPost; canDelete: boolean; onDelete: () => void }) {
  return (
    <article className="hof-card">
      <header className="hof-card-head">
        <div className="hof-author-bubble" aria-hidden="true">
          {post.authorAvatarUrl
            ? <img src={post.authorAvatarUrl} alt="" />
            : <span>{post.author[0]?.toUpperCase() ?? '?'}</span>}
        </div>
        <div className="hof-meta">
          <div className="hof-author">{post.author}</div>
          <div className="hof-date">{relativeTime(post.createdAt)}</div>
        </div>
        {canDelete && (
          <button className="hof-delete" onClick={onDelete} aria-label="Ta bort inlägg">✕</button>
        )}
      </header>

      <div className="hof-media">
        {post.kind === 'image' && post.blobUrl && (
          <img src={post.blobUrl} alt={post.caption || 'Hall of Fame-bild'} loading="lazy" />
        )}
        {post.kind === 'video' && post.blobUrl && (
          <video src={post.blobUrl} controls preload="metadata" playsInline />
        )}
        {post.kind === 'youtube' && post.youtubeId && (
          <div className="hof-youtube">
            <iframe
              src={`https://www.youtube.com/embed/${encodeURIComponent(post.youtubeId)}`}
              title="YouTube"
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
        )}
      </div>

      {post.caption && <p className="hof-caption">{post.caption}</p>}
    </article>
  );
}

function relativeTime(iso: string): string {
  const t = new Date(iso.replace(' ', 'T') + 'Z').getTime();
  if (!Number.isFinite(t)) return iso;
  const diffMs = Date.now() - t;
  const min = Math.round(diffMs / 60_000);
  if (min < 1) return 'just nu';
  if (min < 60) return `${min} min sedan`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} tim sedan`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day} dagar sedan`;
  return iso.split(' ')[0];
}

// ─────────────────────────────────────────────────────────────────────
// Upload modal
// ─────────────────────────────────────────────────────────────────────

type UploadTab = 'file' | 'youtube';

function UploadModal({ onClose, onCreated }: { onClose: () => void; onCreated: (p: HallPost) => void }) {
  const [tab, setTab] = useState<UploadTab>('file');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewKind, setPreviewKind] = useState<'image' | 'video' | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useLockBody(true);
  useEsc(onClose, !busy);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    setErr(null);
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > CLIENT_MAX_BYTES) {
      setErr(`Filen är för stor (max ${Math.round(CLIENT_MAX_BYTES / 1024 / 1024)} MB).`);
      e.target.value = '';
      return;
    }
    const mime = f.type.toLowerCase();
    const isImage = CLIENT_ALLOWED_IMAGE.includes(mime);
    const isVideo = CLIENT_ALLOWED_VIDEO.includes(mime);
    if (!isImage && !isVideo) {
      setErr('Bara bild- och videofiler stöds (jpg, png, webp, gif, mp4, mov, webm).');
      e.target.value = '';
      return;
    }
    setFile(f);
    setPreviewKind(isImage ? 'image' : 'video');
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(f));
  }

  function clearFile() {
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewKind(null);
  }

  async function submit() {
    setErr(null);
    if (tab === 'youtube') {
      if (!youtubeUrl.trim()) { setErr('Klistra in en YouTube-länk.'); return; }
      setBusy(true);
      try {
        const post = await createHallPost({ kind: 'youtube', url: youtubeUrl, caption });
        onCreated(post);
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'kunde inte skapa');
      } finally {
        setBusy(false);
      }
      return;
    }

    if (!file || !previewKind) { setErr('Välj en fil först.'); return; }
    setBusy(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const post = await createHallPost({ kind: previewKind, dataUrl, caption });
      onCreated(post);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'kunde inte ladda upp');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={busy ? undefined : onClose}>
      <div
        className="modal hof-upload-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Ladda upp till Hall of Fame"
      >
        <button className="modal-close" onClick={onClose} aria-label="Stäng">✕</button>
        <div className="modal-info" style={{ padding: '24px 24px 20px' }}>
          <div className="section-eyebrow">Hall of Fame</div>
          <h2 className="modal-name" style={{ fontSize: 24, marginBottom: 12 }}>Nytt inlägg</h2>

          <div className="login-tabs" role="tablist">
            <button
              role="tab"
              aria-selected={tab === 'file'}
              className={tab === 'file' ? 'active' : ''}
              onClick={() => setTab('file')}
            >Fil från enhet</button>
            <button
              role="tab"
              aria-selected={tab === 'youtube'}
              className={tab === 'youtube' ? 'active' : ''}
              onClick={() => setTab('youtube')}
            >YouTube-länk</button>
          </div>

          {tab === 'file' ? (
            <>
              {!file ? (
                <label className="hof-file-pick">
                  <span className="hof-file-pick-icon">📁</span>
                  <span><strong>Välj bild eller video</strong></span>
                  <span className="card-meta">jpg / png / webp / gif / mp4 / mov / webm — max 16 MB</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
                    onChange={onPickFile}
                    hidden
                  />
                </label>
              ) : (
                <div className="hof-file-preview">
                  {previewKind === 'image' && previewUrl && <img src={previewUrl} alt="" />}
                  {previewKind === 'video' && previewUrl && <video src={previewUrl} controls playsInline />}
                  <button type="button" className="btn btn-ghost" onClick={clearFile} style={{ fontSize: 12 }}>
                    Byt fil
                  </button>
                </div>
              )}
            </>
          ) : (
            <label className="admin-field">
              <span>YouTube-länk</span>
              <input
                type="url"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=…"
                autoFocus
              />
              <span className="card-meta">Funkar med youtube.com/watch, youtu.be eller youtube.com/shorts.</span>
            </label>
          )}

          <label className="admin-field">
            <span>Beskrivning (valfri)</span>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={2}
              maxLength={300}
              placeholder="Vad händer i klippet?"
            />
          </label>

          {err && <div className="login-error">{err}</div>}

          <div className="modal-photo-controls" style={{ marginTop: 8 }}>
            <button type="button" className="btn btn-purple" onClick={submit} disabled={busy}>
              {busy ? 'Laddar upp…' : 'Lägg upp'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>Avbryt</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('kunde inte läsa filen'));
    r.readAsDataURL(file);
  });
}
