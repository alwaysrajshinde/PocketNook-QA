import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Send, CheckCheck, Mic, Paperclip, Sparkles, 
  Trash2, ArrowLeft, ShieldCheck, Undo2, ChevronDown,
  PieChart, Users, Camera, Zap, ArrowUpRight, MessageCircle
} from 'lucide-react';
import { processAssistantMessage } from '../services/aiAssistantService';
import { processReceiptFile } from '../services/receiptScannerService';
import { useToast } from '../context/ToastContext';

const CHAT_STORAGE_KEY = 'expense_tracker_whatsapp_chat';

/**
 * PocketNook Signature Brand Formatter
 * Perfectly aligns with PocketNook's Royal Purple (#6C47FF) & Cosmic Night (#16132A) visual identity.
 */
function formatBotMessage(text) {
  if (!text) return null;
  const lines = text.split('\n');

  return lines.map((line, lIdx) => {
    // If divider line like ━━━━━━
    if (/^[━─—–=-]{5,}$/.test(line.trim())) {
      return <div key={lIdx} className="my-2 h-[1px] bg-slate-200/80 dark:bg-white/10" />;
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
    const isTitle = /^[🚨🧾💡👋📊⚡👥🕒💰🏷️]\s/.test(trimmed);
    const isVerdict = trimmed.toLowerCase().startsWith('verdict:');

    if (isTitle) {
      return (
        <div key={lIdx} className="font-extrabold text-[13.5px] text-[#6C47FF] dark:text-[#C084FC] pt-1 pb-0.5 flex items-center gap-1.5">
          {parts}
        </div>
      );
    }

    if (isVerdict) {
      return (
        <div key={lIdx} className="mt-2.5 p-3 rounded-xl bg-purple-50/70 dark:bg-[#1D1936] border border-purple-200/60 dark:border-purple-500/25 text-[12.5px] leading-relaxed text-slate-800 dark:text-slate-200 shadow-xs">
          {parts}
        </div>
      );
    }

    return (
      <div key={lIdx} className="min-h-[18px] text-[12.5px] text-slate-700 dark:text-slate-300 leading-relaxed">
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

    // Default welcome messages in PocketNook voice
    return [
      {
        id: 'msg_welcome_1',
        sender: 'bot',
        text: '👋 *Welcome to PocketNook Copilot!*\n\nI am your private, on-device financial analyst. Your accounts and cards are fully protected with zero cloud data leakage.',
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
      className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center bg-slate-900/60 dark:bg-black/75 backdrop-blur-xl animate-fade-in"
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

      {/* Signature PocketNook Mobile Bottom Sheet */}
      <div className="relative w-full sm:max-w-lg h-[100dvh] sm:h-[88vh] sm:max-h-[760px] bg-[#f4f5fa] dark:bg-[#0d0b18] text-slate-900 dark:text-[#f8fafc] rounded-t-[32px] sm:rounded-[36px] overflow-hidden shadow-2xl flex flex-col border-t sm:border border-slate-200/80 dark:border-white/10 transition-all">
        
        {/* Mobile Pull Handle Indicator */}
        <div className="sm:hidden flex items-center justify-center pt-2.5 pb-1 bg-white dark:bg-[#16132A]">
          <div className="w-12 h-1 rounded-full bg-slate-300 dark:bg-white/20" />
        </div>

        {/* ========================================================
            PocketNook Executive Header (Royal Purple & Cosmic Night)
           ======================================================== */}
        <div className="bg-white dark:bg-[#16132A] px-4 py-3 flex items-center justify-between border-b border-slate-200/80 dark:border-white/10 shadow-xs relative z-20">
          <div className="flex items-center gap-3 min-w-0">
            {/* Back / Dismiss Touch Target */}
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-2xl bg-purple-50 dark:bg-purple-900/30 text-[#6C47FF] dark:text-[#A78BFA] hover:bg-purple-100 dark:hover:bg-purple-900/50 active:scale-95 border border-purple-100 dark:border-purple-500/20 flex items-center justify-center transition-all cursor-pointer flex-shrink-0"
              aria-label="Back"
            >
              <ArrowLeft size={18} />
            </button>

            {/* Glowing PocketNook AI Emblem */}
            <div className="relative flex-shrink-0">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#5B27DC] to-[#7B42F6] flex items-center justify-center shadow-md shadow-purple-600/30 p-[1.5px]">
                <Sparkles size={19} className="text-white" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-[#16132A] rounded-full shadow-xs" />
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="font-black text-[15px] sm:text-base tracking-tight text-slate-900 dark:text-white leading-tight">
                PocketNook Assistant
              </h3>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-[9.5px] font-black tracking-wider px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-900/40 text-[#6C47FF] dark:text-[#C084FC] border border-purple-200/80 dark:border-purple-500/30 flex-shrink-0">
                  Zero-Leakage AI
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-medium leading-none">
                  {isListening ? (
                    <span className="text-amber-500 dark:text-amber-300 font-bold animate-pulse flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping inline-block" />
                      Listening to voice...
                    </span>
                  ) : isTyping ? (
                    <span className="text-[#6C47FF] dark:text-[#A78BFA] italic animate-pulse">analyzing finances...</span>
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
              title="Clear chat"
              className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 active:scale-95 border border-slate-200/60 dark:border-white/5 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer"
            >
              <Trash2 size={15} />
            </button>
            <button
              onClick={onClose}
              title="Close"
              className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 active:scale-95 border border-slate-200/60 dark:border-white/5 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ========================================================
            Signature PocketNook Telemetry Card (HUD)
           ======================================================== */}
        <div className="px-4 py-2 bg-[#f4f5fa] dark:bg-[#0d0b18] select-none z-10">
          <div className="bg-white dark:bg-[#16132A] border border-slate-200/80 dark:border-white/10 rounded-2xl p-2.5 px-3.5 flex items-center justify-between text-xs shadow-sm">
            <div className="flex-1 text-center border-r border-slate-200/80 dark:border-white/10 pr-2">
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-400 block mb-0.5">
                Remaining
              </span>
              <span className={`font-black text-[13px] tracking-tight ${isDeficit ? 'text-rose-600 dark:text-rose-400' : 'text-[#6C47FF] dark:text-[#A78BFA]'}`}>
                {formatCurrency(remaining)}
              </span>
            </div>
            <div className="flex-1 text-center border-r border-slate-200/80 dark:border-white/10 px-2">
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-400 block mb-0.5">
                Safe Pace
              </span>
              <span className="font-black text-[13px] text-slate-900 dark:text-white tracking-tight">
                {formatCurrency(safePace)}
                <span className="text-[9.5px] font-medium text-slate-400">/d</span>
              </span>
            </div>
            <div className="flex-1 text-center pl-2">
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-400 block mb-0.5">
                Today
              </span>
              <span className="font-black text-[13px] text-slate-900 dark:text-white tracking-tight">
                {formatCurrency(today)}
              </span>
            </div>
          </div>
        </div>

        {/* ========================================================
            Conversation Canvas (Clean PocketNook Atmosphere)
           ======================================================== */}
        <div 
          className="flex-1 overflow-y-auto px-4 py-2 space-y-3.5 bg-[#f4f5fa] dark:bg-[#0d0b18] scrollbar-none"
          data-testid="whatsapp-messages-container"
        >
          {/* Zero-Leakage Privacy Pill */}
          <div className="mx-auto max-w-xs text-center py-1.5 px-3.5 rounded-full bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-500/25 text-[10.5px] text-[#6C47FF] dark:text-[#C084FC] font-bold shadow-xs flex items-center justify-center gap-1.5 select-none">
            <ShieldCheck size={14} className="text-[#6C47FF] dark:text-[#C084FC] flex-shrink-0" />
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
                  className={`max-w-[88%] sm:max-w-[82%] rounded-2xl px-4 py-3 shadow-sm relative text-[13px] leading-relaxed transition-all ${
                    isUser
                      ? 'bg-gradient-to-r from-[#5B27DC] to-[#7B42F6] text-white font-medium rounded-tr-xs shadow-purple-600/20 whitespace-pre-wrap'
                      : 'bg-white dark:bg-[#16132A] text-slate-800 dark:text-slate-100 rounded-tl-xs border border-slate-200/80 dark:border-white/10 shadow-slate-900/5'
                  }`}
                  data-testid={`whatsapp-bubble-${msg.sender}`}
                >
                  {/* Clean Formatted Message Stream (No raw asterisks) */}
                  <div className="space-y-0.5">
                    {isUser ? msg.text : formatBotMessage(msg.text)}
                  </div>

                  {/* Contextual Interactive Action Buttons (PocketNook Gradient) */}
                  {msg.actionButtons && msg.actionButtons.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-slate-200/70 dark:border-white/10 flex flex-wrap gap-2">
                      {msg.actionButtons.map((btn, bIdx) => (
                        <button
                          key={bIdx}
                          type="button"
                          onClick={() => handleSendMessage(btn.query)}
                          className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#5B27DC] to-[#7B42F6] hover:from-[#4E1FC5] hover:to-[#6E32E9] text-white font-bold text-xs shadow-md shadow-purple-500/25 flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer flex-1 min-w-[130px]"
                        >
                          <span>{btn.label}</span>
                          <ArrowUpRight size={13} className="opacity-80" />
                        </button>
                      ))}
                    </div>
                  )}

                  <div className={`flex items-center justify-end gap-1 text-[9.5px] mt-2 select-none font-medium ${
                    isUser ? 'text-purple-200' : 'text-slate-400 dark:text-slate-500'
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
              <div className="rounded-2xl rounded-tl-xs px-4 py-2.5 bg-white dark:bg-[#16132A] border border-slate-200/80 dark:border-white/10 shadow-xs flex items-center gap-1.5 w-fit">
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
        <div className="bg-white/90 dark:bg-[#16132A]/90 backdrop-blur-md px-3.5 py-2 flex items-center gap-2 overflow-x-auto scrollbar-none border-t border-slate-200/80 dark:border-white/10">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-400 flex items-center gap-1 flex-shrink-0 select-none">
            <Sparkles size={11} className="text-[#6C47FF] dark:text-[#A78BFA]" />
            Ask Copilot:
          </span>
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => handleSendMessage(p.text)}
              data-testid={`whatsapp-quick-prompt-${p.id}`}
              className="px-3 py-1.5 rounded-xl bg-purple-50/80 dark:bg-[#1D1936] hover:bg-purple-100 dark:hover:bg-purple-900/40 text-xs font-bold text-[#6C47FF] dark:text-[#C084FC] border border-purple-200/60 dark:border-white/10 shadow-xs flex-shrink-0 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* ========================================================
            PocketNook Signature Mobile Composer
           ======================================================== */}
        <div className="bg-white dark:bg-[#16132A] p-3 border-t border-slate-200/80 dark:border-white/10 relative z-20">
          <div className="bg-[#f4f5fa] dark:bg-[#1D1936] border border-slate-200/80 dark:border-white/15 rounded-2xl p-1.5 pl-3 flex items-center gap-2 focus-within:border-[#6C47FF] focus-within:ring-2 focus-within:ring-purple-500/20 transition-all shadow-xs">
            {/* 1-Tap Receipt Camera / OCR */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Scan Receipt Photo"
              data-testid="whatsapp-paperclip-btn"
              className="w-8 h-8 rounded-xl bg-white dark:bg-[#16132A] text-slate-400 hover:text-[#6C47FF] dark:hover:text-[#A78BFA] flex items-center justify-center transition-all cursor-pointer active:scale-90 border border-slate-200/60 dark:border-white/10 flex-shrink-0 shadow-xs"
              aria-label="Attach receipt photo"
            >
              <Paperclip size={17} />
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
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer flex-shrink-0 ${
                isListening
                  ? 'bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-lg shadow-rose-500/50 ring-2 ring-rose-400 animate-pulse'
                  : 'bg-white dark:bg-[#16132A] text-slate-400 hover:text-[#6C47FF] dark:hover:text-[#A78BFA] active:scale-90 border border-slate-200/60 dark:border-white/10 shadow-xs'
              }`}
              aria-label="Voice input"
            >
              <Mic size={17} className={isListening ? 'animate-bounce' : ''} />
            </button>

            {/* Radiant Send Pill in PocketNook Violet */}
            <button
              type="button"
              onClick={() => handleSendMessage()}
              disabled={!inputText.trim() || isTyping}
              data-testid="whatsapp-chat-send-btn"
              className="w-9 h-9 rounded-xl bg-gradient-to-r from-[#5B27DC] to-[#7B42F6] hover:from-[#4E1FC5] hover:to-[#6E32E9] text-white shadow-md shadow-purple-500/30 flex items-center justify-center transition-all cursor-pointer active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none flex-shrink-0"
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
