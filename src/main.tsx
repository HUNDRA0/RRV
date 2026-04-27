import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { FriendsListProvider } from './lib/state';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FriendsListProvider>
      <App />
    </FriendsListProvider>
  </StrictMode>,
);
