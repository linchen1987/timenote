import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { initDesktopStores } from './lib/vault-store';
import './lib/fetch-patch';
import './app.css';

initDesktopStores().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
