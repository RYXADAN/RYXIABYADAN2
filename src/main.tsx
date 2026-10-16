// Ensure window.fetch is writable and configurable to prevent "Cannot set property fetch of #<Window> which has only a getter"
try {
  if (typeof window !== 'undefined') {
    let _fetch = window.fetch;
    try {
      Object.defineProperty(window, 'fetch', {
        get: () => _fetch,
        set: (fn) => { _fetch = fn; },
        configurable: true,
        enumerable: true,
      });
    } catch {
      // ignore if already non-configurable
    }

    // Suppress Vite HMR WebSocket connection closed unhandled rejection
    // (In accordance with environment constraints: HMR is disabled in iFrame, ignore WebSocket errors)
    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason;
      const msg = reason?.message || String(reason || '');
      if (
        msg.includes('WebSocket') ||
        msg.includes('websocket') ||
        msg.includes('@vite/client') ||
        msg.includes('closed without opened')
      ) {
        event.preventDefault();
        event.stopImmediatePropagation?.();
      }
    });

    window.addEventListener('error', (event) => {
      const msg = event?.message || '';
      if (
        msg.includes('WebSocket') ||
        msg.includes('websocket') ||
        msg.includes('@vite/client') ||
        msg.includes('closed without opened')
      ) {
        event.preventDefault();
        event.stopImmediatePropagation?.();
      }
    });
  }
} catch {
  // ignore
}

import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import 'katex/dist/katex.min.css';
import './index.css';

createRoot(document.getElementById('root')!).render(<App />);
