import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import DOMPurify from 'dompurify';
import {
  X, Send, CheckCheck, Mic, Sparkles,
  Trash2, ArrowLeft, ShieldCheck, Scale, Users,
  Activity, ArrowUpRight, Edit3, Check, AlertTriangle,
  CheckCircle2, RotateCcw, Square
} from 'lucide-react';
import {
  processAssistantMessage,
  computeProactiveNudges,
  canHandleLocally,
  findDuplicateTransaction
} from '../services/aiAssistantService';
import { sanitizeFinancialText, prepareSafeFinancialSnapshot } from '../services/piiSanitizerService';
import { buildSafeChatContext, buildSanitizedConversationMemory } from '../services/chatContextService';
import { IS_QA, CHAT_DISPLAY_NAME } from '../utils/appBrand';
import {
  loadChatHistory,
  saveChatHistory,
  clearChatHistoryStorage,
  loadCopilotPreferences,
  learnMerchantCategory,
  saveBudgetRatios,
  saveAiDataConsent,
  recordCopilotMetric
} from '../services/chatStorageService';
import { useChatStream } from '../hooks/useChatStream';
import { useToast } from '../context/ToastContext';

function sanitizeRenderedLlmText(raw = '') {
  // Strip links to unknown domains and sanitize any HTML via DOMPurify before display
  const noUnknownLinks = String(raw || '').replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/gi, '$1');
  const cleaned = DOMPurify.sanitize(noUnknownLinks, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
  return cleaned;
}

const DEFAULT_CATEGORIES = [
  'Food & Dining', 'Groceries', 'Transportation', 'Shopping',
  'Entertainment', 'Bills & Utilities', 'Healthcare', 'Subscriptions',
  'Housing & Rent', 'Other'
];

const PAYMENT_MODES = ['UPI', 'Card', 'Cash', 'Net Banking'];

const ONBOARDING_EXAMPLES = [
  { id: 'ex_chai', label: 'chai 20', query: 'chai 20' },
  { id: 'ex_split', label: 'split 1200 between 4', query: 'split 1200 between 4' },
  { id: 'ex_afford', label: 'can i afford 3500?', query: 'can i afford 3500?' },
  { id: 'ex_hinglish', label: 'chai pe 30 kharch kiya', query: 'chai pe 30 kharch kiya' }
];

function createWelcomeMessages() {
  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return [
    {
      id: 'msg_welcome_1',
      sender: 'bot',
      type: 'onboarding_welcome',
      text:
        '*PocketNook Chat Active*\n\n' +
        'Privacy-first expense assistant: sensitive card, phone & UTR numbers are masked locally before processing. ' +
        'Transactions you log sync securely to your PocketNook ledger.\n\n' +
        '*Tap an example below or type naturally:*\n' +
        '• `chai 20` or `50 chai, 1,200 lunch`\n' +
        '• `split 1200 between 4` or `divide 2500 by 3`\n' +
        '• `can i afford 3500?` • `Where is my money going?`\n' +
        '• `chai pe 30 kharch kiya` (Hinglish supported)\n' +
        '• `Undo` to remove the last expense',
      time: timeStr
    }
  ];
}

/**
 * Renders an inline financial ledger key-value metric row
 */
function FinancialLedgerRow({ label, value, isNegative, isPositive, isHighlight }) {
  const cleanLabel = String(label || '').replace(/[*_]/g, '').trim();
  const cleanValue = String(value || '').replace(/[*_]/g, '').trim();

  return (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-200/70 dark:border-white/[0.08] text-[12px] last:border-b-0 gap-3">
      <span className="text-slate-600 dark:text-zinc-300 font-medium flex-shrink-0">{cleanLabel}</span>
      <span className={`font-mono tabular-nums text-right ${
        isNegative
          ? 'text-rose-700 dark:text-rose-300 font-bold'
          : isPositive
          ? 'text-emerald-700 dark:text-emerald-300 font-bold'
          : isHighlight
          ? 'text-[#5B27DC] dark:text-[#C4B5FD] font-extrabold text-[13px]'
          : 'text-slate-900 dark:text-zinc-100 font-semibold'
      }`}>
        {cleanValue}
      </span>
    </div>
  );
}

/**
 * Inline expense editor embedded inside confirm/logged cards for fast correction + learning
 */
function InlineExpenseEditor({ initialValues, categoryOptions, onSave, onCancel }) {
  const [merchant, setMerchant] = useState(initialValues.merchant || initialValues.description || '');
  const [amount, setAmount] = useState(String(initialValues.amount || ''));
  const [category, setCategory] = useState(initialValues.category || 'Other');
  const [paymentMode, setPaymentMode] = useState(initialValues.payment_mode || initialValues.paymentMode || 'UPI');

  const handleSubmit = (e) => {
    e.preventDefault();
    const numAmt = parseFloat(amount);
    if (!merchant.trim() || isNaN(numAmt) || numAmt <= 0) return;
    onSave({
      merchant: merchant.trim(),
      amount: numAmt,
      category,
      paymentMode
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-2.5 p-3 rounded-xl bg-slate-100/90 dark:bg-[#100D22] border border-purple-300/60 dark:border-purple-400/30 space-y-2.5 text-[12px]"
      data-testid="inline-expense-editor"
    >
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-300 mb-1">
            Merchant
          </label>
          <input
            type="text"
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
            data-testid="inline-edit-merchant"
            className="w-full px-2.5 py-2 rounded-lg bg-white dark:bg-[#1A1633] border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white font-medium text-[12px] focus:outline-none focus:ring-2 focus:ring-[#6C47FF]"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-300 mb-1">
            Amount (₹)
          </label>
          <input
            type="number"
            step="0.01"
            min="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            data-testid="inline-edit-amount"
            className="w-full px-2.5 py-2 rounded-lg bg-white dark:bg-[#1A1633] border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white font-mono font-bold text-[12px] focus:outline-none focus:ring-2 focus:ring-[#6C47FF]"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-300 mb-1">
            Category
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            data-testid="inline-edit-category"
            className="w-full px-2 py-2 rounded-lg bg-white dark:bg-[#1A1633] border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white font-medium text-[12px] focus:outline-none focus:ring-2 focus:ring-[#6C47FF]"
          >
            {categoryOptions.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-300 mb-1">
            Payment Mode
          </label>
          <select
            value={paymentMode}
            onChange={(e) => setPaymentMode(e.target.value)}
            data-testid="inline-edit-mode"
            className="w-full px-2 py-2 rounded-lg bg-white dark:bg-[#1A1633] border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white font-medium text-[12px] focus:outline-none focus:ring-2 focus:ring-[#6C47FF]"
          >
            {PAYMENT_MODES.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-2 min-h-[40px] rounded-lg bg-white dark:bg-white/[0.08] text-slate-700 dark:text-zinc-200 font-semibold border border-slate-300 dark:border-white/15 cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="submit"
          data-testid="inline-edit-save-btn"
          className="px-3.5 py-2 min-h-[40px] rounded-lg bg-[#6C47FF] hover:bg-[#5835E5] text-white font-bold flex items-center gap-1 cursor-pointer"
        >
          <Check size={14} />
          <span>Save &amp; Remember Category</span>
        </button>
      </div>
    </form>
  );
}

/**
 * Rich Financial Card & Markdown Typography Formatter
 */
function formatBotMessage(text, msg = {}, onTriggerEdit = null) {
  if (!text) return null;

  // 1. AFFORDABILITY FINANCIAL DIAGNOSIS CARD
  if (text.includes('Affordability Financial Diagnosis') && text.includes('Planned Purchase:')) {
    const plannedMatch = text.match(/Planned Purchase:\s*([^\n]+)/i);
    const remainingMatch = text.match(/Current (?:Remaining|Pool Balance):\s*([^\n]+)/i);
    const billsMatch = text.match(/Committed Upcoming Bills:\s*([^\n]+)/i);
    const currentPaceMatch = text.match(/Current Daily (?:Pace|Burn):\s*([^\n]+)/i);
    const projectedPaceMatch = text.match(/Projected Daily Pace:\s*([^\n]+)/i);
    const verdictMatch = text.match(/\*?Verdict:([^*]+)\*?/i);
    const recommendationMatch = text.match(/Recommendation:\s*([^\n]+)/i);

    const verdictStr = verdictMatch ? verdictMatch[1].trim() : '';
    const isRisk = /Risk|Tight|Over/i.test(verdictStr || text);
    const isCaution = /Moderate|Caution/i.test(verdictStr);

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/70 dark:border-white/[0.08]">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-lg bg-[#6C47FF]/15 text-[#5B27DC] dark:text-[#C4B5FD] flex items-center justify-center">
              <Scale size={13} />
            </div>
            <span className="font-bold text-[13px] tracking-tight text-slate-900 dark:text-white">
              Affordability Financial Diagnosis
            </span>
          </div>
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ml-2 flex items-center gap-1 ${
            isRisk
              ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-500/30'
              : isCaution
              ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-500/30'
              : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30'
          }`}>
            {isRisk ? <AlertTriangle size={10} /> : <CheckCircle2 size={10} />}
            <span>{isRisk ? 'Budget Risk' : isCaution ? 'Caution' : 'Affordable'}</span>
          </span>
        </div>

        <div className="bg-slate-50/90 dark:bg-[#120F24] rounded-xl p-2.5 px-3 border border-slate-200/80 dark:border-white/[0.08]">
          {plannedMatch && <FinancialLedgerRow label="Planned Purchase" value={plannedMatch[1].trim()} isHighlight />}
          {remainingMatch && <FinancialLedgerRow label="Safe Pool Balance" value={remainingMatch[1].trim()} />}
          {billsMatch && <FinancialLedgerRow label="Committed Upcoming Bills" value={billsMatch[1].trim()} />}
          {currentPaceMatch && <FinancialLedgerRow label="Current Daily Burn" value={currentPaceMatch[1].trim()} />}
          {projectedPaceMatch && (
            <FinancialLedgerRow
              label="Projected Daily Pace"
              value={projectedPaceMatch[1].trim()}
              isNegative={isRisk}
              isPositive={!isRisk && !isCaution}
            />
          )}
        </div>

        <div className={`p-3 rounded-xl border text-[12px] leading-relaxed ${
          isRisk
            ? 'bg-rose-500/[0.08] border-rose-500/30 text-rose-950 dark:text-rose-100'
            : isCaution
            ? 'bg-amber-500/[0.08] border-amber-500/30 text-amber-950 dark:text-amber-100'
            : 'bg-emerald-500/[0.08] border-emerald-500/30 text-emerald-950 dark:text-emerald-100'
        }`}>
          <div className="font-bold text-[12.5px] mb-1">
            Verdict: {verdictStr || (isRisk ? 'Budget Risk Detected' : 'Comfortably Affordable')}
          </div>
          <p className="opacity-95">
            {recommendationMatch ? recommendationMatch[0] : text.split('\n\n').slice(1).join(' ').replace(/\*?Verdict:[^*]+\*?/i, '').trim()}
          </p>
        </div>
      </div>
    );
  }

  // 2. SMART BILL SPLIT CALCULATION CARD
  if (text.includes('Smart Bill Split Calculation') && text.includes('Total Bill:')) {
    const totalMatch = text.match(/Total Bill:\s*([^\n]+)/i);
    const peopleMatch = text.match(/(?:Number of People|Split Between):\s*([^\n]+)/i);
    const owesMatch = text.match(/Each Person Owes:\s*\*?([^\n*]+)\*?/i);
    const breakdownMatch = text.match(/Exact Rounding Breakdown:\s*\*?([^\n*]+)\*?/i);
    const noteMatch = text.match(/_Note:\s*([^_]+)_/i);

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/70 dark:border-white/[0.08]">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-lg bg-[#6C47FF]/15 text-[#5B27DC] dark:text-[#C4B5FD] flex items-center justify-center">
              <Users size={13} />
            </div>
            <span className="font-bold text-[13px] tracking-tight text-slate-900 dark:text-white">
              Smart Bill Split Calculation
            </span>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-[#5B27DC] dark:text-[#C4B5FD] border border-purple-300/60 dark:border-purple-400/30 whitespace-nowrap flex-shrink-0 ml-2">
            Split Share
          </span>
        </div>

        <div className="bg-slate-50/90 dark:bg-[#120F24] rounded-xl p-2.5 px-3 border border-slate-200/80 dark:border-white/[0.08]">
          {totalMatch && <FinancialLedgerRow label="Total Bill" value={totalMatch[1].trim()} />}
          {peopleMatch && <FinancialLedgerRow label="Number of People" value={peopleMatch[1].trim()} />}
          {owesMatch && <FinancialLedgerRow label="Each Person Owes" value={owesMatch[1].trim()} isHighlight />}
          {breakdownMatch && <FinancialLedgerRow label="Exact Split" value={breakdownMatch[1].trim()} />}
        </div>

        {noteMatch && (
          <p className="text-[11.5px] text-amber-800 dark:text-amber-200 bg-amber-500/10 border border-amber-500/25 rounded-lg px-2.5 py-1.5">
            {noteMatch[1].trim()}
          </p>
        )}

        <p className="text-[11.5px] text-slate-600 dark:text-zinc-300">
          Tap below to record your share or switch headcount.
        </p>
      </div>
    );
  }

  // 3. SAFE DAILY BURN RATE CARD
  if (text.includes('Safe Daily Burn Rate') && text.includes('Safe Target:')) {
    const targetMatch = text.match(/Safe Target:\s*\*?([^\n*]+)\*?/i);
    const daysMatch = text.match(/Days (?:Left in Month|Remaining):\s*([^\n]+)/i);
    const poolMatch = text.match(/Remaining Pool:\s*([^\n]+)/i);
    const todayMatch = text.match(/Spent Today:\s*([^\n]+)/i);

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/70 dark:border-white/[0.08]">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-lg bg-[#6C47FF]/15 text-[#5B27DC] dark:text-[#C4B5FD] flex items-center justify-center">
              <Activity size={13} />
            </div>
            <span className="font-bold text-[13px] tracking-tight text-slate-900 dark:text-white">
              Safe Daily Burn Rate
            </span>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-[#5B27DC] dark:text-[#C4B5FD] border border-purple-300/60 dark:border-purple-400/30 whitespace-nowrap flex-shrink-0 ml-2">
            Velocity
          </span>
        </div>

        <div className="bg-slate-50/90 dark:bg-[#120F24] rounded-xl p-2.5 px-3 border border-slate-200/80 dark:border-white/[0.08]">
          {targetMatch && <FinancialLedgerRow label="Safe Target:" value={targetMatch[1].trim()} isHighlight />}
          {daysMatch && <FinancialLedgerRow label="Days Left in Month" value={daysMatch[1].trim()} />}
          {poolMatch && <FinancialLedgerRow label="Remaining Pool" value={poolMatch[1].trim()} />}
          {todayMatch && <FinancialLedgerRow label="Spent Today" value={todayMatch[1].trim()} />}
        </div>
      </div>
    );
  }

  // 4. TAPPABLE EXPENSE LOGGED SUMMARY FOOTER HINT
  const isTappableLoggedCard = msg?.type === 'expense_logged' && msg?.savedTransaction && typeof onTriggerEdit === 'function';

  // 5. EDITORIAL TYPOGRAPHY FORMATTER (DOMPurify sanitized against XSS & rogue links)
  const safeBody = sanitizeRenderedLlmText(text);
  const lines = safeBody.split('\n');
  const renderedLines = lines.map((line, lIdx) => {
    if (/^[━─—–=-]{5,}$/.test(line.trim())) {
      return <div key={lIdx} className="my-2 h-[1px] bg-slate-200/80 dark:bg-white/[0.08]" />;
    }

    const parts = [];
    let key = 0;
    const regex = /(\*([^*]+)\*)|(`([^`]+)`)|(_([^_]+)_)/g;
    let match;
    let lastIndex = 0;

    while ((match = regex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        parts.push(<span key={key++}>{line.substring(lastIndex, match.index)}</span>);
      }
      if (match[1]) {
        parts.push(
          <strong key={key++} className="font-bold text-slate-900 dark:text-white">
            {match[2]}
          </strong>
        );
      } else if (match[3]) {
        parts.push(
          <code key={key++} className="px-1.5 py-0.5 rounded-md bg-purple-100/80 dark:bg-[#1D1936] text-[#5B27DC] dark:text-[#C4B5FD] font-mono text-[11px] border border-purple-300/60 dark:border-purple-400/30">
            {match[4]}
          </code>
        );
      } else if (match[5]) {
        parts.push(
          <em key={key++} className="italic text-slate-500 dark:text-zinc-400 text-[11px]">
            {match[6]}
          </em>
        );
      }
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < line.length) {
      parts.push(<span key={key++}>{line.substring(lastIndex)}</span>);
    }

    const trimmed = line.trim();
    const isTitle = trimmed.startsWith('*') && trimmed.endsWith('*') && trimmed.length < 55;

    if (isTitle) {
      return (
        <div key={lIdx} className="font-bold text-[13.5px] text-[#5B27DC] dark:text-[#C4B5FD] pt-1 pb-0.5">
          {parts}
        </div>
      );
    }

    return (
      <div key={lIdx} className="min-h-[18px] text-[12.5px] text-slate-700 dark:text-zinc-200 leading-relaxed">
        {parts.length > 0 ? parts : <span>&nbsp;</span>}
      </div>
    );
  });

  if (isTappableLoggedCard) {
    return (
      <div
        onClick={() => onTriggerEdit(msg)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onTriggerEdit(msg);
          }
        }}
        aria-label="Tap to edit logged expense details"
        className="cursor-pointer group rounded-xl p-1 -m-1 hover:bg-purple-500/[0.04] transition-colors"
      >
        {renderedLines}
        <div className="mt-1.5 flex items-center gap-1 text-[10.5px] font-semibold text-[#5B27DC] dark:text-[#C4B5FD] opacity-85 group-hover:opacity-100">
          <Edit3 size={11} />
          <span>{msg.syncStatus === 'pending' ? 'Saving...' : 'Synced ✓ • Tap to edit category or amount'}</span>
        </div>
      </div>
    );
  }

  return renderedLines;
}

export default function WhatsAppChatboxModal({
  isOpen,
  onClose,
  onSaveExpense,
  onDeleteExpense,
  onSetBudget,
  aiDataConsent: externalAiConsent,
  onToggleAiConsent,
  dashboardData,
  recentTransactions = [],
  formatCurrency = (v) => `₹${Number(v || 0).toLocaleString('en-IN')}`,
  categories = [],
  userId = 'guest',
  userName = ''
}) {
  const { showToast } = useToast();
  const { isStreaming, streamChat, stopGenerating, clearServerSession } = useChatStream();
  const [messages, setMessages] = useState(createWelcomeMessages);
  const [prefs, setPrefs] = useState({ learnedCategories: {}, budgetRatios: { needs: 50, wants: 30, savings: 20 }, aiDataConsent: false });
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceLang, setVoiceLang] = useState('en-IN');
  const [editingMsgId, setEditingMsgId] = useState(null);
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isAnimating, setIsAnimating] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const modalCardRef = useRef(null);
  const previousFocusRef = useRef(null);
  const speechRecognitionRef = useRef(null);
  const pendingActionIdsRef = useRef(new Set());
  const executedRequestIdsRef = useRef(new Set());
  const touchStartYRef = useRef(null);
  const lastLoggedBatchRef = useRef(null);
  const recentSessionLogsRef = useRef([]);
  const openedAtRef = useRef(Date.now());

  const effectiveAiConsent = externalAiConsent !== undefined ? Boolean(externalAiConsent) : Boolean(prefs.aiDataConsent);

  const handleToggleConsentInChat = async () => {
    const next = !effectiveAiConsent;
    const updated = await saveAiDataConsent(userId, next);
    if (updated) setPrefs(updated);
    if (typeof onToggleAiConsent === 'function') {
      await onToggleAiConsent(next);
    }
    showToast(
      next ? 'AI spending summary sharing enabled (masked PII).' : 'AI data sharing turned OFF.',
      'info'
    );
  };

  const categoryOptions = useMemo(() => {
    const customNames = (categories || []).map(c => (typeof c === 'string' ? c : c?.name)).filter(Boolean);
    return Array.from(new Set([...DEFAULT_CATEGORIES, ...customNames]));
  }, [categories]);

  // Load sanitized chat history & preferences from IndexedDB on user/open
  useEffect(() => {
    let active = true;
    (async () => {
      const [storedMsgs, loadedPrefs] = await Promise.all([
        loadChatHistory(userId),
        loadCopilotPreferences(userId)
      ]);
      if (!active) return;
      if (storedMsgs && storedMsgs.length > 0) {
        setMessages(storedMsgs);
      } else {
        setMessages(createWelcomeMessages());
      }
      if (loadedPrefs) setPrefs(loadedPrefs);
    })();
    return () => { active = false; };
  }, [userId]);

  // Save sanitized messages to IndexedDB whenever messages change
  useEffect(() => {
    if (messages && messages.length > 0) {
      saveChatHistory(userId, messages);
    }
  }, [messages, userId]);

  // VisualViewport resize listener so mobile soft keyboard keeps composer pinned above keyboard
  useEffect(() => {
    if (!isOpen || typeof window === 'undefined' || !window.visualViewport) return;
    const handleViewportChange = () => {
      setViewportHeight(window.visualViewport.height);
    };
    handleViewportChange();
    window.visualViewport.addEventListener('resize', handleViewportChange);
    return () => {
      window.visualViewport?.removeEventListener('resize', handleViewportChange);
      setViewportHeight(null);
    };
  }, [isOpen]);

  // Android hardware Back button (popstate) & Focus Trap / Restoration
  useEffect(() => {
    if (isOpen) {
      openedAtRef.current = Date.now();
      previousFocusRef.current = document.activeElement;
      setShouldRender(true);
      const raf = requestAnimationFrame(() => setIsAnimating(true));

      const stateToken = { pocketnookChatDrawer: true };
      try {
        window.history.pushState(stateToken, '');
      } catch (e) {}

      const handlePopState = () => {
        onClose();
      };
      const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
          onClose();
          return;
        }
        if (e.key === 'Tab' && modalCardRef.current) {
          const focusables = modalCardRef.current.querySelectorAll(
            'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
          );
          if (focusables.length === 0) return;
          const first = focusables[0];
          const last = focusables[focusables.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      };

      window.addEventListener('popstate', handlePopState);
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        cancelAnimationFrame(raf);
        window.removeEventListener('popstate', handlePopState);
        window.removeEventListener('keydown', handleKeyDown);
      };
    } else {
      setIsAnimating(false);
      const timer = setTimeout(() => {
        setShouldRender(false);
        if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
          try { previousFocusRef.current.focus(); } catch (e) {}
        }
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [isOpen, messages, isTyping]);

  // Speech Recognition with bilingual en-IN / hi-IN support & graceful permission-denied handling
  useEffect(() => {
    const SpeechRecognition = typeof window !== 'undefined' &&
      (window.SpeechRecognition || window.webkitSpeechRecognition);

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = voiceLang;

        recognition.onresult = (event) => {
          const transcript = event.results[0]?.[0]?.transcript || '';
          if (transcript) {
            setInputText(transcript);
            handleSendMessage(transcript);
          }
          setIsListening(false);
        };

        recognition.onerror = (e) => {
          setIsListening(false);
          if (e?.error === 'not-allowed' || e?.error === 'service-not-allowed') {
            showToast('Microphone permission denied. Please enable mic access or type your expense.', 'warning');
          } else {
            showToast('Voice input unavailable right now. Please type your message.', 'info');
          }
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        speechRecognitionRef.current = recognition;
      } catch (err) {}
    }
  }, [voiceLang]);

  const toggleVoiceListening = () => {
    if (!speechRecognitionRef.current) {
      showToast('Speech recognition is not supported on this device. Please type instead.', 'info');
      return;
    }

    if (isListening) {
      speechRecognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        speechRecognitionRef.current.lang = voiceLang;
        speechRecognitionRef.current.start();
        setIsListening(true);
        showToast(`Listening (${voiceLang === 'hi-IN' ? 'Hindi' : 'English/Hinglish'})...`, 'info');
      } catch (err) {
        setIsListening(false);
        showToast('Could not start voice capture. Check microphone permissions.', 'warning');
      }
    }
  };

  // Safe dismiss wrapper that closes immediately and cleans up our history pushState token
  const handleDismiss = useCallback(() => {
    onClose();
    if (window.history.state && window.history.state.pocketnookChatDrawer) {
      try { window.history.back(); } catch (e) {}
    }
  }, [onClose]);

  /**
   * Executes a validated LLM tool call safely (either auto-logging low-value high-confidence items or confirming user tap).
   */
  const executeValidatedToolCall = async (tool, { forceConfirmed = false } = {}) => {
    const reqId = tool.requestId || `tool_${Date.now()}`;
    if (executedRequestIdsRef.current.has(reqId)) {
      return { skippedDuplicateRequest: true };
    }

    const mergedRecentTxs = [...recentSessionLogsRef.current, ...(recentTransactions || [])];

    if (tool.name === 'log_expense') {
      const a = tool.args;
      if (!forceConfirmed && findDuplicateTransaction({ amount: a.amount, merchant: a.merchant, date: a.date }, mergedRecentTxs)) {
        return { duplicateDetected: true };
      }
      executedRequestIdsRef.current.add(reqId);
      const payload = {
        amount: a.amount,
        description: a.merchant,
        category: a.category,
        payment_mode: a.mode,
        date: a.date,
        is_refund: a.type === 'income'
      };
      const saved = typeof onSaveExpense === 'function' ? await onSaveExpense(payload) : payload;
      recentSessionLogsRef.current.unshift({ ...(saved || payload), created_at: new Date().toISOString() });
      recordCopilotMetric(userId, 'log_success');
      showToast(`Logged ${formatCurrency(a.amount)} ${a.merchant}!`, 'success');
      return { savedTransaction: saved || payload };
    }

    if (tool.name === 'log_multiple_expenses') {
      executedRequestIdsRef.current.add(reqId);
      const savedItems = [];
      for (const item of tool.args.items) {
        const payload = {
          amount: item.amount,
          description: item.merchant,
          category: item.category,
          payment_mode: item.mode,
          date: item.date,
          is_refund: item.type === 'income'
        };
        const saved = typeof onSaveExpense === 'function' ? await onSaveExpense(payload) : payload;
        savedItems.push(saved || payload);
        recentSessionLogsRef.current.unshift({ ...(saved || payload), created_at: new Date().toISOString() });
      }
      recordCopilotMetric(userId, 'log_success');
      showToast(`Logged ${savedItems.length} expenses!`, 'success');
      return { savedItems };
    }

    if (tool.name === 'undo_last') {
      executedRequestIdsRef.current.add(reqId);
      const res = await processAssistantMessage('Undo', {
        dashboardData,
        recentTransactions: mergedRecentTxs,
        formatCurrency,
        onDeleteExpense,
        lastLoggedBatch: lastLoggedBatchRef.current
      });
      recentSessionLogsRef.current.shift();
      recordCopilotMetric(userId, 'undo');
      showToast('Transaction undone and removed!', 'info');
      return { undoResult: res };
    }

    if (tool.name === 'set_budget') {
      executedRequestIdsRef.current.add(reqId);
      if (typeof onSetBudget === 'function') {
        await onSetBudget(tool.args.amount);
      }
      showToast(`Monthly budget updated to ${formatCurrency(tool.args.amount)}`, 'success');
      return { budgetUpdated: tool.args.amount };
    }

    if (tool.name === 'split_bill') {
      const { total, people, includeSelf } = tool.args;
      const count = includeSelf ? people : people;
      const share = Math.round((total / count) * 100) / 100;
      return {
        localCardText:
          `*Smart Bill Split Calculation*\n` +
          `*Total Bill:* ${formatCurrency(total)}\n` +
          `*Split Between:* ${count} people\n` +
          `*Each Person Owes:* *${formatCurrency(share)}*`
      };
    }

    return {};
  };

  const handleSendMessage = async (textToSend, extraContext = {}) => {
    const raw = (typeof textToSend === 'string' ? textToSend : inputText || '').trim();
    if (!raw) return;

    // Mask sensitive banking tokens BEFORE inserting into DOM state or IndexedDB
    const { sanitizedText: safeDisplayText } = sanitizeFinancialText(raw);
    const startTs = Date.now();
    const clientRequestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const userMsg = {
      id: `msg_${Date.now()}`,
      sender: 'user',
      text: safeDisplayText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const currentHistorySnapshot = [...messages, userMsg];
    setMessages(currentHistorySnapshot);
    if (typeof textToSend !== 'string') {
      setInputText('');
    }
    setIsTyping(true);

    const mergedRecentTxs = [...recentSessionLogsRef.current, ...(recentTransactions || [])];
    const runLocalFallback = async (prefixBanner = '') => {
      const result = await processAssistantMessage(raw, {
        dashboardData,
        recentTransactions: mergedRecentTxs,
        formatCurrency,
        onSaveExpense,
        onDeleteExpense,
        learnedCategories: prefs.learnedCategories,
        customCategories: categories,
        userName,
        budgetRatios: prefs.budgetRatios,
        onUpdateBudgetRatios: async (newRatios) => {
          const updated = await saveBudgetRatios(userId, newRatios);
          if (updated) setPrefs(updated);
        },
        lastLoggedBatch: lastLoggedBatchRef.current,
        ...extraContext
      });

      if (result.type === 'batch_logged' && Array.isArray(result.savedIds)) {
        lastLoggedBatchRef.current = result.savedIds;
        const nowIso = new Date().toISOString();
        (result.items || []).forEach(item => {
          recentSessionLogsRef.current.unshift({ amount: item.amount, description: item.merchant, date: item.date, created_at: nowIso });
        });
        recentSessionLogsRef.current = recentSessionLogsRef.current.slice(0, 20);
      } else if (result.type === 'expense_logged') {
        lastLoggedBatchRef.current = result.savedTransaction?.id ? [result.savedTransaction.id] : null;
        recentSessionLogsRef.current.unshift({
          ...(result.savedTransaction || {}),
          amount: result.parsed?.amount ?? result.savedTransaction?.amount,
          description: result.parsed?.merchant ?? result.savedTransaction?.description,
          date: result.parsed?.date ?? result.savedTransaction?.date,
          created_at: new Date().toISOString()
        });
        recentSessionLogsRef.current = recentSessionLogsRef.current.slice(0, 20);
      } else if (result.type === 'undo_success') {
        recentSessionLogsRef.current.shift();
      }

      const botMsg = {
        id: `msg_bot_${Date.now()}`,
        sender: 'bot',
        text: prefixBanner ? `${prefixBanner}\n\n${result.replyText}` : result.replyText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: result.type,
        data: result.data,
        parsed: result.parsed || null,
        savedTransaction: result.savedTransaction || null,
        syncStatus: result.type === 'expense_logged' ? 'synced' : null,
        actionButtons: result.actionButtons || null,
        suggestedChips: result.suggestedChips || null
      };

      setMessages((prev) => [...prev, botMsg]);

      if (result.type === 'expense_logged') {
        recordCopilotMetric(userId, 'log_success', { durationMs: Date.now() - startTs });
        showToast(`Logged ${formatCurrency(result.parsed?.amount)}! Tap Undo if needed.`, 'success');
      } else if (result.type === 'batch_logged') {
        recordCopilotMetric(userId, 'log_success', { durationMs: Date.now() - startTs });
        showToast(`Logged ${result.count} expenses!`, 'success');
      } else if (result.type === 'undo_success') {
        recordCopilotMetric(userId, 'undo');
        showToast('Transaction undone and removed!', 'info');
      } else if (result.type === 'help_guidance') {
        recordCopilotMetric(userId, 'parse_failure');
      }
    };

    // Hybrid routing: instantaneous local engine for deterministic shorthand, SMS, split, undo, affordability, frameworks
    const shouldRouteLocal = Boolean(extraContext.forceLog || extraContext.targetTxId) || canHandleLocally(raw, {
      dashboardData,
      recentTransactions: mergedRecentTxs,
      learnedCategories: prefs.learnedCategories,
      customCategories: categories
    });

    if (shouldRouteLocal) {
      setTimeout(async () => {
        try {
          await runLocalFallback();
        } catch (err) {
          setMessages((prev) => [
            ...prev,
            {
              id: `msg_bot_${Date.now()}`,
              sender: 'bot',
              text: `Error processing request: ${err.message || 'Please try again'}`,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
          ]);
        } finally {
          setIsTyping(false);
        }
      }, 150);
      return;
    }

    // Streaming SSE LLM path (/api/chat) for open-ended queries and natural tool proposals
    const streamMsgId = `msg_stream_${Date.now()}`;
    let streamBubbleInserted = false;

    try {
      const { recentTurns, olderSummary } = buildSanitizedConversationMemory(currentHistorySnapshot.slice(0, -1));
      const safeContext = buildSafeChatContext({
        consentEnabled: effectiveAiConsent,
        dashboardData,
        recentTransactions: mergedRecentTxs,
        currency: 'INR'
      });

      const isSmsLike = /\b(?:debited|credited|a\/c|utr|rrn)\b/i.test(raw);
      const streamRes = await streamChat({
        message: safeDisplayText,
        isSmsPaste: isSmsLike,
        history: recentTurns,
        olderSummary,
        context: safeContext,
        requestId: clientRequestId,
        userId,
        onToken: (fullAccumulatedText) => {
          setIsTyping(false);
          const safeStreamText = sanitizeRenderedLlmText(fullAccumulatedText);
          if (!streamBubbleInserted) {
            streamBubbleInserted = true;
            setMessages((prev) => [
              ...prev,
              {
                id: streamMsgId,
                sender: 'bot',
                text: safeStreamText,
                isStreamingBubble: true,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              }
            ]);
          } else {
            setMessages((prev) =>
              prev.map((m) => (m.id === streamMsgId ? { ...m, text: safeStreamText } : m))
            );
          }
        },
        onToolCall: async (tool) => {
          const isMutatingTool = ['log_expense', 'log_multiple_expenses', 'undo_last', 'set_budget'].includes(tool.name);
          if (!tool.requiresConfirm && !isMutatingTool) {
            // Auto-execute strictly for read-only/split calculations (get_category_breakdown, split_bill)
            const execRes = await executeValidatedToolCall(tool);
            if (execRes?.duplicateDetected) {
              setMessages((prev) => [
                ...prev,
                {
                  id: `msg_dup_${Date.now()}`,
                  sender: 'bot',
                  type: 'tool_confirm_card',
                  pendingToolCall: { ...tool, requiresConfirm: true, isDuplicateWarning: true },
                  text: `Possible duplicate detected: *${tool.args.merchant}* (${formatCurrency(tool.args.amount)}). Confirm to log anyway?`,
                  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }
              ]);
            } else if (execRes?.savedTransaction) {
              setMessages((prev) => [
                ...prev,
                {
                  id: `msg_tool_ok_${Date.now()}`,
                  sender: 'bot',
                  type: 'expense_logged',
                  syncStatus: 'synced',
                  savedTransaction: execRes.savedTransaction,
                  actionButtons: [
                    { label: 'Edit Details', actionType: 'inline_edit' },
                    { label: `Undo (${formatCurrency(tool.args.amount)} ${tool.args.merchant})`, actionType: 'undo_tx', targetTxId: execRes.savedTransaction.id }
                  ],
                  text:
                    `*Expense Logged Successfully!*\n` +
                    `*Amount:* ${formatCurrency(tool.args.amount)}\n` +
                    `*Category:* ${tool.args.category}\n` +
                    `*Merchant:* ${tool.args.merchant}\n` +
                    `*Mode:* ${tool.args.mode}`,
                  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }
              ]);
            } else if (execRes?.localCardText) {
              setMessages((prev) => [
                ...prev,
                {
                  id: `msg_split_tool_${Date.now()}`,
                  sender: 'bot',
                  text: execRes.localCardText,
                  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }
              ]);
            }
            return;
          }

          // Render explicit CONFIRM / EDIT / CANCEL card for >= ₹500, low confidence, batch, undo, or set_budget
          let confirmSummary = '';
          if (tool.name === 'log_expense') {
            confirmSummary = `Log *${formatCurrency(tool.args.amount)}* for *${tool.args.merchant}* (${tool.args.category} • ${tool.args.mode})?`;
          } else if (tool.name === 'set_budget') {
            confirmSummary = `Update your monthly budget to *${formatCurrency(tool.args.amount)}*?`;
          } else if (tool.name === 'log_multiple_expenses') {
            confirmSummary = `Log *${tool.args.items.length}* expenses from this message?`;
          } else if (tool.name === 'undo_last') {
            confirmSummary = `Undo the last logged transaction?`;
          }

          setMessages((prev) => [
            ...prev,
            {
              id: `msg_confirm_${Date.now()}`,
              sender: 'bot',
              type: 'tool_confirm_card',
              pendingToolCall: tool,
              text: confirmSummary,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
          ]);
        }
      });

      if (streamBubbleInserted) {
        setMessages((prev) =>
          prev.map((m) => (m.id === streamMsgId ? { ...m, isStreamingBubble: false } : m))
        );
      }

      if (!streamRes.ok) {
        if (streamRes.isStaticFallback) {
          // Static host without remote Worker URL configured: answer seamlessly with local conversational engine
          await runLocalFallback('');
        } else {
          // Offline / timeout / quota exhausted / AI_DISABLED / 5xx -> friendly local engine fallback (no retry loop)
          await runLocalFallback(`_${streamRes.friendlyError}_`);
          if (!streamRes.isQuotaOrDisabled) {
            setMessages((prev) =>
              prev.map((m, idx) =>
                idx === prev.length - 1
                  ? { ...m, actionButtons: [...(m.actionButtons || []), { label: 'Retry Online AI', query: raw }] }
                  : m
              )
            );
          }
        }
      }
    } catch (err) {
      await runLocalFallback('_Online AI unavailable right now. Using local assistant._');
    } finally {
      setIsTyping(false);
    }
  };

  /**
   * Idempotent handler for structured card buttons (Log My Share, Confirm & Log, Log Anyway, Undo, Inline Edit)
   */
  const handleCardActionClick = async (msg, btn) => {
    const lockKey = `${msg.id}::${btn.label}`;
    if (pendingActionIdsRef.current.has(lockKey)) return;

    if (btn.actionType === 'inline_edit') {
      setEditingMsgId(msg.id);
      return;
    }

    if (btn.actionType === 'dismiss_notice') {
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, actionButtons: null, text: `${m.text}\n\n_Skipped duplicate entry._` } : m));
      return;
    }

    if (btn.actionType === 'undo_tx') {
      await handleSendMessage('Undo', { targetTxId: btn.targetTxId || msg.savedTransaction?.id });
      return;
    }

    // Undo already-logged share button
    if (btn.actionType === 'log_share' && msg.loggedShareTxId) {
      pendingActionIdsRef.current.add(lockKey);
      try {
        await handleSendMessage('Undo', { targetTxId: msg.loggedShareTxId });
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, loggedShareTxId: null } : m));
      } finally {
        pendingActionIdsRef.current.delete(lockKey);
      }
      return;
    }

    // Idempotent 1-tap Share Logging or Confirm & Log / Force Log
    if (btn.actionType === 'log_share' && btn.sharePayload) {
      pendingActionIdsRef.current.add(lockKey);
      try {
        let saved = null;
        if (typeof onSaveExpense === 'function') {
          saved = await onSaveExpense(btn.sharePayload);
        }
        const createdId = saved?.id || `share_${Date.now()}`;
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, loggedShareTxId: createdId } : m));
        setMessages(prev => [
          ...prev,
          {
            id: `msg_share_ok_${Date.now()}`,
            sender: 'bot',
            type: 'expense_logged',
            syncStatus: 'synced',
            savedTransaction: saved || { ...btn.sharePayload, id: createdId },
            text:
              `*Expense Logged Successfully!*\n` +
              `*Amount:* ${formatCurrency(btn.sharePayload.amount)}\n` +
              `*Category:* ${btn.sharePayload.category}\n` +
              `*Merchant:* ${btn.sharePayload.merchant}\n` +
              `*Mode:* ${btn.sharePayload.payment_mode}`,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
        recordCopilotMetric(userId, 'log_success');
        showToast(`Logged share ${formatCurrency(btn.sharePayload.amount)}!`, 'success');
      } finally {
        pendingActionIdsRef.current.delete(lockKey);
      }
      return;
    }

    if ((btn.actionType === 'confirm_parsed_expense' || btn.actionType === 'force_log_expense') && btn.expensePayload) {
      if (msg.confirmedLogged) return;
      pendingActionIdsRef.current.add(lockKey);
      try {
        const p = btn.expensePayload;
        const payload = {
          amount: p.amount,
          description: p.merchant,
          category: p.category,
          payment_mode: p.paymentMode,
          date: p.date,
          is_refund: p.type === 'income'
        };
        const saved = typeof onSaveExpense === 'function' ? await onSaveExpense(payload) : payload;
        setMessages(prev => prev.map(m => m.id === msg.id ? {
          ...m,
          confirmedLogged: true,
          savedTransaction: saved,
          actionButtons: [{ label: 'Edit Details', actionType: 'inline_edit' }],
          text:
            `*Expense Logged Successfully!*\n` +
            `*Amount:* ${formatCurrency(p.amount)}\n` +
            `*Category:* ${p.category}\n` +
            `*Merchant:* ${p.merchant}\n` +
            `*Mode:* ${p.paymentMode}`
        } : m));
        recordCopilotMetric(userId, 'log_success');
        showToast(`Logged ${formatCurrency(p.amount)}!`, 'success');
      } finally {
        pendingActionIdsRef.current.delete(lockKey);
      }
      return;
    }

    // Default conversational query button
    if (btn.query) {
      await handleSendMessage(btn.query);
    }
  };

  /**
   * Saves inline card edits, updates ledger, and teaches merchant->category preference
   */
  const handleSaveInlineEdit = async (msg, edited) => {
    const baseTx = msg.savedTransaction || msg.parsed || {};
    const payload = {
      ...(baseTx.id ? { id: baseTx.id } : {}),
      amount: edited.amount,
      description: edited.merchant,
      category: edited.category,
      payment_mode: edited.paymentMode,
      date: baseTx.date || new Date().toISOString().slice(0, 10),
      is_refund: Boolean(baseTx.is_refund || baseTx.type === 'income')
    };

    const saved = typeof onSaveExpense === 'function' ? await onSaveExpense(payload) : payload;
    const updatedPrefs = await learnMerchantCategory(userId, edited.merchant, edited.category);
    if (updatedPrefs) setPrefs(updatedPrefs);
    await recordCopilotMetric(userId, 'edit_card');

    setEditingMsgId(null);
    setMessages(prev => prev.map(m => {
      if (m.id !== msg.id) return m;
      return {
        ...m,
        type: 'expense_logged',
        confirmedLogged: true,
        syncStatus: 'synced',
        savedTransaction: saved || payload,
        actionButtons: [
          { label: 'Edit Details', actionType: 'inline_edit' },
          { label: `Undo (${formatCurrency(edited.amount)} ${edited.merchant})`, actionType: 'undo_tx', targetTxId: saved?.id || baseTx.id }
        ],
        text:
          `*Expense Logged Successfully!*\n` +
          `*Amount:* ${formatCurrency(edited.amount)}\n` +
          `*Category:* ${edited.category}\n` +
          `*Merchant:* ${edited.merchant}\n` +
          `*Mode:* ${edited.paymentMode}\n` +
          `*Date:* ${payload.date}\n\n` +
          `_Learned: "${edited.merchant}" → ${edited.category} for future expenses._`
      };
    }));
    showToast(`Updated & remembered "${edited.merchant}" → ${edited.category}`, 'success');
  };

  const handleClearChat = async () => {
    await Promise.all([
      clearChatHistoryStorage(userId),
      clearServerSession(userId)
    ]);
    recentSessionLogsRef.current = [];
    setEditingMsgId(null);
    setMessages([
      {
        id: `msg_fresh_${Date.now()}`,
        sender: 'bot',
        type: 'onboarding_welcome',
        text: '*Chat history cleared!*\n\nLocal & server session copies deleted. Ask any financial question like `Can I afford 3500?`, `Chai 20`, or `Summary` to begin.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
    showToast('Chat history cleared (local & server copies)', 'info');
  };

  // Contextual chips derived from latest bot response + guaranteed core anchors (`Summary`, `Daily Pace`)
  const contextualQuickPrompts = useMemo(() => {
    const lastBot = [...messages].reverse().find(m => m.sender === 'bot');
    const suggested = Array.isArray(lastBot?.suggestedChips) ? lastBot.suggestedChips : [];

    const coreList = [
      { id: 'summary', label: 'Summary', text: 'Summary' },
      { id: 'daily-pace', label: 'Daily Pace', text: 'Daily Pace' },
      { id: 'rule-503020', label: '50/30/20 Rule', text: 'Explain 50/30/20 rule for my budget' },
      { id: 'food-spend', label: 'Food Spend', text: 'Food Spend' },
      { id: 'split-bill', label: 'Split Bill', text: 'Split 2,400 between 6 people' },
      { id: 'undo-last', label: 'Undo Last', text: 'Undo' }
    ];

    const merged = [];
    const seenLabels = new Set();

    for (const s of suggested) {
      const lowerS = s.toLowerCase();
      if (lowerS === 'daily pace' || lowerS === 'summary') continue; // keep core IDs intact
      const id = lowerS.replace(/[^a-z0-9]+/g, '-');
      if (!seenLabels.has(lowerS)) {
        seenLabels.add(lowerS);
        merged.push({ id, label: s, text: s });
      }
    }

    for (const core of coreList) {
      if (!seenLabels.has(core.label.toLowerCase())) {
        seenLabels.add(core.label.toLowerCase());
        merged.push(core);
      }
    }
    return merged;
  }, [messages]);

  // Live financial snapshot telemetry
  const snapshot = useMemo(() => prepareSafeFinancialSnapshot({ dashboardData, recentTransactions }), [dashboardData, recentTransactions]);
  const nudges = useMemo(() => computeProactiveNudges(snapshot, recentTransactions), [snapshot, recentTransactions]);
  const isDeficit = snapshot.remainingBudget < 0;

  if (!shouldRender) return null;

  const isMobileViewport = typeof window !== 'undefined' && window.innerWidth < 640;
  const mobileDynamicStyle = isMobileViewport && viewportHeight
    ? { height: `${Math.max(380, viewportHeight - 8)}px`, maxHeight: `${Math.max(380, viewportHeight - 8)}px` }
    : undefined;

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center bg-slate-950/70 dark:bg-black/75 backdrop-blur-md transition-opacity duration-250 ease-out motion-reduce:transition-none ${
        isAnimating ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      data-testid="whatsapp-chatbox-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pocketnook-chat-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleDismiss();
      }}
    >
      <div
        ref={modalCardRef}
        onClick={(e) => e.stopPropagation()}
        style={mobileDynamicStyle}
        className={`relative w-full sm:max-w-lg h-[94dvh] sm:h-[82vh] sm:max-h-[740px] bg-[#f4f5fa] dark:bg-[#0d0b18] text-slate-900 dark:text-[#f8fafc] rounded-t-[24px] sm:rounded-[36px] overflow-hidden shadow-[0_-16px_50px_rgba(0,0,0,0.4)] dark:shadow-[0_-20px_60px_rgba(0,0,0,0.8)] flex flex-col border-t sm:border border-slate-300/80 dark:border-violet-400/20 transition-transform duration-250 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${
          isAnimating ? 'translate-y-0 sm:scale-100' : 'translate-y-full sm:translate-y-8 sm:scale-95'
        }`}
      >
        {/* Mobile Swipe-Down & Tap Handle */}
        <div
          onClick={handleDismiss}
          onTouchStart={(e) => { touchStartYRef.current = e.touches[0]?.clientY ?? null; }}
          onTouchMove={(e) => {
            if (touchStartYRef.current === null) return;
            const dy = (e.touches[0]?.clientY ?? 0) - touchStartYRef.current;
            if (dy > 70) {
              touchStartYRef.current = null;
              handleDismiss();
            }
          }}
          onTouchEnd={() => { touchStartYRef.current = null; }}
          className="sm:hidden flex items-center justify-center pt-3 pb-1.5 bg-white dark:bg-[#16132A] cursor-pointer active:opacity-60 transition-opacity touch-pan-y"
          title="Swipe down or tap to dismiss"
          aria-label="Swipe down to close chat drawer"
        >
          <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-white/30" />
        </div>

        {/* Executive Header */}
        <div className="bg-white dark:bg-[#16132A] px-3.5 py-2.5 flex items-center justify-between border-b border-slate-200 dark:border-white/15 shadow-xs relative z-20">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={handleDismiss}
              className="w-11 h-11 sm:w-9 sm:h-9 rounded-xl bg-slate-100 dark:bg-white/[0.08] text-slate-700 dark:text-zinc-100 hover:bg-slate-200 dark:hover:bg-white/[0.14] border border-slate-300/70 dark:border-white/[0.12] flex items-center justify-center transition-all cursor-pointer flex-shrink-0"
              aria-label="Back"
            >
              <ArrowLeft size={18} />
            </button>

            <div className="relative flex-shrink-0">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-md ${IS_QA ? 'bg-gradient-to-tr from-amber-700 to-amber-500 shadow-amber-600/30' : 'bg-gradient-to-tr from-[#5B27DC] to-[#7B42F6] shadow-purple-600/30'}`}>
                <Sparkles size={18} className="text-white" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-[#16132A] rounded-full shadow-xs" />
            </div>

            <div className="min-w-0 flex-1">
              <h3 id="pocketnook-chat-title" className="font-bold text-[15px] sm:text-base tracking-tight text-slate-900 dark:text-white leading-tight flex items-center gap-1.5">
                <span>{CHAT_DISPLAY_NAME}</span>
              </h3>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <span className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-[#5B27DC] dark:text-[#C4B5FD] border border-purple-300 dark:border-purple-400/35 flex-shrink-0">
                  Privacy-First
                </span>
                <span className="text-[11px] text-slate-600 dark:text-slate-300 font-medium leading-none">
                  {isListening ? (
                    <span className="text-amber-600 dark:text-amber-300 font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 motion-safe:animate-ping inline-block" />
                      Listening ({voiceLang})...
                    </span>
                  ) : isTyping ? (
                    <span className="text-[#5B27DC] dark:text-[#C4B5FD] italic">processing...</span>
                  ) : (
                    <span>ready • smart expense logger</span>
                  )}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={handleClearChat}
              data-testid="copilot-clear-chat-btn"
              title="Clear Chat History"
              aria-label="Clear Chat History"
              className="w-11 h-11 sm:w-9 sm:h-9 rounded-xl bg-slate-100 dark:bg-white/[0.08] hover:bg-slate-200 dark:hover:bg-white/[0.14] border border-slate-300/70 dark:border-white/[0.12] flex items-center justify-center text-slate-600 dark:text-zinc-200 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer"
            >
              <Trash2 size={16} />
            </button>
            <button
              onClick={handleDismiss}
              title="Close"
              aria-label="Close"
              className="w-11 h-11 sm:w-9 sm:h-9 rounded-xl bg-slate-100 dark:bg-white/[0.08] hover:bg-slate-200 dark:hover:bg-white/[0.14] border border-slate-300/70 dark:border-white/[0.12] flex items-center justify-center text-slate-600 dark:text-zinc-200 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Live Telemetry HUD (with Icon + Text labels for accessibility) */}
        <div className="px-4 py-2 bg-[#f4f5fa] dark:bg-[#0d0b18] select-none z-10">
          <div className="bg-white/95 dark:bg-[#16132A]/95 backdrop-blur-md border border-slate-300/80 dark:border-white/[0.12] rounded-2xl p-2 px-3.5 flex items-center justify-between shadow-2xs">
            <div className="flex-1 text-center border-r border-slate-200 dark:border-white/[0.08] pr-2">
              <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-300 flex items-center justify-center gap-1 mb-0.5">
                {isDeficit ? <AlertTriangle size={10} className="text-rose-600 dark:text-rose-300" /> : <CheckCircle2 size={10} className="text-emerald-600 dark:text-emerald-300" />}
                <span>{isDeficit ? 'Over' : 'Remaining'}</span>
              </span>
              <span className={`font-mono tabular-nums font-bold text-[13.5px] tracking-tight ${isDeficit ? 'text-rose-700 dark:text-rose-300' : 'text-[#5B27DC] dark:text-[#C4B5FD]'}`}>
                {formatCurrency(snapshot.remainingBudget)}
              </span>
            </div>
            <div className="flex-1 text-center border-r border-slate-200 dark:border-white/[0.08] px-2">
              <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-300 block mb-0.5">
                Safe Pace
              </span>
              <span className="font-mono tabular-nums font-bold text-[13.5px] text-slate-900 dark:text-zinc-100 tracking-tight">
                {formatCurrency(snapshot.safeDailyPace)}
                <span className="text-[9.5px] font-normal text-slate-500 dark:text-zinc-300 ml-0.5">/d</span>
              </span>
            </div>
            <div className="flex-1 text-center pl-2">
              <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-300 block mb-0.5">
                Today
              </span>
              <span className="font-mono tabular-nums font-bold text-[13.5px] text-slate-900 dark:text-zinc-100 tracking-tight">
                {formatCurrency(snapshot.todaySpent)}
              </span>
            </div>
          </div>
        </div>

        {/* Proactive Nudge Strip (if applicable) */}
        {nudges.length > 0 && (
          <div className="px-4 pb-1 flex gap-2 overflow-x-auto scrollbar-none">
            {nudges.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => handleSendMessage(n.query)}
                className="text-[11px] font-semibold px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border border-amber-300/70 dark:border-amber-500/30 flex items-center gap-1.5 flex-shrink-0 cursor-pointer"
              >
                <AlertTriangle size={12} />
                <span>{n.text}</span>
              </button>
            ))}
          </div>
        )}

        {/* Conversation Canvas (Accessible live region) */}
        <div
          className="flex-1 overflow-y-auto px-4 py-2 space-y-3.5 bg-[#f4f5fa] dark:bg-[#0d0b18] scrollbar-none"
          data-testid="whatsapp-messages-container"
          aria-live="polite"
          aria-relevant="additions"
        >
          {/* Honest Privacy & Retention Notice Pill */}
          <div className="mx-auto max-w-md text-center py-2 px-3.5 rounded-2xl bg-slate-200/80 dark:bg-white/[0.06] border border-slate-300/80 dark:border-white/[0.1] text-[10.5px] text-slate-700 dark:text-zinc-200 font-medium shadow-2xs space-y-1 select-none">
            <div className="flex items-center justify-center gap-1.5">
              <ShieldCheck size={13} className="text-[#5B27DC] dark:text-[#C4B5FD] flex-shrink-0" />
              <span>Sensitive numbers are masked before processing &amp; summary sharing is OFF by default. Note: free-tier AI prompts may be used by Google to improve its products.</span>
            </div>
            <div className="flex items-center justify-center gap-2 text-[10px] text-slate-600 dark:text-zinc-300">
              <span>Retention: last 200 sanitized messages in IndexedDB</span>
              <button
                type="button"
                onClick={handleToggleConsentInChat}
                data-testid="chat-ai-consent-pill"
                className={`px-2 py-0.5 rounded-full font-bold border cursor-pointer ${
                  effectiveAiConsent
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30'
                    : 'bg-slate-100 dark:bg-white/[0.08] text-slate-700 dark:text-zinc-200 border-slate-300 dark:border-white/15'
                }`}
              >
                Summary Sharing: {effectiveAiConsent ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>

          {messages.map((msg) => {
            const isUser = msg.sender === 'user';
            const isEditingThis = editingMsgId === msg.id;

            return (
              <div
                key={msg.id}
                className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}
              >
                <div
                  className={`max-w-[92%] sm:max-w-[85%] rounded-2xl px-4 py-3 shadow-xs relative text-[13px] leading-relaxed transition-all ${
                    isUser
                      ? 'bg-gradient-to-r from-[#5B27DC] to-[#7B42F6] text-white font-medium rounded-tr-xs shadow-purple-600/20 whitespace-pre-wrap'
                      : 'bg-white dark:bg-[#16132A] text-slate-800 dark:text-zinc-100 rounded-tl-xs border border-slate-300/70 dark:border-white/[0.12] shadow-2xs'
                  }`}
                  data-testid={`whatsapp-bubble-${msg.sender}`}
                >
                  <div className="space-y-0.5">
                    {isUser ? msg.text : formatBotMessage(msg.text, msg, (targetMsg) => setEditingMsgId(targetMsg.id))}
                  </div>

                  {/* Tappable Onboarding Example Pills on Welcome Card */}
                  {msg.type === 'onboarding_welcome' && (
                    <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-white/[0.08] flex flex-wrap gap-1.5" data-testid="onboarding-examples">
                      {ONBOARDING_EXAMPLES.map((ex) => (
                        <button
                          key={ex.id}
                          type="button"
                          onClick={() => handleSendMessage(ex.query)}
                          data-testid={`onboarding-example-${ex.id}`}
                          className="px-3 py-1.5 min-h-[36px] rounded-xl bg-purple-50 dark:bg-purple-900/35 hover:bg-purple-100 dark:hover:bg-purple-900/55 text-[#5B27DC] dark:text-[#C4B5FD] font-semibold text-[11.5px] border border-purple-300/70 dark:border-purple-400/30 cursor-pointer"
                        >
                          &ldquo;{ex.label}&rdquo;
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Inline Expense Editor (for corrections, low-confidence confirm, or category learning) */}
                  {isEditingThis && (msg.savedTransaction || msg.parsed || msg.pendingToolCall?.args) && (
                    <InlineExpenseEditor
                      initialValues={msg.savedTransaction || msg.parsed || {
                        merchant: msg.pendingToolCall?.args?.merchant,
                        amount: msg.pendingToolCall?.args?.amount,
                        category: msg.pendingToolCall?.args?.category,
                        payment_mode: msg.pendingToolCall?.args?.mode,
                        date: msg.pendingToolCall?.args?.date,
                        type: msg.pendingToolCall?.args?.type
                      }}
                      categoryOptions={categoryOptions}
                      onSave={(edited) => handleSaveInlineEdit(msg, edited)}
                      onCancel={() => setEditingMsgId(null)}
                    />
                  )}

                  {/* Validated Tool Call CONFIRM / EDIT / CANCEL Card */}
                  {msg.type === 'tool_confirm_card' && msg.pendingToolCall && !msg.toolResolved && !isEditingThis && (
                    <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-white/[0.08] flex flex-wrap gap-2" data-testid="tool-confirm-card">
                      <button
                        type="button"
                        data-testid="tool-confirm-btn"
                        onClick={async () => {
                          const tool = msg.pendingToolCall;
                          const execRes = await executeValidatedToolCall(tool, { forceConfirmed: true });
                          if (execRes?.skippedDuplicateRequest) return;
                          setMessages(prev => prev.map(m => m.id === msg.id ? {
                            ...m,
                            toolResolved: 'confirmed',
                            savedTransaction: execRes?.savedTransaction || null,
                            type: execRes?.savedTransaction ? 'expense_logged' : m.type,
                            syncStatus: execRes?.savedTransaction ? 'synced' : null,
                            text: execRes?.savedTransaction
                              ? `*Expense Logged Successfully!*\n*Amount:* ${formatCurrency(tool.args.amount)}\n*Merchant:* ${tool.args.merchant}\n*Category:* ${tool.args.category}\n*Mode:* ${tool.args.mode}`
                              : execRes?.budgetUpdated
                              ? `*Budget Updated!*\nMonthly budget is now *${formatCurrency(execRes.budgetUpdated)}*.`
                              : `*Confirmed & Completed!*`
                          } : m));
                        }}
                        className="flex-1 min-h-[40px] py-2 px-3 rounded-xl bg-[#6C47FF] hover:bg-[#5835E5] text-white font-bold text-[12px] flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Check size={14} />
                        <span>Confirm</span>
                      </button>

                      {msg.pendingToolCall.name === 'log_expense' && (
                        <button
                          type="button"
                          data-testid="tool-edit-btn"
                          onClick={() => setEditingMsgId(msg.id)}
                          className="min-h-[40px] py-2 px-3 rounded-xl bg-slate-100 dark:bg-white/[0.08] text-slate-800 dark:text-zinc-100 border border-slate-300 dark:border-white/15 font-semibold text-[12px] flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Edit3 size={13} />
                          <span>Edit</span>
                        </button>
                      )}

                      <button
                        type="button"
                        data-testid="tool-cancel-btn"
                        onClick={() => {
                          setMessages(prev => prev.map(m => m.id === msg.id ? {
                            ...m,
                            toolResolved: 'cancelled',
                            text: `${m.text}\n\n_Cancelled — no changes written to your ledger._`
                          } : m));
                        }}
                        className="min-h-[40px] py-2 px-3 rounded-xl bg-white dark:bg-white/[0.04] text-slate-600 dark:text-zinc-300 border border-slate-300 dark:border-white/15 font-semibold text-[12px] cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {/* Contextual & Idempotent Action Buttons */}
                  {msg.actionButtons && msg.actionButtons.length > 0 && !isEditingThis && (
                    <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-white/[0.08] flex flex-wrap gap-2">
                      {msg.actionButtons.map((btn, bIdx) => {
                        const isShareDone = btn.actionType === 'log_share' && Boolean(msg.loggedShareTxId);
                        const labelText = isShareDone ? 'Logged ✓ · Undo' : btn.label;

                        return (
                          <button
                            key={bIdx}
                            type="button"
                            onClick={() => handleCardActionClick(msg, btn)}
                            data-testid={btn.actionType === 'log_share' ? (isShareDone ? 'logged-undo-btn' : 'log-my-share-btn') : undefined}
                            className={`py-2 px-3 min-h-[40px] rounded-xl font-semibold text-[11.5px] border flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer flex-1 min-w-[120px] ${
                              isShareDone
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30'
                                : 'bg-slate-100 dark:bg-white/[0.08] hover:bg-purple-50 dark:hover:bg-purple-900/35 text-[#5B27DC] dark:text-[#C4B5FD] border-slate-300/80 dark:border-white/[0.12]'
                            }`}
                          >
                            {isShareDone ? <RotateCcw size={12} /> : btn.actionType === 'inline_edit' ? <Edit3 size={12} /> : null}
                            <span>{labelText}</span>
                            {!isShareDone && btn.actionType !== 'inline_edit' && <ArrowUpRight size={12} className="opacity-75" />}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className={`flex items-center justify-end gap-1 text-[10px] mt-2 select-none font-medium ${
                    isUser ? 'text-purple-100' : 'text-slate-500 dark:text-zinc-400'
                  }`}>
                    <span>{msg.time}</span>
                    {isUser && <CheckCheck size={13} className="text-purple-100 ml-0.5" />}
                  </div>
                </div>
              </div>
            );
          })}

          {isTyping && (
            <div className="flex justify-start animate-fade-in">
              <div className="rounded-2xl rounded-tl-xs px-4 py-2.5 bg-white dark:bg-[#16132A] border border-slate-300/70 dark:border-white/[0.12] shadow-2xs flex items-center gap-1.5 w-fit" aria-label="Analyzing message">
                <span className="w-1.5 h-1.5 rounded-full bg-[#6C47FF] dark:bg-[#C4B5FD] motion-safe:animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-[#6C47FF] dark:bg-[#C4B5FD] motion-safe:animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-[#6C47FF] dark:bg-[#C4B5FD] motion-safe:animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Contextual Prompt Chips Carousel */}
        <div className="bg-white/95 dark:bg-[#16132A]/95 backdrop-blur-md px-3.5 py-2 flex items-center gap-2 overflow-x-auto scrollbar-none border-t border-slate-200 dark:border-white/[0.1]">
          <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-300 flex-shrink-0 select-none mr-0.5">
            <Sparkles size={11} className="text-[#5B27DC] dark:text-[#C4B5FD]" />
            <span>Prompt:</span>
          </div>
          {contextualQuickPrompts.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleSendMessage(p.text)}
              data-testid={`whatsapp-quick-prompt-${p.id}`}
              className="px-3.5 py-1.5 min-h-[36px] rounded-full bg-slate-100 dark:bg-white/[0.08] hover:bg-purple-50 dark:hover:bg-purple-900/35 text-[11.5px] font-semibold text-slate-800 dark:text-zinc-100 hover:text-[#5B27DC] dark:hover:text-[#C4B5FD] border border-slate-300/80 dark:border-white/[0.12] shadow-2xs flex-shrink-0 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Ergonomic Pinned Composer with Safe-Area Bottom Padding */}
        <div className="bg-white dark:bg-[#16132A] px-3 pt-2.5 pb-safe border-t border-slate-200 dark:border-white/[0.12] relative z-20">
          <div className="bg-[#f0f2f7] dark:bg-[#120F24] border border-slate-300/80 dark:border-white/[0.14] rounded-[24px] p-1 pl-3.5 flex items-center gap-1.5 focus-within:border-[#6C47FF] focus-within:ring-2 focus-within:ring-[#6C47FF]/25 transition-all shadow-2xs">
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              data-testid="whatsapp-chat-input"
              placeholder={isListening ? 'Listening... speak now!' : 'Ask anything or log expense...'}
              className="flex-1 min-h-[42px] bg-transparent text-[16px] sm:text-[13.5px] font-medium text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-zinc-400 focus:outline-none"
            />

            {/* Voice Language Toggle (EN-IN / HI-IN) */}
            <button
              type="button"
              onClick={() => setVoiceLang(prev => prev === 'en-IN' ? 'hi-IN' : 'en-IN')}
              title={`Voice language: ${voiceLang} (tap to switch)`}
              aria-label={`Switch voice language (current: ${voiceLang})`}
              className="px-2 h-9 rounded-full text-[10px] font-bold bg-white dark:bg-[#1E1938] text-slate-700 dark:text-zinc-200 border border-slate-300/80 dark:border-white/[0.12] cursor-pointer flex-shrink-0"
            >
              {voiceLang === 'hi-IN' ? 'HI' : 'EN'}
            </button>

            {/* Voice Dictation Mic (44px accessible target) */}
            <button
              type="button"
              onClick={toggleVoiceListening}
              title={isListening ? 'Stop listening' : 'Speak your message'}
              data-testid="whatsapp-voice-mic-btn"
              className={`w-11 h-11 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-all cursor-pointer flex-shrink-0 ${
                isListening
                  ? 'bg-rose-500 text-white shadow-md shadow-rose-500/40 ring-2 ring-rose-400'
                  : 'bg-white dark:bg-[#1E1938] text-slate-600 dark:text-zinc-200 hover:text-[#6C47FF] dark:hover:text-[#C4B5FD] active:scale-90 border border-slate-300/80 dark:border-white/[0.12] shadow-2xs'
              }`}
              aria-label="Voice input"
            >
              <Mic size={16} />
            </button>

            {/* Stop Generating (AbortController) OR Send Button (44px accessible target) */}
            {isStreaming ? (
              <button
                type="button"
                onClick={stopGenerating}
                data-testid="stop-generating-btn"
                title="Stop generating"
                aria-label="Stop generating"
                className="w-11 h-11 sm:w-9 sm:h-9 rounded-full bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-500/25 flex items-center justify-center transition-all cursor-pointer active:scale-90 flex-shrink-0"
              >
                <Square size={13} fill="currentColor" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleSendMessage()}
                disabled={!inputText.trim() || isTyping}
                data-testid="whatsapp-chat-send-btn"
                className="w-11 h-11 sm:w-9 sm:h-9 rounded-full bg-gradient-to-r from-[#5B27DC] to-[#7B42F6] hover:from-[#4E1FC5] hover:to-[#6E32E9] text-white shadow-md shadow-purple-500/25 flex items-center justify-center transition-all cursor-pointer active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none flex-shrink-0"
                aria-label="Send"
              >
                <Send size={15} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
