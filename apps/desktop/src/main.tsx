import { parseNotebookId } from '@timenote/core';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { initAutomationBridge } from './lib/automation/bridge';
import { getCurrentNotebookToken, isListWindow } from './lib/notebook-window';
import { initDesktopStores } from './lib/vault-store';
import './lib/fetch-patch';
import './app.css';

function automationProjectId(): string | null {
  const token = getCurrentNotebookToken();
  if (token) return parseNotebookId(token) || token.split('_')[0] || null;
  if (isListWindow()) return null;
  return null;
}

initDesktopStores()
  .then(async () => {
    // The automation runtime lives at window level: it survives route
    // changes and serves broker requests as long as this WebView is alive.
    await initAutomationBridge(automationProjectId());
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  })
  .catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[timenote] init failed:', err);
    const root = document.getElementById('root');
    if (root) {
      root.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;padding:2rem;font-family:system-ui,sans-serif;color:#dc2626;text-align:center;">
          <h1 style="font-size:1.25rem;font-weight:700;margin-bottom:0.75rem;">应用初始化失败</h1>
          <pre style="white-space:pre-wrap;word-break:break-word;max-width:42rem;font-size:0.875rem;line-height:1.5;">${message}</pre>
        </div>`;
    }
  });
