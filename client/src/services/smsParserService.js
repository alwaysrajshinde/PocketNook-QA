/**
 * SMS & UPI Smart Parser Service
 * 100% Client-Side / Edge Regex & Natural Language Parser (₹0 Budget Compliant)
 * 
 * Supports:
 * - Indian Banks (HDFC, SBI, ICICI, Axis, Kotak, PNB, BoB, Canara, IndusInd, IDFC, etc.)
 * - UPI Apps (Google Pay, PhonePe, Paytm, BHIM, CRED, Amazon Pay)
 * - Credit/Debit Card swipe alerts
 * - Natural language shorthand (e.g., "Chai 20", "Uber 350 upi", "Paid 450 at Starbucks")
 * - Smart auto-categorization based on vendor keywords
 */

// Category taxonomy with comprehensive Indian & Global merchant keywords
export const CATEGORY_KEYWORDS = [
  {
    category: 'Food & Dining',
    keywords: [
      'swiggy', 'zomato', 'starbucks', 'mcdonald', 'kfc', 'burger', 'pizza', 'domino', 
      'subway', 'chai', 'tea', 'coffee', 'cafe', 'restaurant', 'bistro', 'bakery', 
      'dhaba', 'lunch', 'dinner', 'breakfast', 'snacks', 'eatclub', 'haldiram', 'barbeque',
      'dosa', 'biryani', 'food', 'canteen', 'mess', 'hotel'
    ]
  },
  {
    category: 'Groceries',
    keywords: [
      'blinkit', 'zepto', 'instamart', 'bigbasket', 'd-mart', 'dmart', 'reliance fresh', 
      'smart bazaar', 'supermarket', 'kirana', 'grocery', 'milk', 'vegetable', 'fruit', 
      'spencer', 'nature basket', 'dunzo', 'otipy', 'country delight', 'meat', 'fresh'
    ]
  },
  {
    category: 'Transportation',
    keywords: [
      'uber', 'ola', 'rapido', 'petrol', 'fuel', 'diesel', 'shell', 'hp fuel', 'hpcl', 
      'bpcl', 'indian oil', 'iocl', 'bharat petroleum', 'metro', 'irctc', 'railway', 
      'auto', 'cab', 'parking', 'toll', 'fastag', 'bus', 'redbus', 'flight', 'indigo', 'air india'
    ]
  },
  {
    category: 'Shopping',
    keywords: [
      'amazon', 'flipkart', 'myntra', 'ajio', 'meesho', 'nykaa', 'tata cliq', 'zara', 
      'h&m', 'croma', 'reliance digital', 'decathlon', 'nike', 'adidas', 'shopping', 
      'mall', 'westside', 'lifestyle', 'max fashion', 'shoppers stop', 'clothing', 'store'
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
      'hp gas', 'bharat gas', 'bill payment', 'recharge', 'dth', 'tata play'
    ]
  },
  {
    category: 'Healthcare',
    keywords: [
      'apollo', 'pharmeasy', '1mg', 'tata 1mg', 'netmeds', 'pharmacy', 'medplus', 
      'doctor', 'clinic', 'hospital', 'lab', 'diagnostic', 'medicine', 'dental', 
      'health', 'chemist'
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
      'rent', 'maintenance', 'flat', 'apartment', 'pg', 'society', 'nobroker', 'mygate'
    ]
  }
];

/**
 * Predicts category from merchant name or text description
 * @param {string} text 
 * @returns {string} Category name
 */
export function predictCategory(text = '') {
  if (!text) return 'Other';
  const lower = text.toLowerCase();
  for (const group of CATEGORY_KEYWORDS) {
    for (const kw of group.keywords) {
      if (lower.includes(kw)) {
        return group.category;
      }
    }
  }
  return 'Other';
}

/**
 * Normalizes payment mode string into standard choices
 */
export function normalizePaymentMode(text = '') {
  const lower = text.toLowerCase();
  if (/upi|gpay|google\s*pay|phonepe|paytm|bhim|cred|amazon\s*pay|vpa|@/.test(lower)) {
    return 'UPI';
  }
  if (/credit|card|pos|debit|visa|mastercard|rupay/.test(lower)) {
    return 'Card';
  }
  if (/net\s*banking|neft|rtgs|imps|bank\s*transfer|direct\s*debit/.test(lower)) {
    return 'Net Banking';
  }
  if (/cash|atm|withdrawn/.test(lower)) {
    return 'Cash';
  }
  return 'UPI';
}

/**
 * Clean and format merchant description
 */
export function cleanMerchantName(merchant = '') {
  if (!merchant) return 'Quick Expense';
  return merchant
    .replace(/^[\s*.\-_:/@]+|[\s*.\-_:/@]+$/g, '')
    .replace(/^(?:vpa|upi|at|to|inr|rs\.?|transfer\s+to|paid\s+to|info:?)\s*/i, '')
    .replace(/\s+(?:ref|rrn|upi|txn|bal|avl|on|from).*$/i, '')
    .trim() || 'Expense';
}

/**
 * Parse an Indian Bank or UPI notification SMS or natural text
 * @param {string} rawText 
 * @returns {object} Parsed transaction metadata
 */
export function parseSmsNotification(rawText = '') {
  if (!rawText || typeof rawText !== 'string') {
    return { success: false, error: 'Empty text' };
  }

  const text = rawText.trim();
  const lower = text.toLowerCase();

  // 1. Check for Natural Language shorthand: e.g. "Chai 20", "Lunch 150 card", "Uber 350 upi"
  const shorthandMatch1 = text.match(/^([A-Za-z\s&'-]+?)\s+(?:₹|rs\.?|inr)?\s*([0-9]+(?:\.[0-9]{1,2})?)(?:\s+(upi|cash|card|net\s*banking))?$/i);
  if (shorthandMatch1 && shorthandMatch1[1] && shorthandMatch1[2]) {
    const rawMerchant = shorthandMatch1[1].trim();
    const amt = parseFloat(shorthandMatch1[2]);
    if (!isNaN(amt) && amt > 0) {
      const mode = shorthandMatch1[3] ? normalizePaymentMode(shorthandMatch1[3]) : 'UPI';
      const cat = predictCategory(rawMerchant);
      return {
        success: true,
        amount: amt,
        type: 'expense',
        merchant: cleanMerchantName(rawMerchant),
        category: cat,
        paymentMode: mode,
        date: new Date().toISOString().slice(0, 10),
        accountLast4: null,
        balance: null,
        bankOrApp: 'Manual Quick Add',
        confidence: 95,
        rawText: text
      };
    }
  }

  // 1b. Shorthand "Paid 450 at Starbucks via UPI" or "Spent 500 for petrol"
  const shorthandMatch2 = text.match(/^(?:paid|spent)\s+(?:₹|rs\.?|inr)?\s*([0-9]+(?:\.[0-9]{1,2})?)\s+(?:at|to|for|on)\s+([A-Za-z0-9\s&'-]+?)(?:\s+(?:via|by|with)\s+(upi|cash|card|net\s*banking))?$/i);
  if (shorthandMatch2 && shorthandMatch2[1] && shorthandMatch2[2]) {
    const amt = parseFloat(shorthandMatch2[1]);
    const rawMerchant = shorthandMatch2[2].trim();
    if (!isNaN(amt) && amt > 0) {
      const mode = shorthandMatch2[3] ? normalizePaymentMode(shorthandMatch2[3]) : 'UPI';
      const cat = predictCategory(rawMerchant);
      return {
        success: true,
        amount: amt,
        type: 'expense',
        merchant: cleanMerchantName(rawMerchant),
        category: cat,
        paymentMode: mode,
        date: new Date().toISOString().slice(0, 10),
        accountLast4: null,
        balance: null,
        bankOrApp: 'Natural Language',
        confidence: 95,
        rawText: text
      };
    }
  }

  // 1c. Amount-first shorthand: e.g. "50 chai", "120 lunch", "40 auto upi"
  const shorthandMatch3 = text.match(/^(?:₹|rs\.?|inr)?\s*([0-9]+(?:\.[0-9]{1,2})?)\s+([A-Za-z\s&'-]+?)(?:\s+(upi|cash|card|net\s*banking))?$/i);
  if (shorthandMatch3 && shorthandMatch3[1] && shorthandMatch3[2]) {
    const amt = parseFloat(shorthandMatch3[1]);
    const rawMerchant = shorthandMatch3[2].trim();
    if (!isNaN(amt) && amt > 0 && !/^(?:people|persons|months|days|weeks|percent|%)/i.test(rawMerchant)) {
      const mode = shorthandMatch3[3] ? normalizePaymentMode(shorthandMatch3[3]) : 'UPI';
      const cat = predictCategory(rawMerchant);
      return {
        success: true,
        amount: amt,
        type: 'expense',
        merchant: cleanMerchantName(rawMerchant),
        category: cat,
        paymentMode: mode,
        date: new Date().toISOString().slice(0, 10),
        accountLast4: null,
        balance: null,
        bankOrApp: 'Manual Quick Add',
        confidence: 95,
        rawText: text
      };
    }
  }

  // 1d. Refund / Income shorthand: e.g. "Refund 650 Amazon", "Received 1200 from Rahul"
  const incomeShorthandMatch = text.match(/^(?:refund|income|received|salary|cashback|credited)\s+(?:₹|rs\.?|inr)?\s*([0-9]+(?:\.[0-9]{1,2})?)(?:\s+(?:from|by|via|for|at)?\s*([A-Za-z0-9\s&'-]+?))?(?:\s+(?:via|by|with)\s+(upi|cash|card|net\s*banking))?$/i);
  if (incomeShorthandMatch && incomeShorthandMatch[1]) {
    const amt = parseFloat(incomeShorthandMatch[1]);
    const rawMerchant = (incomeShorthandMatch[2] || 'Refund / Income').trim();
    if (!isNaN(amt) && amt > 0) {
      const mode = incomeShorthandMatch[3] ? normalizePaymentMode(incomeShorthandMatch[3]) : 'UPI';
      const cat = predictCategory(rawMerchant);
      return {
        success: true,
        amount: amt,
        type: 'income',
        merchant: cleanMerchantName(rawMerchant),
        category: cat,
        paymentMode: mode,
        date: new Date().toISOString().slice(0, 10),
        accountLast4: null,
        balance: null,
        bankOrApp: 'Income / Refund',
        confidence: 95,
        rawText: text
      };
    }
  }

  // 2. Transaction Type: Debit / Spent vs Credit / Refund
  const isCredit = /(?:credited|refund(?:ed)?|received|cashback|added\s+to)/i.test(lower) && 
                   !/(?:debited|spent|paid\s+to)/i.test(lower);
  const type = isCredit ? 'income' : 'expense';

  // 3. Amount Extraction:
  // Regex looks for "debited by/for Rs. 450", "spent Rs 1,200.50", "INR 450.00 debited", "paid Rs.50", etc.
  let amount = null;
  const amountRegexes = [
    // "debited ... Rs. 450.00"
    /(?:debited(?:\s+by|\s+for|\s+with)?|spent|paid|transferred|withdrawn)\s*(?:INR|Rs\.?|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
    // "Rs. 450.00 debited"
    /(?:INR|Rs\.?|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)\s*(?:debited|spent|paid|withdrawn|credited)/i,
    // "paid ₹150 to"
    /(?:paid|spent|transferred|sent)\s*(?:INR|Rs\.?|₹)?\s*([0-9,]+(?:\.[0-9]{1,2})?)\s*(?:to|towards|at|for)/i,
    // "credited with Rs 500"
    /(?:credited(?:\s+by|\s+with)?|received|refunded)\s*(?:INR|Rs\.?|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
    // Standalone currency pattern
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

  // 4. Merchant / Payee Extraction:
  let merchant = '';
  const merchantRegexes = [
    // "paid to ABC", "transferred to ABC", "to ABC on"
    /(?:paid\s+to|transferred\s+to|transfer\s+to|to\s+vpa|to)\s+([A-Za-z0-9\s*.\-_@]+?)(?:\s+on|\s+using|\s+via|\s+ref|\s+avl|\s+upi|\s+from|\s+bal|\.|\n|$)/i,
    // "at ABC", "spent at ABC", "purchase at ABC"
    /(?:at|towards|spent\s+at|purchase\s+at)\s+([A-Za-z0-9\s*.\-_@]+?)(?:\s+on|\s+using|\s+via|\s+ref|\s+avl|\s+upi|\s+from|\s+bal|\.|\n|$)/i,
    // "Info: BIL*NETFLIX"
    /(?:info|narration|desc|remarks?)\s*[:=\-]?\s*([A-Za-z0-9\s*.\-_@]+?)(?:\.|\n|$|\s+avl|\s+bal)/i,
    // Google Pay: "You paid ₹150 to XYZ"
    /you\s+paid\s+(?:INR|Rs\.?|₹)?\s*[0-9,.]+\s+to\s+([A-Za-z0-9\s*.\-_@]+?)(?:\s+using|\s+from|\.|\n|$)/i
  ];

  for (const rx of merchantRegexes) {
    const match = text.match(rx);
    if (match && match[1]) {
      const candidate = match[1].trim();
      // Skip if candidate is just "UPI" or "Account" or "your"
      if (candidate.length > 1 && !/^(?:your|a\/c|account|bank|upi|card|my)$/i.test(candidate)) {
        merchant = cleanMerchantName(candidate);
        break;
      }
    }
  }

  if (!merchant) {
    // If merchant wasn't matched, check if known brand is present in text
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

  // 5. Category Prediction
  const category = predictCategory(`${merchant} ${text}`);

  // 6. Payment Mode
  const paymentMode = normalizePaymentMode(text);

  // 7. Account Last 4 digits
  let accountLast4 = null;
  const acctMatch = text.match(/(?:a\/c|acct|account|card|ending(?:\s+in)?)\s*(?:no\.?)?\s*(?:xx|\*{2,})?([0-9]{3,4})/i);
  if (acctMatch && acctMatch[1]) {
    accountLast4 = acctMatch[1];
  }

  // 8. Available Balance if present
  let balance = null;
  const balMatch = text.match(/(?:avl\s*bal|avail\s*bal|available\s*balance|bal\s*(?:is)?)\s*(?:INR|Rs\.?|₹)?\s*([0-9,]+(?:\.[0-9]{1,2})?)/i);
  if (balMatch && balMatch[1]) {
    const balNum = parseFloat(balMatch[1].replace(/,/g, ''));
    if (!isNaN(balNum)) balance = balNum;
  }

  // 9. Detected Bank or App
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

  // 10. Date parsing (fallback to today)
  let date = new Date().toISOString().slice(0, 10);
  const dateMatch = text.match(/\b(\d{1,2})[-/ ]([A-Za-z]{3}|\d{1,2})[-/ ](\d{2,4})\b/);
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
    } catch (e) {}
  }

  return {
    success: true,
    amount,
    type,
    merchant,
    category,
    paymentMode,
    date,
    accountLast4,
    balance,
    bankOrApp,
    confidence: 90,
    rawText: text
  };
}
