import { lazy, Suspense, useEffect, useState } from 'react';
import { App } from './App';
import { FriendsListProvider } from './lib/state';

// Lazy-load CatanPage — won't be included in the main bundle
const CatanPage = lazy(() =>
  import('./components/catan/CatanPage').then(m => ({ default: m.CatanPage })),
);

function useHash() {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  return hash;
}

export function Root() {
  const hash = useHash();
  const isCatan = hash === '#catan';

  if (isCatan) {
    return (
      <Suspense fallback={
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 20, background: 'var(--bg)', color: 'var(--ink)', fontFamily: 'var(--font-body)' }}>
          <span style={{ fontSize: 48 }}>🎲</span>
          <span style={{ fontSize: 16, color: 'var(--mute)' }}>Laddar Catan…</span>
        </div>
      }>
        <CatanPage />
      </Suspense>
    );
  }

  return (
    <FriendsListProvider>
      <App />
    </FriendsListProvider>
  );
}
