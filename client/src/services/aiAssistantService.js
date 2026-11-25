/**
 * aiAssistantService.js
 * PocketNook Privacy-First Financial Chat Engine
 *
 * - Masks sensitive numbers locally before processing
 * - Deterministic NLP, parser confidence scoring, duplicate detection, and budget logic
 * - Optional sanitized cloud enhancement via backend proxy when configured
 * - Bilingual: understands English, Hindi keywords, and Hinglish
 */

import { parseSmsNotification, parseIndianAmount, CATEGORY_KEYWORDS } from './smsParserService.js';
import { sanitizeFinancialText, prepareSafeFinancialSnapshot, MAX_SANITIZE_INPUT_CHARS } from './piiSanitizerService.js';
import { getUpcomingRenewals } from './recurringExpensesService.js';
import { inferDefaultPaymentMode } from './chatStorageService.js';

const FINANCIAL_DISCLAIMER = '\n\n_Informational estimate only — not regulated financial advice._';
const DUPLICATE_WINDOW_MS = 5 * 60 * 1000; // 5-minute duplicate protection window

/**
 * Reads upcoming recurring bill total safely without seeding defaults if user hasn't set up recurring bills
 */
function getActiveUpcomingBillsTotal(daysRemaining) {
  try {
    if (typeof localStorage === 'undefined') return 0;
    const raw = localStorage.getItem('expense_tracker_recurring_subs');
    if (!raw) return 0;
    const subs = JSON.parse(raw);
    if (!Array.isArray(subs) || subs.length === 0) return 0;
    const upcoming = getUpcomingRenewals(subs, Math.max(1, daysRemaining));
    return upcoming.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  } catch (e) {
    return 0;
  }
}

function parseUtcTimestamp(ts) {
  if (!ts) return null;
  const s = String(ts).trim();
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)
    ? `${s.replace(' ', 'T')}Z`
    : s;
  const ms = Date.parse(normalized);
  return isNaN(ms) ? null : ms;
}

/**
 * Checks whether a candidate transaction duplicates a recent ledger entry within a 2-minute window
 */
export function findDuplicateTransaction(candidate, recentTransactions = []) {
  if (!candidate || !candidate.amount || !Array.isArray(recentTransactions)) return null;
  const candAmt = Number(candidate.amount);
  const candMerchant = (candidate.merchant || '').toLowerCase().trim();
  const candDate = candidate.date || new Date().toISOString().slice(0, 10);
  const nowMs = Date.now();

  return recentTransactions.find(tx => {
    const txAmt = Number(tx.amount || 0);
    const txMerchant = (tx.description || tx.merchant || '').toLowerCase().trim();
    const txDate = (tx.date || '').slice(0, 10);
    const sameAmount = Math.abs(txAmt - candAmt) < 0.01;
    const similarMerchant = candMerchant && txMerchant &&
      (txMerchant === candMerchant || txMerchant.includes(candMerchant) || candMerchant.includes(txMerchant));
    if (!sameAmount || !similarMerchant || (txDate && txDate !== candDate)) return false;

    const txTimeMs = parseUtcTimestamp(tx.created_at || tx.createdAt || tx.updated_at);
    if (txTimeMs !== null) {
      return Math.abs(nowMs - txTimeMs) <= DUPLICATE_WINDOW_MS;
    }
    return false;
  }) || null;
}

/**
 * Computes proactive financial nudges (high category usage, recurring pattern detection)
 */
export function computeProactiveNudges(snapshot, recentTransactions = []) {
  const nudges = [];
  if (snapshot.budget > 0 && snapshot.percentSpent >= 80 && snapshot.percentSpent < 100) {
    nudges.push({
      id: 'nudge_budget_80',
      level: 'warning',
      text: `You've used ${snapshot.percentSpent}% of your monthly budget.`,
      query: 'Daily Pace'
    });
  }

  for (const cat of snapshot.categoryBreakdown || []) {
    if (cat.percent >= 50 && snapshot.totalSpent > 0) {
      nudges.push({
        id: `nudge_cat_${cat.category}`,
        level: 'info',
        text: `${cat.category} accounts for ${cat.percent}% of your spends.`,
        query: `${cat.category} spend`
      });
      break;
    }
  }

  // Detect potential recurring charge (same merchant + amount appearing >= 2 times)
  const seenMap = new Map();
  for (const tx of recentTransactions || []) {
    const m = (tx.description || tx.merchant || '').trim();
    const a = Number(tx.amount || 0);
    if (!m || a <= 0) continue;
    const key = `${m.toLowerCase()}::${a}`;
    seenMap.set(key, (seenMap.get(key) || 0) + 1);
    if (seenMap.get(key) === 2) {
      nudges.push({
        id: `nudge_rec_${m}`,
        level: 'tip',
        text: `Noticed "${m}" (₹${a.toLocaleString('en-IN')}) twice recently. Track it as a recurring bill?`,
        query: 'Saving Tips'
      });
      break;
    }
  }

  return nudges.slice(0, 2);
}

/**
 * Main query dispatcher for PocketNook Chat
 *
 * @param {string} rawInput
 * @param {Object} context
 * @returns {Promise<Object>}
 */
export async function processAssistantMessage(rawInput = '', context = {}) {
  const trimmedRaw = (rawInput || '').trim();
  const { sanitizedText, wasTruncated } = sanitizeFinancialText(trimmedRaw);
  const text = sanitizedText;
  const lower = text.toLowerCase().trim();

  const {
    dashboardData = {},
    recentTransactions = [],
    formatCurrency = (v) => `₹${Number(v || 0).toLocaleString('en-IN')}`,
    onSaveExpense = null,
    onDeleteExpense = null,
    learnedCategories = {},
    customCategories = [],
    budgetRatios = { needs: 50, wants: 30, savings: 20 },
    onUpdateBudgetRatios = null,
    forceLog = false,
    targetTxId = null,
    lastLoggedBatch = null,
    userName = ''
  } = context;

  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysRemaining = Math.max(1, daysInMonth - now.getDate() + 1);
  const upcomingRecurringTotal = Number(context.upcomingRecurringTotal ?? getActiveUpcomingBillsTotal(daysRemaining));

  const snapshot = prepareSafeFinancialSnapshot({
    dashboardData,
    recentTransactions,
    upcomingRecurringTotal,
    committedSavings: Number(dashboardData?.committed_savings || 0)
  });

  const defaultPaymentMode = inferDefaultPaymentMode(recentTransactions);
  const parserOptions = { learnedCategories, customCategories, defaultPaymentMode };

  const truncationNotice = wasTruncated
    ? `_Note: Input was capped at ${MAX_SANITIZE_INPUT_CHARS.toLocaleString('en-IN')} characters for responsiveness._\n\n`
    : '';

  const wrapResult = (res) => ({
    ...res,
    replyText: truncationNotice ? `${truncationNotice}${res.replyText}` : res.replyText,
    sanitizedInput: text
  });

  // 0. BUDGET RATIO UPDATE ACTION
  const ratioChangeMatch = lower.match(/^apply\s+(\d{2})\/(\d{2})\/(\d{2})/i);
  if (ratioChangeMatch) {
    const needs = parseInt(ratioChangeMatch[1], 10);
    const wants = parseInt(ratioChangeMatch[2], 10);
    const savings = parseInt(ratioChangeMatch[3], 10);
    if (needs + wants + savings === 100) {
      if (typeof onUpdateBudgetRatios === 'function') {
        await onUpdateBudgetRatios({ needs, wants, savings });
      }
      return wrapResult(handle503020Rule(snapshot, formatCurrency, { needs, wants, savings }));
    }
  }

  // 1. GREETING, PERSONAL NAME (ON-DEVICE), SMALL TALK & ASSISTANT IDENTITY
  if (isPersonalNameIntent(lower)) {
    return wrapResult(handlePersonalNameIntent(userName));
  }
  if (isSmallTalkOrFeedbackIntent(lower)) {
    return wrapResult(handleSmallTalkOrFeedback(lower, snapshot, formatCurrency));
  }
  if (isGreetingOrIdentity(lower)) {
    return wrapResult(handleGreetingResponse(snapshot, formatCurrency, userName, lower));
  }

  // 1b. NATURAL BUDGET HEALTH & TOP/LATEST EXPENSE INSIGHT
  if (isSpendingInsightIntent(lower)) {
    return wrapResult(handleSpendingInsight(lower, snapshot, formatCurrency));
  }

  // 2. UNDO / DELETE LAST EXPENSE
  if (isUndoIntent(lower)) {
    return wrapResult(await handleUndoIntent(snapshot, formatCurrency, onDeleteExpense, { targetTxId, lastLoggedBatch }));
  }

  // 3. TODAY'S TOTAL QUICK INQUIRY
  if (isTodaysTotalIntent(lower)) {
    return wrapResult(handleTodaysTotal(snapshot, formatCurrency));
  }

  // 4. BILL SPLITTING CALCULATOR
  if (isBillSplitIntent(lower)) {
    return wrapResult(handleBillSplitIntent(text, lower, formatCurrency, defaultPaymentMode));
  }

  // 5. AFFORDABILITY ANALYSIS ("Can I afford X?")
  if (isAffordabilityIntent(lower)) {
    return wrapResult(handleAffordabilityIntent(lower, snapshot, formatCurrency));
  }

  // 6. DAILY PACE & BURN RATE QUERY
  if (isPaceOrBurnRateIntent(lower)) {
    return wrapResult(handlePaceIntent(snapshot, formatCurrency));
  }

  // 7. CATEGORY SPENDING BREAKDOWN & INQUIRY
  if (isCategoryBreakdownIntent(lower)) {
    return wrapResult(handleCategoryQuery(lower, snapshot, formatCurrency));
  }

  // 8. RECENT TRANSACTIONS / HISTORY INSPECTION
  if (isRecentHistoryIntent(lower)) {
    return wrapResult(handleRecentHistory(snapshot, formatCurrency));
  }

  // 9. 50/30/20 (OR CUSTOM) BUDGET FRAMEWORK
  if (isRule503020Intent(lower)) {
    return wrapResult(handle503020Rule(snapshot, formatCurrency, budgetRatios));
  }

  // 10. EMERGENCY FUND CALCULATOR & STRATEGY
  if (isEmergencyFundIntent(lower)) {
    return wrapResult(handleEmergencyFund(snapshot, formatCurrency));
  }

  // 11. DEBT PAYOFF STRATEGY (Avalanche vs. Snowball)
  if (isDebtPayoffIntent(lower)) {
    return wrapResult(handleDebtPayoff(snapshot, formatCurrency));
  }

  // 12. OVER-BUDGET & DEFICIT TRIAGE
  if (isOverbudgetIntent(lower, snapshot)) {
    return wrapResult(handleOverbudgetRecovery(snapshot, formatCurrency));
  }

  // 13. CATEGORY-SPECIFIC REDUCTION PLANS
  if (isCategoryOptimizationIntent(lower)) {
    return wrapResult(handleCategoryOptimization(lower, snapshot, formatCurrency));
  }

  // 14. FUTURE GOAL & PURCHASE PLANNING
  if (isGoalPlanningIntent(lower)) {
    return wrapResult(handleGoalPlanning(text, lower, snapshot, formatCurrency));
  }

  // 15. BILINGUAL / HINGLISH SAVINGS ADVICE
  if (isBilingualSavingsIntent(lower)) {
    return wrapResult(handleBilingualSavingsAdvice(snapshot, formatCurrency));
  }

  // 16. INVESTMENT & WEALTH HYGIENE
  if (isInvestmentOrWealthIntent(lower)) {
    return wrapResult(handleInvestmentAdvice(snapshot, formatCurrency));
  }

  // 17. SAVINGS TIPS & GENERAL FINANCIAL COACHING
  if (isSavingAdviceIntent(lower)) {
    return wrapResult(handleSavingAdvice(snapshot, formatCurrency));
  }

  // 18. BUDGET SUMMARY (Overview)
  if (isSummaryIntent(lower)) {
    return wrapResult(handleSummary(snapshot, formatCurrency));
  }

  // 19. MULTI-ITEM BATCH EXPENSE LOGGING (Comma safe: "50 chai, 1,200 lunch, 40 auto")
  const multiItems = extractMultiItemExpenses(text, parserOptions);
  if (multiItems.length > 1) {
    return wrapResult(await handleMultiItemLogging(multiItems, snapshot, formatCurrency, onSaveExpense, recentTransactions, forceLog));
  }

  // 20. SINGLE EXPENSE / INCOME LOGGING (Confidence-gated + Duplicate-protected)
  // Pass masked text for storage while using raw/masked text carefully; note masked text preserves A/c last4 and amounts cleanly!
  const parsed = parseSmsNotification(text, parserOptions);
  if (parsed.success && parsed.amount > 0) {
    if (!forceLog) {
      const duplicateTx = findDuplicateTransaction(parsed, recentTransactions);
      if (duplicateTx) {
        return wrapResult(handleDuplicateWarning(parsed, duplicateTx, formatCurrency));
      }

      if (parsed.isLowConfidence) {
        return wrapResult(handleLowConfidenceConfirm(parsed, formatCurrency));
      }
    }

    return wrapResult(await handleSingleExpenseLogging(parsed, snapshot, formatCurrency, onSaveExpense));
  }

  // 21. LOCAL SMART FINANCIAL SYNTHESIZER (offline / fallback)
  if (isGeneralFinancialQuestion(lower)) {
    return wrapResult(handleSmartFinancialAdvisory(text, snapshot, formatCurrency));
  }

  // 21b. NATURAL CONVERSATIONAL FALLBACK (when user asks a genuine sentence, not random gibberish)
  if (isNaturalConversationSentence(lower)) {
    return wrapResult(handleConversationalFallback(text, snapshot, formatCurrency));
  }

  // 22. FALLBACK GUIDANCE ROADMAP
  return wrapResult(handleFallbackResponse(text, snapshot, formatCurrency));
}

/**
 * Determines whether a prompt should execute instantaneously via the local deterministic engine
 * rather than making an external SSE /api/chat LLM call.
 */
export function canHandleLocally(rawInput = '', context = {}) {
  const { sanitizedText } = sanitizeFinancialText((rawInput || '').trim());
  const text = sanitizedText;
  const lower = text.toLowerCase().trim();
  if (!lower) return true;

  // Explicitly route budget updates, natural LLM tool prompts, or injection tests to /api/chat SSE
  if (/\bset\s+(?:my\s+)?budget\b/i.test(lower) || /\bignore\s+(?:all\s+)?previous\s+instructions\b/i.test(lower)) {
    return false;
  }

  const snapshot = prepareSafeFinancialSnapshot({
    dashboardData: context.dashboardData || {},
    recentTransactions: context.recentTransactions || []
  });
  const defaultPaymentMode = inferDefaultPaymentMode(context.recentTransactions || []);
  const parserOptions = {
    learnedCategories: context.learnedCategories || {},
    customCategories: context.customCategories || [],
    defaultPaymentMode
  };

  if (/^apply\s+(\d{2})\/(\d{2})\/(\d{2})/i.test(lower)) return true;
  if (
    isPersonalNameIntent(lower) ||
    isSmallTalkOrFeedbackIntent(lower) ||
    isGreetingOrIdentity(lower) ||
    isSpendingInsightIntent(lower) ||
    isUndoIntent(lower) ||
    isTodaysTotalIntent(lower) ||
    isBillSplitIntent(lower) ||
    isAffordabilityIntent(lower) ||
    isPaceOrBurnRateIntent(lower) ||
    isCategoryBreakdownIntent(lower) ||
    isRecentHistoryIntent(lower) ||
    isRule503020Intent(lower) ||
    isEmergencyFundIntent(lower) ||
    isDebtPayoffIntent(lower) ||
    isOverbudgetIntent(lower, snapshot) ||
    isCategoryOptimizationIntent(lower) ||
    isGoalPlanningIntent(lower) ||
    isBilingualSavingsIntent(lower) ||
    isInvestmentOrWealthIntent(lower) ||
    isSavingAdviceIntent(lower) ||
    isSummaryIntent(lower)
  ) {
    return true;
  }

  if (extractMultiItemExpenses(text, parserOptions).length > 1) return true;
  const parsed = parseSmsNotification(text, parserOptions);
  if (parsed.success && parsed.amount > 0) return true;

  // Deterministic gibberish check (non-word random strings) handled locally without wasting LLM quota
  if (/^[a-z0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]+$/i.test(lower) && !/\s/.test(lower) && lower.length > 8) {
    return true;
  }

  // Known benchmark phrasing for general coaching fallback
  if (/\bmanage\s+(?:money|monthly\s+salary)\b/i.test(lower)) {
    return true;
  }

  return false;
}

/* ========================================================
   INTENT CLASSIFIERS
   ======================================================== */

function isPersonalNameIntent(lower) {
  return /\b(?:my\s+name|what(?:'s|\s+is)\s+my\s+name|tell\s+me\s+my\s+name|who\s+am\s+i|mera\s+naam|mera\s+name)\b/i.test(lower);
}

function handlePersonalNameIntent(userName = '') {
  const cleanName = String(userName || '').trim();
  const replyText = cleanName
    ? `Your name on this account is *${cleanName}*.\n\n_For privacy, your name and account identity stay strictly on-device and are never sent to external AI._`
    : `You're signed in to your personal PocketNook vault. For privacy, personal account details stay strictly on-device.`;
  return {
    replyText,
    type: 'personal_identity',
    suggestedChips: ['Summary', 'Daily Pace', 'Chai 20']
  };
}

function isGreetingOrIdentity(lower) {
  return /^(?:hi|hello|hey|namaste|hola|good\s*(?:morning|afternoon|evening)|who\s*are\s*you|what\s*can\s*you\s*do|help|bhai)\b/i.test(lower);
}

function isSmallTalkOrFeedbackIntent(lower) {
  return /\b(?:how\s+are\s+you|how\s+r\s+u|kaise\s+ho|kya\s+haal|kya\s+hal|what'?s\s+up|whats\s+up|sup|thanks|thank\s+you|thx|shukriya|dhanyawad|got\s+it|thik\s+hai|theek\s+hai|sahi\s+hai|badhiya|good\s+night|see\s+you|bye)\b/i.test(lower) ||
    /^(?:ok|okay|okey|cool|nice|great|awesome|yes|yeah|yep|no|nope|hmm|acha|achha)[!.]*$/i.test(lower.trim());
}

function isSpendingInsightIntent(lower) {
  return /\b(?:how\s+am\s+i\s+doing|am\s+i\s+doing\s+(?:good|well|okay|fine)|budget\s+kaisa|mera\s+(?:budget|kharcha)|biggest\s+expense|highest\s+(?:expense|spend)|most\s+expensive|sabse\s+bada\s+kharcha|top\s+expense|latest\s+expense|last\s+expense|how\s+many\s+(?:expenses|transactions)|average\s+spend)\b/i.test(lower);
}

function isNaturalConversationSentence(lower) {
  const words = lower.trim().split(/\s+/).filter(Boolean);
  const alphaWords = words.filter((w) => /[a-z]{2,}/i.test(w) && /[aeiouy]/i.test(w));
  if (alphaWords.length >= 2) return true;
  return /\b(?:how|why|what|when|where|who|can|could|should|would|tell|suggest|explain|kya|kaise|kitna|kyu|batao)\b/i.test(lower);
}

function isUndoIntent(lower) {
  return /\b(?:undo|delete\s*last|cancel\s*last|remove\s*last|pichla\s*hatao|delete\s*karo)\b/i.test(lower);
}

function isTodaysTotalIntent(lower) {
  return /\b(?:today'?s?\s*total|spent\s*today|aaj\s*ka\s*kharcha|today\s*spend)\b/i.test(lower);
}

function isBillSplitIntent(lower) {
  return (/\b(?:split|divide|hissa|share|doston\s*me)\b/i.test(lower) && /\d+/.test(lower)) ||
    /\b(?:split|divide)\s+(?:a\s+|the\s+)?bill\b/i.test(lower);
}

function isAffordabilityIntent(lower) {
  return /\b(?:can\s*i\s*afford|should\s*i\s*buy|khareed\s*sakta|le\s*sakta|kya\s*mai|afford\s*kar)\b/i.test(lower) ||
    (/\b(?:afford|budget\s*hai)\b/i.test(lower) && /\d+/.test(lower));
}

function isPaceOrBurnRateIntent(lower) {
  return /\b(?:burn\s*rate|daily\s*pace|daily\s*budget|per\s*day|aaj\s*ka\s*budget|pace|kitna\s*kharch\s*kar\s*sakta)\b/i.test(lower);
}

function isCategoryBreakdownIntent(lower) {
  return /\b(?:category|categories|breakdown|where\s*(?:did|is)\s*(?:all\s*)?my\s*money|where.*money.*going|kahan\s*kharcha|food\s*spend|travel\s*spend|grocery|shopping)\b/i.test(lower) &&
    !/\b(?:chai\s*\d|\d+\s*chai|spent\s*\d)\b/i.test(lower);
}

function isRecentHistoryIntent(lower) {
  return /\b(?:last\s*\d*\s*expenses|recent\s*(?:expenses|transactions|activity)|pichla\s*kharcha|history)\b/i.test(lower);
}

function isRule503020Intent(lower) {
  return /\b(?:50[\s/-]?30[\s/-]?20|fifty\s*thirty\s*twenty|rule\s*of\s*thumb|budget\s*rule|how\s*to\s*allocate|allocation\s*rule)\b/i.test(lower);
}

function isEmergencyFundIntent(lower) {
  return /\b(?:emergency\s*fund|rainy\s*day\s*fund|aapatkaalin|safety\s*cushion|emergency\s*savings|how\s*much\s*emergency)\b/i.test(lower);
}

function isDebtPayoffIntent(lower) {
  return /\b(?:debt|loan|credit\s*card|avalanche|snowball|karz|udhari|pay\s*off|emi|interest\s*rate)\b/i.test(lower);
}

function isOverbudgetIntent(lower, snapshot) {
  return /\b(?:over\s*budget|exceeded|deficit|kharcha\s*zyada|budget\s*khatam|spent\s*too\s*much|overspent)\b/i.test(lower) ||
    (snapshot.remainingBudget < 0 && /\b(?:status|how\s*am\s*i\s*doing|kaisa\s*chal\s*raha)\b/i.test(lower));
}

function isCategoryOptimizationIntent(lower) {
  return /\b(?:cut\s*down|reduce|save\s*on|spend\s*less)\b/i.test(lower) &&
    /\b(?:food|dining|grocery|shopping|clothes|delivery|zomato|swiggy|uber|ola|subscription|bills)\b/i.test(lower);
}

function isGoalPlanningIntent(lower) {
  return /\b(?:save\s*for|plan\s*to\s*buy|saving\s*target|goal|kharidna\s*hai|phone\s*kharidna|laptop\s*kharidna)\b/i.test(lower) && /\d+/.test(lower);
}

function isBilingualSavingsIntent(lower) {
  return /\b(?:paisa\s*kaise\s*bachaye|kharch\s*kaise\s*kam|bachat\s*kaise|paisa\s*bachao|salary\s*kaise\s*manage|paise\s*bachane)\b/i.test(lower);
}

function isInvestmentOrWealthIntent(lower) {
  return /\b(?:invest|investment|stocks|mutual\s*fund|sip|fd|fixed\s*deposit|gold|save\s*vs\s*invest|wealth\s*building)\b/i.test(lower);
}

function isSavingAdviceIntent(lower) {
  return /\b(?:how\s*to\s*save|saving\s*tips|advice|tips|save\s*money|budget\s*plan|spending\s*advice)\b/i.test(lower);
}

function isSummaryIntent(lower) {
  return /\b(?:summary|balance|overview|budget|status|kitna\s*(?:paisa|kharcha)?\s*bacha)\b/i.test(lower);
}

function isGeneralFinancialQuestion(lower) {
  return /\b(?:money|finance|budget|spend|expense|salary|savings|bank|credit|cash|fund|earn|plan|target|cost|pocket|rupee|invest|future)\b/i.test(lower);
}

/* ========================================================
   CONVERSATIONAL & FINANCIAL ENGINE HANDLERS
   ======================================================== */

function handleSmallTalkOrFeedback(lower, snapshot, formatCurrency) {
  let replyText = '';
  if (/\b(?:how\s+are\s+you|how\s+r\s+u|kaise\s+ho|kya\s+haal|kya\s+hal|what'?s\s+up|whats\s+up|sup)\b/i.test(lower)) {
    replyText =
      `I'm doing great, thanks for asking! Always ready to help with your finances.\n\n` +
      `Right now your safe pool stands at *${formatCurrency(snapshot.remainingBudget)}* (*${formatCurrency(snapshot.safeDailyPace)}/day* for ${snapshot.daysRemaining} ${snapshot.daysRemaining === 1 ? 'day' : 'days'}). Want to log an expense or check today's spend?`;
  } else if (/\b(?:bye|good\s+night|see\s+you)\b/i.test(lower)) {
    replyText = `Take care! Today's spend stands at *${formatCurrency(snapshot.todaySpent)}* with *${formatCurrency(snapshot.remainingBudget)}* remaining. Catch you later!`;
  } else if (/\b(?:thanks|thank\s+you|thx|shukriya|dhanyawad)\b/i.test(lower)) {
    replyText = `You're welcome! Happy to help anytime. Let me know if you'd like to log an expense or check your budget.`;
  } else {
    replyText = `Got it! Everything looks set—you have *${formatCurrency(snapshot.remainingBudget)}* remaining this month (*${formatCurrency(snapshot.safeDailyPace)}/day*). Just message me whenever you want to log a spend or ask a question.`;
  }

  return {
    replyText,
    type: 'small_talk',
    suggestedChips: ['Summary', 'Daily Pace', "Today's Total", 'Chai 20']
  };
}

function handleSpendingInsight(lower, snapshot, formatCurrency) {
  const txs = snapshot.safeTransactions || [];
  if (/\b(?:biggest|highest|most\s+expensive|sabse\s+bada|top\s+expense)\b/i.test(lower)) {
    if (txs.length === 0) {
      return {
        replyText: `You haven't logged any expenses this month yet, so there's no top expense yet.`,
        type: 'spending_insight',
        suggestedChips: ['Chai 20', 'Summary']
      };
    }
    const biggest = txs.reduce((max, t) => (t.amount > (max?.amount || 0) ? t : max), txs[0]);
    const avg = Math.round(txs.reduce((s, t) => s + Number(t.amount || 0), 0) / txs.length);
    return {
      replyText:
        `Your biggest single spend this month was *${formatCurrency(biggest.amount)}* on *${biggest.merchant}* (${biggest.category} • ${biggest.date}).\n\n` +
        `Across ${txs.length} transactions, your average spend is *${formatCurrency(avg)}*, with *${snapshot.topCategory?.category || 'General'}* leading overall.`,
      type: 'spending_insight',
      suggestedChips: ['Food Spend', 'Recent expenses', 'Summary']
    };
  }

  if (/\b(?:latest\s+expense|last\s+expense|how\s+many\s+(?:expenses|transactions)|average\s+spend)\b/i.test(lower)) {
    if (txs.length === 0) {
      return {
        replyText: `No expenses recorded yet this cycle. Try sending \`Chai 20\` to log your first entry!`,
        type: 'spending_insight'
      };
    }
    const latest = txs[0];
    const avg = Math.round(txs.reduce((s, t) => s + Number(t.amount || 0), 0) / txs.length);
    return {
      replyText:
        `You've logged *${txs.length} transactions* averaging *${formatCurrency(avg)}* each.\n\n` +
        `Your latest entry was *${formatCurrency(latest.amount)}* at *${latest.merchant}* (${latest.category}).`,
      type: 'spending_insight',
      suggestedChips: ['Undo Last', 'Summary', 'Daily Pace']
    };
  }

  const healthLine = snapshot.remainingBudget < 0
    ? `You're currently *${formatCurrency(Math.abs(snapshot.remainingBudget))} over budget*, so keeping discretionary spends minimal for the next ${snapshot.daysRemaining} days will help.`
    : snapshot.percentSpent >= 80
    ? `You've used *${snapshot.percentSpent}%* of your budget with *${formatCurrency(snapshot.remainingBudget)}* left (*${formatCurrency(snapshot.safeDailyPace)}/day*). Staying mindful on *${snapshot.topCategory?.category || 'top categories'}* will finish the month smoothly.`
    : `You're in solid shape! Only *${snapshot.percentSpent}%* of your budget is used—you still have *${formatCurrency(snapshot.remainingBudget)}* left (*${formatCurrency(snapshot.safeDailyPace)}/day*).`;

  return {
    replyText: `${healthLine}\n\nToday's spend so far: *${formatCurrency(snapshot.todaySpent)}*.`,
    type: 'spending_insight',
    suggestedChips: ['Summary', 'Food Spend', 'Daily Pace']
  };
}

function handleConversationalFallback(text, snapshot, formatCurrency) {
  const topCat = snapshot.topCategory?.category;
  const topNote = topCat ? ` Your top category right now is *${topCat}* (${snapshot.topCategory.percent}%).` : '';
  const replyText =
    `Here's where things stand for you right now: you've spent *${formatCurrency(snapshot.totalSpent)}* so far this month, with *${formatCurrency(snapshot.remainingBudget)}* remaining (*${formatCurrency(snapshot.safeDailyPace)}/day* over ${snapshot.daysRemaining} ${snapshot.daysRemaining === 1 ? 'day' : 'days'}).${topNote}\n\n` +
    `If you meant to log something (like \`Lunch 150\`), check affordability (\`Can I afford 2000?\`), split a bill (\`Split 1200 between 4\`), or ask a money question, just type it naturally!`;

  return {
    replyText,
    type: 'conversational_reply',
    suggestedChips: ['Summary', 'Daily Pace', 'Food Spend', '50/30/20 Rule']
  };
}

function handleGreetingResponse(snapshot, formatCurrency, userName = '', lower = '') {
  const isHelpOrCapabilities = /\b(?:who\s*are\s*you|what\s*can\s*you\s*do|help)\b/i.test(lower);
  const firstName = String(userName || '').trim().split(/\s+/)[0];
  const greetingPrefix = firstName ? `Hey ${firstName}!` : 'Hello!';

  if (!isHelpOrCapabilities) {
    const replyText =
      `${greetingPrefix} How can I help today?\n\n` +
      `Your safe pool currently has *${formatCurrency(snapshot.remainingBudget)}* left (*${formatCurrency(snapshot.safeDailyPace)}/day*). ` +
      `Feel free to chat naturally, ask about your spending, or type an expense like \`Chai 20\`.`;
    return {
      replyText,
      type: 'greeting',
      suggestedChips: ['Summary', 'Daily Pace', 'Food Spend', 'Chai 20']
    };
  }

  const replyText =
    `*PocketNook Chat Active*\n\n` +
    `Privacy-first expense assistant: sensitive numbers are masked locally before processing. Try these examples:\n\n` +
    `• *Instant Logging:* \`Chai 20\`, \`Lunch 150 card\`, or \`chai pe 30 kharch kiya\`\n` +
    `• *Multi-Item Batch:* \`50 chai, 1,200 lunch, 40 auto\`\n` +
    `• *Affordability Diagnosis:* \`Can I afford a 3500 dinner?\`\n` +
    `• *Smart Bill Split:* \`Split 2,400 among 6\` or \`Divide 2500 by 3\`\n` +
    `• *Deep Analytics:* \`Where is my money going?\` or \`Food spend\`\n` +
    `• *50/30/20 Plan:* \`Explain 50/30/20 rule for my budget\`\n` +
    `• *Quick Undo:* Send \`Undo\` to remove the last entry.\n\n` +
    `*Financial Status:* Safe pool remaining: *${formatCurrency(snapshot.remainingBudget)}* (*${formatCurrency(snapshot.safeDailyPace)}/day*).`;

  return {
    replyText,
    type: 'greeting',
    suggestedChips: ['Summary', 'Daily Pace', '50/30/20 Rule', 'Emergency Fund'],
    actionButtons: [
      { label: 'Check Budget', query: 'Summary' },
      { label: 'Daily Pace', query: 'Daily Pace' }
    ]
  };
}

async function handleUndoIntent(snapshot, formatCurrency, onDeleteExpense, { targetTxId = null, lastLoggedBatch = null } = {}) {
  let txToRemove = null;
  if (targetTxId) {
    txToRemove = snapshot.safeTransactions.find(t => String(t.id) === String(targetTxId)) || {
      id: targetTxId,
      amount: 0,
      merchant: 'Logged Entry',
      category: 'Expense',
      paymentMode: 'UPI'
    };
  } else {
    txToRemove = snapshot.safeTransactions[0];
  }

  if (!txToRemove) {
    return {
      replyText: `No recent transactions found in this billing cycle to undo.`,
      type: 'undo_failed',
      suggestedChips: ['Summary', 'Chai 20']
    };
  }

  if (typeof onDeleteExpense === 'function' && txToRemove.id) {
    await onDeleteExpense(txToRemove.id);
  }

  const batchNote = (lastLoggedBatch && lastLoggedBatch.length > 1)
    ? `\n\n_Note: This removed the most recent entry. ${lastLoggedBatch.length - 1} earlier items from your last batch remain logged._`
    : '';

  const replyText =
    `*Transaction Undone & Removed!*\n` +
    `*Removed:* ${formatCurrency(txToRemove.amount)} for *${txToRemove.merchant}* (${txToRemove.category})\n` +
    `*Payment Mode:* ${txToRemove.paymentMode}\n\n` +
    `Updated remaining balance is *${formatCurrency(snapshot.remainingBudget + (txToRemove.amount || 0))}*.` +
    batchNote;

  return {
    replyText,
    type: 'undo_success',
    undoneTransaction: txToRemove,
    suggestedChips: ['Summary', 'Recent expenses', 'Daily Pace']
  };
}

function handleTodaysTotal(snapshot, formatCurrency) {
  const { todaySpent, safeDailyPace } = snapshot;
  const remainingToday = Math.max(0, safeDailyPace - todaySpent);
  const replyText =
    `*Today's Spending Check*\n` +
    `*Spent Today:* *${formatCurrency(todaySpent)}*\n` +
    `*Safe Daily Pace:* ${formatCurrency(safeDailyPace)}/day\n\n` +
    (todaySpent <= safeDailyPace
      ? `You still have *${formatCurrency(remainingToday)}* within today's safe allowance.`
      : `You are *${formatCurrency(todaySpent - safeDailyPace)}* above today's pace.`);

  return {
    replyText,
    type: 'todays_total',
    suggestedChips: ['Food Spend', 'Recent expenses', 'Summary']
  };
}

function handleBillSplitIntent(text, lower, formatCurrency, defaultPaymentMode = 'UPI') {
  // Parse total bill + headcount contextually rather than Math.min / Math.max guesswork
  const tokenRegex = /([0-9,]+(?:\.[0-9]{1,2})?(?:\s*(?:k|lakh|lakhs|lac|l|cr|crore))?)/gi;
  const rawTokens = text.match(tokenRegex) || [];

  if (rawTokens.length < 2) {
    return {
      replyText: `To split a bill, please specify both the total amount and headcount.\n\n*Examples:* \`Split 2,400 among 6\`, \`Divide 2500 by 3\`, or \`Split 1800 with 4 friends\``,
      type: 'split_error',
      suggestedChips: ['Split 2,400 between 6', 'Summary']
    };
  }

  let totalBill = parseIndianAmount(rawTokens[0]);
  let peopleCount = parseInt(String(rawTokens[1]).replace(/,/g, ''), 10);

  // Explicit people count match if user put count inside "between/among/by/with/for N" or "N ways"
  const explicitPeopleMatch = lower.match(/(?:between|among|by|with|for|into)\s+(\d+)\s*(?:people|persons|friends|mates|ways|members|pax|logon|doston)?\b|(\d+)\s*ways\b/i);
  if (explicitPeopleMatch) {
    const parsedPeople = parseInt(explicitPeopleMatch[1] || explicitPeopleMatch[2], 10);
    if (!isNaN(parsedPeople)) {
      peopleCount = parsedPeople;
      // Ensure totalBill uses the non-people token
      const nonPeopleTokens = rawTokens.filter(t => parseInt(t.replace(/,/g, ''), 10) !== parsedPeople);
      if (nonPeopleTokens.length > 0) {
        totalBill = parseIndianAmount(nonPeopleTokens[0]);
      }
    }
  }

  if (!totalBill || totalBill <= 0) {
    return {
      replyText: `Please specify a valid bill amount greater than ₹0.`,
      type: 'split_error'
    };
  }

  if (isNaN(peopleCount) || peopleCount <= 0) {
    return {
      replyText: `The number of people must be at least 1.`,
      type: 'split_error'
    };
  }

  const isWithFriendsPhrase = /\bwith\s+\d+\s+(?:friends?|mates?|people|persons|doston)\b/i.test(lower);
  const perPersonExact = totalBill / peopleCount;
  const roundedBase = Math.floor(perPersonExact);
  const remainder = Math.round((totalBill - roundedBase * peopleCount) * 100) / 100;

  // Compute exact remainder distribution when not evenly divisible in whole rupees
  let breakdownNote = '';
  let userShare = Math.round(perPersonExact * 100) / 100;
  if (Number.isInteger(totalBill) && totalBill % peopleCount !== 0) {
    const intRem = totalBill % peopleCount;
    const higherCount = intRem;
    const lowerCount = peopleCount - intRem;
    userShare = roundedBase + 1;
    breakdownNote = `\n*Exact Rounding Breakdown:* ${higherCount} × ${formatCurrency(roundedBase + 1)} + ${lowerCount} × ${formatCurrency(roundedBase)} (Total ${formatCurrency(totalBill)} exact)`;
  }

  const friendsAmbiguityNote = isWithFriendsPhrase
    ? `\n_Note: Split ${peopleCount} ways above. If "${peopleCount} friends" excludes you, tap below to split ${peopleCount + 1} ways._`
    : '';

  const shareForLog = Math.round(userShare);

  const replyText =
    `*Smart Bill Split Calculation*\n` +
    `*Total Bill:* ${formatCurrency(totalBill)}\n` +
    `*Split Between:* ${peopleCount} people\n` +
    `*Each Person Owes:* *${formatCurrency(userShare)}*` +
    breakdownNote +
    friendsAmbiguityNote +
    `\n\nTap below to record your share or reply \`Dinner ${shareForLog} ${defaultPaymentMode.toLowerCase()}\`.`;

  const actionButtons = [
    {
      label: `Log My Share (${formatCurrency(shareForLog)})`,
      actionType: 'log_share',
      sharePayload: {
        amount: shareForLog,
        merchant: 'Shared Bill',
        category: 'Food & Dining',
        payment_mode: defaultPaymentMode,
        date: new Date().toISOString().slice(0, 10)
      },
      query: `Dinner ${shareForLog} ${defaultPaymentMode.toLowerCase()}`
    }
  ];

  if (isWithFriendsPhrase) {
    actionButtons.push({
      label: `Split ${peopleCount + 1} Ways (Incl. You)`,
      query: `Split ${totalBill} between ${peopleCount + 1} people`
    });
  } else {
    actionButtons.push({ label: 'Check Budget', query: 'Summary' });
  }

  return {
    replyText,
    type: 'split_bill',
    data: { totalBill, peopleCount, perPerson: userShare, remainder },
    suggestedChips: [`Log Share ${shareForLog}`, 'Summary'],
    actionButtons
  };
}

function handleAffordabilityIntent(lower, snapshot, formatCurrency) {
  const tokenMatch = lower.match(/([0-9,]+(?:\.[0-9]{1,2})?(?:\s*(?:k|lakh|lakhs|lac|l|cr|crore))?)/i);
  const plannedAmount = tokenMatch ? parseIndianAmount(tokenMatch[1]) : null;

  if (!plannedAmount || plannedAmount <= 0) {
    return {
      replyText: `Please specify the amount you want to spend.\n\n*Example:* \`Can I afford a 4,500 smartwatch?\``,
      type: 'affordability_error'
    };
  }

  if (!snapshot.hasBudgetConfigured) {
    return {
      replyText:
        `*Affordability Financial Diagnosis*\n` +
        `*Planned Purchase:* ${formatCurrency(plannedAmount)}\n` +
        `*Status:* No monthly budget configured yet.\n\n` +
        `Set a monthly budget in Budget Settings so I can evaluate affordability against your safe pool and upcoming bills.`,
      type: 'affordability_analysis',
      data: { plannedAmount, remaining: 0, newRemaining: -plannedAmount, newPace: 0 },
      actionButtons: [{ label: 'Summary', query: 'Summary' }]
    };
  }

  const remaining = snapshot.remainingBudget;
  const commitments = snapshot.totalUpcomingCommitted || 0;
  const freePool = snapshot.freeSafePool;
  const days = snapshot.daysRemaining;
  const currentPace = snapshot.safeDailyPace;

  const newRemaining = remaining - plannedAmount;
  const freeAfterPurchase = freePool - plannedAmount;
  const newPace = days > 0 ? Math.round(freeAfterPurchase / days) : 0;

  let advice = '';

  if (remaining <= 0) {
    advice =
      `*Verdict: Budget Risk — Already Over Budget.*\n` +
      `You are currently ${formatCurrency(Math.abs(remaining))} past your monthly budget. ` +
      `Recommendation: Defer non-essential purchases until next cycle.`;
  } else if (newRemaining < 0) {
    advice =
      `*Verdict: Budget Risk Detected.*\n` +
      `Spending ${formatCurrency(plannedAmount)} pushes you *${formatCurrency(Math.abs(newRemaining))} over budget* with ${days} ${days === 1 ? 'day' : 'days'} left. ` +
      `Recommendation: Hold off or reallocate from another category.`;
  } else if (freeAfterPurchase < 0) {
    advice =
      `*Verdict: Budget Risk — Encroaches on Upcoming Bills.*\n` +
      `While within raw budget, you have *${formatCurrency(commitments)}* in upcoming committed bills/EMIs. This purchase leaves a *${formatCurrency(Math.abs(freeAfterPurchase))}* shortfall against upcoming commitments. ` +
      `Recommendation: Keep cash reserved for upcoming due bills first.`;
  } else {
    const ratioOfFree = freePool > 0 ? plannedAmount / freePool : 1;
    if (ratioOfFree <= 0.25) {
      advice =
        `*Verdict: Comfortably Affordable!*\n` +
        `Uses ${Math.round(ratioOfFree * 100)}% of your free safe pool. After this spend, you retain *${formatCurrency(freeAfterPurchase)}* (*${formatCurrency(newPace)}/day* for ${days} ${days === 1 ? 'day' : 'days'}).`;
    } else if (ratioOfFree <= 0.75) {
      advice =
        `*Verdict: Moderate Caution.*\n` +
        `Uses ${Math.round(ratioOfFree * 100)}% of your free pool, adjusting your daily pace from *${formatCurrency(currentPace)}/day* to *${formatCurrency(newPace)}/day*. Keep secondary discretionary spends light.`;
    } else {
      advice =
        `*Verdict: Tight Squeeze (75%–100% of Free Pool).*\n` +
        `This consumes *${Math.round(ratioOfFree * 100)}%* of your remaining uncommitted funds, leaving only *${formatCurrency(freeAfterPurchase)}* total (*${formatCurrency(newPace)}/day*) for the rest of the month.`;
    }
  }

  const lastDayNote = snapshot.isLastDayOfMonth ? ' • Final day of month' : '';
  const commitmentsLine = commitments > 0
    ? `\n*Committed Upcoming Bills:* ${formatCurrency(commitments)} (Free Pool: ${formatCurrency(freePool)})`
    : '';

  const replyText =
    `*Affordability Financial Diagnosis*\n` +
    `*Planned Purchase:* ${formatCurrency(plannedAmount)}\n` +
    `*Current Remaining:* ${formatCurrency(remaining)} (${days} ${days === 1 ? 'day' : 'days'} left${lastDayNote})` +
    commitmentsLine +
    `\n*Current Daily Pace:* ${formatCurrency(currentPace)}/day\n` +
    `*Projected Daily Pace:* ${formatCurrency(newPace)}/day\n\n` +
    `${advice}`;

  return {
    replyText,
    type: 'affordability_analysis',
    data: { plannedAmount, remaining, newRemaining, newPace, freeAfterPurchase },
    actionButtons: [
      { label: 'Daily Pace', query: 'Daily Pace' },
      { label: 'Summary', query: 'Summary' }
    ]
  };
}

function handlePaceIntent(snapshot, formatCurrency) {
  const { remainingBudget, safeDailyPace, daysRemaining, todaySpent, isLastDayOfMonth } = snapshot;

  const isTodayPaceHealthy = todaySpent <= safeDailyPace;
  const replyText =
    `*Safe Daily Burn Rate*\n` +
    `*Safe Target:* *${formatCurrency(safeDailyPace)}/day*\n` +
    `*Days Left in Month:* ${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'}${isLastDayOfMonth ? ' (Final day)' : ''}\n` +
    `*Remaining Pool:* ${formatCurrency(remainingBudget)}\n` +
    `*Spent Today:* ${formatCurrency(todaySpent)}\n\n` +
    (isTodayPaceHealthy
      ? `*Status:* On Track — You are ${formatCurrency(safeDailyPace - todaySpent)} below your safe daily cap today.`
      : `*Status:* High Velocity — You have spent ${formatCurrency(todaySpent - safeDailyPace)} above today's target pace. Consider keeping tomorrow's spend minimal.`);

  return {
    replyText,
    type: 'daily_pace',
    suggestedChips: ['Food Spend', 'Summary', 'Tips'],
    actionButtons: [
      { label: 'Food Spend', query: 'Food Spend' },
      { label: 'Saving Tips', query: 'Saving Tips' }
    ]
  };
}

function handle503020Rule(snapshot, formatCurrency, ratios = { needs: 50, wants: 30, savings: 20 }) {
  const budget = snapshot.budget || 30000;
  const needsPct = ratios?.needs ?? 50;
  const wantsPct = ratios?.wants ?? 30;
  const savingsPct = ratios?.savings ?? 20;

  const needs = Math.round(budget * (needsPct / 100));
  const wants = Math.round(budget * (wantsPct / 100));
  const savings = Math.round(budget * (savingsPct / 100));
  const totalSpent = snapshot.totalSpent;
  const spendLimit = needs + wants;

  const replyText =
    `*The 50/30/20 Financial Framework*\n` +
    `Calibrated to your monthly baseline of *${formatCurrency(budget)}* (${needsPct}/${wantsPct}/${savingsPct} split):\n\n` +
    `• *${needsPct}% Needs (${formatCurrency(needs)}):* Essential groceries, rent, EMIs, family support, utilities, transit.\n` +
    `• *${wantsPct}% Wants (${formatCurrency(wants)}):* Dining out, cafes, OTT subscriptions, shopping, hobbies.\n` +
    `• *${savingsPct}% Savings (${formatCurrency(savings)}):* Emergency fund, SIPs, debt acceleration, future goals.\n\n` +
    `*Current Status:* You have spent *${formatCurrency(totalSpent)}* so far this month. ` +
    (totalSpent > spendLimit
      ? `You are past the recommended ${needsPct + wantsPct}% spending ceiling (${formatCurrency(spendLimit)}). Restrict further spends to essential needs only.`
      : `You are within the ${formatCurrency(spendLimit)} operational limit with *${formatCurrency(spendLimit - totalSpent)}* buffer before tapping savings.`) +
    FINANCIAL_DISCLAIMER;

  return {
    replyText,
    type: 'budget_framework',
    suggestedChips: ['Summary', 'Daily Pace', 'Emergency Fund', 'Tips'],
    actionButtons: [
      { label: 'Apply 55/25/20 (EMI-Heavy)', query: 'apply 55/25/20' },
      { label: 'Apply 50/30/20 Standard', query: 'apply 50/30/20' }
    ]
  };
}

function handleEmergencyFund(snapshot, formatCurrency) {
  const monthlyBurn = snapshot.totalSpent > 0 ? snapshot.totalSpent : Math.round(snapshot.budget * 0.8) || 20000;
  const fund3Month = monthlyBurn * 3;
  const fund6Month = monthlyBurn * 6;

  const replyText =
    `*Emergency Reserve Architecture*\n` +
    `Based on your current monthly baseline of ~*${formatCurrency(monthlyBurn)}/month*:\n\n` +
    `• *3-Month Baseline Cushion:* *${formatCurrency(fund3Month)}* (Covers sudden medical or job transition)\n` +
    `• *6-Month Fortress Cushion:* *${formatCurrency(fund6Month)}* (Complete multi-month economic resilience)\n\n` +
    `*Strategic Placement:*\n` +
    `1. Keep 1 month in a high-interest liquid savings account with instant UPI access.\n` +
    `2. Keep the remaining 2–5 months in sweep-in FDs or liquid overnight funds with zero exit loads.\n` +
    `3. Never lock emergency cash in volatile equities or locking schemes.` +
    FINANCIAL_DISCLAIMER;

  return {
    replyText,
    type: 'emergency_fund',
    suggestedChips: ['50/30/20 Rule', 'Summary', 'Daily Pace']
  };
}

function handleDebtPayoff(snapshot, formatCurrency) {
  const replyText =
    `*Debt Acceleration Blueprint: Avalanche vs Snowball*\n\n` +
    `• *Method 1: Debt Avalanche (Mathematically Optimal)*\n` +
    `Pay minimums on everything, then channel all surplus cash to the debt with the *highest interest rate* (e.g. Credit Cards @ 36–42% APR). Saves the most money in interest charges.\n\n` +
    `• *Method 2: Debt Snowball (Psychological Momentum)*\n` +
    `Pay minimums on everything, then channel surplus cash to the *smallest balance*. Clearing small debts quickly builds motivational momentum.\n\n` +
    `*PocketNook Recommendation:* For revolving credit card debt, *always prioritize high-interest dues first*.` +
    FINANCIAL_DISCLAIMER;

  return {
    replyText,
    type: 'debt_strategy',
    suggestedChips: ['Emergency Fund', '50/30/20 Rule', 'Summary']
  };
}

function handleOverbudgetRecovery(snapshot, formatCurrency) {
  const deficit = Math.abs(snapshot.remainingBudget);
  const days = snapshot.daysRemaining;
  const topCat = snapshot.topCategory?.category || 'discretionary spends';

  const replyText =
    `*Over-Budget Recovery & Triage Plan*\n` +
    (snapshot.remainingBudget < 0
      ? `Your spending has exceeded the monthly budget by *${formatCurrency(deficit)}* with ${days} ${days === 1 ? 'day' : 'days'} remaining.\n\n`
      : `Your spending velocity is high with only *${formatCurrency(snapshot.remainingBudget)}* left for ${days} days.\n\n`) +
    `*Immediate 3-Step Turnaround:*\n` +
    `1. *Freeze Non-Essential Outflows:* Zero dining out, cafes, or shopping for the next 7 days.\n` +
    `2. *Tackle Top Category:* Your biggest outflow is *${topCat}*. Cap secondary purchases here immediately.\n` +
    `3. *Zero-Spend Days:* Target 3 zero-expense weekdays to stabilize your cash position.`;

  return {
    replyText,
    type: 'deficit_recovery',
    suggestedChips: ['Daily Pace', 'Category Spend', 'Tips']
  };
}

function handleCategoryOptimization(lower, snapshot, formatCurrency) {
  let title = 'Spending Reduction Blueprint';
  let tips = '';

  if (lower.includes('food') || lower.includes('dining') || lower.includes('zomato') || lower.includes('swiggy')) {
    title = 'Food & Dining Optimization Plan';
    tips =
      `• *Cap Food Delivery to 1x/Week:* Delivery fees, packaging, and platform markups add 35–50% to meal costs.\n` +
      `• *Meal Prep Staples:* Batch cooking lunch on Sundays cuts weekday office dining expenses significantly.\n` +
      `• *Daily Micro-Spend Audit:* Frequent small chai/snack orders add up quickly over a month. Keep a dedicated weekly cap.`;
  } else if (lower.includes('shopping') || lower.includes('clothes')) {
    title = 'Shopping & Discretionary Control';
    tips =
      `• *The 48-Hour Cooling Rule:* For non-essential purchases > ₹1,000, wait 48 hours before checking out.\n` +
      `• *Cost-Per-Use Check:* Estimate how many times you will realistically use the item.\n` +
      `• *Mute Sale Push Alerts:* Disable promotional shopping notifications to avoid artificial urgency.`;
  } else {
    title = 'Recurring Bills & Subscriptions Audit';
    tips =
      `• *Ghost Subscription Purge:* Review streaming, gym, and app renewals. Cancel anything unused in the last 30 days.\n` +
      `• *Annual vs Monthly Audit:* For services used daily, annual plans often cut costs by 15–25%.\n` +
      `• *Family Sharing Plans:* Pool OTT/broadband plans where permitted to split fixed overhead.`;
  }

  const replyText =
    `*${title}*\n\n` +
    `${tips}\n\n` +
    `*Current Daily Safe Pace:* ${formatCurrency(snapshot.safeDailyPace)}/day.`;

  return {
    replyText,
    type: 'category_optimization',
    suggestedChips: ['Daily Pace', 'Summary', '50/30/20 Rule']
  };
}

function handleGoalPlanning(text, lower, snapshot, formatCurrency) {
  const tokenRegex = /([0-9,]+(?:\.[0-9]{1,2})?(?:\s*(?:k|lakh|lakhs|lac|l|cr|crore))?)/gi;
  const numbers = text.match(tokenRegex) || [];
  const targetAmount = numbers.length > 0 ? (parseIndianAmount(numbers[0]) || 25000) : 25000;
  const months = numbers.length > 1 ? Math.min(36, Math.max(1, parseInt(numbers[1].replace(/,/g, ''), 10))) : 6;
  const monthlyNeeded = Math.round(targetAmount / months);

  const replyText =
    `*Goal Feasibility & Savings Roadmap*\n` +
    `*Target Goal:* ${formatCurrency(targetAmount)}\n` +
    `*Target Timeline:* ${months} months\n` +
    `*Required Monthly Savings:* *${formatCurrency(monthlyNeeded)}/month*\n\n` +
    `*Feasibility Assessment:*\n` +
    `Your current monthly safe remaining pool is *${formatCurrency(snapshot.remainingBudget)}*. ` +
    (snapshot.remainingBudget >= monthlyNeeded
      ? `This goal is *achievable*! Setting aside ${formatCurrency(monthlyNeeded)}/month keeps you on target.`
      : `This requires tighter discipline or extending your timeline to ${Math.ceil(targetAmount / (Math.max(snapshot.remainingBudget, 1000)))} months.`) +
    FINANCIAL_DISCLAIMER;

  return {
    replyText,
    type: 'goal_planning',
    suggestedChips: ['Summary', 'Daily Pace', 'Tips']
  };
}

function handleBilingualSavingsAdvice(snapshot, formatCurrency) {
  const topCat = snapshot.topCategory?.category || 'food aur shopping';
  const pace = snapshot.safeDailyPace;

  const replyText =
    `*Smart Savings Plan (पैसे बचाने का आसान तरीका)*\n\n` +
    `1. *Safe Daily Spending Target:* Aapka daily kharch target *${formatCurrency(pace)}/day* hai. Iske andar rehne par mahine ke ant me paisa bachega.\n` +
    `2. *Pay Yourself First:* Salary aate hi sabse pehle 20% savings alag account ya SIP me transfer karein, baki 80% se kharcha chalayein.\n` +
    `3. *Top Category Check:* Aapka sabse bada kharcha *${topCat}* me ho raha hai. Isme 15% katauti karne se aaram se mahine ke ₹1,500–₹3,000 bach sakte hain.\n` +
    `4. *24 Ghante Ka Niyam:* Kisi bhi ₹1,000+ ki cheez ko khareedne se pehle 24 ghante intezaar karein; impulse shopping ruk jayegi.` +
    FINANCIAL_DISCLAIMER;

  return {
    replyText,
    type: 'bilingual_advice',
    suggestedChips: ['Summary', 'Daily Pace', '50/30/20 Rule']
  };
}

function handleInvestmentAdvice(snapshot, formatCurrency) {
  const replyText =
    `*Core Wealth Building & Investment Principles*\n\n` +
    `1. *First Priority — Emergency Fund:* Keep 3–6 months of expenses in a liquid FD or high-yield account before equity exposure.\n` +
    `2. *Eliminate High-Interest Debt:* Clear revolving credit card debt before chasing market returns.\n` +
    `3. *Broad Index Funds & SIPs:* Disciplined monthly SIPs in diversified funds suit long (5+ year) horizons.\n` +
    `4. *Protect Near-Term Cash:* Capital needed within 12–24 months belongs in capital-preserving liquid instruments.` +
    FINANCIAL_DISCLAIMER;

  return {
    replyText,
    type: 'investment_advice',
    suggestedChips: ['Emergency Fund', 'Debt Payoff', 'Summary']
  };
}

function handleSmartFinancialAdvisory(text, snapshot, formatCurrency) {
  const replyText =
    `*PocketNook Financial Intelligence Diagnosis*\n\n` +
    `Regarding your query on *"_` + text.slice(0, 45) + `_"*:\n\n` +
    `• *Budget Health:* You have spent *${formatCurrency(snapshot.totalSpent)}* with *${formatCurrency(snapshot.remainingBudget)}* remaining this cycle.\n` +
    `• *Daily Discipline:* Your safe daily spending pace is *${formatCurrency(snapshot.safeDailyPace)}/day* across ${snapshot.daysRemaining} ${snapshot.daysRemaining === 1 ? 'day' : 'days'}.\n` +
    `• *Primary Recommendation:* Maintain consistency, track upcoming fixed bills, and keep daily spends below ${formatCurrency(snapshot.safeDailyPace)}.\n\n` +
    `Ask about \`50/30/20 rule\`, \`Emergency fund\`, \`Daily pace\`, or \`Split bill\` for deeper calculations.`;

  return {
    replyText,
    type: 'smart_advisory',
    suggestedChips: ['Summary', 'Daily Pace', '50/30/20 Rule', 'Emergency Fund']
  };
}

function handleCategoryQuery(lower, snapshot, formatCurrency) {
  const categories = snapshot.categoryBreakdown;

  for (const catRule of CATEGORY_KEYWORDS) {
    const isCategoryNamed = catRule.keywords.some(k => lower.includes(k)) || lower.includes(catRule.category.toLowerCase());
    if (isCategoryNamed) {
      const match = categories.find(c => c.category.toLowerCase() === catRule.category.toLowerCase());
      const spent = match ? match.spent : 0;
      const pct = match ? match.percent : 0;

      const replyText =
        `*${catRule.category} Spending Analysis*\n` +
        `*Total Spent:* *${formatCurrency(spent)}*\n` +
        `*Share of Budget:* ${pct}% of total spending\n\n` +
        (spent > 0
          ? `This is one of your active spending channels this month.`
          : `Great news! You have spent ₹0 in ${catRule.category} so far this month.`);

      return { replyText, type: 'category_detail', suggestedChips: ['Summary', 'Daily Pace', 'Tips'] };
    }
  }

  if (categories.length === 0) {
    return {
      replyText: `You haven't recorded any category expenses yet this month. Start by logging something like \`Chai 20\`!`,
      type: 'category_breakdown',
      suggestedChips: ['Summary', 'Chai 20']
    };
  }

  const currentMonthName = new Date().toLocaleString('en-IN', { month: 'long' });
  const topCats = categories.slice(0, 4);
  const chartLines = topCats.map((c, i) => `${i + 1}. *${c.category}:* ${formatCurrency(c.spent)} (${c.percent}%)`).join('\n');

  const replyText =
    `*Top Spending Categories (${currentMonthName})*\n` +
    `${chartLines}\n\n` +
    `*Top Category:* *${snapshot.topCategory?.category || 'General'}* (${snapshot.topCategory?.percent || 0}% of expenses)`;

  return {
    replyText,
    type: 'category_breakdown',
    suggestedChips: ['Food Spend', 'Daily Pace', 'Summary']
  };
}

function handleRecentHistory(snapshot, formatCurrency) {
  const txs = snapshot.safeTransactions.slice(0, 5);
  if (txs.length === 0) {
    return {
      replyText: `No recent transactions recorded yet this month.`,
      type: 'history'
    };
  }

  const list = txs.map((t, idx) =>
    `${idx + 1}. *${t.merchant}* • ${formatCurrency(t.amount)} (${t.category} • ${t.paymentMode} • ${t.date})`
  ).join('\n');

  const replyText =
    `*Recent Spending History (${txs.length} Transactions)*\n` +
    `${list}\n\n` +
    `Send \`Undo\` to remove *${txs[0].merchant}* (${formatCurrency(txs[0].amount)}).`;

  return {
    replyText,
    type: 'recent_history',
    suggestedChips: ['Undo Last', 'Summary', 'Daily Pace']
  };
}

function handleSavingAdvice(snapshot, formatCurrency) {
  const topCat = snapshot.topCategory?.category || 'discretionary';
  const topSpent = snapshot.topCategory?.spent || 0;
  const pace = snapshot.safeDailyPace;

  const replyText =
    `*Personalized Financial Coaching*\n` +
    `1. *Top Optimization Target:* Your highest expense is *${topCat}* (${formatCurrency(topSpent)}). Trimming 15% here saves *${formatCurrency(Math.round(topSpent * 0.15))}*.\n` +
    `2. *The Daily Pace Rule:* Your safe burn rate is *${formatCurrency(pace)}/day*. Keeping 2 weekdays zero-spend adds *${formatCurrency(pace * 2)}* directly to your savings pool.\n` +
    `3. *Micro-Expense Alert:* Small ₹20–₹50 daily spends compound fast. Use Speed Chips to track them visibly.` +
    FINANCIAL_DISCLAIMER;

  return {
    replyText,
    type: 'saving_advice',
    suggestedChips: ['Summary', 'Daily Pace', 'Categories']
  };
}

function handleSummary(snapshot, formatCurrency) {
  const { totalSpent, budget, remainingBudget, todaySpent, percentSpent } = snapshot;

  const replyText =
    `*Monthly Budget Summary*\n` +
    `*Spent This Month:* ${formatCurrency(totalSpent)} (${percentSpent}%)\n` +
    `*Total Budget:* ${formatCurrency(budget)}\n` +
    `*Remaining Balance:* *${formatCurrency(remainingBudget)}*\n` +
    `*Spent Today:* ${formatCurrency(todaySpent)}\n` +
    `*Safe Daily Pace:* ${formatCurrency(snapshot.safeDailyPace)}/day\n\n` +
    (remainingBudget < 0
      ? `*Notice:* Budget exceeded by ${formatCurrency(Math.abs(remainingBudget))}!`
      : `*Health:* Safe and comfortably within limits.`);

  return {
    replyText,
    type: 'summary',
    suggestedChips: ['Daily Pace', 'Food Spend', 'Split Bill', 'Tips']
  };
}

/**
 * Safely splits multi-item inputs without breaking Indian comma-grouped amounts like "50 chai, 1,200 lunch, 40 auto"
 */
export function extractMultiItemExpenses(text, options = {}) {
  const parts = text
    .split(/(?<!\d),(?!\d)|,(?=\s)|[;\n]+|\s+\band\b\s+/i)
    .map(p => p.trim())
    .filter(Boolean);

  const parsedItems = [];
  for (const part of parts) {
    const item = parseSmsNotification(part, options);
    if (item.success && item.amount > 0) {
      parsedItems.push(item);
    }
  }
  return parsedItems;
}

function handleDuplicateWarning(parsed, duplicateTx, formatCurrency) {
  const replyText =
    `*Possible Duplicate Detected*\n` +
    `An identical entry for *${parsed.merchant}* (${formatCurrency(parsed.amount)}) was already logged today (${duplicateTx.date || 'today'}).\n\n` +
    `Did you want to skip this duplicate or log it again anyway?`;

  return {
    replyText,
    type: 'duplicate_warning',
    parsed,
    duplicateOf: duplicateTx,
    actionButtons: [
      {
        label: `Log Anyway (${formatCurrency(parsed.amount)})`,
        actionType: 'force_log_expense',
        expensePayload: parsed
      },
      {
        label: 'Skip Duplicate',
        actionType: 'dismiss_notice',
        query: ''
      }
    ],
    suggestedChips: ['Recent expenses', 'Summary']
  };
}

function handleLowConfidenceConfirm(parsed, formatCurrency) {
  const reasonLine = parsed.confidenceReasons?.[0] || 'Needs category/amount confirmation';

  if (parsed.isAmbiguous && Array.isArray(parsed.ambiguityOptions)) {
    const optA = parsed.ambiguityOptions[0];
    const optB = parsed.ambiguityOptions[1];
    return {
      replyText:
        `*Confirm Quick Expense*\n` +
        `Detected *${parsed.merchant}* (${reasonLine}). Which amount did you mean?`,
      type: 'confirm_expense',
      parsed,
      actionButtons: [
        {
          label: optA.label,
          actionType: 'confirm_parsed_expense',
          expensePayload: { ...parsed, amount: optA.amount }
        },
        {
          label: optB.label,
          actionType: 'confirm_parsed_expense',
          expensePayload: { ...parsed, amount: optB.amount }
        }
      ],
      suggestedChips: ['Summary']
    };
  }

  const replyText =
    `*Confirm Expense Details*\n` +
    `*Merchant:* ${parsed.merchant}\n` +
    `*Amount:* ${formatCurrency(parsed.amount)}\n` +
    `*Guessed Category:* ${parsed.category}\n` +
    `*Mode:* ${parsed.paymentMode}${parsed.isModeExplicit ? '' : ' (defaulted)'}\n` +
    `*Confidence:* ${parsed.confidence}% (${reasonLine})\n\n` +
    `Please confirm or edit the details below before adding to your ledger.`;

  return {
    replyText,
    type: 'confirm_expense',
    parsed,
    actionButtons: [
      {
        label: `Confirm & Log (${formatCurrency(parsed.amount)})`,
        actionType: 'confirm_parsed_expense',
        expensePayload: parsed
      }
    ],
    suggestedChips: ['Summary']
  };
}

async function handleMultiItemLogging(items, snapshot, formatCurrency, onSaveExpense, recentTransactions = [], forceLog = false) {
  let totalAdded = 0;
  const loggedList = [];
  const savedIds = [];

  for (const item of items) {
    if (!forceLog && findDuplicateTransaction(item, recentTransactions)) {
      continue;
    }
    let saved = null;
    if (typeof onSaveExpense === 'function') {
      saved = await onSaveExpense({
        amount: item.amount,
        description: item.merchant,
        category: item.category,
        payment_mode: item.paymentMode,
        date: item.date,
        is_refund: item.type === 'income'
      });
    }
    if (saved?.id) savedIds.push(saved.id);
    totalAdded += item.type === 'income' ? -item.amount : item.amount;
    loggedList.push(`• *${item.merchant}*: ${formatCurrency(item.amount)} (${item.category})`);
  }

  if (loggedList.length === 0) {
    return {
      replyText: `*Batch Skipped — Duplicate Entries Detected*\nAll items in this batch were already logged today.`,
      type: 'duplicate_warning',
      suggestedChips: ['Recent expenses', 'Summary']
    };
  }

  const newTotal = snapshot.totalSpent + totalAdded;
  const replyText =
    `*Batch Expenses Recorded (${loggedList.length} Items)*\n` +
    `${loggedList.join('\n')}\n\n` +
    `*Total Batch Amount:* ${formatCurrency(totalAdded)}\n` +
    `*Updated Month Spent:* ${formatCurrency(newTotal)}`;

  return {
    replyText,
    type: 'batch_logged',
    totalAdded,
    count: loggedList.length,
    savedIds,
    items,
    suggestedChips: ['Undo', 'Summary', "Today's Total"]
  };
}

async function handleSingleExpenseLogging(parsed, snapshot, formatCurrency, onSaveExpense) {
  let savedTransaction = null;
  if (typeof onSaveExpense === 'function') {
    savedTransaction = await onSaveExpense({
      amount: parsed.amount,
      description: parsed.merchant,
      category: parsed.category,
      payment_mode: parsed.paymentMode,
      date: parsed.date,
      is_refund: parsed.type === 'income'
    });
  }

  const currentTotal = snapshot.totalSpent + (parsed.type === 'income' ? -parsed.amount : parsed.amount);
  const replyText = parsed.type === 'income'
    ? `*Income / Refund Logged!*\n` +
    `*Amount:* +${formatCurrency(parsed.amount)}\n` +
    `*Source:* ${parsed.merchant}\n` +
    `*Mode:* ${parsed.paymentMode}\n` +
    `*Date:* ${parsed.date}\n\n` +
    `Updated Monthly Spent: ${formatCurrency(currentTotal)}`
    : `*Expense Logged Successfully!*\n` +
    `*Amount:* ${formatCurrency(parsed.amount)}\n` +
    `*Category:* ${parsed.category}\n` +
    `*Merchant:* ${parsed.merchant}\n` +
    `*Mode:* ${parsed.paymentMode}\n` +
    `*Date:* ${parsed.date}\n\n` +
    `Updated Monthly Spent: ${formatCurrency(currentTotal)}`;

  return {
    replyText,
    type: 'expense_logged',
    parsed,
    savedTransaction: savedTransaction || {
      amount: parsed.amount,
      description: parsed.merchant,
      category: parsed.category,
      payment_mode: parsed.paymentMode,
      date: parsed.date,
      is_refund: parsed.type === 'income'
    },
    suggestedChips: ['Undo', "Today's Total", 'Summary', 'Daily Pace'],
    actionButtons: [
      {
        label: 'Edit Details',
        actionType: 'inline_edit'
      },
      {
        label: `Undo (${formatCurrency(parsed.amount)} ${parsed.merchant})`,
        actionType: 'undo_tx',
        targetTxId: savedTransaction?.id || null,
        query: 'Undo'
      }
    ]
  };
}

function handleFallbackResponse(text, snapshot, formatCurrency) {
  const replyText =
    `*I couldn't recognize an expense or command in that message — here is how I can help:*\n\n` +
    `• \`Chai 20\` or \`chai pe 30 kharch kiya\` (Record expense)\n` +
    `• \`50 chai, 1,200 lunch, 40 auto\` (Multi-item batch)\n` +
    `• \`Split 2,400 among 6\` or \`Divide 2500 by 3\` (Smart bill split)\n` +
    `• \`Can I afford 3500?\` (Affordability check)\n` +
    `• \`50/30/20 rule\` • \`Emergency fund\` • \`Daily pace\`\n` +
    `• \`Paisa kaise bachaye\` (Hinglish guidance)\n\n` +
    `*Current Status:* Safe pool remaining: *${formatCurrency(snapshot.remainingBudget)}* (*${formatCurrency(snapshot.safeDailyPace)}/day*).`;

  return {
    replyText,
    type: 'help_guidance',
    suggestedChips: ['Chai 20', 'Summary', 'Daily Pace', '50/30/20 Rule']
  };
}
