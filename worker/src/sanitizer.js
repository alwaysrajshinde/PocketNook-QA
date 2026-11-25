/**
 * Server-side PII & HTML sanitizer for /api/chat (Cloudflare Worker + local dev Express).
 * Re-sanitizes all untrusted fields (message, history, olderSummary, context merchantGeneric & upcomingFixed).
 */

const MAX_INPUT_CHARS = 2000;

const UPI_REF_PATTERNS = [
  /\b(?:upi\s*ref(?:erence)?(?:\s*no\.?)?|utr|rrn|txn\s*(?:id|ref|no\.?)?|txnid)\s*[:#-]?\s*([a-z0-9]{6,26})\b/gi,
  /\b(?:ref(?:erence)?\s*(?:no\.?|id|#)?)\s*[:#-]?\s*([a-z0-9]{6,22})\b/gi
];
const EMAIL_PATTERN = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;
const PAN_PATTERN = /\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b/gi;
const CARD_PATTERNS = [
  /\b(?:\d{4}[-\s]){3}\d{4}\b/g,
  /\b(?:\d{16})\b/g,
  /\b(?:(?:debit|credit)\s*)?card\s*(?:no\.?|number|ending(?:\s*(?:in|with))?)?\s*[:#-]?\s*(?:x{2,}|[*]{2,})?\s*(\d{3,6})\b/gi
];
const AADHAAR_PATTERNS = [
  /\b(?:aadhaar|aadhar|uid)\s*(?:no\.?|number)?\s*[:#-]?\s*[2-9]\d{3}[\s-]?\d{4}[\s-]?\d{4}(?!\d)\b/gi,
  /\b[2-9]\d{3}[\s-]\d{4}[\s-]\d{4}(?![\s-]?\d)\b/g
];
const ACCOUNT_FULL_PATTERN = /\b(a\/c|acct|account|acc)\s*(?:no\.?|number)?\s*[:#-]?\s*(?:x{2,}|[*]{2,})?(\d{5,18})\b/gi;
const LABELED_PHONE_PATTERN = /\b(?:ph|phone|mob|mobile|tel|call|helpline|contact|whatsapp)\s*(?:no\.?|number)?\s*[:#-]?\s*(\+?[\d\s()-]{8,16})/gi;
const INDIAN_MOBILE_PATTERN = /(?<![₹.\d])(?:\+91[\s-]?|91[\s-]?)?([6-9]\d{9})(?!\.\d|\d)/g;

export function sanitizeServerText(rawText = '') {
  if (!rawText || typeof rawText !== 'string') return '';
  let text = rawText.slice(0, MAX_INPUT_CHARS);

  if (/<[^>]+>/i.test(text)) {
    text = text
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  UPI_REF_PATTERNS.forEach((p) => {
    text = text.replace(p, '[UPI_REF_MASKED]');
  });
  text = text.replace(EMAIL_PATTERN, '[EMAIL_MASKED]');
  text = text.replace(PAN_PATTERN, '[PAN_MASKED]');
  CARD_PATTERNS.forEach((p) => {
    text = text.replace(p, '[CARD_MASKED]');
  });
  AADHAAR_PATTERNS.forEach((p) => {
    text = text.replace(p, '[AADHAAR_MASKED]');
  });
  text = text.replace(ACCOUNT_FULL_PATTERN, (_m, label, digits) => `${label} **${digits.slice(-4)}`);
  text = text.replace(LABELED_PHONE_PATTERN, (full, numPart) => {
    const clean = numPart.replace(/\D/g, '');
    return clean.length >= 7 && clean.length <= 15 ? full.replace(numPart, '[PHONE_MASKED]') : full;
  });
  text = text.replace(INDIAN_MOBILE_PATTERN, (match, _digits, offset, src) => {
    const prefix = src.slice(Math.max(0, offset - 8), offset);
    return /(?:rs\.?|inr|₹)\s*$/i.test(prefix) ? match : '[PHONE_MASKED]';
  });

  return text;
}

export function sanitizeChatPayload({ message, history = [], olderSummary = null, context = null }) {
  const safeMessage = sanitizeServerText(message);
  const safeHistory = (Array.isArray(history) ? history : []).map((t) => ({
    role: t.role,
    content: sanitizeServerText(t.content)
  }));
  const safeOlderSummary = olderSummary ? sanitizeServerText(olderSummary) : null;

  let safeContext = null;
  if (context) {
    safeContext = {
      ...context,
      recentTransactions: (context.recentTransactions || []).map((tx) => ({
        ...tx,
        merchantGeneric: sanitizeServerText(tx.merchantGeneric).slice(0, 60)
      })),
      ...(context.upcomingFixed
        ? {
            upcomingFixed: context.upcomingFixed.map((f) => ({
              ...f,
              name: sanitizeServerText(f.name).slice(0, 60)
            }))
          }
        : {})
    };
  }

  return {
    message: safeMessage,
    history: safeHistory,
    olderSummary: safeOlderSummary,
    context: safeContext
  };
}
