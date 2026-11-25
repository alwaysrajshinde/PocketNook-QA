/**
 * chatStorageService.js
 * IndexedDB-backed Sanitized Chat Storage, Learned Preferences & Local Telemetry
 *
 * Replaces plaintext localStorage chat storage:
 * - Partitions chat threads, learned merchant mappings, and budget ratios by userId
 * - Runs sanitizeFinancialText() on every message BEFORE disk persistence (no cosmetic scrubbing)
 * - Caps conversation retention to the most recent 200 messages
 * - Purges legacy unencrypted localStorage chat key automatically
 * - Tracks anonymous local quality signals (edit rate, undo rate, time-to-log, active weeks)
 */

import { sanitizeFinancialText } from './piiSanitizerService.js';

const DB_NAME = 'pocketnook_chat_db';
const DB_VERSION = 1;
const STORE_CONVERSATIONS = 'conversations';
const STORE_PREFERENCES = 'preferences';
const STORE_TELEMETRY = 'telemetry';
const LEGACY_LOCALSTORAGE_KEY = 'expense_tracker_whatsapp_chat';
export const MAX_CHAT_HISTORY_MESSAGES = 200;

const memoryFallback = {
  conversations: new Map(),
  preferences: new Map(),
  telemetry: new Map()
};

function normalizeUserId(userId) {
  return (userId || 'guest').toString().trim().toLowerCase() || 'guest';
}

function openChatDB() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_CONVERSATIONS)) {
        db.createObjectStore(STORE_CONVERSATIONS, { keyPath: 'userId' });
      }
      if (!db.objectStoreNames.contains(STORE_PREFERENCES)) {
        db.createObjectStore(STORE_PREFERENCES, { keyPath: 'userId' });
      }
      if (!db.objectStoreNames.contains(STORE_TELEMETRY)) {
        db.createObjectStore(STORE_TELEMETRY, { keyPath: 'userId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
  });
}

async function idbGet(storeName, key) {
  try {
    const db = await openChatDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    return memoryFallback[storeName]?.get(key) || null;
  }
}

async function idbPut(storeName, value) {
  memoryFallback[storeName]?.set(value.userId, value);
  try {
    const db = await openChatDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(value);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    // Graceful memory fallback
  }
}

/**
 * Ensures any persisted message only stores masked/sanitized text
 */
export function sanitizeMessageForStorage(msg) {
  if (!msg || typeof msg !== 'object') return msg;
  const { sanitizedText } = sanitizeFinancialText(String(msg.text || ''));
  return {
    ...msg,
    text: sanitizedText
  };
}

/**
 * Loads sanitized chat messages from IndexedDB (purging legacy plaintext localStorage if present)
 */
export async function loadChatHistory(userId) {
  const uid = normalizeUserId(userId);
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem(LEGACY_LOCALSTORAGE_KEY)) {
      localStorage.removeItem(LEGACY_LOCALSTORAGE_KEY);
    }
  } catch (e) {}

  const record = await idbGet(STORE_CONVERSATIONS, uid);
  if (record && Array.isArray(record.messages) && record.messages.length > 0) {
    return record.messages.slice(-MAX_CHAT_HISTORY_MESSAGES).map(sanitizeMessageForStorage);
  }
  return null;
}

/**
 * Saves sanitized chat messages to IndexedDB with a strict 200-message cap
 */
export async function saveChatHistory(userId, messages = []) {
  const uid = normalizeUserId(userId);
  const capped = (Array.isArray(messages) ? messages : [])
    .slice(-MAX_CHAT_HISTORY_MESSAGES)
    .map(sanitizeMessageForStorage);

  await idbPut(STORE_CONVERSATIONS, {
    userId: uid,
    messages: capped,
    updatedAt: new Date().toISOString()
  });
}

/**
 * Clears stored chat messages for a user
 */
export async function clearChatHistoryStorage(userId) {
  const uid = normalizeUserId(userId);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(LEGACY_LOCALSTORAGE_KEY);
    }
  } catch (e) {}

  await idbPut(STORE_CONVERSATIONS, {
    userId: uid,
    messages: [],
    updatedAt: new Date().toISOString()
  });
}

/**
 * Loads user personalization preferences (learned merchant -> category mappings & budget allocation ratios)
 */
export async function loadCopilotPreferences(userId) {
  const uid = normalizeUserId(userId);
  const record = await idbGet(STORE_PREFERENCES, uid);
  return {
    userId: uid,
    learnedCategories: record?.learnedCategories || {},
    budgetRatios: record?.budgetRatios || { needs: 50, wants: 30, savings: 20 }
  };
}

/**
 * Learns a merchant -> category override after a user edits/corrects an expense card
 */
export async function learnMerchantCategory(userId, merchant, category) {
  if (!merchant || !category) return null;
  const uid = normalizeUserId(userId);
  const prefs = await loadCopilotPreferences(uid);
  const cleanKey = String(merchant).trim().toLowerCase();
  if (!cleanKey) return prefs;

  const updated = {
    ...prefs,
    learnedCategories: {
      ...prefs.learnedCategories,
      [cleanKey]: category
    },
    updatedAt: new Date().toISOString()
  };
  await idbPut(STORE_PREFERENCES, updated);
  return updated;
}

/**
 * Saves custom Needs/Wants/Savings ratios for cultural/household alignment (e.g. EMI-heavy 55/25/20)
 */
export async function saveBudgetRatios(userId, ratios) {
  const uid = normalizeUserId(userId);
  const prefs = await loadCopilotPreferences(uid);
  const updated = {
    ...prefs,
    budgetRatios: ratios,
    updatedAt: new Date().toISOString()
  };
  await idbPut(STORE_PREFERENCES, updated);
  return updated;
}

/**
 * Infers user's most frequent payment mode from transaction history
 */
export function inferDefaultPaymentMode(transactions = []) {
  if (!Array.isArray(transactions) || transactions.length === 0) return 'UPI';
  const counts = {};
  for (const tx of transactions) {
    const mode = tx?.payment_mode || tx?.paymentMode;
    if (mode) counts[mode] = (counts[mode] || 0) + 1;
  }
  let topMode = 'UPI';
  let topCount = 0;
  for (const [mode, count] of Object.entries(counts)) {
    if (count > topCount) {
      topCount = count;
      topMode = mode;
    }
  }
  return topMode;
}

/**
 * Records local quality & accuracy telemetry metrics
 */
export async function recordCopilotMetric(userId, eventType, payload = {}) {
  const uid = normalizeUserId(userId);
  const current = (await idbGet(STORE_TELEMETRY, uid)) || {
    userId: uid,
    logsCount: 0,
    editCount: 0,
    undoCount: 0,
    parseFailures: 0,
    totalTimeToLogMs: 0,
    timedLogCount: 0,
    lastActiveDate: null
  };

  const todayStr = new Date().toISOString().slice(0, 10);
  const updated = {
    ...current,
    lastActiveDate: todayStr,
    updatedAt: new Date().toISOString()
  };

  if (eventType === 'log_success') {
    updated.logsCount += 1;
    if (typeof payload.durationMs === 'number' && payload.durationMs > 0 && payload.durationMs < 120000) {
      updated.totalTimeToLogMs += payload.durationMs;
      updated.timedLogCount += 1;
    }
  } else if (eventType === 'edit_card') {
    updated.editCount += 1;
  } else if (eventType === 'undo') {
    updated.undoCount += 1;
  } else if (eventType === 'parse_failure') {
    updated.parseFailures += 1;
  }

  await idbPut(STORE_TELEMETRY, updated);
  return updated;
}

export async function getCopilotTelemetry(userId) {
  const uid = normalizeUserId(userId);
  const stats = (await idbGet(STORE_TELEMETRY, uid)) || {
    logsCount: 0,
    editCount: 0,
    undoCount: 0,
    parseFailures: 0,
    totalTimeToLogMs: 0,
    timedLogCount: 0
  };
  const totalLogs = Math.max(1, stats.logsCount);
  return {
    ...stats,
    editRatePercent: stats.logsCount > 0 ? Math.round((stats.editCount / totalLogs) * 100) : 0,
    undoRatePercent: stats.logsCount > 0 ? Math.round((stats.undoCount / totalLogs) * 100) : 0,
    avgTimeToLogMs: stats.timedLogCount > 0 ? Math.round(stats.totalTimeToLogMs / stats.timedLogCount) : 0
  };
}
