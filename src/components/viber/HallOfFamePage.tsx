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

import { useCallback, useEffect, useRef, useState } from 'react';
import { useEsc, useLockBody } from '../../hooks/useViberHooks';
import { useFriendsList } from '../../lib/state';
import { LoginModal } from './LoginModal';
import {
  CLIENT_ALLOWED_IMAGE,
  CLIENT_ALLOWED_VIDEO,
  IMAGE_MAX_BYTES,
  UPLOAD_SAFE_BYTES,
  VIDEO_SOURCE_MAX_BYTES,
  addHallComment,
  createHallBinaryPost,
  createHallPost,
  deleteHallComment,
  deleteHallPost,
  fetchHallComments,
  fetchHallPosts,
  recordHallView,
  setHallReaction,
  type HallComment,
  type HallPost,
  type HallSort,
} from '../../lib/hallApi';
import { compressVideoToTargetSize } from '../../lib/compressVideo';

type FeedFilter = 'all' | 'images' | 'videos';

export function HallOfFamePage() {
  const { currentUser, isAdmin, canDeleteAnyHallPost } = useFriendsList();
  const [posts, setPosts] = useState<HallPost[] | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FeedFilter>('all');
  const [sort, setSort] = useState<HallSort>('newest');
  const [lightboxPost, setLightboxPost] = useState<HallPost | null>(null);
  const [loginTab, setLoginTab] = useState<'login' | 'register' | 'recover' | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const requireLogin = useCallback(() => setLoginTab('login'), []);

  // Toast that auto-clears. Used for "länken kopierad" after share fallback.
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(prev => (prev === msg ? null : prev)), 2400);
  }, []);

  // Deep link from another tab: #hall-of-fame?post=ID. Scroll to + briefly
  // highlight the matching card once the feed has loaded.
  useEffect(() => {
    if (!posts || posts.length === 0) return;
    const hash = window.location.hash;
    const q = hash.indexOf('?');
    if (q < 0) return;
    const params = new URLSearchParams(hash.slice(q + 1));
    const target = params.get('post');
    if (!target) return;
    const el = document.getElementById(`hof-post-${target}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('hof-card-flash');
    window.setTimeout(() => el.classList.remove('hof-card-flash'), 2000);
  }, [posts]);

  const refresh = useCallback(async () => {
    try { setPosts(await fetchHallPosts(sort)); }
    catch (e) { setError(e instanceof Error ? e.message : 'fel'); }
  }, [sort]);

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

  // Counts for tab labels — YouTube embeds count as videos so we don't
  // burn a third tab on something that's identical from the viewer's POV.
  const imageCount = posts?.filter(p => p.kind === 'image').length ?? 0;
  const videoCount = posts?.filter(p => p.kind === 'video' || p.kind === 'youtube').length ?? 0;
  const visiblePosts = posts?.filter(p => {
    if (filter === 'all') return true;
    if (filter === 'images') return p.kind === 'image';
    return p.kind === 'video' || p.kind === 'youtube';
  });

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
          <button type="button" className="link-btn" onClick={requireLogin}>Logga in</button>
          {' '}för att ladda upp, gilla eller kommentera.
        </p>
      )}

      {error && <p className="login-error" style={{ margin: '0 auto', maxWidth: 600 }}>{error}</p>}

      {posts && posts.length > 0 && (
        <>
          <div className="hof-tabs" role="tablist" aria-label="Filtrera inlägg">
            <button
              role="tab"
              aria-selected={filter === 'all'}
              className={filter === 'all' ? 'active' : ''}
              onClick={() => setFilter('all')}
            >
              Alla <span className="hof-tab-count">{posts.length}</span>
            </button>
            <button
              role="tab"
              aria-selected={filter === 'images'}
              className={filter === 'images' ? 'active' : ''}
              onClick={() => setFilter('images')}
            >
              Bilder <span className="hof-tab-count">{imageCount}</span>
            </button>
            <button
              role="tab"
              aria-selected={filter === 'videos'}
              className={filter === 'videos' ? 'active' : ''}
              onClick={() => setFilter('videos')}
            >
              Videor <span className="hof-tab-count">{videoCount}</span>
            </button>
          </div>
          <div className="hof-sort">
            <label htmlFor="hof-sort-select">Sortera:</label>
            <select
              id="hof-sort-select"
              value={sort}
              onChange={(e) => setSort(e.target.value as HallSort)}
            >
              <option value="newest">Nyast först</option>
              <option value="oldest">Äldst först</option>
              <option value="most_viewed">Mest tittad</option>
              <option value="most_liked">Mest gillad</option>
              <option value="most_disliked">Mest ogillad</option>
            </select>
          </div>
        </>
      )}

      <main className="hof-feed">
        {posts === null && <p className="hof-empty">Laddar…</p>}
        {posts && posts.length === 0 && (
          <p className="hof-empty">Inga inlägg ännu. Bli först!</p>
        )}
        {posts && posts.length > 0 && visiblePosts && visiblePosts.length === 0 && (
          <p className="hof-empty">
            {filter === 'images' ? 'Inga bilder ännu.' : 'Inga videor ännu.'}
          </p>
        )}
        {visiblePosts?.map((p) => {
          const canDelete = !!currentUser && (currentUser.id === p.userId || isAdmin || canDeleteAnyHallPost);
          return (
            <HofCard
              key={p.id}
              post={p}
              canDelete={canDelete}
              canEngage={!!currentUser}
              isAdmin={isAdmin}
              currentUserId={currentUser?.id ?? null}
              onDelete={() => onDelete(p.id)}
              onOpenImage={() => setLightboxPost(p)}
              onRequireLogin={requireLogin}
              onShareCopied={() => showToast('Länken är kopierad')}
              onPatch={(patch) => {
                setPosts(prev => prev?.map(x => x.id === p.id ? { ...x, ...patch } : x) ?? null);
              }}
            />
          );
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

      {lightboxPost && <ImageLightbox post={lightboxPost} onClose={() => setLightboxPost(null)} />}

      {loginTab && (
        <LoginModal onClose={() => setLoginTab(null)} initialTab={loginTab} />
      )}

      {toast && <div className="hof-toast" role="status" aria-live="polite">{toast}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Feed card
// ─────────────────────────────────────────────────────────────────────

interface HofCardProps {
  post: HallPost;
  canDelete: boolean;
  canEngage: boolean;
  isAdmin: boolean;
  currentUserId: string | null;
  onDelete: () => void;
  onOpenImage: () => void;
  onRequireLogin: () => void;
  onShareCopied: () => void;
  onPatch: (patch: Partial<HallPost>) => void;
}

function HofCard({ post, canDelete, canEngage, isAdmin, currentUserId, onDelete, onOpenImage, onRequireLogin, onShareCopied, onPatch }: HofCardProps) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [busyReaction, setBusyReaction] = useState(false);
  const cardRef = useRef<HTMLElement | null>(null);
  const viewCountedRef = useRef(false);

  // Count one view per post per session once the card is meaningfully on
  // screen (≥50% visible for ≥1.5 s). We optimistically bump the local
  // count so the chip updates instantly; the server is the source of
  // truth on next refresh.
  useEffect(() => {
    if (viewCountedRef.current) return;
    const el = cardRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    let timer: number | null = null;
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.intersectionRatio >= 0.5) {
          if (timer === null) {
            timer = window.setTimeout(() => {
              if (viewCountedRef.current) return;
              viewCountedRef.current = true;
              recordHallView(post.id);
              onPatch({ viewCount: post.viewCount + 1 });
              io.disconnect();
            }, 1500);
          }
        } else if (timer !== null) {
          window.clearTimeout(timer);
          timer = null;
        }
      }
    }, { threshold: [0, 0.5, 1] });
    io.observe(el);
    return () => { io.disconnect(); if (timer !== null) window.clearTimeout(timer); };
    // We deliberately don't depend on post.viewCount so the effect only
    // sets up once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id]);

  async function share() {
    const url = `${location.origin}/#hall-of-fame?post=${encodeURIComponent(post.id)}`;
    const text = post.caption
      ? `${post.author}: ${post.caption}`
      : `${post.author} på Hall of Fame`;
    // Web Share API is the gold path on phones — uses the native sheet.
    const nav = navigator as Navigator & {
      share?: (data: { title?: string; text?: string; url?: string }) => Promise<void>;
    };
    if (typeof nav.share === 'function') {
      try {
        await nav.share({ title: 'Hall of Fame', text, url });
        return;
      } catch (e) {
        // User dismissed the sheet — that's a no-op, not an error.
        if (e instanceof Error && e.name === 'AbortError') return;
        // Fall through to clipboard on other errors.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      onShareCopied();
    } catch {
      // Very old browser without clipboard API — last-resort prompt.
      window.prompt('Kopiera länken:', url);
    }
  }

  async function toggleReaction(kind: 'like' | 'dislike') {
    if (!canEngage) { onRequireLogin(); return; }
    if (busyReaction) return;
    setBusyReaction(true);
    // Optimistic: predict the result instantly, then reconcile.
    const prev = { likeCount: post.likeCount, dislikeCount: post.dislikeCount, myReaction: post.myReaction };
    let nextMine: 'like' | 'dislike' | null;
    let likeDelta = 0, dislikeDelta = 0;
    if (post.myReaction === kind) {
      nextMine = null;
      if (kind === 'like') likeDelta = -1; else dislikeDelta = -1;
    } else {
      nextMine = kind;
      if (kind === 'like') { likeDelta = +1; if (post.myReaction === 'dislike') dislikeDelta = -1; }
      else { dislikeDelta = +1; if (post.myReaction === 'like') likeDelta = -1; }
    }
    onPatch({
      likeCount: post.likeCount + likeDelta,
      dislikeCount: post.dislikeCount + dislikeDelta,
      myReaction: nextMine,
    });
    try {
      const r = await setHallReaction(post.id, nextMine);
      onPatch({ likeCount: r.likeCount, dislikeCount: r.dislikeCount, myReaction: r.myReaction });
    } catch {
      onPatch(prev); // rollback
    } finally {
      setBusyReaction(false);
    }
  }

  return (
    <article className="hof-card" id={`hof-post-${post.id}`} ref={cardRef}>
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
          <button
            type="button"
            className="hof-image-btn"
            onClick={onOpenImage}
            aria-label="Visa bilden i fullskärm"
          >
            <img src={post.blobUrl} alt={post.caption || 'Hall of Fame-bild'} loading="lazy" />
          </button>
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

      <div className="hof-actions">
        <button
          type="button"
          className="hof-react"
          data-active={post.myReaction === 'like'}
          disabled={busyReaction}
          onClick={() => toggleReaction('like')}
          aria-pressed={post.myReaction === 'like'}
          title={canEngage ? 'Gilla' : 'Logga in för att gilla'}
        >
          <span className="hof-react-ico">👍</span>
          <span className="hof-react-count">{post.likeCount}</span>
        </button>
        <button
          type="button"
          className="hof-react"
          data-active={post.myReaction === 'dislike'}
          disabled={busyReaction}
          onClick={() => toggleReaction('dislike')}
          aria-pressed={post.myReaction === 'dislike'}
          title={canEngage ? 'Ogilla' : 'Logga in för att ogilla'}
        >
          <span className="hof-react-ico">👎</span>
          <span className="hof-react-count">{post.dislikeCount}</span>
        </button>
        <span
          className="hof-react hof-views"
          title="Visningar"
          aria-label={`${post.viewCount} visningar`}
        >
          <EyeIcon />
          <span className="hof-react-count">{post.viewCount}</span>
        </span>
        <button
          type="button"
          className="hof-react"
          onClick={() => void share()}
          aria-label="Dela inlägget"
          title="Dela"
        >
          <ShareIosIcon />
          <span className="hof-react-label">Dela</span>
        </button>
        <button
          type="button"
          className="hof-react hof-comments-toggle"
          data-active={commentsOpen}
          onClick={() => setCommentsOpen(v => !v)}
          aria-expanded={commentsOpen}
        >
          <span className="hof-react-ico">💬</span>
          <span className="hof-react-count">{post.commentCount}</span>
          <span className="hof-react-label">{commentsOpen ? 'Stäng' : 'Kommentarer'}</span>
        </button>
      </div>

      {commentsOpen && (
        <Comments
          post={post}
          canEngage={canEngage}
          isAdmin={isAdmin}
          currentUserId={currentUserId}
          onRequireLogin={onRequireLogin}
          onCountChange={(c) => onPatch({ commentCount: c })}
        />
      )}
    </article>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Comments section — inline list below a card
// ─────────────────────────────────────────────────────────────────────

interface CommentsProps {
  post: HallPost;
  canEngage: boolean;
  isAdmin: boolean;
  currentUserId: string | null;
  onRequireLogin: () => void;
  onCountChange: (count: number) => void;
}

function Comments({ post, canEngage, isAdmin, currentUserId, onRequireLogin, onCountChange }: CommentsProps) {
  const [list, setList] = useState<HallComment[] | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const c = await fetchHallComments(post.id);
        if (!cancelled) setList(c);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'fel');
      }
    })();
    return () => { cancelled = true; };
  }, [post.id]);

  async function submit() {
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const c = await addHallComment(post.id, text);
      setList(prev => (prev ? [...prev, c] : [c]));
      onCountChange(post.commentCount + 1);
      setDraft('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'kunde inte kommentera');
    } finally {
      setBusy(false);
    }
  }

  async function remove(c: HallComment) {
    if (!confirm('Ta bort kommentaren?')) return;
    try {
      await deleteHallComment(c.id);
      setList(prev => prev?.filter(x => x.id !== c.id) ?? null);
      onCountChange(Math.max(0, post.commentCount - 1));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'kunde inte radera');
    }
  }

  return (
    <div className="hof-comments">
      {list === null ? (
        <p className="hof-comments-empty">Laddar…</p>
      ) : list.length === 0 ? (
        <p className="hof-comments-empty">Inga kommentarer ännu.</p>
      ) : (
        <ul className="hof-comment-list">
          {list.map(c => (
            <li key={c.id} className="hof-comment">
              <div className="hof-author-bubble hof-comment-bubble" aria-hidden="true">
                {c.authorAvatarUrl
                  ? <img src={c.authorAvatarUrl} alt="" />
                  : <span>{c.author[0]?.toUpperCase() ?? '?'}</span>}
              </div>
              <div className="hof-comment-body">
                <div className="hof-comment-head">
                  <span className="hof-comment-author">{c.author}</span>
                  <span className="hof-comment-date">{relativeTime(c.createdAt)}</span>
                </div>
                <p className="hof-comment-text">{c.body}</p>
              </div>
              {(currentUserId === c.userId || isAdmin) && (
                <button
                  type="button"
                  className="hof-comment-delete"
                  onClick={() => remove(c)}
                  aria-label="Ta bort kommentar"
                >✕</button>
              )}
            </li>
          ))}
        </ul>
      )}

      {err && <p className="login-error" style={{ marginTop: 8 }}>{err}</p>}

      {canEngage ? (
        <form
          className="hof-comment-form"
          onSubmit={(e) => { e.preventDefault(); void submit(); }}
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Skriv en kommentar…"
            rows={2}
            maxLength={500}
            disabled={busy}
          />
          <button type="submit" className="btn btn-purple" disabled={busy || !draft.trim()}>
            {busy ? 'Skickar…' : 'Skicka'}
          </button>
        </form>
      ) : (
        <button
          type="button"
          className="btn btn-purple hof-comment-login-cta"
          onClick={onRequireLogin}
        >
          Logga in för att kommentera
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Image lightbox — tap to open, pinch / mouse-wheel to zoom, drag to pan
// ─────────────────────────────────────────────────────────────────────

function ImageLightbox({ post, onClose }: { post: HallPost; onClose: () => void }) {
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const dragRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);

  useLockBody(true);
  useEsc(onClose, true);

  const reset = () => { setScale(1); setTx(0); setTy(0); };

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    const next = Math.min(5, Math.max(1, scale + (e.deltaY < 0 ? 0.2 : -0.2)));
    if (next === 1) { setTx(0); setTy(0); }
    setScale(next);
  }

  function onPointerDown(e: React.PointerEvent) {
    if (scale <= 1) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, tx, ty };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    setTx(dragRef.current.tx + (e.clientX - dragRef.current.x));
    setTy(dragRef.current.ty + (e.clientY - dragRef.current.y));
  }
  function onPointerUp() { dragRef.current = null; }

  return (
    <div className="hof-lightbox" onClick={onClose} role="dialog" aria-modal="true" aria-label="Bildvisning">
      <button className="hof-lightbox-close" onClick={onClose} aria-label="Stäng">✕</button>
      <div className="hof-lightbox-zoom">
        <button onClick={(e) => { e.stopPropagation(); setScale(s => Math.min(5, s + 0.4)); }} aria-label="Zooma in">+</button>
        <button onClick={(e) => { e.stopPropagation(); reset(); }} aria-label="Återställ zoom">1:1</button>
        <button onClick={(e) => { e.stopPropagation(); const n = Math.max(1, scale - 0.4); if (n === 1) { setTx(0); setTy(0); } setScale(n); }} aria-label="Zooma ut">−</button>
      </div>
      <div
        className="hof-lightbox-stage"
        onClick={(e) => e.stopPropagation()}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={() => (scale === 1 ? setScale(2) : reset())}
      >
        {post.blobUrl && (
          <img
            src={post.blobUrl}
            alt={post.caption || 'Hall of Fame-bild'}
            draggable={false}
            style={{
              transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
              cursor: scale > 1 ? 'grab' : 'zoom-in',
            }}
          />
        )}
      </div>
      {post.caption && <p className="hof-lightbox-caption" onClick={(e) => e.stopPropagation()}>{post.caption}</p>}
    </div>
  );
}

// iPhone-style share icon — square with an up-arrow popping out.
function ShareIosIcon() {
  return (
    <svg className="hof-react-ico" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 3 L12 15 M12 3 L8 7 M12 3 L16 7"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"
      />
      <path
        d="M6 11 L6 20 A1 1 0 0 0 7 21 L17 21 A1 1 0 0 0 18 20 L18 11"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"
      />
    </svg>
  );
}

// Eye icon for the views chip.
function EyeIcon() {
  return (
    <svg className="hof-react-ico" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M2 12 C 5 6, 9 4, 12 4 C 15 4, 19 6, 22 12 C 19 18, 15 20, 12 20 C 9 20, 5 18, 2 12 Z"
        stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.8" fill="none" />
    </svg>
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
  // Compression progress 0..1; null when not compressing.
  const [compressProgress, setCompressProgress] = useState<number | null>(null);

  useLockBody(true);
  useEsc(onClose, !busy);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    setErr(null);
    const f = e.target.files?.[0];
    if (!f) return;
    const mime = f.type.toLowerCase();
    const isImage = CLIENT_ALLOWED_IMAGE.includes(mime);
    const isVideo = CLIENT_ALLOWED_VIDEO.includes(mime);
    if (!isImage && !isVideo) {
      setErr('Bara bild- och videofiler stöds (jpg, png, webp, gif, mp4, mov, webm).');
      e.target.value = '';
      return;
    }
    // Images upload as-is, so the cap is the safe upload size.
    if (isImage && f.size > IMAGE_MAX_BYTES) {
      setErr(`Bilden är för stor (max ${Math.round(IMAGE_MAX_BYTES / 1024 / 1024)} MB).`);
      e.target.value = '';
      return;
    }
    // Videos can be much larger — we'll compress in-browser before upload.
    if (isVideo && f.size > VIDEO_SOURCE_MAX_BYTES) {
      setErr(`Videon är för stor (max ${Math.round(VIDEO_SOURCE_MAX_BYTES / 1024 / 1024)} MB innan komprimering).`);
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
      let uploadFile: File = file;

      // Videos over the safe size go through MediaRecorder re-encode
      // first. Target slightly under the cap to leave headroom for the
      // mp4/webm container overhead the encoder adds.
      if (previewKind === 'video' && file.size > UPLOAD_SAFE_BYTES) {
        setCompressProgress(0);
        const targetBytes = Math.floor(UPLOAD_SAFE_BYTES * 0.92);
        const blob = await compressVideoToTargetSize(file, {
          targetBytes,
          onProgress: (p) => setCompressProgress(p),
        });
        // If even the re-encode can't get small enough (very long video),
        // bail with a clear message rather than try a doomed upload.
        if (blob.size > UPLOAD_SAFE_BYTES) {
          throw new Error('klippet är för långt — klipp ner det eller använd YouTube-fliken');
        }
        const baseName = file.name.replace(/\.[^.]+$/, '') || 'video';
        uploadFile = new File([blob], `${baseName}.webm`, { type: blob.type || 'video/webm' });
        setCompressProgress(null);
      }

      const post = await createHallBinaryPost(uploadFile, previewKind, caption);
      onCreated(post);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'kunde inte ladda upp');
      setCompressProgress(null);
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
                  <span className="card-meta">Bilder upp till 4 MB. Större video komprimeras automatiskt i webbläsaren.</span>
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

          {compressProgress !== null && (
            <div className="hof-compress" aria-live="polite">
              <div className="hof-compress-label">
                <span>Komprimerar video…</span>
                <span className="hof-compress-pct">{Math.round(compressProgress * 100)}%</span>
              </div>
              <div className="hof-compress-bar">
                <div
                  className="hof-compress-fill"
                  style={{ width: `${Math.round(compressProgress * 100)}%` }}
                />
              </div>
              <p className="hof-compress-hint">
                Tar ungefär lika lång tid som klippet självt — släpp inte fliken.
              </p>
            </div>
          )}

          <div className="modal-photo-controls" style={{ marginTop: 8 }}>
            <button type="button" className="btn btn-purple" onClick={submit} disabled={busy}>
              {busy
                ? (compressProgress !== null ? 'Komprimerar…' : 'Laddar upp…')
                : 'Lägg upp'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>Avbryt</button>
          </div>
        </div>
      </div>
    </div>
  );
}

