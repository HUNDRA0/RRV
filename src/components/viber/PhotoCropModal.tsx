// Square-crop editor for friend photos.
//
// Admin picks an image → this modal opens with the image positioned inside
// a square frame. Drag to pan, slider (or wheel) to zoom. "Använd" renders
// the visible square via canvas to a fresh data URL (800×800 JPEG) which
// the caller uploads.
//
// Why bake the crop server-side instead of storing object-position metadata
// per photo:
//   - Existing photo display is in many places (carousel, leaderboard
//     avatars, modal, person cards) — all would need to read the metadata.
//   - Re-encoding once on upload keeps everything else simple.
//
// Cost: lose information (can't re-crop later without re-uploading the
// original). Acceptable for a 16-friend site; nobody's going to demand
// non-destructive edits.

import { useEffect, useRef, useState } from 'react';
import { useEsc, useLockBody } from '../../hooks/useViberHooks';

interface PhotoCropModalProps {
  // Source image as data URL. Passed in by the caller (read from a File).
  sourceDataUrl: string;
  // Final output dimensions in CSS px. 800 is a sensible default for
  // ~280px display @ 2× retina with some headroom for zoom.
  size?: number;
  onAccept: (dataUrl: string) => void;
  onCancel: () => void;
}

export function PhotoCropModal({
  sourceDataUrl,
  size = 800,
  onAccept,
  onCancel,
}: PhotoCropModalProps) {
  // The actual <img> we use as source for the final canvas. We keep its
  // natural dimensions to compute the visible region precisely.
  const imgRef = useRef<HTMLImageElement | null>(null);
  // The pan/zoom interaction happens in CSS pixels inside FRAME_PX × FRAME_PX.
  const [imgLoaded, setImgLoaded] = useState(false);
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  // Zoom is the multiplier on the base scale that fits the image's shorter
  // side to FRAME_PX. So at zoom=1 the image just fills the frame.
  const [zoom, setZoom] = useState(1);
  // offsetX/Y are the image's center expressed in frame coordinates
  // (FRAME_PX/2 = centered).
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  // Single-finger drag state.
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  // Live pointers on the frame (mouse, touch, pen). Pinch fires when 2 are
  // active simultaneously.
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  // Pinch state captured once when the second finger lands; all subsequent
  // pinch math reads from here so zoom doesn't drift between move events.
  const pinchRef = useRef<{ startDist: number; startZoom: number; startOffset: { x: number; y: number } } | null>(null);

  const FRAME_PX = 320; // size of the preview frame on screen
  useLockBody(true);
  useEsc(onCancel, true);

  // When image loads, compute initial state — fit image to frame, centered.
  function onImgLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const el = e.currentTarget;
    setNatural({ w: el.naturalWidth, h: el.naturalHeight });
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setImgLoaded(true);
  }

  // Computed display values
  const baseScale = natural.w === 0
    ? 1
    : FRAME_PX / Math.min(natural.w, natural.h);
  const scale = baseScale * zoom;
  const dispW = natural.w * scale;
  const dispH = natural.h * scale;
  // Constrain offset so the image always covers the frame (can't drag past edges).
  function clamp(o: { x: number; y: number }): { x: number; y: number } {
    const maxX = Math.max(0, (dispW - FRAME_PX) / 2);
    const maxY = Math.max(0, (dispH - FRAME_PX) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, o.x)),
      y: Math.max(-maxY, Math.min(maxY, o.y)),
    };
  }

  // Zoom in a way that keeps the frame's center mapped to the same source
  // pixel — without this, clicking +/− or moving the slider made the image
  // appear to stretch toward the top-left.
  function setZoomCentered(newZoom: number) {
    const z = clampZoom(newZoom);
    if (z === zoom) return;
    const f = z / zoom;
    // Compute the new max-offset bounds inline (state hasn't re-rendered yet
    // so clamp()'s closure would still see the old dimensions).
    const newScale = baseScale * z;
    const newDispW = natural.w * newScale;
    const newDispH = natural.h * newScale;
    const maxX = Math.max(0, (newDispW - FRAME_PX) / 2);
    const maxY = Math.max(0, (newDispH - FRAME_PX) / 2);
    setZoom(z);
    setOffset(o => ({
      x: Math.max(-maxX, Math.min(maxX, o.x * f)),
      y: Math.max(-maxY, Math.min(maxY, o.y * f)),
    }));
  }

  // Pointer + touch handling. One finger pans; two fingers pinch-zoom.
  function onPointerDown(e: React.PointerEvent) {
    if (!imgLoaded) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 1) {
      dragRef.current = {
        startX: e.clientX, startY: e.clientY,
        origX: offset.x, origY: offset.y,
      };
    } else if (pointersRef.current.size === 2) {
      // Second finger landed — abandon any in-flight drag and capture
      // pinch baseline.
      dragRef.current = null;
      const pts = [...pointersRef.current.values()];
      pinchRef.current = {
        startDist: Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y),
        startZoom: zoom,
        startOffset: { x: offset.x, y: offset.y },
      };
    }
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Two-finger pinch: zoom = startZoom * (currentDist / startDist).
    // Offset rescales proportionally so the frame-center source pixel
    // stays put.
    if (pointersRef.current.size >= 2 && pinchRef.current) {
      const pts = [...pointersRef.current.values()];
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const targetZoom = clampZoom(pinchRef.current.startZoom * (dist / pinchRef.current.startDist));
      const f = targetZoom / pinchRef.current.startZoom;
      const newScale = baseScale * targetZoom;
      const newDispW = natural.w * newScale;
      const newDispH = natural.h * newScale;
      const maxX = Math.max(0, (newDispW - FRAME_PX) / 2);
      const maxY = Math.max(0, (newDispH - FRAME_PX) / 2);
      setZoom(targetZoom);
      setOffset({
        x: Math.max(-maxX, Math.min(maxX, pinchRef.current.startOffset.x * f)),
        y: Math.max(-maxY, Math.min(maxY, pinchRef.current.startOffset.y * f)),
      });
      return;
    }

    // Single-finger drag.
    if (dragRef.current) {
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      setOffset(clamp({
        x: dragRef.current.origX + dx,
        y: dragRef.current.origY + dy,
      }));
    }
  }
  function onPointerUp(e: React.PointerEvent) {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (pointersRef.current.size === 0) dragRef.current = null;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  }

  // Wheel zoom — also center-anchored now.
  function onWheel(e: React.WheelEvent) {
    if (!imgLoaded) return;
    e.preventDefault();
    const delta = -e.deltaY * 0.0015;
    setZoomCentered(zoom * (1 + delta));
  }
  function clampZoom(z: number): number {
    return Math.max(1, Math.min(5, z));
  }

  // Reclamp the offset whenever zoom changes (otherwise zooming out can
  // leave the image off-frame).
  useEffect(() => { setOffset(o => clamp(o)); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, natural.w, natural.h]);

  // Render the visible square to a canvas at full output resolution and
  // hand the data URL up.
  async function accept() {
    const img = imgRef.current;
    if (!img || !imgLoaded) return;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Map frame coordinates → source pixel coordinates.
    // At zoom=1, FRAME_PX of frame ≡ min(natW,natH) of source.
    const srcVisible = FRAME_PX / scale; // src px shown along frame's short edge
    // The center of the source visible region, in source-pixel coords.
    // offset is "image center relative to frame center, in frame px".
    // → image center in source-px coords = (natW/2 - offset.x/scale, natH/2 - offset.y/scale)
    const cxSrc = natural.w / 2 - offset.x / scale;
    const cySrc = natural.h / 2 - offset.y / scale;
    const sx = cxSrc - srcVisible / 2;
    const sy = cySrc - srcVisible / 2;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(img, sx, sy, srcVisible, srcVisible, 0, 0, size, size);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    onAccept(dataUrl);
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div
        className="modal photo-crop-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Beskär bild"
      >
        <button className="modal-close" onClick={onCancel} aria-label="Stäng">✕</button>
        <div className="modal-info" style={{ padding: '24px 24px 20px' }}>
          <div className="section-eyebrow">Beskär bild</div>
          <h2 className="modal-name" style={{ fontSize: 22, marginBottom: 12 }}>
            Placera bilden
          </h2>
          <p className="card-meta" style={{ marginBottom: 14 }}>
            Dra för att flytta. Nyp med två fingrar för att zooma — eller använd hjulet / + / –.
          </p>

          <div
            className="photo-crop-frame"
            style={{ width: FRAME_PX, height: FRAME_PX }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onPointerLeave={onPointerUp}
            onWheel={onWheel}
          >
            <img
              ref={imgRef}
              src={sourceDataUrl}
              alt=""
              onLoad={onImgLoad}
              draggable={false}
              style={{
                width: dispW,
                height: dispH,
                transform: `translate(${offset.x}px, ${offset.y}px)`,
                visibility: imgLoaded ? 'visible' : 'hidden',
              }}
            />
            {/* Inner ring overlay shows what's kept */}
            <div className="photo-crop-mask" aria-hidden="true" />
          </div>

          <div className="photo-crop-controls">
            <button
              type="button"
              className="btn btn-ghost photo-crop-zoom-btn"
              onClick={() => setZoomCentered(zoom - 0.15)}
              aria-label="Zooma ut"
              disabled={zoom <= 1.001}
            >−</button>
            <input
              type="range"
              min={1}
              max={5}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoomCentered(parseFloat(e.target.value))}
              aria-label="Zoom"
              className="photo-crop-zoom-range"
            />
            <button
              type="button"
              className="btn btn-ghost photo-crop-zoom-btn"
              onClick={() => setZoomCentered(zoom + 0.15)}
              aria-label="Zooma in"
              disabled={zoom >= 4.999}
            >+</button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }); }}
              style={{ fontSize: 12 }}
            >Återställ</button>
          </div>

          <div className="modal-photo-controls" style={{ marginTop: 14 }}>
            <button type="button" className="btn btn-purple" onClick={accept} disabled={!imgLoaded}>
              Använd bild
            </button>
            <button type="button" className="btn btn-ghost" onClick={onCancel}>
              Avbryt
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
