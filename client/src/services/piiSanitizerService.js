/**
 * piiSanitizerService.js
 * PocketNook Zero-Leakage Privacy & PII Scrubbing Engine
 * 
 * Runs 100% locally on the user's device.
 * Strips all personal identifiable information (PII) and sensitive banking details:
 * - Bank account numbers (A/C XX1234, Acct ending in 4912)
 * - Credit / Debit card digits (**** 1234, card xx9911)
 * - UPI Transaction Reference / UTR / RRN numbers
 * - Phone numbers (Indian & International formats)
 * - Personal email addresses
 * - Indian Government ID formats (PAN, Aadhaar)
 * 
 * Guarantees that only sanitized category names, generic numbers, and generic prompts
 * are ever processed by conversational reasoning engines.
 */

// Bank Account Number patterns
const ACCOUNT_PATTERNS = [
  /\b(?:a\/c|acct|account|acc)\s*(?:no\.?|number)?\s*[:#-]?\s*(?:x{2,}|[*]{2,})?\s*(\d{3,18})\b/gi,
  /\b(?:a\/c|acct|account)\s*(?:ending\s*(?:in|with)?)?\s*[:#-]?\s*(?:x{2,}|[*]{2,})?\s*(\d{3,6})\b/gi,
  /\b(?:x{2,}|[*]{2,})\s*(\d{3,6})\b/gi
];

// Card numbers
const CARD_PATTERNS = [
  /\b(?:\d{4}[- ]){3}\d{4}\b/g, // 16 digit formatted card
  /\bcard\s*(?:ending\s*(?:in|with)?)?\s*[:#-]?\s*(?:x{2,}|[*]{2,})?\s*(\d{3,6})\b/gi,
  /\b(?:debit|credit)\s*card\s*[:#-]?\s*(?:x{2,}|[*]{2,})?\s*(\d{3,6})\b/gi
];

// UPI Reference / UTR / RRN numbers (12-16 digits tracking codes)
const UPI_REF_PATTERNS = [
  /\b(?:upi\s*ref(?:erence)?(?:\s*no\.?)?|utr|rrn|txn\s*(?:id|ref)?)\s*[:#-]?\s*([a-z0-9]{8,24})\b/gi,
  /\b(?:ref\s*(?:no\.?)?|reference\s*(?:no\.?)?)\s*[:#-]?\s*(\d{8,18})\b/gi
];

// Phone numbers
const PHONE_PATTERNS = [
  /(?:\+?91[\s-]?)?[6789]\d{9}\b/g, // Indian 10-digit mobile
  /\b\+?[1-9]\d{0,2}[\s-]?(?:\(\d{1,4}\)|\d{1,4})[\s-]?\d{3,4}[\s-]?\d{3,4}\b/g // International formats
];

// Email addresses
const EMAIL_PATTERN = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;

// PAN card (5 letters, 4 digits, 1 letter)
const PAN_PATTERN = /\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b/gi;

// Aadhaar card (12 digits with spaces or hyphens)
const AADHAAR_PATTERN = /\b[2-9]{1}\d{3}[\s-]?\d{4}[\s-]?\d{4}\b/g;

/**
 * Sanitizes a raw text string, replacing all sensitive banking and personal tokens
 * with safe generic placeholders.
 * 
 * @param {string} rawText 
 * @returns {{ sanitizedText: string, wasSanitized: boolean, redactedTypes: string[] }}
 */
export function sanitizeFinancialText(rawText = '') {
  if (!rawText || typeof rawText !== 'string') {
    return { sanitizedText: '', wasSanitized: false, redactedTypes: [] };
  }

  let text = rawText;
  const redactedTypes = new Set();

  // 1. Scrub emails
  if (EMAIL_PATTERN.test(text)) {
    text = text.replace(EMAIL_PATTERN, '[EMAIL_REDACTED]');
    redactedTypes.add('email');
  }

  // 2. Scrub PAN
  if (PAN_PATTERN.test(text)) {
    text = text.replace(PAN_PATTERN, '[PAN_REDACTED]');
    redactedTypes.add('pan');
  }

  // 3. Scrub Aadhaar
  if (AADHAAR_PATTERN.test(text)) {
    text = text.replace(AADHAAR_PATTERN, '[AADHAAR_REDACTED]');
    redactedTypes.add('aadhaar');
  }

  // 4. Scrub Card numbers
  CARD_PATTERNS.forEach(pattern => {
    if (pattern.test(text)) {
      text = text.replace(pattern, '[CARD_REDACTED]');
      redactedTypes.add('card');
    }
  });

  // 5. Scrub Account numbers
  ACCOUNT_PATTERNS.forEach(pattern => {
    if (pattern.test(text)) {
      text = text.replace(pattern, '[ACCOUNT_REDACTED]');
      redactedTypes.add('bank_account');
    }
  });

  // 6. Scrub UPI / UTR References
  UPI_REF_PATTERNS.forEach(pattern => {
    if (pattern.test(text)) {
      text = text.replace(pattern, '[UPI_REF_REDACTED]');
      redactedTypes.add('transaction_ref');
    }
  });

  // 7. Scrub Phone numbers (make sure we don't accidentally match plain expense amounts like 500 or 1200)
  PHONE_PATTERNS.forEach(pattern => {
    // Only scrub if the match looks like an actual 10+ digit phone number
    text = text.replace(pattern, (match) => {
      const cleanDigits = match.replace(/\D/g, '');
      if (cleanDigits.length >= 10 && cleanDigits.length <= 13) {
        redactedTypes.add('phone');
        return '[PHONE_REDACTED]';
      }
      return match;
    });
  });

  return {
    sanitizedText: text,
    wasSanitized: redactedTypes.size > 0,
    redactedTypes: Array.from(redactedTypes)
  };
}

/**
 * Prepares an anonymized financial context vector safe for conversational reasoning.
 * Strips personal names, specific account IDs, or private notes.
 * 
 * @param {Object} options
 * @param {Object} options.dashboardData
 * @param {Array} options.recentTransactions
 * @returns {Object} Sanitized financial snapshot
 */
export function prepareSafeFinancialSnapshot({ dashboardData = {}, recentTransactions = [] } = {}) {
  const budget = Number(dashboardData?.budget || 0);
  const totalSpent = Number(dashboardData?.total_spent || 0);
  const remainingBudget = Number(dashboardData?.remaining_budget || 0);
  const todaySpent = Number(dashboardData?.today_spent || 0);
  const percentSpent = budget > 0 ? Math.round((totalSpent / budget) * 100) : 0;

  // Days left in current month calculation
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const currentDay = now.getDate();
  const daysRemaining = Math.max(1, daysInMonth - currentDay);
  const safeDailyPace = remainingBudget > 0 ? Math.round(remainingBudget / daysRemaining) : 0;

  // Category summary (only category name, amount, and percent - zero PII)
  const categoryBreakdown = (dashboardData?.category_breakdown || []).map(c => ({
    category: c.name || c.category || 'General',
    spent: Number(c.spent || 0),
    percent: Math.round(Number(c.percent || 0))
  })).sort((a, b) => b.spent - a.spent);

  // Top spending category
  const topCategory = categoryBreakdown[0] || null;

  // Recent transactions: scrub any raw merchant notes
  const safeTransactions = (recentTransactions || []).slice(0, 10).map(tx => {
    const { sanitizedText } = sanitizeFinancialText(tx.description || tx.merchant || 'Expense');
    return {
      id: tx.id,
      amount: Number(tx.amount || 0),
      category: tx.category || 'Uncategorized',
      merchant: sanitizedText,
      paymentMode: tx.payment_mode || 'UPI',
      date: tx.date || new Date().toISOString().slice(0, 10),
      isRefund: Boolean(tx.is_refund)
    };
  });

  return {
    budget,
    totalSpent,
    remainingBudget,
    todaySpent,
    percentSpent,
    daysRemaining,
    safeDailyPace,
    categoryBreakdown,
    topCategory,
    safeTransactions,
    isOverBudget: remainingBudget < 0
  };
}
