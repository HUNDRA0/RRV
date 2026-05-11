// Canvas-based image crop modal. Shown after the admin selects a file.
// The user drags a crop rectangle, confirms, and we export a cropped JPEG
// data URL that's then passed to the photo upload handler.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface Rect { x: number; y: number; w: number; h: number }
type Handle = 'nw' | 'ne' | 'sw' | 'se' | 'move' | null;

interface Props {
  file: File;
  onConfirm: (dataUrl: string) => void;
  onCancel: () => void;
}

const HANDLE_R = 8;
const MIN_SIZE = 40;

export function ImageCropModal({ file, onConfirm, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [scale, setScale] = useState(1);
  const [crop, setCrop] = useState<Rect>({ x: 0, y: 0, w: 0, h: 0 });
  const [dragging, setDragging] = useState<Handle>(null);
  const dragStart = useRef<{ mx: number; my: number; crop: Rect } | null>(null);

  // Load image from file
  useEffect(() => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      setImg(image);
      URL.revokeObjectURL(url);
    };
    image.src = url;
  }, [file]);

  // Fit image in 640×480 canvas area
  useLayoutEffect(() => {
    if (!img || !canvasRef.current) return;
    const maxW = Math.min(640, window.innerWidth - 48);
    const maxH = Math.min(480, window.innerHeight - 220);
    const s = Math.min(maxW / img.width, maxH / img.height, 1);
    setScale(s);
    const w = img.width * s;
    const h = img.height * s;
    canvasRef.current.width = w;
    canvasRef.current.height = h;
    // Default crop: center square at 80%
    const side = Math.min(w, h) * 0.8;
    setCrop({ x: (w - side) / 2, y: (h - side) / 2, w: side, h: side });
  }, [img]);

  // Redraw whenever crop changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d')!;
    const cw = canvas.width, ch = canvas.height;

    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(img, 0, 0, cw, ch);

    // Dim outside crop
    ctx.fillStyle = 'rgba(0,0,0,0.52)';
    ctx.fillRect(0, 0, cw, crop.y);                           // top
    ctx.fillRect(0, crop.y + crop.h, cw, ch - crop.y - crop.h); // bottom
    ctx.fillRect(0, crop.y, crop.x, crop.h);                  // left
    ctx.fillRect(crop.x + crop.w, crop.y, cw - crop.x - crop.w, crop.h); // right

    // Crop border
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(crop.x, crop.y, crop.w, crop.h);

    // Rule-of-thirds grid
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 0.7;
    for (let i = 1; i < 3; i++) {
      const x = crop.x + (crop.w / 3) * i;
      const y = crop.y + (crop.h / 3) * i;
      ctx.beginPath(); ctx.moveTo(x, crop.y); ctx.lineTo(x, crop.y + crop.h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(crop.x, y); ctx.lineTo(crop.x + crop.w, y); ctx.stroke();
    }

    // Corner handles
    const corners: [number, number][] = [
      [crop.x, crop.y], [crop.x + crop.w, crop.y],
      [crop.x, crop.y + crop.h], [crop.x + crop.w, crop.y + crop.h],
    ];
    for (const [hx, hy] of corners) {
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(hx, hy, HANDLE_R, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(139,92,246,0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(hx, hy, HANDLE_R, 0, Math.PI * 2); ctx.stroke();
    }
  }, [img, crop]);

  function hitHandle(x: number, y: number): Handle {
    const { x: cx, y: cy, w: cw, h: ch } = crop;
    const corners: [number, number, Handle][] = [
      [cx, cy, 'nw'], [cx + cw, cy, 'ne'],
      [cx, cy + ch, 'sw'], [cx + cw, cy + ch, 'se'],
    ];
    for (const [hx, hy, name] of corners) {
      if (Math.hypot(x - hx, y - hy) <= HANDLE_R + 4) return name;
    }
    if (x >= cx && x <= cx + cw && y >= cy && y <= cy + ch) return 'move';
    return null;
  }

  function canvasPoint(e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const { x, y } = canvasPoint(e);
    const hit = hitHandle(x, y);
    if (!hit) return;
    setDragging(hit);
    dragStart.current = { mx: x, my: y, crop: { ...crop } };
  }

  function onMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!dragging || !dragStart.current || !canvasRef.current) return;
    const { x, y } = canvasPoint(e);
    const dx = x - dragStart.current.mx;
    const dy = y - dragStart.current.my;
    const base = dragStart.current.crop;
    const cw = canvasRef.current.width;
    const ch = canvasRef.current.height;

    setCrop(prev => {
      let { x: nx, y: ny, w: nw, h: nh } = { ...prev };
      if (dragging === 'move') {
        nx = Math.max(0, Math.min(cw - nw, base.x + dx));
        ny = Math.max(0, Math.min(ch - nh, base.y + dy));
      } else {
        if (dragging.includes('n')) {
          ny = Math.min(base.y + base.h - MIN_SIZE, base.y + dy);
          nh = base.y + base.h - ny;
        }
        if (dragging.includes('s')) {
          nh = Math.max(MIN_SIZE, base.h + dy);
        }
        if (dragging.includes('w')) {
          nx = Math.min(base.x + base.w - MIN_SIZE, base.x + dx);
          nw = base.x + base.w - nx;
        }
        if (dragging.includes('e')) {
          nw = Math.max(MIN_SIZE, base.w + dx);
        }
        // Clamp to canvas
        nx = Math.max(0, nx); ny = Math.max(0, ny);
        nw = Math.min(cw - nx, nw); nh = Math.min(ch - ny, nh);
      }
      return { x: nx, y: ny, w: nw, h: nh };
    });
  }

  function onMouseUp() { setDragging(null); dragStart.current = null; }

  function getCursor(): string {
    if (dragging === 'move') return 'grabbing';
    if (dragging) return `${dragging}-resize`;
    return 'crosshair';
  }

  function confirm() {
    if (!img) return;
    const out = document.createElement('canvas');
    const srcX = crop.x / scale;
    const srcY = crop.y / scale;
    const srcW = crop.w / scale;
    const srcH = crop.h / scale;
    out.width = Math.round(srcW);
    out.height = Math.round(srcH);
    out.getContext('2d')!.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, out.width, out.height);
    onConfirm(out.toDataURL('image/jpeg', 0.88));
  }

  return createPortal(
    <div
      className="pdm-scrim is-open"
      style={{ zIndex: 10000 }}
      role="dialog"
      aria-modal="true"
      aria-label="Beskär bild"
    >
      <div className="crop-modal">
        <div className="crop-header">
          <span className="crop-title">Beskär bild</span>
          <span className="crop-hint">Dra hörnen för att justera · Klicka inuti för att flytta</span>
        </div>
        {img ? (
          <canvas
            ref={canvasRef}
            className="crop-canvas"
            style={{ cursor: getCursor(), display: 'block', maxWidth: '100%' }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
          />
        ) : (
          <div className="crop-loading">Laddar bild…</div>
        )}
        <div className="crop-footer">
          <button type="button" className="nav-btn" onClick={onCancel}>Avbryt</button>
          <button type="button" className="nav-btn primary" onClick={confirm} disabled={!img}>
            Beskär &amp; Ladda upp
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
