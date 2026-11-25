/**
 * chatContextService.js
 * Pure Context Builder & Conversation Memory Windowing for PocketNook Chat
 *
 * - Builds a compact, aggregated JSON snapshot (~<= 1500 tokens)
 * - Runs piiSanitizerService on ALL merchant/name/message text before leaving device
 * - Enforces opt-in "Use AI with my data" consent gate (default OFF)
 * - Trims conversation memory to the last 8 sanitized turns + compact summary of older turns
 */

import { sanitizeFinancialText } from './piiSanitizerService.js';

export const MAX_CONTEXT_CHAR_BUDGET = 4800; // ~1200–1500 tokens max
export const MAX_RECENT_TURNS = 8;

/**
 * Scrubs raw merchant/notes strings into safe generic merchant labels without personal names, VPAs, or PII
 */
export function toGenericMerchant(rawMerchant = '') {
  const { sanitizedText } = sanitizeFinancialText(String(rawMerchant || 'Expense'));
  const stripped = sanitizedText
    // Remove UPI handles like user@okicici or vpa refs
    .replace(/\b[a-zA-Z0-9._-]+@[a-zA-Z0-9]+\b/g, 'UPI Merchant')
    // Remove masked tokens into concise space
    .replace(/\[(?:PHONE|EMAIL|PAN|AADHAAR|CARD|UPI_REF)_MASKED\]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return (stripped || 'Expense').slice(0, 48);
}

/**
 * Builds the compact, privacy-safe financial snapshot for LLM context when consent is ON.
 * Returns null when shareFinancialDataConsent is false.
 *
 * @param {Object} params
 * @returns {Object|null}
 */
export function buildSafeChatContext({
  consentEnabled = false,
  dashboardData = {},
  recentTransactions = [],
  upcomingRecurring = [],
  currency = 'INR',
  month = null,
  now = new Date()
} = {}) {
  if (!consentEnabled) {
    return null;
  }

  const targetMonth = month || dashboardData?.month_key || now.toISOString().slice(0, 7);
  const monthlyBudget = Math.round(Number(dashboardData?.budget || 0) * 100) / 100;
  const spentThisMonth = Math.round(Number(dashboardData?.total_spent || 0) * 100) / 100;
  const remaining = Math.round(Number(dashboardData?.remaining_budget ?? (monthlyBudget - spentThisMonth)) * 100) / 100;
  const todaySpent = Math.round(Number(dashboardData?.today_spent || 0) * 100) / 100;

  const year = now.getFullYear();
  const monIdx = now.getMonth();
  const daysInMonth = new Date(year, monIdx + 1, 0).getDate();
  const daysLeft = Math.max(1, daysInMonth - now.getDate() + 1);
  const safeDailyPace = remaining > 0 ? Math.round(remaining / daysLeft) : 0;

  // Aggregated category totals (sorted highest spend first, capped at 12)
  const rawCats = Array.isArray(dashboardData?.category_breakdown) && dashboardData.category_breakdown.length > 0
    ? dashboardData.category_breakdown
    : (Array.isArray(dashboardData?.top_categories) ? dashboardData.top_categories : []);

  const categoryTotals = rawCats
    .map((c) => {
      const amt = Math.round(Number(c.spent ?? c.amount ?? 0) * 100) / 100;
      const pct = c.percent ?? c.percentage ?? (spentThisMonth > 0 ? Math.round((amt / spentThisMonth) * 100) : 0);
      return {
        category: String(c.name || c.category || 'Other').slice(0, 32),
        amount: amt,
        pctOfSpend: Math.round(Number(pct || 0))
      };
    })
    .filter((c) => c.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 12);

  // Last 10 recent transactions with generic scrubbed merchant labels
  const txList = (Array.isArray(recentTransactions) ? recentTransactions : [])
    .slice(0, 10)
    .map((tx) => ({
      date: String(tx.date || now.toISOString().slice(0, 10)).slice(0, 10),
      amount: Math.round(Number(tx.amount || 0) * 100) / 100,
      category: String(tx.category || 'Other').slice(0, 32),
      merchantGeneric: toGenericMerchant(tx.description || tx.merchant || 'Expense'),
      mode: String(tx.payment_mode || tx.paymentMode || 'UPI').slice(0, 16)
    }));

  // Optional upcoming fixed bills/subscriptions (scrubbed names)
  const fixedList = (Array.isArray(upcomingRecurring) ? upcomingRecurring : [])
    .filter((s) => s && s.status !== 'paused' && Number(s.amount) > 0)
    .slice(0, 6)
    .map((s) => ({
      name: toGenericMerchant(s.name || 'Subscription'),
      amount: Math.round(Number(s.amount || 0) * 100) / 100,
      dueDate: String(s.nextDueDate || s.dueDate || '').slice(0, 10)
    }));

  const snapshot = {
    month: targetMonth,
    currency: String(currency || 'INR').slice(0, 6),
    monthlyBudget,
    spentThisMonth,
    remaining,
    daysLeft,
    safeDailyPace,
    todaySpent,
    categoryTotals,
    recentTransactions: txList
  };

  if (fixedList.length > 0) {
    snapshot.upcomingFixed = fixedList;
  }

  // Enforce strict compact token/size cap (~1500 tokens max)
  while (JSON.stringify(snapshot).length > MAX_CONTEXT_CHAR_BUDGET && snapshot.recentTransactions.length > 0) {
    snapshot.recentTransactions.pop();
  }
  while (JSON.stringify(snapshot).length > MAX_CONTEXT_CHAR_BUDGET && snapshot.upcomingFixed?.length > 0) {
    snapshot.upcomingFixed.pop();
  }

  return snapshot;
}

/**
 * Prepares sanitized conversation history: keeps only the last 8 turns and summarizes older turns compactly.
 *
 * @param {Array} messages
 * @returns {{ recentTurns: Array<{role: string, content: string}>, olderSummary: string|null }}
 */
export function buildSanitizedConversationMemory(messages = []) {
  const conversational = (Array.isArray(messages) ? messages : [])
    .filter((m) => m && m.type !== 'onboarding_welcome' && typeof m.text === 'string' && m.text.trim())
    .map((m) => {
      const { sanitizedText } = sanitizeFinancialText(m.text);
      return {
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: sanitizedText.slice(0, 600),
        type: m.type || null
      };
    });

  if (conversational.length <= MAX_RECENT_TURNS) {
    return {
      recentTurns: conversational.map(({ role, content }) => ({ role, content })),
      olderSummary: null
    };
  }

  const older = conversational.slice(0, conversational.length - MAX_RECENT_TURNS);
  const recent = conversational.slice(-MAX_RECENT_TURNS);

  // Deterministic compact summary of older turns (zero PII, ~<= 240 chars)
  const userQueries = older
    .filter((m) => m.role === 'user')
    .slice(-4)
    .map((m) => m.content.slice(0, 40).replace(/\s+/g, ' '))
    .join('; ');

  const olderSummary = older.length > 0
    ? `Earlier in this chat (${older.length} turns): user discussed ${userQueries || 'expenses and budgeting'}.`
    : null;

  return {
    recentTurns: recent.map(({ role, content }) => ({ role, content })),
    olderSummary: olderSummary ? olderSummary.slice(0, 260) : null
  };
}
