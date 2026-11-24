/**
 * Centralized Application Version & Release Metadata
 * Automatically updated on every build, commit, and push
 */

export const APP_VERSION = 'v2.4.5';
export const APP_RELEASE_DATE = 'November 24, 2026';
export const APP_RELEASE_TIME = '06:50 PM';
export const APP_SHORT_DATE = '24 Nov 2026';
export const APP_INKED_DATETIME = '24 Nov 2026, 06:50 PM';
export const APP_BUILD_TIMESTAMP = '2026-11-24T13:20:44.078Z';

// Inked version string combining version number and exact release date & time
export const APP_INKED_VERSION = `${APP_VERSION} · Updated ${APP_SHORT_DATE} at ${APP_RELEASE_TIME}`;
export const APP_INKED_SHORT = `${APP_VERSION} (${APP_SHORT_DATE}, ${APP_RELEASE_TIME})`;

export const APP_CHANGELOG_SUMMARY = 'Mobile-first optimization, single-page expense modal, custom fintech dropdowns, unified reports analytics, and luxury welcome greeting.';

export const APP_EDITION = 'Windows & Android Edition · Offline-First';

export default {
  version: APP_VERSION,
  releaseDate: APP_RELEASE_DATE,
  releaseTime: APP_RELEASE_TIME,
  shortDate: APP_SHORT_DATE,
  releaseTimeShort: APP_RELEASE_TIME,
  inkedDateTime: APP_INKED_DATETIME,
  timestamp: APP_BUILD_TIMESTAMP,
  inkedVersion: APP_INKED_VERSION,
  inkedShort: APP_INKED_SHORT,
  changelogSummary: APP_CHANGELOG_SUMMARY,
  edition: APP_EDITION
};
