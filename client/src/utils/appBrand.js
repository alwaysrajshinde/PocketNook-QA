export function isQaEnvironment() {
  if (import.meta.env?.VITE_IS_QA === 'true') return true;
  if (typeof window === 'undefined') return false;
  const path = (window.location?.pathname || '').toLowerCase();
  const host = (window.location?.hostname || '').toLowerCase();
  return path.includes('pocketnook-qa') || host.includes('-qa');
}

export const IS_QA = isQaEnvironment();
export const APP_DISPLAY_NAME = IS_QA ? 'PocketNook QA' : 'PocketNook';
export const CHAT_DISPLAY_NAME = IS_QA ? 'PocketNook Chat · QA' : 'PocketNook Chat';

export function applyDocumentQaBranding() {
  if (!IS_QA || typeof document === 'undefined') return;
  document.title = 'PocketNook QA';
  const appNameMeta = document.querySelector('meta[name="application-name"]');
  if (appNameMeta) appNameMeta.setAttribute('content', 'PocketNook QA');
  const appleTitleMeta = document.querySelector('meta[name="apple-mobile-web-app-title"]');
  if (appleTitleMeta) appleTitleMeta.setAttribute('content', 'PocketNook QA');
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) themeMeta.setAttribute('content', '#D97706');
  const iconLink = document.querySelector('link[rel="icon"]');
  if (iconLink) iconLink.setAttribute('href', './icon-qa.svg');
}
