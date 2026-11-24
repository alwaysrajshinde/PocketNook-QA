/**
 * routeService.js
 * Comprehensive client-side routing, URL synchronization, and history management
 * Supports hash-based SPA routing with seamless GitHub Pages and direct path fallback.
 */

export const ROUTE_TABS = {
  HOME: 'home',
  TRANSACTIONS: 'transactions',
  REPORTS: 'reports',
  SETTINGS: 'settings'
};

export const SETTINGS_SECTIONS = {
  BUDGET: 'budget',
  CATEGORIES: 'categories',
  THEME: 'theme',
  DATA: 'data',
  SECURITY: 'security',
  PROFILE: 'profile',
  LANGUAGE: 'language',
  HELP: 'help'
};

const STORAGE_ACTIVE_ROUTE_KEY = 'expense_tracker_active_route';
const STORAGE_INTENDED_ROUTE_KEY = 'expense_tracker_intended_route';

/**
 * Normalizes a raw path/hash into path string and query parameters
 */
function extractPathAndQuery(locationObj = typeof window !== 'undefined' ? window.location : {}) {
  let raw = '';

  // 1. Prioritize hash if present (e.g. #/transactions, #/settings/budget?foo=bar)
  if (locationObj.hash && locationObj.hash.length > 1) {
    raw = locationObj.hash.slice(1); // remove leading '#'
  } else if (locationObj.pathname) {
    // 2. Fall back to pathname (e.g. /transactions, /PocketNook/transactions, /PocketNook-QA/)
    let p = locationObj.pathname;
    // Strip GitHub Pages repository base name if present
    p = p.replace(/^\/(?:expense-tracker|pocketnook(?:-[a-z0-9_-]+)?)(?:\/|$)/i, '/');
    raw = p;
  }

  // 3. Check for GitHub Pages SPA 404 query param (e.g. ?p=/transactions)
  if (locationObj.search) {
    try {
      const sp = new URLSearchParams(locationObj.search);
      if (sp.has('p')) {
        raw = sp.get('p') || '';
      } else if (sp.has('route')) {
        raw = sp.get('route') || '';
      }
    } catch (e) {}
  }

  // Clean raw string
  raw = (raw || '').trim();
  if (raw.startsWith('#')) raw = raw.slice(1);
  if (raw.startsWith('/')) raw = raw.slice(1);

  // Strip repository prefix if present inside hash (e.g. #/PocketNook, #/PocketNook-QA, or #PocketNook/transactions)
  raw = raw.replace(/^(?:expense-tracker|pocketnook(?:-[a-z0-9_-]+)?)(?:\/|$)/i, '');
  // Also clean up any accidental leading '-qa/' or '-qa' if previous malformed path was entered
  raw = raw.replace(/^-qa(?:\/|$)/i, '');
  if (raw.startsWith('/')) raw = raw.slice(1);

  let [pathPart, queryPart] = raw.split('?');
  pathPart = (pathPart || '').toLowerCase().trim();
  // Strip trailing slashes
  pathPart = pathPart.replace(/\/+$/, '');

  const searchParams = new URLSearchParams(queryPart || (locationObj.search ? locationObj.search.slice(1) : ''));
  return { pathPart, searchParams, rawOriginal: raw };
}

/**
 * Parses current browser location and returns structured route state
 */
export function parseRoute(locationObj = typeof window !== 'undefined' ? window.location : {}) {
  const { pathPart, searchParams, rawOriginal } = extractPathAndQuery(locationObj);

  // Default empty route or repo root -> Overview
  if (!pathPart || pathPart === 'index.html' || pathPart === '/' || pathPart === 'home' || pathPart === 'overview' || pathPart === 'pocketnook' || pathPart === 'pocketnook-qa' || pathPart === '-qa' || pathPart === 'expense-tracker') {
    return {
      tab: ROUTE_TABS.HOME,
      section: null,
      reportsTab: 'overview',
      isValid: true,
      isDefault: true,
      canonicalHash: '#/overview'
    };
  }

  // Transactions
  if (pathPart === 'transactions' || pathPart === 'tx') {
    return {
      tab: ROUTE_TABS.TRANSACTIONS,
      section: null,
      reportsTab: 'overview',
      isValid: true,
      canonicalHash: '#/transactions'
    };
  }

  // Reports (with optional sub-tab in query or sub-path)
  if (pathPart === 'reports' || pathPart.startsWith('reports/')) {
    let reportsTab = searchParams.get('tab') || 'overview';
    if (pathPart === 'reports/categories' || pathPart === 'reports/category') reportsTab = 'category';
    else if (pathPart === 'reports/payment' || pathPart === 'reports/paymentmodes') reportsTab = 'payment';
    else if (pathPart === 'reports/yearly') reportsTab = 'yearly';
    else if (pathPart === 'reports/overview') reportsTab = 'overview';

    // Normalize
    if (!['overview', 'category', 'payment', 'yearly'].includes(reportsTab)) {
      reportsTab = 'overview';
    }

    return {
      tab: ROUTE_TABS.REPORTS,
      section: null,
      reportsTab,
      isValid: true,
      canonicalHash: reportsTab && reportsTab !== 'overview' ? `#/reports?tab=${reportsTab}` : '#/reports'
    };
  }

  // More / Settings
  if (pathPart === 'settings' || pathPart === 'more' || pathPart.startsWith('settings/') || pathPart.startsWith('more/')) {
    let section = searchParams.get('section') || null;

    if (pathPart.includes('/budget')) section = SETTINGS_SECTIONS.BUDGET;
    else if (pathPart.includes('/categories') || pathPart.includes('/category')) section = SETTINGS_SECTIONS.CATEGORIES;
    else if (pathPart.includes('/theme') || pathPart.includes('/appearance')) section = SETTINGS_SECTIONS.THEME;
    else if (pathPart.includes('/export') || pathPart.includes('/data') || pathPart.includes('/backup')) section = SETTINGS_SECTIONS.DATA;
    else if (pathPart.includes('/security') || pathPart.includes('/account')) section = SETTINGS_SECTIONS.SECURITY;
    else if (pathPart.includes('/profile')) section = SETTINGS_SECTIONS.PROFILE;
    else if (pathPart.includes('/language')) section = SETTINGS_SECTIONS.LANGUAGE;
    else if (pathPart.includes('/help') || pathPart.includes('/support')) section = SETTINGS_SECTIONS.HELP;

    return {
      tab: ROUTE_TABS.SETTINGS,
      section: section || null,
      reportsTab: 'overview',
      isValid: true,
      canonicalHash: section ? `#/settings/${section}` : '#/more'
    };
  }

  // Direct Shortcuts
  if (pathPart === 'budget') {
    return {
      tab: ROUTE_TABS.SETTINGS,
      section: SETTINGS_SECTIONS.BUDGET,
      reportsTab: 'overview',
      isValid: true,
      canonicalHash: '#/settings/budget'
    };
  }

  if (pathPart === 'categories') {
    return {
      tab: ROUTE_TABS.SETTINGS,
      section: SETTINGS_SECTIONS.CATEGORIES,
      reportsTab: 'overview',
      isValid: true,
      canonicalHash: '#/settings/categories'
    };
  }

  if (pathPart === 'appearance' || pathPart === 'theme') {
    return {
      tab: ROUTE_TABS.SETTINGS,
      section: SETTINGS_SECTIONS.THEME,
      reportsTab: 'overview',
      isValid: true,
      canonicalHash: '#/settings/appearance'
    };
  }

  if (pathPart === 'export' || pathPart === 'backup') {
    return {
      tab: ROUTE_TABS.SETTINGS,
      section: SETTINGS_SECTIONS.DATA,
      reportsTab: 'overview',
      isValid: true,
      canonicalHash: '#/settings/export'
    };
  }

  if (pathPart === 'security') {
    return {
      tab: ROUTE_TABS.SETTINGS,
      section: SETTINGS_SECTIONS.SECURITY,
      reportsTab: 'overview',
      isValid: true,
      canonicalHash: '#/settings/security'
    };
  }

  if (pathPart === 'profile') {
    return {
      tab: ROUTE_TABS.SETTINGS,
      section: SETTINGS_SECTIONS.PROFILE,
      reportsTab: 'overview',
      isValid: true,
      canonicalHash: '#/settings/profile'
    };
  }

  if (pathPart === 'privacy' || pathPart === 'terms') {
    return {
      tab: 'legal',
      legalType: pathPart,
      isValid: true,
      canonicalHash: `#/${pathPart}`
    };
  }

  // Check fallback in sessionStorage before declaring invalid
  try {
    const saved = sessionStorage.getItem(STORAGE_ACTIVE_ROUTE_KEY);
    if (saved && (!pathPart || pathPart === 'index.html')) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.tab && parsed.tab !== 'not_found') {
        return { ...parsed, isValid: true };
      }
    }
  } catch (e) {}

  // Unknown route
  return {
    tab: 'not_found',
    section: null,
    reportsTab: 'overview',
    isValid: false,
    rawPath: rawOriginal || pathPart,
    canonicalHash: `#/404?path=${encodeURIComponent(rawOriginal || pathPart)}`
  };
}

/**
 * Formats a route state into a canonical URL hash string
 */
export function formatRoute(route = {}) {
  const { tab = ROUTE_TABS.HOME, section = null, reportsTab = 'overview' } = route;

  if (tab === ROUTE_TABS.HOME) {
    return '#/overview';
  }

  if (tab === ROUTE_TABS.TRANSACTIONS) {
    return '#/transactions';
  }

  if (tab === ROUTE_TABS.REPORTS) {
    return reportsTab && reportsTab !== 'overview' ? `#/reports?tab=${reportsTab}` : '#/reports';
  }

  if (tab === ROUTE_TABS.SETTINGS) {
    if (section === SETTINGS_SECTIONS.BUDGET) return '#/settings/budget';
    if (section === SETTINGS_SECTIONS.CATEGORIES) return '#/settings/categories';
    if (section === SETTINGS_SECTIONS.THEME) return '#/settings/appearance';
    if (section === SETTINGS_SECTIONS.DATA) return '#/settings/export';
    if (section === SETTINGS_SECTIONS.SECURITY) return '#/settings/security';
    if (section === SETTINGS_SECTIONS.PROFILE) return '#/settings/profile';
    if (section === SETTINGS_SECTIONS.LANGUAGE) return '#/settings/language';
    if (section === SETTINGS_SECTIONS.HELP) return '#/settings/help';
    return '#/more';
  }

  if (tab === 'legal' && route.legalType) {
    return `#/${route.legalType}`;
  }

  return '#/overview';
}

/**
 * Synchronizes route state to browser URL hash and sessionStorage
 */
export function syncRouteToUrl(route = {}, replace = false) {
  if (typeof window === 'undefined') return;

  const targetHash = formatRoute(route);

  try {
    sessionStorage.setItem(STORAGE_ACTIVE_ROUTE_KEY, JSON.stringify({
      tab: route.tab,
      section: route.section || null,
      reportsTab: route.reportsTab || 'overview'
    }));
  } catch (e) {}

  // Avoid pushing duplicate history entries if hash already matches
  if (window.location.hash !== targetHash) {
    if (replace) {
      window.history.replaceState(null, '', targetHash);
    } else {
      window.history.pushState(null, '', targetHash);
    }
  }
}

/**
 * Saves intended route before redirecting unauthenticated users to login
 */
export function saveIntendedRoute() {
  if (typeof window === 'undefined') return;
  try {
    const hash = window.location.hash || '';
    const pathname = window.location.pathname || '';
    
    // Normalize path/hash to test if it's just the root or repo slug
    let clean = (hash.length > 1 ? hash.slice(1) : pathname).toLowerCase().trim();
    clean = clean.replace(/^\/(?:expense-tracker|pocketnook(?:-[a-z0-9_-]+)?)(?:\/|$)/i, '/');
    clean = clean.replace(/^(?:expense-tracker|pocketnook(?:-[a-z0-9_-]+)?)(?:\/|$)/i, '');
    clean = clean.replace(/^-qa(?:\/|$)/i, '');
    clean = clean.replace(/^\/+/, '').replace(/\/+$/, '');

    // Only save genuinely deep routes like transactions, reports, settings/budget
    if (clean && clean !== 'home' && clean !== 'overview' && clean !== 'index.html' && clean !== 'privacy' && clean !== 'terms' && clean !== 'pocketnook' && clean !== 'pocketnook-qa' && clean !== '-qa' && clean !== 'expense-tracker') {
      const current = hash || pathname;
      sessionStorage.setItem(STORAGE_INTENDED_ROUTE_KEY, current);
    }
  } catch (e) {}
}

/**
 * Consumes and returns saved intended route upon successful login
 */
export function consumeIntendedRoute() {
  if (typeof window === 'undefined') return null;
  try {
    const route = sessionStorage.getItem(STORAGE_INTENDED_ROUTE_KEY);
    if (route) {
      sessionStorage.removeItem(STORAGE_INTENDED_ROUTE_KEY);
      return route;
    }
  } catch (e) {}
  return null;
}
