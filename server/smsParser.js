/**
 * Server-side SMS & WhatsApp NLP Parser
 * Reuses the same regex engine for WhatsApp incoming messages & webhooks
 */

const CATEGORY_KEYWORDS = [
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

function predictCategory(text = '') {
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

function normalizePaymentMode(text = '') {
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

function cleanMerchantName(merchant = '') {
  if (!merchant) return 'Quick Expense';
  return merchant
    .replace(/^[\s*.\-_:/@]+|[\s*.\-_:/@]+$/g, '')
    .replace(/^(?:vpa|upi|at|to|inr|rs\.?|transfer\s+to|paid\s+to|info:?)\s*/i, '')
    .replace(/\s+(?:ref|rrn|upi|txn|bal|avl|on|from).*$/i, '')
    .trim() || 'Expense';
}

function parseSmsNotification(rawText = '') {
  if (!rawText || typeof rawText !== 'string') {
    return { success: false, error: 'Empty text' };
  }

  const text = rawText.trim();
  const lower = text.toLowerCase();

  // Natural language shorthand: "Chai 20", "Uber 350 upi"
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
        bankOrApp: 'WhatsApp Assistant',
        confidence: 95
      };
    }
  }

  // "Paid 450 at Starbucks via UPI"
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
        bankOrApp: 'WhatsApp Assistant',
        confidence: 95
      };
    }
  }

  // Bank SMS format
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

  return {
    success: true,
    amount,
    type,
    merchant,
    category: predictCategory(`${merchant} ${text}`),
    paymentMode: normalizePaymentMode(text),
    date: new Date().toISOString().slice(0, 10),
    confidence: 90
  };
}

module.exports = {
  parseSmsNotification,
  predictCategory,
  normalizePaymentMode,
  cleanMerchantName
};
