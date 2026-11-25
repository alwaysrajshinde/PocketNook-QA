import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { applyDocumentQaBranding } from './utils/appBrand'

applyDocumentQaBranding();

// Register Service Worker for PWA
if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then((reg) => {
        console.log('[PWA] Service Worker registered with scope:', reg.scope);
      })
      .catch((err) => {
        console.log('[PWA] Service Worker registration failed:', err);
      });
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
