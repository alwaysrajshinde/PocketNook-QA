import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Send, CheckCheck, Mic, Paperclip, MoreVertical, Sparkles, 
  Trash2, ArrowLeft, Bot, RefreshCw, Zap, ShieldCheck
} from 'lucide-react';
import { parseSmsNotification } from '../services/smsParserService';
import { useToast } from '../context/ToastContext';

const CHAT_STORAGE_KEY = 'expense_tracker_whatsapp_chat';

export default function WhatsAppChatboxModal({
  isOpen,
  onClose,
  onSaveExpense,
  dashboardData,
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
    } catch (e) {}

    // Default welcome messages from PocketNook WhatsApp bot
    return [
      {
        id: 'msg_welcome_1',
        sender: 'bot',
        text: '👋 *Welcome to PocketNook WhatsApp Assistant!*\n\nI can automatically log your expenses from normal chat messages or pasted bank SMS alerts. Zero manual typing required!',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      },
      {
        id: 'msg_welcome_2',
        sender: 'bot',
        text: '💡 *Try sending any of these:*\n• `Chai 20`\n• `Lunch 150 card`\n• `Uber 340 upi`\n• `Petrol 500 cash`\n• `Paid 450 at Starbucks`\n• `Summary` (to check your budget)\n\nOr paste your bank SMS debit notification!',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ];
  });

  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
    } catch (e) {}
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, messages, isTyping]);

  if (!isOpen) return null;

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

    // Process message with SMS / NLP parser
    setTimeout(async () => {
      try {
        const lower = raw.toLowerCase().trim();

        // 1. Budget Summary query
        if (lower === 'summary' || lower === 'balance' || lower.includes('budget') || lower.includes('how much')) {
          const totalSpent = dashboardData?.total_spent || 0;
          const budget = dashboardData?.budget || 0;
          const remaining = dashboardData?.remaining_budget || 0;
          const todaySpent = dashboardData?.today_spent || 0;

          const replyText = `📊 *Monthly Budget Summary*\n━━━━━━━━━━━━━━━━━━━━\n` +
            `💰 *Spent This Month:* ${formatCurrency(totalSpent)}\n` +
            `🎯 *Monthly Budget:* ${formatCurrency(budget)}\n` +
            `⚖️ *Remaining Balance:* ${formatCurrency(remaining)}\n` +
            `📅 *Spent Today:* ${formatCurrency(todaySpent)}\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            (remaining < 0 ? `⚠️ *Notice:* You have exceeded your monthly budget!` : `✨ *Status:* Within safe budget limits.`);

          setMessages((prev) => [
            ...prev,
            {
              id: `msg_bot_${Date.now()}`,
              sender: 'bot',
              text: replyText,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
          ]);
          setIsTyping(false);
          return;
        }

        // 2. Parse expense using smart NLP / SMS parser
        const parsed = parseSmsNotification(raw);
        if (parsed.success && parsed.amount > 0) {
          // Log expense to backend
          await onSaveExpense({
            amount: parsed.amount,
            description: parsed.merchant,
            category: parsed.category,
            payment_mode: parsed.paymentMode,
            date: parsed.date,
            is_refund: parsed.type === 'income'
          });

          const currentTotal = (dashboardData?.total_spent || 0) + (parsed.type === 'income' ? -parsed.amount : parsed.amount);
          const replyText = parsed.type === 'income'
            ? `🎉 *Income / Refund Logged!*\n━━━━━━━━━━━━━━━━━━━━\n` +
              `💵 *Amount:* +${formatCurrency(parsed.amount)}\n` +
              `📝 *Source:* ${parsed.merchant}\n` +
              `💳 *Mode:* ${parsed.paymentMode}\n` +
              `📅 *Date:* ${parsed.date}\n` +
              `━━━━━━━━━━━━━━━━━━━━\n` +
              `💰 Updated Monthly Spent: ${formatCurrency(currentTotal)}`
            : `✅ *Expense Logged Successfully!*\n━━━━━━━━━━━━━━━━━━━━\n` +
              `💰 *Amount:* ${formatCurrency(parsed.amount)}\n` +
              `🏷️ *Category:* ${parsed.category}\n` +
              `📝 *Merchant:* ${parsed.merchant}\n` +
              `💳 *Mode:* ${parsed.paymentMode}\n` +
              `📅 *Date:* ${parsed.date}\n` +
              `━━━━━━━━━━━━━━━━━━━━\n` +
              `📊 Updated Monthly Spent: ${formatCurrency(currentTotal)}`;

          setMessages((prev) => [
            ...prev,
            {
              id: `msg_bot_${Date.now()}`,
              sender: 'bot',
              text: replyText,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              isExpenseLogged: true,
              amount: parsed.amount
            }
          ]);
          showToast(`Logged ₹${parsed.amount} via WhatsApp assistant!`, 'success');
        } else {
          // Unrecognized phrase
          const helpText = `🤔 I couldn't detect an amount in: _"${raw}"_\n\n` +
            `*Quick tips:*\n` +
            `• Enter *item + amount*, e.g., \`Chai 20\` or \`Lunch 150\`\n` +
            `• Specify mode if you want, e.g., \`Uber 350 upi\`\n` +
            `• Or paste a complete bank SMS!`;

          setMessages((prev) => [
            ...prev,
            {
              id: `msg_bot_${Date.now()}`,
              sender: 'bot',
              text: helpText,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
          ]);
        }
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            id: `msg_bot_${Date.now()}`,
            sender: 'bot',
            text: `❌ Error logging expense: ${err.message || 'Please try again'}`,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      } finally {
        setIsTyping(false);
      }
    }, 450);
  };

  const handleClearChat = () => {
    localStorage.removeItem(CHAT_STORAGE_KEY);
    setMessages([
      {
        id: `msg_fresh_${Date.now()}`,
        sender: 'bot',
        text: '🧹 *Chat history cleared!*\n\nSend any expense like `Chai 20` or `Summary` to begin.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
    showToast('Chat history cleared', 'info');
  };

  const QUICK_PROMPTS = [
    { label: '☕ Chai 20', text: 'Chai 20' },
    { label: '🍛 Lunch 120', text: 'Lunch 120 upi' },
    { label: '🛺 Auto 50', text: 'Auto 50 cash' },
    { label: '⛽ Petrol 200', text: 'Petrol 200' },
    { label: '📊 Summary', text: 'Summary' }
  ];

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-xs animate-fade-in"
      data-testid="whatsapp-chatbox-modal"
    >
      {/* Modal Container with Authentic WhatsApp Phone / Web Style */}
      <div className="relative w-full max-w-lg h-[92vh] max-h-[720px] bg-[#EFEAE2] dark:bg-[#0b141a] rounded-3xl overflow-hidden shadow-2xl flex flex-col border border-emerald-900/20 dark:border-white/10 animate-scale-in">
        
        {/* ========================================================
            WhatsApp Header (Green #008069 / Dark #202c33)
           ======================================================== */}
        <div className="bg-[#008069] dark:bg-[#202c33] text-white px-4 py-3 flex items-center justify-between shadow-md z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-1 rounded-full hover:bg-white/10 transition-colors cursor-pointer text-white"
              aria-label="Back"
            >
              <ArrowLeft size={20} />
            </button>

            {/* Avatar & Online status */}
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-emerald-700 dark:bg-emerald-800 text-white flex items-center justify-center font-bold text-lg border border-white/20">
                🤖
              </div>
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-[#008069] dark:border-[#202c33] rounded-full" />
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-bold text-sm sm:text-base leading-tight">
                  PocketNook Assistant
                </h3>
                <span className="text-[10px] font-bold px-1.5 py-0.2 bg-white/20 rounded-full">
                  Bot
                </span>
              </div>
              <p className="text-[11px] text-emerald-100/90 dark:text-emerald-400/90 flex items-center gap-1">
                {isTyping ? (
                  <span className="italic animate-pulse">typing...</span>
                ) : (
                  <span>online • auto-expense logger</span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleClearChat}
              title="Clear chat"
              className="p-2 rounded-full hover:bg-white/10 transition-colors cursor-pointer text-white/90 hover:text-white"
            >
              <Trash2 size={17} />
            </button>
            <button
              onClick={onClose}
              title="Close"
              className="p-2 rounded-full hover:bg-white/10 transition-colors cursor-pointer text-white/90 hover:text-white"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* ========================================================
            WhatsApp Chat Wall / Messages Area
           ======================================================== */}
        <div 
          className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#E5DDD5] dark:bg-[#0b141a] bg-opacity-95"
          style={{
            backgroundImage: `radial-gradient(circle at 50% 50%, rgba(0,0,0,0.02) 1px, transparent 1px)`,
            backgroundSize: '16px 16px'
          }}
          data-testid="whatsapp-messages-container"
        >
          {/* Encryption notice banner */}
          <div className="mx-auto max-w-xs text-center py-1.5 px-3 rounded-lg bg-[#FFF2A5]/70 dark:bg-[#182229] border border-amber-200/50 dark:border-white/5 text-[10.5px] text-slate-700 dark:text-amber-200/80 font-medium shadow-xs">
            🔒 Messages parsed on-device locally. Zero financial data shared with third-party servers.
          </div>

          {messages.map((msg) => {
            const isUser = msg.sender === 'user';

            return (
              <div
                key={msg.id}
                className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}
              >
                <div
                  className={`max-w-[85%] sm:max-w-[78%] rounded-2xl px-3.5 py-2.5 shadow-xs relative text-xs leading-relaxed whitespace-pre-wrap ${
                    isUser
                      ? 'bg-[#E7FFDB] dark:bg-[#005c4b] text-slate-900 dark:text-white rounded-tr-none'
                      : 'bg-white dark:bg-[#202c33] text-slate-900 dark:text-slate-100 rounded-tl-none border border-black/5 dark:border-white/5'
                  }`}
                  data-testid={`whatsapp-bubble-${msg.sender}`}
                >
                  <div>{msg.text}</div>

                  <div className={`flex items-center justify-end gap-1 text-[9.5px] mt-1 select-none ${
                    isUser ? 'text-slate-500 dark:text-emerald-200/70' : 'text-slate-400 dark:text-slate-400'
                  }`}>
                    <span>{msg.time}</span>
                    {isUser && (
                      <CheckCheck size={13} className="text-[#53bdeb] ml-0.5" />
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Typing Indicator Bubble */}
          {isTyping && (
            <div className="flex justify-start animate-fade-in">
              <div className="bg-white dark:bg-[#202c33] text-slate-500 rounded-2xl rounded-tl-none px-4 py-2.5 shadow-xs border border-black/5 dark:border-white/5 flex items-center gap-1.5 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ========================================================
            Quick Suggestions Pill Strip
           ======================================================== */}
        <div className="bg-[#F0F2F5] dark:bg-[#111b21] px-3 py-1.5 flex items-center gap-1.5 overflow-x-auto scrollbar-none border-t border-slate-200/60 dark:border-white/5">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex-shrink-0 mr-1">
            Try:
          </span>
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => handleSendMessage(p.text)}
              data-testid={`whatsapp-quick-prompt-${p.text.toLowerCase().replace(/\s+/g, '-')}`}
              className="px-2.5 py-1 rounded-full bg-white dark:bg-[#202c33] hover:bg-emerald-50 dark:hover:bg-[#005c4b]/30 text-[11px] font-semibold text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-white/10 shadow-xs flex-shrink-0 transition-colors cursor-pointer"
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* ========================================================
            WhatsApp Bottom Input Bar
           ======================================================== */}
        <div className="bg-[#F0F2F5] dark:bg-[#202c33] p-2.5 flex items-center gap-2">
          <div className="flex-1 bg-white dark:bg-[#2a3942] rounded-full px-4 py-2 flex items-center gap-2 shadow-xs border border-slate-200/50 dark:border-transparent">
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
              placeholder="Type an expense (e.g. Chai 20) or paste bank SMS..."
              className="w-full bg-transparent text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
            />
          </div>

          {/* Send or Mic button */}
          <button
            type="button"
            onClick={() => handleSendMessage()}
            disabled={!inputText.trim() || isTyping}
            data-testid="whatsapp-chat-send-btn"
            className="w-10 h-10 rounded-full bg-[#008069] hover:bg-[#00705c] dark:bg-[#00a884] dark:hover:bg-[#008f70] text-white flex items-center justify-center shadow-md transition-transform active:scale-90 disabled:opacity-50 cursor-pointer"
            aria-label="Send"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
