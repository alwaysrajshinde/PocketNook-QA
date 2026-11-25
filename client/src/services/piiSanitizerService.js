/**
 * piiSanitizerService.js
 * PocketNook Privacy & Sensitive-Number Masking Engine
 *
 * Runs locally on the user's device before text reaches parsing/AI layers:
 * - Masks UPI Transaction Reference / UTR / RRN numbers (run before phone/Aadhaar to avoid digit collisions)
 * - Masks full 16-digit Card numbers and CVV/Card refs
 * - Masks Bank Account numbers while optionally preserving last 4 digits (e.g. A/c **4912) for matching
 * - Masks Indian & International Phone numbers (avoiding false positives on ₹/Rs currency amounts)
 * - Masks Email addresses, PAN, and Aadhaar numbers
 * - Caps raw input size to prevent ReDoS on oversized pastes
 */

export const MAX_SANITIZE_INPUT_CHARS = 4000;

// 1. UPI Reference / UTR / RRN numbers (run FIRST so 12-digit UTRs never collide with Aadhaar/Phone)
const UPI_REF_PATTERNS = [
  /\b(?:upi\s*ref(?:erence)?(?:\s*no\.?)?|utr|rrn|txn\s*(?:id|ref|no\.?)?|txnid)\s*[:#-]?\s*([a-z0-9]{6,26})\b/gi,
  /\b(?:ref(?:erence)?\s*(?:no\.?|id|#)?)\s*[:#-]?\s*([a-z0-9]{6,22})\b/gi
];

// 2. Email addresses
const EMAIL_PATTERN = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;

// 3. PAN card (5 letters, 4 digits, 1 letter)
const PAN_PATTERN = /\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b/gi;

// 4. Aadhaar card (12 digits with spaces/hyphens, or 12 raw digits prefixed by aadhaar/uid; negative lookahead avoids 16-digit card prefix match)
const AADHAAR_PATTERNS = [
  /\b(?:aadhaar|aadhar|uid)\s*(?:no\.?|number)?\s*[:#-]?\s*[2-9]\d{3}[\s-]?\d{4}[\s-]?\d{4}(?!\d)\b/gi,
  /\b[2-9]\d{3}[\s-]\d{4}[\s-]\d{4}(?![\s-]?\d)\b/g
];

// 5. Card numbers (full 16-digit PAN or explicit card ending refs)
const CARD_PATTERNS = [
  /\b(?:\d{4}[-\s]){3}\d{4}\b/g,
  /\b(?:\d{16})\b/g,
  /\b(?:(?:debit|credit)\s*)?card\s*(?:no\.?|number|ending(?:\s*(?:in|with))?)?\s*[:#-]?\s*(?:x{2,}|[*]{2,})?\s*(\d{3,6})\b/gi
];

// 6. Bank Account Number patterns (preserve last 4 digits as **[last4] for safe matching)
const ACCOUNT_FULL_PATTERN = /\b(a\/c|acct|account|acc)\s*(?:no\.?|number)?\s*[:#-]?\s*(?:x{2,}|[*]{2,})?(\d{5,18})\b/gi;
const ACCOUNT_LAST4_PATTERN = /\b(a\/c|acct|account|acc)\s*(?:no\.?|number|ending(?:\s*(?:in|with))?)?\s*[:#-]?\s*(?:x{2,}|[*]{2,})\s*(\d{4})\b/gi;

// 7. Phone numbers (avoid false positives on currency figures or plain numbers)
const LABELED_PHONE_PATTERN = /\b(?:ph|phone|mob|mobile|tel|call|helpline|contact|whatsapp)\s*(?:no\.?|number)?\s*[:#-]?\s*(\+?[\d\s()-]{8,16})/gi;
const INDIAN_MOBILE_PATTERN = /(?<![₹.\d])(?:\+91[\s-]?|91[\s-]?)?([6-9]\d{9})(?!\.\d|\d)/g;

/**
 * Sanitizes a raw text string, masking sensitive banking and personal tokens
 * while preserving low-risk account last-4 suffixes (`A/c **4912`) for ledger matching.
 *
 * @param {string} rawText
 * @returns {{ sanitizedText: string, wasSanitized: boolean, wasTruncated: boolean, redactedTypes: string[] }}
 */
export function sanitizeFinancialText(rawText = '') {
  if (!rawText || typeof rawText !== 'string') {
    return { sanitizedText: '', wasSanitized: false, wasTruncated: false, redactedTypes: [] };
  }

  let wasTruncated = false;
  let text = rawText;
  if (text.length > MAX_SANITIZE_INPUT_CHARS) {
    text = text.slice(0, MAX_SANITIZE_INPUT_CHARS);
    wasTruncated = true;
  }

  // Strip executable HTML / script payloads before storage or display
  if (/<[^>]+>/i.test(text)) {
    text = text.replace(/<script[\s\S]*?<\/script>/gi, ' ')
               .replace(/<[^>]*>/g, ' ')
               .replace(/\s{2,}/g, ' ')
               .trim();
  }

  const redactedTypes = new Set();

  // 1. Mask UPI / UTR / RRN References first so 12+ digit UTRs never collide with Aadhaar/Phone
  UPI_REF_PATTERNS.forEach(pattern => {
    text = text.replace(pattern, () => {
      redactedTypes.add('transaction_ref');
      return '[UPI_REF_MASKED]';
    });
  });

  // 2. Mask emails
  if (EMAIL_PATTERN.test(text)) {
    text = text.replace(EMAIL_PATTERN, '[EMAIL_MASKED]');
    redactedTypes.add('email');
  }

  // 3. Mask PAN
  if (PAN_PATTERN.test(text)) {
    text = text.replace(PAN_PATTERN, '[PAN_MASKED]');
    redactedTypes.add('pan');
  }

  // 4. Mask Card numbers BEFORE Aadhaar so 16-digit cards are never partially masked as Aadhaar
  CARD_PATTERNS.forEach(pattern => {
    text = text.replace(pattern, () => {
      redactedTypes.add('card');
      return '[CARD_MASKED]';
    });
  });

  // 5. Mask Aadhaar
  AADHAAR_PATTERNS.forEach(pattern => {
    text = text.replace(pattern, () => {
      redactedTypes.add('aadhaar');
      return '[AADHAAR_MASKED]';
    });
  });

  // 6. Mask long bank account numbers while keeping low-risk last 4 digits (`A/c **4912`)
  text = text.replace(ACCOUNT_FULL_PATTERN, (_match, label, digits) => {
    redactedTypes.add('bank_account');
    const last4 = digits.slice(-4);
    return `${label} **${last4}`;
  });
  text = text.replace(ACCOUNT_LAST4_PATTERN, (_match, label, last4) => {
    // Already masked to 4 digits; preserve safely for account reconciliation
    return `${label} **${last4}`;
  });

  // 7. Mask Phone numbers safely (avoiding currency & decimal false positives)
  text = text.replace(LABELED_PHONE_PATTERN, (fullMatch, numPart) => {
    const cleanDigits = numPart.replace(/\D/g, '');
    if (cleanDigits.length >= 7 && cleanDigits.length <= 15) {
      redactedTypes.add('phone');
      return fullMatch.replace(numPart, '[PHONE_MASKED]');
    }
    return fullMatch;
  });

  text = text.replace(INDIAN_MOBILE_PATTERN, (match, _digits, offset, sourceStr) => {
    // Guard against preceding currency keywords like "Rs. 9876543210"
    const prefix = sourceStr.slice(Math.max(0, offset - 8), offset);
    if (/(?:rs\.?|inr|₹)\s*$/i.test(prefix)) {
      return match;
    }
    redactedTypes.add('phone');
    return '[PHONE_MASKED]';
  });

  return {
    sanitizedText: text,
    wasSanitized: redactedTypes.size > 0,
    wasTruncated,
    redactedTypes: Array.from(redactedTypes)
  };
}

/**
 * Prepares an anonymized financial context snapshot for reasoning.
 * Strips raw merchant PII and computes remaining days, burn pace, and upcoming commitments.
 *
 * @param {Object} options
 * @param {Object} options.dashboardData
 * @param {Array} options.recentTransactions
 * @param {number} options.upcomingRecurringTotal
 * @param {number} options.committedSavings
 * @returns {Object} Sanitized financial snapshot
 */
export function prepareSafeFinancialSnapshot({
  dashboardData = {},
  recentTransactions = [],
  upcomingRecurringTotal = 0,
  committedSavings = 0
} = {}) {
  const budget = Number(dashboardData?.budget || 0);
  const totalSpent = Number(dashboardData?.total_spent || 0);
  const remainingBudget = Number(dashboardData?.remaining_budget || 0);
  const todaySpent = Number(dashboardData?.today_spent || 0);
  const percentSpent = budget > 0 ? Math.round((totalSpent / budget) * 100) : 0;

  // Days left in current month (inclusive of today when on final day)
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const currentDay = now.getDate();
  const isLastDayOfMonth = currentDay >= daysInMonth;
  const daysRemaining = Math.max(1, daysInMonth - currentDay + 1);

  const recurringCommitments = Math.max(0, Number(upcomingRecurringTotal || 0));
  const savingsCommitments = Math.max(0, Number(committedSavings || 0));
  const totalUpcomingCommitted = recurringCommitments + savingsCommitments;
  const freeSafePool = remainingBudget - totalUpcomingCommitted;
  const safeDailyPace = freeSafePool > 0
    ? Math.round(freeSafePool / daysRemaining)
    : (remainingBudget > 0 ? Math.round(remainingBudget / daysRemaining) : 0);

  // Category summary
  const categoryBreakdown = (dashboardData?.category_breakdown || []).map(c => ({
    category: c.name || c.category || 'General',
    spent: Number(c.spent || 0),
    percent: Math.round(Number(c.percent || 0))
  })).sort((a, b) => b.spent - a.spent);

  const topCategory = categoryBreakdown[0] || null;

  // Recent transactions: mask any sensitive tokens in merchant notes
  const safeTransactions = (recentTransactions || []).slice(0, 20).map(tx => {
    const { sanitizedText } = sanitizeFinancialText(tx.description || tx.merchant || 'Expense');
    return {
      id: tx.id,
      amount: Number(tx.amount || 0),
      category: tx.category || 'Uncategorized',
      merchant: sanitizedText,
      paymentMode: tx.payment_mode || 'UPI',
      date: tx.date || new Date().toISOString().slice(0, 10),
      createdAt: tx.created_at || tx.updated_at || null,
      isRefund: Boolean(tx.is_refund)
    };
  });

  return {
    budget,
    totalSpent,
    remainingBudget,
    freeSafePool,
    recurringCommitments,
    savingsCommitments,
    totalUpcomingCommitted,
    todaySpent,
    percentSpent,
    daysRemaining,
    isLastDayOfMonth,
    safeDailyPace,
    categoryBreakdown,
    topCategory,
    safeTransactions,
    hasBudgetConfigured: budget > 0,
    isOverBudget: remainingBudget < 0
  };
}
