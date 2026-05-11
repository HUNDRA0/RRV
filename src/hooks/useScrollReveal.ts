import { useEffect } from 'react';

export function useScrollReveal(dep?: unknown) {
  useEffect(() => {
    const targets = document.querySelectorAll<HTMLElement>('.reveal:not(.in-view)');
    if (!targets.length) return;

    const obs = new IntersectionObserver(
      entries => {
        entries.forEach((entry, i) => {
          if (!entry.isIntersecting) return;
          const delay = Math.min(i * 40, 200);
          setTimeout(() => entry.target.classList.add('in-view'), delay);
          obs.unobserve(entry.target);
        });
      },
      { threshold: 0.04 },
    );

    let staggerIdx = 0;
    targets.forEach(el => {
      const rect = el.getBoundingClientRect();
      const inViewport = rect.top < window.innerHeight && rect.bottom > 0;
      if (inViewport) {
        const delay = Math.min(staggerIdx * 40, 200);
        staggerIdx++;
        setTimeout(() => el.classList.add('in-view'), delay);
      } else {
        obs.observe(el);
      }
    });

    return () => obs.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dep]);
}
