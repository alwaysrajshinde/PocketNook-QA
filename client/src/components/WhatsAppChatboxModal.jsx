import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Send, CheckCheck, Mic, Paperclip, Sparkles, 
  Trash2, ArrowLeft, Bot, ShieldCheck, Undo2,
  PieChart, Users, Camera, Zap, ChevronDown
} from 'lucide-react';
import { processAssistantMessage } from '../services/aiAssistantService';
import { processReceiptFile } from '../services/receiptScannerService';
import { useToast } from '../context/ToastContext';

const CHAT_STORAGE_KEY = 'expense_tracker_whatsapp_chat';

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
    } catch (e) {}

    // Default welcome messages from PocketNook WhatsApp Copilot
    return [
      {
        id: 'msg_welcome_1',
        sender: 'bot',
        text: '👋 *Welcome to PocketNook AI Copilot!*\n\nI am your private, on-device financial assistant. Your banking data is scrubbed with zero leakage before reasoning.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      },
      {
        id: 'msg_welcome_2',
        sender: 'bot',
        text: '💡 *Ask me anything:*\n• `Can I afford a 3000 dinner?`\n• `Where is my money going?`\n• `Split 2400 between 6 people`\n• `50 chai, 120 lunch, 40 auto`\n• `What is my safe daily pace?`\n• `Chai 20` or paste any bank SMS!\n• `Undo` (to delete last expense)\n\n📎 *Tip:* Tap the paperclip icon to scan any bill receipt photo instantly!',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ];
  });

  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const speechRecognitionRef = useRef(null);

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

  // Initialize Speech Recognition if supported
  useEffect(() => {
    const SpeechRecognition = typeof window !== 'undefined' && 
      (window.SpeechRecognition || window.webkitSpeechRecognition);

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-IN'; // Supports Indian English & Hinglish accent

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
        showToast('🎙️ Listening... Speak your expense (e.g. Chai 20 rupees)', 'info');
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
      text: `📷 [Attached Receipt: ${file.name}]`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, attachMsg]);
    setIsTyping(true);

    try {
      const result = await processReceiptFile(file);
      const formattedAmount = formatCurrency(result.amount);
      const replyText =
        `🧾 *Receipt Scanned Successfully!*\n━━━━━━━━━━━━━━━━━━━━\n` +
        `💰 *Amount:* ${formattedAmount}\n` +
        `🏷️ *Category:* ${result.category}\n` +
        `📝 *Vendor:* ${result.vendor}\n` +
        `💳 *Mode:* ${result.paymentMethod || 'UPI'}\n` +
        `📅 *Date:* ${result.date}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `✨ On-device OCR verified with ${result.confidence}% confidence.`;

      const botMsg = {
        id: `msg_bot_${Date.now()}`,
        sender: 'bot',
        text: replyText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actionButtons: [
          { 
            label: `✅ Confirm & Log (${formattedAmount})`, 
            query: `${result.vendor} ${result.amount} ${result.paymentMethod || 'upi'}` 
          },
          { label: '📊 Check Budget', query: 'Summary' }
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
          text: `❌ Could not read receipt clearly. Please try typing the amount directly (e.g. \`D-Mart 450\`).`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsTyping(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

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

    // Process message through AI Copilot
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
            text: `❌ Error processing request: ${err.message || 'Please try again'}`,
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
        text: '🧹 *Chat history cleared!*\n\nSend any question like `Can I afford 3000?`, `Chai 20`, or `Summary` to begin.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
    showToast('Chat history cleared', 'info');
  };

  const QUICK_PROMPTS = [
    { id: 'summary', label: '📊 Summary', text: 'Summary' },
    { id: 'daily-pace', label: '⚡ Daily Pace', text: 'Daily Pace' },
    { id: 'food-spend', label: '🍕 Food Spend', text: 'Food Spend' },
    { id: 'split-bill', label: '👥 Split Bill', text: 'Split 2400 between 6 people' },
    { id: 'saving-tips', label: '💡 Saving Tips', text: 'Saving Tips' },
    { id: 'last-5', label: '🕒 Last 5', text: 'Recent expenses' },
    { id: 'undo-last', label: '↩️ Undo Last', text: 'Undo' }
  ];

  // Live financial snapshot stats
  const remaining = Number(dashboardData?.remaining_budget || 0);
  const today = Number(dashboardData?.today_spent || 0);
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = Math.max(1, daysInMonth - now.getDate());
  const safePace = remaining > 0 ? Math.round(remaining / daysLeft) : 0;

  return (
    <div 
      className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center bg-slate-950/75 sm:p-4 backdrop-blur-md animate-fade-in"
      data-testid="whatsapp-chatbox-modal"
    >
      {/* Hidden receipt file picker */}
      <input 
        type="file" 
        accept="image/*" 
        ref={fileInputRef} 
        onChange={handleReceiptUpload} 
        className="hidden" 
      />

      {/* Premium Fintech Mobile Sheet Container */}
      <div className="relative w-full sm:max-w-md h-[100dvh] sm:h-[88vh] sm:max-h-[760px] bg-slate-50 dark:bg-[#0c131f] text-slate-900 dark:text-slate-100 rounded-t-[28px] sm:rounded-[32px] overflow-hidden shadow-2xl flex flex-col border-t sm:border border-slate-200/80 dark:border-white/10 transition-all">
        
        {/* Mobile Pull Handle Indicator */}
        <div className="sm:hidden flex items-center justify-center pt-2.5 pb-1 bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* ========================================================
            Executive Fintech App Bar (Dark Emerald Obsidian)
           ======================================================== */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950 text-white px-3.5 py-3 flex items-center justify-between border-b border-white/10 shadow-lg relative z-20">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 flex items-center justify-center transition-all cursor-pointer text-white flex-shrink-0"
              aria-label="Back"
            >
              <ArrowLeft size={18} />
            </button>

            {/* Glowing Gem Avatar */}
            <div className="relative flex-shrink-0">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-400 via-teal-500 to-indigo-600 p-[1.5px] shadow-lg shadow-emerald-500/25">
                <div className="w-full h-full rounded-[14px] bg-slate-950 flex items-center justify-center text-base">
                  🤖
                </div>
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 border-2 border-slate-900 rounded-full shadow-xs" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="font-extrabold text-sm sm:text-[14.5px] tracking-tight text-white leading-tight truncate">
                  PocketNook Assistant · AI Copilot
                </h3>
                <span className="text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  Zero-Leakage AI
                </span>
              </div>
              <p className="text-[11px] text-emerald-300/90 flex items-center gap-1.5 mt-0.5 font-medium leading-none">
                {isListening ? (
                  <span className="text-amber-300 font-semibold animate-pulse flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping inline-block" />
                    Listening to voice...
                  </span>
                ) : isTyping ? (
                  <span className="italic animate-pulse">analyzing finances...</span>
                ) : (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
                    <span>online • auto-expense logger</span>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Action Icons */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={handleClearChat}
              title="Clear chat"
              className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-all cursor-pointer"
            >
              <Trash2 size={15} />
            </button>
            <button
              onClick={onClose}
              title="Close"
              className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-all cursor-pointer"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* ========================================================
            Live Financial Telemetry HUD (3-Cell Micro-Metrics)
           ======================================================== */}
        <div className="grid grid-cols-3 divide-x divide-slate-200/60 dark:divide-white/10 bg-white/80 dark:bg-[#101826]/90 backdrop-blur-md border-b border-slate-200/80 dark:border-white/10 px-3 py-2 text-center text-xs shadow-xs z-10 select-none">
          <div className="px-1 flex flex-col justify-center">
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">
              Remaining
            </span>
            <span className="font-extrabold text-xs text-emerald-600 dark:text-emerald-400 tracking-tight">
              {formatCurrency(remaining)}
            </span>
          </div>
          <div className="px-1 flex flex-col justify-center">
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">
              Safe Pace
            </span>
            <span className="font-extrabold text-xs text-slate-800 dark:text-slate-200 tracking-tight">
              {formatCurrency(safePace)}
              <span className="text-[9px] font-medium text-slate-400">/d</span>
            </span>
          </div>
          <div className="px-1 flex flex-col justify-center">
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">
              Today
            </span>
            <span className="font-extrabold text-xs text-slate-800 dark:text-slate-200 tracking-tight">
              {formatCurrency(today)}
            </span>
          </div>
        </div>

        {/* ========================================================
            Fintech Conversation Wall / Messages Area
           ======================================================== */}
        <div 
          className="flex-1 overflow-y-auto px-3.5 py-4 space-y-3.5 bg-slate-100/70 dark:bg-[#0a0f18] scrollbar-none"
          style={{
            backgroundImage: `radial-gradient(circle at 50% 50%, rgba(16, 185, 129, 0.03) 1px, transparent 1px)`,
            backgroundSize: '20px 20px'
          }}
          data-testid="whatsapp-messages-container"
        >
          {/* Zero Leakage Privacy Shield Pill */}
          <div className="mx-auto max-w-xs text-center py-1.5 px-3 rounded-full bg-emerald-500/10 dark:bg-emerald-950/40 border border-emerald-500/20 text-[10px] text-emerald-700 dark:text-emerald-300 font-semibold shadow-xs flex items-center justify-center gap-1.5 select-none">
            <ShieldCheck size={13} className="text-emerald-500 flex-shrink-0" />
            <span>🔒 Bank-Grade Zero Leakage: Account &amp; card numbers scrubbed locally before reasoning.</span>
          </div>

          {messages.map((msg) => {
            const isUser = msg.sender === 'user';

            return (
              <div
                key={msg.id}
                className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}
              >
                <div
                  className={`max-w-[86%] sm:max-w-[80%] rounded-[22px] px-4 py-3 shadow-sm relative text-[12.5px] sm:text-[13px] leading-relaxed whitespace-pre-wrap transition-all ${
                    isUser
                      ? 'bg-gradient-to-br from-emerald-600 via-emerald-600 to-teal-700 text-white rounded-tr-xs shadow-md shadow-emerald-950/20 border border-emerald-400/20'
                      : 'bg-white dark:bg-[#131c2a] text-slate-800 dark:text-slate-100 rounded-tl-xs border border-slate-200/80 dark:border-white/10 shadow-slate-900/5'
                  }`}
                  data-testid={`whatsapp-bubble-${msg.sender}`}
                >
                  <div className="space-y-1">{msg.text}</div>

                  {/* Contextual Interactive Action Buttons */}
                  {msg.actionButtons && msg.actionButtons.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-slate-200/60 dark:border-white/10 flex flex-wrap gap-2">
                      {msg.actionButtons.map((btn, bIdx) => (
                        <button
                          key={bIdx}
                          type="button"
                          onClick={() => handleSendMessage(btn.query)}
                          className="py-2 px-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-700/20 flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer flex-1 min-w-[130px]"
                        >
                          <span>{btn.label}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className={`flex items-center justify-end gap-1 text-[9.5px] mt-1.5 select-none font-medium ${
                    isUser ? 'text-emerald-100/80' : 'text-slate-400 dark:text-slate-500'
                  }`}>
                    <span>{msg.time}</span>
                    {isUser && (
                      <CheckCheck size={13} className="text-cyan-200 ml-0.5" />
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex justify-start animate-fade-in">
              <div className="rounded-[20px] rounded-tl-xs px-4 py-2.5 bg-white dark:bg-[#131c2a] border border-slate-200/80 dark:border-white/10 shadow-xs flex items-center gap-1.5 w-fit">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ========================================================
            Quick Suggestions Pill Strip
           ======================================================== */}
        <div className="bg-white/90 dark:bg-[#0c131d]/90 backdrop-blur-md px-3 py-2 flex items-center gap-1.5 overflow-x-auto scrollbar-none border-t border-slate-200/70 dark:border-white/10">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-400 flex items-center gap-1 flex-shrink-0 mr-1 select-none">
            <Sparkles size={11} className="text-emerald-500" />
            Ask Copilot:
          </span>
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => handleSendMessage(p.text)}
              data-testid={`whatsapp-quick-prompt-${p.id}`}
              className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#162132] hover:bg-emerald-500/10 dark:hover:bg-emerald-500/20 text-xs font-semibold text-slate-700 dark:text-slate-200 border border-slate-200/70 dark:border-white/10 shadow-xs flex-shrink-0 active:scale-95 transition-all cursor-pointer"
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* ========================================================
            Integrated Mobile Composer Bar with Voice & OCR Camera
           ======================================================== */}
        <div className="bg-white/95 dark:bg-[#0c131d]/95 backdrop-blur-xl p-3 flex items-center gap-2 border-t border-slate-200/80 dark:border-white/10 relative z-20">
          {/* Attach receipt photo button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Scan Receipt Photo"
            data-testid="whatsapp-paperclip-btn"
            className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-[#162132] hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 dark:text-slate-300 hover:text-emerald-500 dark:hover:text-emerald-400 border border-slate-200/60 dark:border-white/10 flex items-center justify-center transition-all cursor-pointer active:scale-90 flex-shrink-0"
            aria-label="Attach receipt photo"
          >
            <Paperclip size={18} />
          </button>

          {/* Text Input Pill Enclosure */}
          <div className="flex-1 bg-slate-100/90 dark:bg-[#162132]/90 rounded-2xl px-4 py-2.5 border border-slate-200/80 dark:border-white/10 focus-within:border-emerald-500/60 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all shadow-inner flex items-center">
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
              placeholder={isListening ? "Listening... speak now!" : "Ask copilot, type expense, or tap mic..."}
              className="w-full bg-transparent text-[13px] text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
            />
          </div>

          {/* Voice Mic Button */}
          <button
            type="button"
            onClick={toggleVoiceListening}
            title={isListening ? "Stop listening" : "Speak your message"}
            data-testid="whatsapp-voice-mic-btn"
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer flex-shrink-0 ${
              isListening
                ? 'bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-lg shadow-rose-500/40 ring-2 ring-rose-400 animate-pulse'
                : 'bg-slate-100 dark:bg-[#162132] hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-white/10 active:scale-90'
            }`}
            aria-label="Voice input"
          >
            <Mic size={18} className={isListening ? 'animate-bounce' : ''} />
          </button>

          {/* Send Button */}
          <button
            type="button"
            onClick={() => handleSendMessage()}
            disabled={!inputText.trim() || isTyping}
            data-testid="whatsapp-chat-send-btn"
            className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-lg shadow-emerald-600/30 flex items-center justify-center transition-all cursor-pointer active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none flex-shrink-0"
            aria-label="Send"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
