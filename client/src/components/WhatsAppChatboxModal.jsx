import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Send, CheckCheck, Mic, Paperclip, Sparkles, 
  Trash2, ArrowLeft, ShieldCheck, Undo2, ChevronDown,
  PieChart, Users, Camera, Zap, ArrowUpRight
} from 'lucide-react';
import { processAssistantMessage } from '../services/aiAssistantService';
import { processReceiptFile } from '../services/receiptScannerService';
import { useToast } from '../context/ToastContext';

const CHAT_STORAGE_KEY = 'expense_tracker_whatsapp_chat';

/**
 * Luxury Fintech Message Formatter
 * Formats bot messages into clean, modern editorial typography without raw asterisks.
 */
function formatBotMessage(text) {
  if (!text) return null;
  const lines = text.split('\n');

  return lines.map((line, lIdx) => {
    // If divider line like ━━━━━━
    if (/^[━─—–=-]{5,}$/.test(line.trim())) {
      return <div key={lIdx} className="my-2.5 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />;
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
          <strong key={key++} className="font-semibold text-white tracking-tight">
            {match[2]}
          </strong>
        );
      } else if (match[3]) {
        // `code`
        parts.push(
          <code key={key++} className="px-1.5 py-0.5 rounded-md bg-white/10 text-emerald-300 font-mono text-[11px] border border-white/5">
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
    const isTitle = /^[🚨🧾💡👋📊⚡👥🕒💰🏷️]\s/.test(trimmed);
    const isVerdict = trimmed.toLowerCase().startsWith('verdict:');

    if (isTitle) {
      return (
        <div key={lIdx} className="font-bold text-[13.5px] text-white pt-1 pb-0.5 flex items-center gap-1.5">
          {parts}
        </div>
      );
    }

    if (isVerdict) {
      return (
        <div key={lIdx} className="mt-2 p-2.5 rounded-xl bg-white/[0.04] border border-white/5 text-[12px] leading-relaxed text-slate-200">
          {parts}
        </div>
      );
    }

    return (
      <div key={lIdx} className="min-h-[18px] text-[12.5px] text-slate-300 leading-relaxed">
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
    } catch (e) {}

    // Default welcome messages
    return [
      {
        id: 'msg_welcome_1',
        sender: 'bot',
        text: '👋 *Welcome to PocketNook Copilot*\n\nYour intelligent, private on-device financial analyst. Your banking records remain completely secure with zero cloud leakage.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      },
      {
        id: 'msg_welcome_2',
        sender: 'bot',
        text: '💡 *Instant Intelligence:*\n• `Can I afford a 3000 dinner?`\n• `Where is my money going?`\n• `Split 2400 between 6 people`\n• `50 chai, 120 lunch, 40 auto`\n• `What is my safe daily pace?`\n• `Chai 20` or paste any bank SMS!\n• `Undo` (to delete last expense)\n\n📎 *Tip:* Tap the paperclip icon to scan any bill receipt photo instantly!',
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
        `✨ Verified on-device with ${result.confidence}% accuracy.`;

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

    // Process through AI Assistant
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
        text: '🧹 *Chat history cleared!*\n\nAsk any question like `Can I afford 3000?`, `Chai 20`, or `Summary` to begin.',
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

  // Live financial snapshot calculations
  const remaining = Number(dashboardData?.remaining_budget || 0);
  const today = Number(dashboardData?.today_spent || 0);
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = Math.max(1, daysInMonth - now.getDate());
  const safePace = remaining > 0 ? Math.round(remaining / daysLeft) : 0;
  const isDeficit = remaining < 0;

  return (
    <div 
      className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center bg-black/85 backdrop-blur-xl animate-fade-in"
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

      {/* Luxury Fintech Mobile Sheet */}
      <div className="relative w-full sm:max-w-md h-[100dvh] sm:h-[88vh] sm:max-h-[760px] bg-[#0A0E17] text-slate-100 rounded-t-[32px] sm:rounded-[36px] overflow-hidden shadow-2xl flex flex-col border-t sm:border border-white/10 transition-all">
        
        {/* Native Pull Handle */}
        <div className="sm:hidden flex items-center justify-center pt-3 pb-1 bg-[#0A0E17]">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* ========================================================
            Executive Navigation Header (Clean, Spacious, Uncluttered)
           ======================================================== */}
        <div className="bg-[#0A0E17]/95 px-4 py-3 flex items-center justify-between border-b border-white/[0.08] backdrop-blur-md relative z-20">
          <div className="flex items-center gap-3 min-w-0">
            {/* Elegant Back/Dismiss Touch Target */}
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white/[0.06] hover:bg-white/[0.12] active:scale-95 border border-white/10 flex items-center justify-center transition-all cursor-pointer text-white flex-shrink-0"
              aria-label="Back"
            >
              <ArrowLeft size={18} />
            </button>

            {/* Bespoke Luxury Emblem */}
            <div className="relative flex-shrink-0">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-indigo-500 p-[1.5px] shadow-lg shadow-emerald-500/20">
                <div className="w-full h-full rounded-[14px] bg-[#0A0E17] flex items-center justify-center">
                  <Sparkles size={18} className="text-emerald-400" />
                </div>
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 border-2 border-[#0A0E17] rounded-full shadow-xs" />
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-[15px] tracking-tight text-white leading-tight">
                PocketNook Assistant
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[9.5px] font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex-shrink-0">
                  Zero-Leakage AI
                </span>
                <span className="text-[11px] text-slate-400 flex items-center gap-1.5 font-medium leading-none">
                  {isListening ? (
                    <span className="text-amber-300 font-semibold animate-pulse flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping inline-block" />
                      Listening...
                    </span>
                  ) : isTyping ? (
                    <span className="text-emerald-400 italic animate-pulse">analyzing...</span>
                  ) : (
                    <span>online • auto-expense logger</span>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Clean Action Icons */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={handleClearChat}
              title="Clear chat"
              className="w-8 h-8 rounded-full bg-white/[0.04] hover:bg-white/[0.1] active:scale-95 border border-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-all cursor-pointer"
            >
              <Trash2 size={14} />
            </button>
            <button
              onClick={onClose}
              title="Close"
              className="w-8 h-8 rounded-full bg-white/[0.04] hover:bg-white/[0.1] active:scale-95 border border-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-all cursor-pointer"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* ========================================================
            Floating Apple Card-Style Telemetry HUD (Micro-Metrics)
           ======================================================== */}
        <div className="p-3 bg-[#0A0E17] select-none z-10">
          <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-2.5 px-3 flex items-center justify-between text-xs backdrop-blur-lg shadow-inner">
            <div className="flex-1 text-center border-r border-white/10 pr-2">
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                Remaining
              </span>
              <span className={`font-extrabold text-[13px] tracking-tight ${isDeficit ? 'text-rose-400' : 'text-emerald-400'}`}>
                {formatCurrency(remaining)}
              </span>
            </div>
            <div className="flex-1 text-center border-r border-white/10 px-2">
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                Safe Pace
              </span>
              <span className="font-extrabold text-[13px] text-white tracking-tight">
                {formatCurrency(safePace)}
                <span className="text-[9.5px] font-medium text-slate-400">/d</span>
              </span>
            </div>
            <div className="flex-1 text-center pl-2">
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                Today
              </span>
              <span className="font-extrabold text-[13px] text-white tracking-tight">
                {formatCurrency(today)}
              </span>
            </div>
          </div>
        </div>

        {/* ========================================================
            Conversation Canvas (Clean, Layered, Tactile Cards)
           ======================================================== */}
        <div 
          className="flex-1 overflow-y-auto px-4 py-2 space-y-4 bg-gradient-to-b from-[#0A0E17] via-[#0D121F] to-[#0A0E17] scrollbar-none"
          data-testid="whatsapp-messages-container"
        >
          {/* Bank-Grade Privacy Pill */}
          <div className="mx-auto max-w-xs text-center py-1.5 px-3.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10.5px] text-emerald-300 font-semibold shadow-xs flex items-center justify-center gap-1.5 select-none backdrop-blur-md">
            <ShieldCheck size={14} className="text-emerald-400 flex-shrink-0" />
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
                  className={`max-w-[88%] sm:max-w-[82%] rounded-2xl px-4 py-3 shadow-md relative text-[13px] leading-relaxed transition-all ${
                    isUser
                      ? 'bg-gradient-to-tr from-emerald-600 to-teal-600 text-white font-medium rounded-br-sm shadow-emerald-950/40 border border-emerald-400/30 whitespace-pre-wrap'
                      : 'bg-white/[0.04] text-slate-100 rounded-bl-sm border border-white/[0.08] shadow-black/40 backdrop-blur-md'
                  }`}
                  data-testid={`whatsapp-bubble-${msg.sender}`}
                >
                  {/* Clean Formatted Message Stream (No raw asterisks) */}
                  <div className="space-y-0.5">
                    {isUser ? msg.text : formatBotMessage(msg.text)}
                  </div>

                  {/* Contextual Interactive Apple-Style Glass Action Buttons */}
                  {msg.actionButtons && msg.actionButtons.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-white/10 flex flex-wrap gap-2">
                      {msg.actionButtons.map((btn, bIdx) => (
                        <button
                          key={bIdx}
                          type="button"
                          onClick={() => handleSendMessage(btn.query)}
                          className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 hover:from-emerald-500/30 hover:to-teal-500/30 text-emerald-300 hover:text-white font-bold text-xs shadow-sm flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer flex-1 min-w-[130px] border border-emerald-500/30 backdrop-blur-md"
                        >
                          <span>{btn.label}</span>
                          <ArrowUpRight size={13} className="opacity-70" />
                        </button>
                      ))}
                    </div>
                  )}

                  <div className={`flex items-center justify-end gap-1 text-[9.5px] mt-2 select-none font-medium ${
                    isUser ? 'text-emerald-100/70' : 'text-slate-400'
                  }`}>
                    <span>{msg.time}</span>
                    {isUser && (
                      <CheckCheck size={13} className="text-emerald-200 ml-0.5 opacity-80" />
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Tactile Typing Wave */}
          {isTyping && (
            <div className="flex justify-start animate-fade-in">
              <div className="rounded-2xl rounded-bl-sm px-4 py-3 bg-white/[0.04] border border-white/[0.08] shadow-sm flex items-center gap-1.5 w-fit">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ========================================================
            Floating Suggestion Carousel (Clean Micro-Pills)
           ======================================================== */}
        <div className="bg-[#0A0E17]/95 px-3 py-2 flex items-center gap-2 overflow-x-auto scrollbar-none border-t border-white/[0.06] backdrop-blur-md">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1 flex-shrink-0 select-none">
            <Sparkles size={11} className="text-emerald-400" />
            Suggested:
          </span>
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => handleSendMessage(p.text)}
              data-testid={`whatsapp-quick-prompt-${p.id}`}
              className="px-3.5 py-1.5 rounded-full bg-white/[0.05] hover:bg-emerald-500/15 active:bg-emerald-500/25 text-xs font-medium text-slate-200 border border-white/10 shadow-xs flex-shrink-0 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* ========================================================
            Floating Dynamic Island Composer (Luxury Mobile Input)
           ======================================================== */}
        <div className="bg-[#0A0E17] p-3 pt-1 border-t border-white/[0.06] relative z-20">
          <div className="bg-white/[0.05] border border-white/10 rounded-full p-1.5 pl-3 flex items-center gap-2 shadow-xl backdrop-blur-2xl focus-within:border-emerald-500/50 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all">
            {/* 1-Tap Receipt Camera / OCR */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Scan Receipt Photo"
              data-testid="whatsapp-paperclip-btn"
              className="w-8 h-8 rounded-full bg-white/[0.04] hover:bg-white/[0.1] text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer active:scale-90 flex-shrink-0"
              aria-label="Attach receipt photo"
            >
              <Paperclip size={17} />
            </button>

            {/* Seamless Fluid Text Field */}
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
              className="flex-1 bg-transparent text-[13.5px] text-white placeholder-slate-400 focus:outline-none"
            />

            {/* Voice Dictation Mic */}
            <button
              type="button"
              onClick={toggleVoiceListening}
              title={isListening ? "Stop listening" : "Speak your message"}
              data-testid="whatsapp-voice-mic-btn"
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer flex-shrink-0 ${
                isListening
                  ? 'bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-lg shadow-rose-500/50 ring-2 ring-rose-400 animate-pulse'
                  : 'bg-white/[0.06] hover:bg-white/[0.12] text-slate-300 hover:text-white active:scale-90'
              }`}
              aria-label="Voice input"
            >
              <Mic size={17} className={isListening ? 'animate-bounce' : ''} />
            </button>

            {/* Radiant Send Pill */}
            <button
              type="button"
              onClick={() => handleSendMessage()}
              disabled={!inputText.trim() || isTyping}
              data-testid="whatsapp-chat-send-btn"
              className="w-9 h-9 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 hover:brightness-110 text-white shadow-lg shadow-emerald-500/30 flex items-center justify-center transition-all cursor-pointer active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none flex-shrink-0"
              aria-label="Send"
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
