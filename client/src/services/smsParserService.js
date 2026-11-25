/**
 * SMS & Natural Language Expense Parser Service
 * Client-side regex & deterministic NLP parser
 *
 * Supports:
 * - Indian Banks (HDFC, SBI, ICICI, Axis, Kotak, PNB, BoB, Canara, IndusInd, IDFC, etc.)
 * - UPI Apps (Google Pay, PhonePe, Paytm, BHIM, CRED, Amazon Pay)
 * - Card swipe alerts & income/refund alerts
 * - Shorthand & Indian formats: "Chai 20", "1,200 lunch", "1.5k groceries", "2 lakh bike", "20 rs coffee"
 * - Relative dates: "yesterday", "last Friday", "today", "DD-MMM-YYYY"
 * - Hinglish expenses: "chai pe 30 kharch kiya", "200 ka petrol", "auto me 40 diye"
 * - Quantity vs Amount disambiguation ("2 chai 40") & parser confidence scoring
 * - Learned merchant -> category personalization & custom categories
 */

export const MAX_SMS_INPUT_CHARS = 4000;

export const CATEGORY_KEYWORDS = [
  {
    category: 'Food & Dining',
    keywords: [
      'swiggy', 'zomato', 'starbucks', 'mcdonald', 'kfc', 'burger', 'pizza', 'domino',
      'subway', 'chai', 'tea', 'coffee', 'cafe', 'restaurant', 'bistro', 'bakery',
      'dhaba', 'lunch', 'dinner', 'breakfast', 'snacks', 'eatclub', 'haldiram', 'barbeque',
      'dosa', 'biryani', 'food', 'canteen', 'mess', 'hotel', 'samosa', 'momos'
    ]
  },
  {
    category: 'Groceries',
    keywords: [
      'blinkit', 'zepto', 'instamart', 'bigbasket', 'd-mart', 'dmart', 'reliance fresh',
      'smart bazaar', 'supermarket', 'kirana', 'grocery', 'groceries', 'milk', 'vegetable', 'fruit',
      'spencer', 'nature basket', 'dunzo', 'otipy', 'country delight', 'meat', 'fresh', 'rashan'
    ]
  },
  {
    category: 'Transportation',
    keywords: [
      'uber', 'ola', 'rapido', 'petrol', 'fuel', 'diesel', 'shell', 'hp fuel', 'hpcl',
      'bpcl', 'indian oil', 'iocl', 'bharat petroleum', 'metro', 'irctc', 'railway',
      'auto', 'cab', 'parking', 'toll', 'fastag', 'bus', 'redbus', 'flight', 'indigo', 'air india', 'rickshaw'
    ]
  },
  {
    category: 'Shopping',
    keywords: [
      'amazon', 'flipkart', 'myntra', 'ajio', 'meesho', 'nykaa', 'tata cliq', 'zara',
      'h&m', 'croma', 'reliance digital', 'decathlon', 'nike', 'adidas', 'shopping',
      'mall', 'westside', 'lifestyle', 'max fashion', 'shoppers stop', 'clothing', 'store', 'shirt', 'shoes'
    ]
  },
  {
    category: 'Entertainment',
    keywords: [
      'netflix', 'spotify', 'youtube', 'prime video', 'hotstar', 'disney', 'bookmyshow',
      'cinema', 'pvr', 'inox', 'movie', 'concert', 'gaming', 'steam', 'playstation',
      'event', 'theatre'
    ]
  },
  {
    category: 'Bills & Utilities',
    keywords: [
      'electricity', 'bescom', 'tneb', 'msedcl', 'cesc', 'uppcl', 'broadband', 'wifi',
      'airtel', 'jio', 'vi', 'vodafone', 'water bill', 'gas bill', 'lpg', 'indane',
      'hp gas', 'bharat gas', 'bill payment', 'recharge', 'dth', 'tata play', 'bijli'
    ]
  },
  {
    category: 'Healthcare',
    keywords: [
      'apollo', 'pharmeasy', '1mg', 'tata 1mg', 'netmeds', 'pharmacy', 'medplus',
      'doctor', 'clinic', 'hospital', 'lab', 'diagnostic', 'medicine', 'dental',
      'health', 'chemist', 'dawai'
    ]
  },
  {
    category: 'Subscriptions',
    keywords: [
      'icloud', 'google one', 'chatgpt', 'openai', 'github', 'adobe', 'canva',
      'medium', 'notion', 'coursera', 'linkedin', 'sub', 'subscription'
    ]
  },
  {
    category: 'Housing & Rent',
    keywords: [
      'rent', 'maintenance', 'flat', 'apartment', 'pg', 'society', 'nobroker', 'mygate', 'kiraya'
    ]
  }
];

const AMOUNT_TOKEN_SRC = '([0-9,]+(?:\\.[0-9]{1,2})?(?:\\s*(?:k|lakh|lakhs|lac|lacs|l|cr|crore|crores))?)';
const NON_EXPENSE_QUESTION_GUARD = /\b(?:can\s+i|should\s+i|how\s+(?:much|to|do|should)|what\s+is|where\s+(?:is|did)|why\s+|explain|split\b|divide\b|save\s+for|afford\b|budget\b|emergency\b|50[\s/-]?30[\s/-]?20|avalanche|snowball)\b/i;

/**
 * Parses Indian formatted amounts including commas, decimals, k, lakh, cr suffixes.
 * Examples: "1,200", "1,00,000", "1.5k", "2 lakh", "2400.50"
 * @param {string|number} rawAmount
 * @returns {number|null}
 */
export function parseIndianAmount(rawAmount) {
  if (typeof rawAmount === 'number') return isFinite(rawAmount) ? rawAmount : null;
  if (!rawAmount || typeof rawAmount !== 'string') return null;

  const cleaned = rawAmount.trim().toLowerCase().replace(/,/g, '').replace(/(?:₹|rs\.?|inr|rupees|\/-)/g, '').trim();
  const match = cleaned.match(/^([0-9]+(?:\.[0-9]+)?)\s*(k|lakh|lakhs|lac|lacs|l|cr|crore|crores)?$/i);
  if (!match) return null;

  const base = parseFloat(match[1]);
  if (isNaN(base) || !isFinite(base)) return null;

  const suffix = (match[2] || '').toLowerCase();
  if (suffix === 'k') return Math.round(base * 1000 * 100) / 100;
  if (['lakh', 'lakhs', 'lac', 'lacs', 'l'].includes(suffix)) return Math.round(base * 100000 * 100) / 100;
  if (['cr', 'crore', 'crores'].includes(suffix)) return Math.round(base * 10000000 * 100) / 100;
  return base;
}

/**
 * Formats a Date object as local YYYY-MM-DD
 */
function toLocalISODate(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Extracts explicit or relative dates ("yesterday", "last Friday", "DD-MMM-YY")
 * and returns a cleaned text without the relative date phrase.
 */
export function extractDateFromText(text = '') {
  const now = new Date();
  let date = toLocalISODate(now);
  let strippedText = text;
  let foundExplicitDate = false;

  // 1. Day before yesterday / parso
  if (/\b(?:day\s+before\s+yesterday|parso)\b/i.test(strippedText)) {
    const d = new Date(now);
    d.setDate(d.getDate() - 2);
    date = toLocalISODate(d);
    strippedText = strippedText.replace(/\b(?:on\s+)?(?:day\s+before\s+yesterday|parso)\b/gi, ' ').trim();
    foundExplicitDate = true;
  }
  // 2. Yesterday / kal
  else if (/\b(?:yesterday|kal)\b/i.test(strippedText)) {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    date = toLocalISODate(d);
    strippedText = strippedText.replace(/\b(?:on\s+)?(?:yesterday|kal)\b/gi, ' ').trim();
    foundExplicitDate = true;
  }
  // 3. Today / aaj
  else if (/\b(?:today|aaj)\b/i.test(strippedText)) {
    strippedText = strippedText.replace(/\b(?:on\s+)?(?:today|aaj)\b/gi, ' ').trim();
    foundExplicitDate = true;
  }
  // 4. Last <Weekday>
  else {
    const weekdayMatch = strippedText.match(/\b(?:on\s+)?last\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i);
    if (weekdayMatch) {
      const daysMap = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
      const targetDay = daysMap[weekdayMatch[1].toLowerCase()];
      const d = new Date(now);
      let diff = d.getDay() - targetDay;
      if (diff <= 0) diff += 7;
      d.setDate(d.getDate() - diff);
      date = toLocalISODate(d);
      strippedText = strippedText.replace(weekdayMatch[0], ' ').trim();
      foundExplicitDate = true;
    }
  }

  // 5. Explicit DD-MMM-YYYY or DD/MM/YYYY
  if (!foundExplicitDate) {
    const dateMatch = strippedText.match(/\b(\d{1,2})[-/ ]([A-Za-z]{3}|\d{1,2})[-/ ](\d{2,4})\b/);
    if (dateMatch) {
      try {
        const day = dateMatch[1].padStart(2, '0');
        let mon = dateMatch[2];
        const yr = dateMatch[3].length === 2 ? `20${dateMatch[3]}` : dateMatch[3];
        const monthNames = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
        if (isNaN(mon)) {
          mon = monthNames[mon.slice(0, 3).toLowerCase()] || '01';
        } else {
          mon = mon.padStart(2, '0');
        }
        date = `${yr}-${mon}-${day}`;
        foundExplicitDate = true;
      } catch (e) {}
    }
  }

  return {
    date,
    strippedText: strippedText.replace(/\s{2,}/g, ' ').trim(),
    foundExplicitDate
  };
}

/**
 * Predicts category from merchant name or text description, checking user's learned mappings and custom categories first.
 * @param {string} text
 * @param {Object} [options]
 * @param {Object} [options.learnedCategories]
 * @param {Array} [options.customCategories]
 * @returns {{ category: string, matchedBy: string }}
 */
function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function predictCategoryWithConfidence(text = '', { learnedCategories = {}, customCategories = [] } = {}) {
  if (!text) return { category: 'Other', matchedBy: 'default' };
  const lower = text.toLowerCase().trim();

  // 1. User's learned merchant -> category overrides take highest precedence (word-boundary safe)
  for (const [merchantKey, learnedCat] of Object.entries(learnedCategories || {})) {
    const cleanKey = merchantKey?.trim().toLowerCase();
    if (cleanKey && new RegExp(`\\b${escapeRegExp(cleanKey)}\\b`, 'i').test(lower)) {
      return { category: learnedCat, matchedBy: 'learned' };
    }
  }

  // 2. Built-in merchant keyword taxonomy
  for (const group of CATEGORY_KEYWORDS) {
    for (const kw of group.keywords) {
      if (lower.includes(kw)) {
        return { category: group.category, matchedBy: 'keyword' };
      }
    }
  }

  // 3. Match user's custom categories by whole-word name (so "AI" never hijacks "chai")
  for (const c of customCategories || []) {
    const catName = typeof c === 'string' ? c : c?.name;
    const cleanName = catName?.trim();
    if (cleanName && new RegExp(`\\b${escapeRegExp(cleanName)}\\b`, 'i').test(lower)) {
      return { category: cleanName, matchedBy: 'custom' };
    }
  }

  return { category: 'Other', matchedBy: 'default' };
}

export function predictCategory(text = '', options = {}) {
  return predictCategoryWithConfidence(text, options).category;
}

/**
 * Normalizes payment mode string into standard choices and detects whether mode was explicit
 */
export function detectPaymentMode(text = '', defaultMode = 'UPI') {
  const lower = text.toLowerCase();
  if (/\b(?:upi|gpay|google\s*pay|phonepe|paytm|bhim|cred|amazon\s*pay|vpa)\b|@/.test(lower)) {
    return { paymentMode: 'UPI', isModeExplicit: true };
  }
  if (/\b(?:credit\s*card|debit\s*card|card|pos|visa|mastercard|rupay)\b/.test(lower)) {
    return { paymentMode: 'Card', isModeExplicit: true };
  }
  if (/\b(?:net\s*banking|neft|rtgs|imps|bank\s*transfer|direct\s*debit)\b/.test(lower)) {
    return { paymentMode: 'Net Banking', isModeExplicit: true };
  }
  if (/\b(?:cash|atm|withdrawn)\b/.test(lower)) {
    return { paymentMode: 'Cash', isModeExplicit: true };
  }
  return { paymentMode: defaultMode || 'UPI', isModeExplicit: false };
}

export function normalizePaymentMode(text = '', defaultMode = 'UPI') {
  return detectPaymentMode(text, defaultMode).paymentMode;
}

/**
 * Clean and format merchant description
 */
export function cleanMerchantName(merchant = '') {
  if (!merchant) return 'Quick Expense';
  return merchant
    .replace(/^[\s*.\-_:/@]+|[\s*.\-_:/@]+$/g, '')
    .replace(/^(?:vpa|upi|at|to|inr|rs\.?|transfer\s+to|paid\s+to|info:?|for|on)\s+/i, '')
    .replace(/\s+(?:ref|rrn|upi|txn|bal|avl|on|from)\b.*$/i, '')
    .replace(/\s+(?:rs\.?|inr|rupees|\/-)$/i, '')
    .trim() || 'Expense';
}

function buildResult({
  amount,
  type,
  merchant,
  date,
  accountLast4 = null,
  balance = null,
  bankOrApp = 'Manual Quick Add',
  rawText,
  options = {},
  sourceType = 'shorthand',
  explicitModeText = '',
  isAmbiguous = false,
  ambiguityOptions = null,
  quantity = null
}) {
  const { learnedCategories = {}, customCategories = [], defaultPaymentMode = 'UPI' } = options;
  const cleanedMerchant = cleanMerchantName(merchant);
  const { category, matchedBy } = predictCategoryWithConfidence(`${cleanedMerchant} ${rawText}`, {
    learnedCategories,
    customCategories
  });
  const { paymentMode, isModeExplicit } = detectPaymentMode(explicitModeText || rawText, defaultPaymentMode);

  // Calibrated confidence scoring (0 - 100)
  let confidence = 65;
  const confidenceReasons = [];

  if (sourceType === 'bank_sms') {
    confidence = 88;
    confidenceReasons.push('Matched bank/UPI alert pattern');
  } else if (sourceType === 'shorthand') {
    confidence = 72;
    confidenceReasons.push('Matched shorthand syntax');
  } else if (sourceType === 'hinglish') {
    confidence = 82;
    confidenceReasons.push('Matched Hinglish expense syntax');
  }

  if (matchedBy === 'learned') {
    confidence += 16;
    confidenceReasons.push('Matched your learned category mapping');
  } else if (matchedBy === 'keyword' || matchedBy === 'custom') {
    confidence += 14;
    confidenceReasons.push('Recognized merchant category');
  } else {
    confidenceReasons.push('Unrecognized merchant (needs category confirmation)');
  }

  if (isModeExplicit) {
    confidence += 6;
    confidenceReasons.push(`Explicit payment mode (${paymentMode})`);
  } else {
    confidenceReasons.push(`Defaulted mode to ${paymentMode}`);
  }

  if (type === 'income' && sourceType === 'shorthand') {
    confidence = Math.max(confidence, 88);
  }

  if (isAmbiguous) {
    confidence = 55;
    confidenceReasons.unshift('Ambiguous quantity vs amount');
  }

  confidence = Math.min(99, Math.max(20, confidence));

  return {
    success: true,
    amount,
    type,
    merchant: cleanedMerchant,
    category,
    matchedBy,
    paymentMode,
    isModeExplicit,
    date,
    accountLast4,
    balance,
    bankOrApp,
    confidence,
    isLowConfidence: confidence < 80 || isAmbiguous,
    isAmbiguous,
    ambiguityOptions,
    quantity,
    confidenceReasons,
    rawText
  };
}

/**
 * Parse an Indian Bank/UPI notification SMS or natural language shorthand
 * @param {string} rawText
 * @param {Object} [options]
 * @returns {object} Parsed transaction metadata
 */
export function parseSmsNotification(rawText = '', options = {}) {
  if (!rawText || typeof rawText !== 'string') {
    return { success: false, error: 'Empty text' };
  }

  const trimmedInput = rawText.trim().slice(0, MAX_SMS_INPUT_CHARS);
  if (!trimmedInput) {
    return { success: false, error: 'Empty text' };
  }

  const { date, strippedText } = extractDateFromText(trimmedInput);
  const text = strippedText || trimmedInput;
  const lower = text.toLowerCase();

  // Do not accidentally parse explicit questions or calculation prompts as expenses
  if (text.includes('?') || NON_EXPENSE_QUESTION_GUARD.test(lower)) {
    // Allow genuine bank SMS alerts that happen to contain words like "budget"
    const looksLikeSms = /\b(?:debited|credited|a\/c|acct|utr|rrn|avl\s*bal)\b/i.test(lower);
    if (!looksLikeSms) {
      return { success: false, error: 'Conversational query rather than transaction' };
    }
  }

  // 0. Quantity + Merchant + Amount disambiguation: e.g. "2 chai 40", "3 coffee 150"
  const qtyRegex = new RegExp(
    `^(\\d{1,2})\\s+([A-Za-z][A-Za-z\\s&'-]{1,28}?)\\s+(?:₹|rs\\.?|inr)?\\s*${AMOUNT_TOKEN_SRC}(?:\\s*(?:rs\\.?|inr|rupees|/-))?(?:\\s+(upi|cash|card|net\\s*banking))?$`,
    'i'
  );
  const qtyMatch = text.match(qtyRegex);
  if (qtyMatch) {
    const qty = parseInt(qtyMatch[1], 10);
    const rawMerchant = qtyMatch[2].trim();
    const trailingAmt = parseIndianAmount(qtyMatch[3]);
    if (qty >= 2 && qty <= 20 && trailingAmt && trailingAmt > 0 && !/^(?:people|persons|months|days|weeks|percent)/i.test(rawMerchant)) {
      return buildResult({
        amount: trailingAmt,
        type: 'expense',
        merchant: `${qty}x ${rawMerchant}`,
        date,
        bankOrApp: 'Ambiguous Quick Add',
        rawText: trimmedInput,
        options,
        sourceType: 'shorthand',
        explicitModeText: qtyMatch[4] || '',
        isAmbiguous: true,
        quantity: qty,
        ambiguityOptions: [
          { label: `Total ₹${trailingAmt} (${qty} ${cleanMerchantName(rawMerchant)})`, amount: trailingAmt },
          { label: `${qty} × ₹${trailingAmt} = ₹${qty * trailingAmt}`, amount: qty * trailingAmt }
        ]
      });
    }
  }

  // 1a. Refund / Income shorthand: "Refund 650 Amazon", "Received 1,200 from Rahul", "Salary 50k"
  const incomeRegex = new RegExp(
    `^(?:refund|income|received|salary|cashback|credited)\\s+(?:₹|rs\\.?|inr)?\\s*${AMOUNT_TOKEN_SRC}(?:\\s*(?:rs\\.?|inr|rupees|/-))?(?:\\s+(?:from|by|via|for|at)?\\s*([A-Za-z0-9\\s&'-]+?))?(?:\\s+(?:via|by|with)?\\s*(upi|cash|card|net\\s*banking))?$`,
    'i'
  );
  const incomeShorthandMatch = text.match(incomeRegex);
  if (incomeShorthandMatch && incomeShorthandMatch[1]) {
    const amt = parseIndianAmount(incomeShorthandMatch[1]);
    const rawMerchant = (incomeShorthandMatch[2] || 'Refund / Income').trim();
    if (amt && amt > 0) {
      return buildResult({
        amount: amt,
        type: 'income',
        merchant: rawMerchant,
        date,
        bankOrApp: 'Income / Refund',
        rawText: trimmedInput,
        options,
        sourceType: 'shorthand',
        explicitModeText: incomeShorthandMatch[3] || ''
      });
    }
  }

  // 1b. Hinglish expense patterns:
  // "chai pe 30 kharch kiya", "lunch me 150 kharche", "auto ke 40 diye", "200 ka petrol"
  const hinglishPostRegex = new RegExp(
    `^([A-Za-z\\s&'-]+?)\\s+(?:pe|par|me|mein|ke|ki|ka|ko)\\s+(?:₹|rs\\.?|inr)?\\s*${AMOUNT_TOKEN_SRC}(?:\\s*(?:rs\\.?|inr|rupees|/-))?(?:\\s+(?:kharch(?:a|e)?(?:\\s+kiya|\\s+kiye)?|diye|diya|bheje|bheja|lagaye|laga))?(?:\\s+(upi|cash|card|net\\s*banking))?$`,
    'i'
  );
  const hinglishPreRegex = new RegExp(
    `^(?:₹|rs\\.?|inr)?\\s*${AMOUNT_TOKEN_SRC}(?:\\s*(?:rs\\.?|inr|rupees|/-))?\\s+(?:ka|ke|ki)\\s+([A-Za-z\\s&'-]+?)(?:\\s+(?:kharch(?:a|e)?|liya|khareeda|kharida))?(?:\\s+(upi|cash|card|net\\s*banking))?$`,
    'i'
  );

  const hinglishPost = text.match(hinglishPostRegex);
  if (hinglishPost) {
    const amt = parseIndianAmount(hinglishPost[2]);
    if (amt && amt > 0) {
      return buildResult({
        amount: amt,
        type: 'expense',
        merchant: hinglishPost[1],
        date,
        bankOrApp: 'Hinglish Quick Add',
        rawText: trimmedInput,
        options,
        sourceType: 'hinglish',
        explicitModeText: hinglishPost[3] || ''
      });
    }
  }

  const hinglishPre = text.match(hinglishPreRegex);
  if (hinglishPre) {
    const amt = parseIndianAmount(hinglishPre[1]);
    if (amt && amt > 0) {
      return buildResult({
        amount: amt,
        type: 'expense',
        merchant: hinglishPre[2],
        date,
        bankOrApp: 'Hinglish Quick Add',
        rawText: trimmedInput,
        options,
        sourceType: 'hinglish',
        explicitModeText: hinglishPre[3] || ''
      });
    }
  }

  // 1c. Merchant-first shorthand: "Chai 20", "Lunch 1,200 card", "Laptop 1.5k upi", "Coffee 20 rs"
  const shorthand1Regex = new RegExp(
    `^([A-Za-z][A-Za-z0-9\\s&'-]{0,35}?)\\s+(?:₹|rs\\.?|inr)?\\s*${AMOUNT_TOKEN_SRC}(?:\\s*(?:rs\\.?|inr|rupees|/-))?(?:\\s+(upi|cash|card|net\\s*banking))?$`,
    'i'
  );
  const shorthandMatch1 = text.match(shorthand1Regex);
  if (shorthandMatch1 && shorthandMatch1[1] && shorthandMatch1[2]) {
    const rawMerchant = shorthandMatch1[1].trim();
    const amt = parseIndianAmount(shorthandMatch1[2]);
    if (amt && amt > 0 && rawMerchant.split(/\s+/).length <= 4) {
      return buildResult({
        amount: amt,
        type: 'expense',
        merchant: rawMerchant,
        date,
        bankOrApp: 'Manual Quick Add',
        rawText: trimmedInput,
        options,
        sourceType: 'shorthand',
        explicitModeText: shorthandMatch1[3] || ''
      });
    }
  }

  // 1d. Action-verb shorthand: "Paid 450 at Starbucks via UPI", "Spent 1.5k on groceries"
  const shorthand2Regex = new RegExp(
    `^(?:paid|spent)\\s+(?:₹|rs\\.?|inr)?\\s*${AMOUNT_TOKEN_SRC}(?:\\s*(?:rs\\.?|inr|rupees|/-))?\\s+(?:at|to|for|on)\\s+([A-Za-z0-9\\s&'-]+?)(?:\\s+(?:via|by|with)\\s+(upi|cash|card|net\\s*banking))?$`,
    'i'
  );
  const shorthandMatch2 = text.match(shorthand2Regex);
  if (shorthandMatch2 && shorthandMatch2[1] && shorthandMatch2[2]) {
    const amt = parseIndianAmount(shorthandMatch2[1]);
    const rawMerchant = shorthandMatch2[2].trim();
    if (amt && amt > 0) {
      return buildResult({
        amount: amt,
        type: 'expense',
        merchant: rawMerchant,
        date,
        bankOrApp: 'Natural Language',
        rawText: trimmedInput,
        options,
        sourceType: 'shorthand',
        explicitModeText: shorthandMatch2[3] || ''
      });
    }
  }

  // 1e. Amount-first shorthand: "50 chai", "1,200 lunch", "20 rs coffee", "1.5k petrol upi"
  const shorthand3Regex = new RegExp(
    `^(?:₹|rs\\.?|inr)?\\s*${AMOUNT_TOKEN_SRC}(?:\\s*(?:rs\\.?|inr|rupees|/-))?\\s+([A-Za-z][A-Za-z0-9\\s&'-]{0,35}?)(?:\\s+(upi|cash|card|net\\s*banking))?$`,
    'i'
  );
  const shorthandMatch3 = text.match(shorthand3Regex);
  if (shorthandMatch3 && shorthandMatch3[1] && shorthandMatch3[2]) {
    const amt = parseIndianAmount(shorthandMatch3[1]);
    const rawMerchant = shorthandMatch3[2].trim();
    if (amt && amt > 0 && !/^(?:people|persons|friends|ways|months|days|weeks|percent|%|rs|inr|rupees)/i.test(rawMerchant) && rawMerchant.split(/\s+/).length <= 4) {
      return buildResult({
        amount: amt,
        type: 'expense',
        merchant: rawMerchant,
        date,
        bankOrApp: 'Manual Quick Add',
        rawText: trimmedInput,
        options,
        sourceType: 'shorthand',
        explicitModeText: shorthandMatch3[3] || ''
      });
    }
  }

  // 2. Bank / UPI SMS parsing
  const isCredit = /(?:credited|refund(?:ed)?|received|cashback|added\s+to)/i.test(lower) &&
    !/(?:debited|spent|paid\s+to)/i.test(lower);
  const type = isCredit ? 'income' : 'expense';

  let amount = null;
  const amountRegexes = [
    /(?:debited(?:\s+by|\s+for|\s+with)?|spent|paid|transferred|withdrawn)\s*(?:INR|Rs\.?|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
    /(?:INR|Rs\.?|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)\s*(?:debited|spent|paid|withdrawn|credited)/i,
    /(?:paid|spent|transferred|sent)\s*(?:INR|Rs\.?|₹)?\s*([0-9,]+(?:\.[0-9]{1,2})?)\s*(?:to|towards|at|for)/i,
    /(?:credited(?:\s+by|\s+with)?|received|refunded)\s*(?:INR|Rs\.?|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
    /(?:INR|Rs\.?|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i
  ];

  for (const rx of amountRegexes) {
    const match = text.match(rx);
    if (match && match[1]) {
      const cleanNum = parseFloat(match[1].replace(/,/g, ''));
      if (!isNaN(cleanNum) && cleanNum > 0) {
        amount = cleanNum;
        break;
      }
    }
  }

  if (!amount) {
    return { success: false, error: 'Could not detect transaction amount' };
  }

  let merchant = '';
  const merchantRegexes = [
    /(?:paid\s+to|transferred\s+to|transfer\s+to|to\s+vpa|to)\s+([A-Za-z0-9\s*.\-_@]+?)(?:\s+on|\s+using|\s+via|\s+ref|\s+avl|\s+upi|\s+from|\s+bal|\.|\n|$)/i,
    /(?:at|towards|spent\s+at|purchase\s+at)\s+([A-Za-z0-9\s*.\-_@]+?)(?:\s+on|\s+using|\s+via|\s+ref|\s+avl|\s+upi|\s+from|\s+bal|\.|\n|$)/i,
    /(?:info|narration|desc|remarks?)\s*[:=\-]?\s*([A-Za-z0-9\s*.\-_@]+?)(?:\.|\n|$|\s+avl|\s+bal)/i,
    /you\s+paid\s+(?:INR|Rs\.?|₹)?\s*[0-9,.]+\s+to\s+([A-Za-z0-9\s*.\-_@]+?)(?:\s+using|\s+from|\.|\n|$)/i
  ];

  for (const rx of merchantRegexes) {
    const match = text.match(rx);
    if (match && match[1]) {
      const candidate = match[1].trim();
      if (candidate.length > 1 && !/^(?:your|a\/c|account|bank|upi|card|my)$/i.test(candidate)) {
        merchant = cleanMerchantName(candidate);
        break;
      }
    }
  }

  if (!merchant) {
    for (const group of CATEGORY_KEYWORDS) {
      for (const kw of group.keywords) {
        if (lower.includes(kw)) {
          merchant = kw.charAt(0).toUpperCase() + kw.slice(1);
          break;
        }
      }
      if (merchant) break;
    }
  }

  if (!merchant) {
    merchant = isCredit ? 'Refund / Deposit' : 'Bank Payment';
  }

  let accountLast4 = null;
  const acctMatch = text.match(/(?:a\/c|acct|account|ending(?:\s+in)?)\s*(?:no\.?)?\s*(?:xx|\*{2,})?([0-9]{3,4})/i);
  if (acctMatch && acctMatch[1]) {
    accountLast4 = acctMatch[1];
  }

  let balance = null;
  const balMatch = text.match(/(?:avl\s*bal|avail\s*bal|available\s*balance|bal\s*(?:is)?)\s*(?:INR|Rs\.?|₹)?\s*([0-9,]+(?:\.[0-9]{1,2})?)/i);
  if (balMatch && balMatch[1]) {
    const balNum = parseFloat(balMatch[1].replace(/,/g, ''));
    if (!isNaN(balNum)) balance = balNum;
  }

  let bankOrApp = 'UPI / Bank';
  if (/hdfc/i.test(text)) bankOrApp = 'HDFC Bank';
  else if (/sbi/i.test(text)) bankOrApp = 'SBI';
  else if (/icici/i.test(text)) bankOrApp = 'ICICI Bank';
  else if (/axis/i.test(text)) bankOrApp = 'Axis Bank';
  else if (/kotak/i.test(text)) bankOrApp = 'Kotak Bank';
  else if (/pnb/i.test(text)) bankOrApp = 'PNB';
  else if (/bob|bank of baroda/i.test(text)) bankOrApp = 'Bank of Baroda';
  else if (/google\s*pay|gpay/i.test(text)) bankOrApp = 'Google Pay';
  else if (/phonepe/i.test(text)) bankOrApp = 'PhonePe';
  else if (/paytm/i.test(text)) bankOrApp = 'Paytm';
  else if (/cred/i.test(text)) bankOrApp = 'CRED';

  return buildResult({
    amount,
    type,
    merchant,
    date,
    accountLast4,
    balance,
    bankOrApp,
    rawText: trimmedInput,
    options,
    sourceType: 'bank_sms'
  });
}
