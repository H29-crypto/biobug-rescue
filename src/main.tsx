import React from 'react';
import ReactDOM from 'react-dom/client';
import Experiences from './Experiences';
import './styles.css';
import './academic.css';

const chunkRetryKey = 'biobug:chunk-retry-at';
const chunkRetryWindow = 15_000;
try {
  const currentUrl = new URL(window.location.href);
  if (currentUrl.searchParams.has('_asset_retry')) {
    currentUrl.searchParams.delete('_asset_retry');
    window.history.replaceState(null, '', currentUrl.pathname + currentUrl.search + currentUrl.hash);
  }
  const previousRetry = Number(window.sessionStorage.getItem(chunkRetryKey));
  const remaining = chunkRetryWindow - (Date.now() - previousRetry);
  if (previousRetry && remaining > 0) {
    window.setTimeout(() => window.sessionStorage.removeItem(chunkRetryKey), remaining);
  }
} catch { /* Continue to the app when browser storage is unavailable. */ }
window.addEventListener('vite:preloadError', event => {
  try {
    const previousRetry = Number(window.sessionStorage.getItem(chunkRetryKey));
    if (Date.now() - previousRetry < chunkRetryWindow) return;
    window.sessionStorage.setItem(chunkRetryKey, String(Date.now()));
    event.preventDefault();
    const retryUrl = new URL(window.location.href);
    retryUrl.searchParams.set('_asset_retry', String(Date.now()));
    window.location.replace(retryUrl.toString());
  } catch { /* The route error boundary will provide manual recovery. */ }
});
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><Experiences /></React.StrictMode>);
