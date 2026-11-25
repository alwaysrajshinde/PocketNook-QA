import React, { useState, useEffect, useRef } from 'react';
import {
  X, Send, CheckCheck, Mic, Paperclip, Sparkles,
  Trash2, ArrowLeft, ShieldCheck, Scale, Users,
  Activity, Receipt, ArrowUpRight
} from 'lucide-react';
import { processAssistantMessage } from '../services/aiAssistantService';
import { processReceiptFile } from '../services/receiptScannerService';
import { useToast } from '../context/ToastContext';

const CHAT_STORAGE_KEY = 'expense_tracker_whatsapp_chat';

/**
 * Renders an inline financial ledger key-value metric row
 */
function FinancialLedgerRow({ label, value, isNegative, isPositive, isHighlight }) {
  const cleanLabel = String(label || '').replace(/[*_]/g, '').trim();
  const cleanValue = String(value || '').replace(/[*_]/g, '').trim();

  return (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-white/[0.04] text-[12px] last:border-b-0 gap-3">
      <span className="text-slate-500 dark:text-zinc-400 font-medium flex-shrink-0">{cleanLabel}</span>
      <span className={`font-mono tabular-nums text-right ${
        isNegative
          ? 'text-rose-600 dark:text-rose-400 font-bold'
          : isPositive
          ? 'text-emerald-600 dark:text-emerald-400 font-bold'
          : isHighlight
          ? 'text-[#6C47FF] dark:text-[#C084FC] font-extrabold text-[13px]'
          : 'text-slate-900 dark:text-zinc-100 font-semibold'
      }`}>
        {cleanValue}
      </span>
    </div>
  );
}

/**
 * PocketNook Luxury Fintech Message Formatter
 * Replaces generic AI bot outputs with bespoke financial diagnosis cards.
 */
function formatBotMessage(text) {
  if (!text) return null;

  // 1. AFFORDABILITY FINANCIAL DIAGNOSIS CARD
  if (text.includes('Affordability Financial Diagnosis') && text.includes('Planned Purchase:')) {
    const plannedMatch = text.match(/Planned Purchase:\s*([^\n]+)/i);
    const remainingMatch = text.match(/Current (?:Remaining|Pool Balance):\s*([^\n]+)/i);
    const currentPaceMatch = text.match(/Current Daily (?:Pace|Burn):\s*([^\n]+)/i);
    const projectedPaceMatch = text.match(/Projected Daily Pace:\s*([^\n]+)/i);
    const verdictMatch = text.match(/\*?Verdict:([^*]+)\*?/i);
    const recommendationMatch = text.match(/Recommendation:\s*([^\n]+)/i);

    const isRisk = /Risk/i.test(verdictMatch ? verdictMatch[1] : text);

    return (
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-white/[0.06]">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-lg bg-[#6C47FF]/10 text-[#6C47FF] dark:text-[#C084FC] flex items-center justify-center">
              <Scale size={13} />
            </div>
            <span className="font-bold text-[13px] tracking-tight text-slate-900 dark:text-white">
              Affordability Financial Diagnosis
            </span>
          </div>
          <span className={`text-[9.5px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ml-2 ${
            isRisk
              ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/80 dark:border-rose-500/20'
              : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-500/20'
          }`}>
            {isRisk ? 'Budget Risk' : 'Affordable'}
          </span>
        </div>

        {/* Ledger Grid */}
        <div className="bg-slate-50/80 dark:bg-[#120F24] rounded-xl p-2.5 px-3 border border-slate-200/60 dark:border-white/[0.05]">
          {plannedMatch && (
            <FinancialLedgerRow label="Planned Purchase" value={plannedMatch[1].trim()} isHighlight />
          )}
          {remainingMatch && (
            <FinancialLedgerRow label="Safe Pool Balance" value={remainingMatch[1].trim()} />
          )}
          {currentPaceMatch && (
            <FinancialLedgerRow label="Current Daily Burn" value={currentPaceMatch[1].trim()} />
          )}
          {projectedPaceMatch && (
            <FinancialLedgerRow
              label="Projected Daily Pace"
              value={projectedPaceMatch[1].trim()}
              isNegative={isRisk}
              isPositive={!isRisk}
            />
          )}
        </div>

        {/* Verdict Callout */}
        <div className={`p-3 rounded-xl border text-[12px] leading-relaxed ${
          isRisk
            ? 'bg-rose-500/[0.06] border-rose-500/20 text-rose-900 dark:text-rose-200'
            : 'bg-emerald-500/[0.06] border-emerald-500/20 text-emerald-900 dark:text-emerald-200'
        }`}>
          <div className="font-bold text-[12.5px] mb-1 flex items-center gap-1">
            <span>Verdict: {verdictMatch ? verdictMatch[1].trim() : (isRisk ? 'Budget Risk Detected' : 'Comfortably Affordable')}</span>
          </div>
          <p className="opacity-90">
            {recommendationMatch
              ? recommendationMatch[0]
              : 'Hold off or reallocate funds from another category to stay within safe burn pace.'}
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

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-white/[0.06]">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-lg bg-[#6C47FF]/10 text-[#6C47FF] dark:text-[#C084FC] flex items-center justify-center">
              <Users size={13} />
            </div>
            <span className="font-bold text-[13px] tracking-tight text-slate-900 dark:text-white">
              Smart Bill Split Calculation
            </span>
          </div>
          <span className="text-[9.5px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-purple-50 dark:bg-purple-900/30 text-[#6C47FF] dark:text-[#C084FC] whitespace-nowrap flex-shrink-0 ml-2">
            Split Share
          </span>
        </div>

        <div className="bg-slate-50/80 dark:bg-[#120F24] rounded-xl p-2.5 px-3 border border-slate-200/60 dark:border-white/[0.05]">
          {totalMatch && (
            <FinancialLedgerRow label="Total Bill" value={totalMatch[1].trim()} />
          )}
          {peopleMatch && (
            <FinancialLedgerRow label="Number of People" value={peopleMatch[1].trim()} />
          )}
          {owesMatch && (
            <FinancialLedgerRow
              label="Each Person Owes"
              value={owesMatch[1].trim()}
              isHighlight
            />
          )}
        </div>

        <p className="text-[11.5px] text-slate-500 dark:text-zinc-400">
          Want me to log your share? Tap the button below or reply with your expense details.
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
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-white/[0.06]">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-lg bg-[#6C47FF]/10 text-[#6C47FF] dark:text-[#C084FC] flex items-center justify-center">
              <Activity size={13} />
            </div>
            <span className="font-bold text-[13px] tracking-tight text-slate-900 dark:text-white">
              Safe Daily Burn Rate
            </span>
          </div>
          <span className="text-[9.5px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-purple-50 dark:bg-purple-900/30 text-[#6C47FF] dark:text-[#C084FC] whitespace-nowrap flex-shrink-0 ml-2">
            Velocity
          </span>
        </div>

        <div className="bg-slate-50/80 dark:bg-[#120F24] rounded-xl p-2.5 px-3 border border-slate-200/60 dark:border-white/[0.05]">
          {targetMatch && (
            <FinancialLedgerRow label="Safe Target:" value={targetMatch[1].trim()} isHighlight />
          )}
          {daysMatch && (
            <FinancialLedgerRow label="Days Left in Month" value={daysMatch[1].trim()} />
          )}
          {poolMatch && (
            <FinancialLedgerRow label="Remaining Pool" value={poolMatch[1].trim()} />
          )}
          {todayMatch && (
            <FinancialLedgerRow label="Spent Today" value={todayMatch[1].trim()} />
          )}
        </div>
      </div>
    );
  }

  // 4. SMART RECEIPT SCANNED CARD
  if (text.includes('Receipt Scanned Successfully!')) {
    const amtMatch = text.match(/Amount:\s*([^\n]+)/i);
    const catMatch = text.match(/Category:\s*([^\n]+)/i);
    const venMatch = text.match(/Vendor:\s*([^\n]+)/i);
    const modeMatch = text.match(/Mode:\s*([^\n]+)/i);

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-white/[0.06]">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Receipt size={13} />
            </div>
            <span className="font-bold text-[13px] tracking-tight text-slate-900 dark:text-white">
              Receipt Scanned Successfully!
            </span>
          </div>
          <span className="text-[9.5px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-500/20 whitespace-nowrap flex-shrink-0 ml-2">
            On-Device OCR
          </span>
        </div>

        <div className="bg-slate-50/80 dark:bg-[#120F24] rounded-xl p-2.5 px-3 border border-slate-200/60 dark:border-white/[0.05]">
          {amtMatch && (
            <FinancialLedgerRow label="Amount" value={amtMatch[1].trim()} isHighlight />
          )}
          {venMatch && (
            <FinancialLedgerRow label="Vendor" value={venMatch[1].trim()} />
          )}
          {catMatch && (
            <FinancialLedgerRow label="Category" value={catMatch[1].trim()} />
          )}
          {modeMatch && (
            <FinancialLedgerRow label="Payment Mode" value={modeMatch[1].trim()} />
          )}
        </div>
      </div>
    );
  }

  // 5. EDITORIAL TYPOGRAPHY FORMATTER (Clean lines, zero clutter)
  const lines = text.split('\n');

  return lines.map((line, lIdx) => {
    // If divider line like ━━━━━━
    if (/^[━─—–=-]{5,}$/.test(line.trim())) {
      return <div key={lIdx} className="my-2 h-[1px] bg-slate-200/60 dark:bg-white/[0.06]" />;
    }

    // Parse inline bold *text* and `code`
    const parts = [];
    let key = 0;
    const regex = /(\*([^*]+)\*)|(`([^`]+)`)/g;
    let match;
    let lastIndex = 0;

    while ((match = regex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        parts.push(<span key={key++}>{line.substring(lastIndex, match.index)}</span>);
      }
      if (match[1]) {
        // *bold*
        parts.push(
          <strong key={key++} className="font-bold text-slate-900 dark:text-white">
            {match[2]}
          </strong>
        );
      } else if (match[3]) {
        // `code`
        parts.push(
          <code key={key++} className="px-1.5 py-0.5 rounded-md bg-purple-50 dark:bg-[#1D1936] text-[#6C47FF] dark:text-[#C084FC] font-mono text-[11px] border border-purple-200/60 dark:border-purple-500/20">
            {match[4]}
          </code>
        );
      }
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < line.length) {
      parts.push(<span key={key++}>{line.substring(lastIndex)}</span>);
    }

    const trimmed = line.trim();
    const isTitle = trimmed.startsWith('*') && trimmed.endsWith('*') && trimmed.length < 50;

    if (isTitle) {
      return (
        <div key={lIdx} className="font-bold text-[13.5px] text-[#6C47FF] dark:text-[#C084FC] pt-1 pb-0.5">
          {parts}
        </div>
      );
    }

    return (
      <div key={lIdx} className="min-h-[18px] text-[12.5px] text-slate-700 dark:text-zinc-300 leading-relaxed">
        {parts.length > 0 ? parts : <span>&nbsp;</span>}
      </div>
    );
  });
}

export default function WhatsAppChatboxModal({
  isOpen,
  onClose,
  onSaveExpense,
  onDeleteExpense,
  dashboardData,
  recentTransactions = [],
  formatCurrency = (v) => `₹${Number(v || 0).toLocaleString('en-IN')}`,
  categories = []
}) {
  const { showToast } = useToast();
  const [messages, setMessages] = useState(() => {
    try {
      const stored = localStorage.getItem(CHAT_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) { }

    return [
      {
        id: 'msg_welcome_1',
        sender: 'bot',
        text: '*PocketNook Copilot Active*\n\nYour private, on-device financial intelligence engine. All accounts and cards stay strictly local with zero cloud data leakage.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      },
      {
        id: 'msg_welcome_2',
        sender: 'bot',
        text: '*Instant Financial Intelligence:*\n• `Can I afford a 3500 dinner?`\n• `Where is my money going?`\n• `Split 2400 between 6 people`\n• `50 chai, 120 lunch, 40 auto`\n• `What is my safe daily pace?`\n• `Chai 20` or paste any bank SMS alert\n• `Undo` to remove last expense',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ];
  });

  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isAnimating, setIsAnimating] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const speechRecognitionRef = useRef(null);

  // Smooth entrance & exit animation state coordinator
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      const raf = requestAnimationFrame(() => {
        setIsAnimating(true);
      });
      return () => cancelAnimationFrame(raf);
    } else {
      setIsAnimating(false);
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    try {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
    } catch (e) { }
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, messages, isTyping]);

  // Speech Recognition Hook
  useEffect(() => {
    const SpeechRecognition = typeof window !== 'undefined' &&
      (window.SpeechRecognition || window.webkitSpeechRecognition);

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-IN';

        recognition.onresult = (event) => {
          const transcript = event.results[0]?.[0]?.transcript || '';
          if (transcript) {
            setInputText(transcript);
            handleSendMessage(transcript);
          }
          setIsListening(false);
        };

        recognition.onerror = (e) => {
          console.warn('Speech recognition error:', e);
          setIsListening(false);
          showToast('Voice input unavailable or permission denied', 'info');
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        speechRecognitionRef.current = recognition;
      } catch (err) {
        console.warn('SpeechRecognition init error:', err);
      }
    }
  }, []);

  const toggleVoiceListening = () => {
    if (!speechRecognitionRef.current) {
      showToast('Speech recognition not supported in this browser. Please type your message.', 'info');
      return;
    }

    if (isListening) {
      speechRecognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        speechRecognitionRef.current.start();
        setIsListening(true);
        showToast('Listening... Speak your expense (e.g. Chai 20 rupees)', 'info');
      } catch (err) {
        console.warn('Start listening error:', err);
        setIsListening(false);
      }
    }
  };

  const handleReceiptUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const attachMsg = {
      id: `msg_att_${Date.now()}`,
      sender: 'user',
      text: `[Attached Receipt: ${file.name}]`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, attachMsg]);
    setIsTyping(true);

    try {
      const result = await processReceiptFile(file);
      const formattedAmount = formatCurrency(result.amount);
      const replyText =
        `*Receipt Scanned Successfully!*\n` +
        `*Amount:* ${formattedAmount}\n` +
        `*Category:* ${result.category}\n` +
        `*Vendor:* ${result.vendor}\n` +
        `*Mode:* ${result.paymentMethod || 'UPI'}\n` +
        `*Date:* ${result.date}`;

      const botMsg = {
        id: `msg_bot_${Date.now()}`,
        sender: 'bot',
        text: replyText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actionButtons: [
          {
            label: `Confirm & Log (${formattedAmount})`,
            query: `${result.vendor} ${result.amount} ${result.paymentMethod || 'upi'}`
          },
          { label: 'Check Budget', query: 'Summary' }
        ]
      };

      setMessages((prev) => [...prev, botMsg]);
      showToast(`Scanned ${result.vendor} (${formattedAmount})!`, 'success');
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg_bot_${Date.now()}`,
          sender: 'bot',
          text: `Could not read receipt clearly. Please try typing the amount directly (e.g. \`D-Mart 450\`).`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsTyping(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (!shouldRender) return null;

  const handleSendMessage = async (textToSend) => {
    const raw = (textToSend || inputText || '').trim();
    if (!raw) return;

    const userMsg = {
      id: `msg_${Date.now()}`,
      sender: 'user',
      text: raw,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    setTimeout(async () => {
      try {
        const result = await processAssistantMessage(raw, {
          dashboardData,
          recentTransactions,
          formatCurrency,
          onSaveExpense,
          onDeleteExpense
        });

        const botMsg = {
          id: `msg_bot_${Date.now()}`,
          sender: 'bot',
          text: result.replyText,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          type: result.type,
          data: result.data,
          actionButtons: result.actionButtons || null,
          suggestedChips: result.suggestedChips || null
        };

        setMessages((prev) => [...prev, botMsg]);

        if (result.type === 'expense_logged') {
          showToast(`Logged ₹${result.parsed?.amount} via Copilot!`, 'success');
        } else if (result.type === 'batch_logged') {
          showToast(`Logged ${result.count} expenses successfully!`, 'success');
        } else if (result.type === 'undo_success') {
          showToast('Transaction undone and removed!', 'info');
        }
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
    }, 300);
  };

  const handleClearChat = () => {
    localStorage.removeItem(CHAT_STORAGE_KEY);
    setMessages([
      {
        id: `msg_fresh_${Date.now()}`,
        sender: 'bot',
        text: '*Chat history cleared!*\n\nAsk any financial question like `Can I afford 3500?`, `Chai 20`, or `Summary` to begin.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
    showToast('Chat history cleared', 'info');
  };

  const QUICK_PROMPTS = [
    { id: 'summary', label: 'Summary', text: 'Summary' },
    { id: 'daily-pace', label: 'Daily Pace', text: 'Daily Pace' },
    { id: 'rule-503020', label: '50/30/20 Rule', text: 'Explain 50/30/20 rule for my budget' },
    { id: 'emergency-fund', label: 'Emergency Fund', text: 'How much emergency fund do I need?' },
    { id: 'debt-payoff', label: 'Pay Off Debt', text: 'How should I pay off debt?' },
    { id: 'food-spend', label: 'Food Spend', text: 'Food Spend' },
    { id: 'split-bill', label: 'Split Bill', text: 'Split 2400 between 6 people' },
    { id: 'saving-tips', label: 'Saving Tips', text: 'Saving Tips' },
    { id: 'last-5', label: 'Last 5', text: 'Recent expenses' },
    { id: 'undo-last', label: 'Undo Last', text: 'Undo' }
  ];

  // Live financial snapshot stats
  const remaining = Number(dashboardData?.remaining_budget || 0);
  const today = Number(dashboardData?.today_spent || 0);
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = Math.max(1, daysInMonth - now.getDate());
  const safePace = remaining > 0 ? Math.round(remaining / daysLeft) : 0;
  const isDeficit = remaining < 0;

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center bg-slate-950/70 dark:bg-black/75 backdrop-blur-md transition-opacity duration-250 ease-out ${
        isAnimating ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      data-testid="whatsapp-chatbox-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      {/* Hidden receipt file picker (disabled for now) */}
      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        onChange={handleReceiptUpload}
        disabled
        className="hidden"
      />

      {/* Signature PocketNook Mobile Bottom Sheet Drawer (Reduced height so page behind is visible) */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full sm:max-w-lg h-[82dvh] sm:h-[80vh] sm:max-h-[720px] bg-[#f4f5fa] dark:bg-[#0d0b18] text-slate-900 dark:text-[#f8fafc] rounded-t-[32px] sm:rounded-[36px] overflow-hidden shadow-[0_-16px_50px_rgba(0,0,0,0.4)] dark:shadow-[0_-20px_60px_rgba(0,0,0,0.8)] flex flex-col border-t sm:border border-slate-200/80 dark:border-white/10 transition-transform duration-250 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isAnimating
            ? 'translate-y-0 sm:scale-100'
            : 'translate-y-full sm:translate-y-8 sm:scale-95'
        }`}
      >

        {/* Mobile Pull Handle Indicator */}
        <div
          onClick={onClose}
          className="sm:hidden flex items-center justify-center pt-3 pb-1.5 bg-white dark:bg-[#16132A] cursor-pointer active:opacity-60 transition-opacity"
          title="Tap to dismiss"
        >
          <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-white/25 hover:bg-slate-400 dark:hover:bg-white/40 transition-colors" />
        </div>

        {/* ========================================================
            PocketNook Executive Header (Royal Purple & Cosmic Night)
           ======================================================== */}
        <div className="bg-white dark:bg-[#16132A] px-4 py-3 flex items-center justify-between border-b border-slate-200/80 dark:border-white/10 shadow-xs relative z-20">
          <div className="flex items-center gap-3 min-w-0">
            {/* Back / Dismiss Touch Target */}
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-zinc-200 hover:bg-slate-200 dark:hover:bg-white/[0.1] active:scale-95 border border-slate-200/60 dark:border-white/[0.08] flex items-center justify-center transition-all cursor-pointer flex-shrink-0"
              aria-label="Back"
            >
              <ArrowLeft size={18} />
            </button>

            {/* Refined PocketNook AI Emblem */}
            <div className="relative flex-shrink-0">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#5B27DC] to-[#7B42F6] flex items-center justify-center shadow-md shadow-purple-600/30 p-[1.5px]">
                <Sparkles size={18} className="text-white" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-[#16132A] rounded-full shadow-xs" />
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-[15px] sm:text-base tracking-tight text-slate-900 dark:text-white leading-tight">
                PocketNook Assistant
              </h3>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-[9.5px] font-bold tracking-wider px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-900/30 text-[#6C47FF] dark:text-[#C084FC] border border-purple-200/80 dark:border-purple-500/25 flex-shrink-0">
                  Zero-Leakage AI
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-none">
                  {isListening ? (
                    <span className="text-amber-500 dark:text-amber-300 font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping inline-block" />
                      Listening to voice...
                    </span>
                  ) : isTyping ? (
                    <span className="text-[#6C47FF] dark:text-[#A78BFA] italic">analyzing finances...</span>
                  ) : (
                    <span>online • auto-expense logger</span>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Action Icons */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={handleClearChat}
              data-testid="copilot-clear-chat-btn"
              title="Clear Chat History"
              aria-label="Clear Chat History"
              className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 dark:hover:bg-white/[0.1] active:scale-95 border border-slate-200/60 dark:border-white/[0.06] flex items-center justify-center text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer"
            >
              <Trash2 size={15} />
            </button>
            <button
              onClick={onClose}
              title="Close"
              className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 dark:hover:bg-white/[0.1] active:scale-95 border border-slate-200/60 dark:border-white/[0.06] flex items-center justify-center text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ========================================================
            PocketNook Executive Telemetry Card (HUD)
           ======================================================== */}
        <div className="px-4 py-2 bg-[#f4f5fa] dark:bg-[#0d0b18] select-none z-10">
          <div className="bg-white/95 dark:bg-[#16132A]/95 backdrop-blur-md border border-slate-200/80 dark:border-white/[0.08] rounded-2xl p-2.5 px-4 flex items-center justify-between shadow-2xs">
            <div className="flex-1 text-center border-r border-slate-200/70 dark:border-white/[0.06] pr-2">
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-400 block mb-0.5">
                Remaining
              </span>
              <span className={`font-mono tabular-nums font-bold text-[13.5px] tracking-tight ${isDeficit ? 'text-rose-600 dark:text-rose-400' : 'text-[#6C47FF] dark:text-[#A78BFA]'}`}>
                {formatCurrency(remaining)}
              </span>
            </div>
            <div className="flex-1 text-center border-r border-slate-200/70 dark:border-white/[0.06] px-2">
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-400 block mb-0.5">
                Safe Pace
              </span>
              <span className="font-mono tabular-nums font-bold text-[13.5px] text-slate-900 dark:text-zinc-100 tracking-tight">
                {formatCurrency(safePace)}
                <span className="text-[9px] font-normal text-slate-400 dark:text-zinc-500 ml-0.5">/d</span>
              </span>
            </div>
            <div className="flex-1 text-center pl-2">
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-400 block mb-0.5">
                Today
              </span>
              <span className="font-mono tabular-nums font-bold text-[13.5px] text-slate-900 dark:text-zinc-100 tracking-tight">
                {formatCurrency(today)}
              </span>
            </div>
          </div>
        </div>

        {/* ========================================================
            Conversation Canvas
           ======================================================== */}
        <div
          className="flex-1 overflow-y-auto px-4 py-2 space-y-3.5 bg-[#f4f5fa] dark:bg-[#0d0b18] scrollbar-none"
          data-testid="whatsapp-messages-container"
        >
          {/* Zero-Leakage Privacy Pill */}
          <div className="mx-auto max-w-sm text-center py-1.5 px-3.5 rounded-full bg-slate-100/90 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.06] text-[10.5px] text-slate-600 dark:text-zinc-400 font-medium shadow-2xs flex items-center justify-center gap-1.5 select-none">
            <ShieldCheck size={13} className="text-[#6C47FF] dark:text-[#C084FC] flex-shrink-0" />
            <span>Bank-Grade Zero Leakage • Client-Side Encrypted</span>
          </div>

          {messages.map((msg) => {
            const isUser = msg.sender === 'user';

            return (
              <div
                key={msg.id}
                className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}
              >
                <div
                  className={`max-w-[90%] sm:max-w-[84%] rounded-2xl px-4 py-3 shadow-xs relative text-[13px] leading-relaxed transition-all ${
                    isUser
                      ? 'bg-gradient-to-r from-[#5B27DC] to-[#7B42F6] text-white font-medium rounded-tr-xs shadow-purple-600/20 whitespace-pre-wrap'
                      : 'bg-white dark:bg-[#16132A] text-slate-800 dark:text-zinc-100 rounded-tl-xs border border-slate-200/80 dark:border-white/[0.08] shadow-2xs'
                  }`}
                  data-testid={`whatsapp-bubble-${msg.sender}`}
                >
                  {/* Clean Formatted Message Stream */}
                  <div className="space-y-0.5">
                    {isUser ? msg.text : formatBotMessage(msg.text)}
                  </div>

                  {/* Contextual Action Buttons */}
                  {msg.actionButtons && msg.actionButtons.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-white/[0.06] flex flex-wrap gap-2">
                      {msg.actionButtons.map((btn, bIdx) => (
                        <button
                          key={bIdx}
                          type="button"
                          onClick={() => handleSendMessage(btn.query)}
                          className="py-2 px-3 rounded-xl bg-slate-100 dark:bg-white/[0.06] hover:bg-purple-50 dark:hover:bg-purple-900/30 text-[#6C47FF] dark:text-[#C084FC] hover:border-purple-300 dark:hover:border-purple-500/30 font-semibold text-[11.5px] border border-slate-200/80 dark:border-white/[0.08] flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer flex-1 min-w-[120px]"
                        >
                          <span>{btn.label}</span>
                          <ArrowUpRight size={12} className="opacity-70" />
                        </button>
                      ))}
                    </div>
                  )}

                  <div className={`flex items-center justify-end gap-1 text-[9.5px] mt-2 select-none font-medium ${
                    isUser ? 'text-purple-200' : 'text-slate-400 dark:text-zinc-500'
                  }`}>
                    <span>{msg.time}</span>
                    {isUser && (
                      <CheckCheck size={13} className="text-purple-200 ml-0.5" />
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex justify-start animate-fade-in">
              <div className="rounded-2xl rounded-tl-xs px-4 py-2.5 bg-white dark:bg-[#16132A] border border-slate-200/80 dark:border-white/[0.08] shadow-2xs flex items-center gap-1.5 w-fit">
                <span className="w-1.5 h-1.5 rounded-full bg-[#6C47FF] dark:bg-[#A78BFA] animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-[#6C47FF] dark:bg-[#A78BFA] animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-[#6C47FF] dark:bg-[#A78BFA] animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ========================================================
            PocketNook Prompt Chips Carousel
           ======================================================== */}
        <div className="bg-white/95 dark:bg-[#16132A]/95 backdrop-blur-md px-3.5 py-2 flex items-center gap-2 overflow-x-auto scrollbar-none border-t border-slate-200/70 dark:border-white/[0.06]">
          <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-400 flex-shrink-0 select-none mr-0.5">
            <Sparkles size={11} className="text-[#6C47FF] dark:text-[#A78BFA]" />
            <span>Prompt:</span>
          </div>
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => handleSendMessage(p.text)}
              data-testid={`whatsapp-quick-prompt-${p.id}`}
              className="px-3 py-1.5 rounded-full bg-slate-100 dark:bg-white/[0.06] hover:bg-purple-50 dark:hover:bg-purple-900/30 text-[11.5px] font-semibold text-slate-700 dark:text-zinc-200 hover:text-[#6C47FF] dark:hover:text-[#C084FC] border border-slate-200/80 dark:border-white/[0.08] shadow-2xs flex-shrink-0 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* ========================================================
            PocketNook Ergonomic Mobile Composer
           ======================================================== */}
        <div className="bg-white dark:bg-[#16132A] p-3 border-t border-slate-200/70 dark:border-white/[0.08] relative z-20">
          <div className="bg-[#f0f2f7] dark:bg-[#120F24] border border-slate-200/80 dark:border-white/[0.08] rounded-[22px] p-1.5 pl-3 flex items-center gap-2 focus-within:border-[#6C47FF]/60 focus-within:ring-2 focus-within:ring-[#6C47FF]/20 transition-all shadow-2xs">
            {/* Attachment option disabled for now (will work on next) */}
            <button
              type="button"
              disabled
              title="Receipt attachment disabled (will work on next)"
              data-testid="whatsapp-paperclip-btn"
              className="w-8 h-8 rounded-full bg-slate-100/60 dark:bg-white/[0.03] text-slate-300 dark:text-zinc-600 flex items-center justify-center cursor-not-allowed opacity-35 border border-slate-200/40 dark:border-white/[0.04] flex-shrink-0"
              aria-label="Attachment option disabled"
            >
              <Paperclip size={16} />
            </button>

            {/* Inset Text Field */}
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
              placeholder={isListening ? "Listening... speak now!" : "Ask anything or type expense..."}
              className="flex-1 bg-transparent text-[13.5px] font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
            />

            {/* Voice Dictation Mic */}
            <button
              type="button"
              onClick={toggleVoiceListening}
              title={isListening ? "Stop listening" : "Speak your message"}
              data-testid="whatsapp-voice-mic-btn"
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer flex-shrink-0 ${
                isListening
                  ? 'bg-rose-500 text-white shadow-md shadow-rose-500/40 ring-2 ring-rose-400 animate-pulse'
                  : 'bg-white dark:bg-[#16132A] text-slate-400 hover:text-[#6C47FF] dark:hover:text-[#A78BFA] active:scale-90 border border-slate-200/60 dark:border-white/[0.06] shadow-2xs'
              }`}
              aria-label="Voice input"
            >
              <Mic size={16} className={isListening ? 'animate-bounce' : ''} />
            </button>

            {/* Send Pill in PocketNook Violet */}
            <button
              type="button"
              onClick={() => handleSendMessage()}
              disabled={!inputText.trim() || isTyping}
              data-testid="whatsapp-chat-send-btn"
              className="w-8 h-8 rounded-full bg-gradient-to-r from-[#5B27DC] to-[#7B42F6] hover:from-[#4E1FC5] hover:to-[#6E32E9] text-white shadow-md shadow-purple-500/25 flex items-center justify-center transition-all cursor-pointer active:scale-90 disabled:opacity-25 disabled:cursor-not-allowed disabled:shadow-none flex-shrink-0"
              aria-label="Send"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
