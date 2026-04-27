// A character that softly drifts toward the cursor. Used for the big tier
// letters S / A / ? — purely decorative, low magnitude (~10px max), spring-eased
// via CSS transition. Skipped entirely on touch (`hover: none`) and when the
// user prefers reduced motion.

import { useEffect, useRef, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  className?: string;
  /** Maximum px the element drifts toward the cursor. Default 10. */
  strength?: number;
}

export function MagneticLetter({ children, className, strength = 10 }: Props) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Bail on devices without a real pointer or with reduced motion.
    if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let frame = 0;
    function onMove(e: MouseEvent) {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        // Smooth "magnetic" pull — distance-attenuated so far-away cursor
        // movement doesn't make it twitch.
        const dist = Math.hypot(dx, dy);
        const range = 240;
        const pull = dist > range ? 0 : 1 - dist / range;
        el.style.setProperty('--mx', `${(dx / range) * strength * pull}px`);
        el.style.setProperty('--my', `${(dy / range) * strength * pull}px`);
      });
    }
    function reset() {
      cancelAnimationFrame(frame);
      if (!el) return;
      el.style.setProperty('--mx', '0px');
      el.style.setProperty('--my', '0px');
    }

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseleave', reset);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseleave', reset);
    };
  }, [strength]);

  return (
    <span ref={ref} className={`magnetic ${className ?? ''}`}>
      {children}
    </span>
  );
}
