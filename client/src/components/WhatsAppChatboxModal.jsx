import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Send, CheckCheck, Mic, Paperclip, MoreVertical, Sparkles, 
  Trash2, ArrowLeft, Bot, RefreshCw, Zap, ShieldCheck, Undo2,
  PieChart, Users, HelpCircle, AlertCircle, CheckCircle2, Camera
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
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-xs animate-fade-in"
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
                  PocketNook Assistant · AI Copilot
                </h3>
                <span className="text-[10px] font-bold px-1.5 py-0.2 bg-white/20 rounded-full">
                  Zero-Leakage AI
                </span>
              </div>
              <p className="text-[11px] text-emerald-100/90 dark:text-emerald-400/90 flex items-center gap-1">
                {isListening ? (
                  <span className="text-amber-300 font-semibold animate-pulse flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping inline-block" />
                    Listening to voice...
                  </span>
                ) : isTyping ? (
                  <span className="italic animate-pulse">analyzing finances...</span>
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
            Live Financial Snapshot Ribbon
           ======================================================== */}
        <div className="bg-[#E2F7CB] dark:bg-[#1f2c34] px-4 py-2 flex items-center justify-between text-[11px] border-b border-black/5 dark:border-white/5 text-slate-700 dark:text-slate-300 font-medium select-none shadow-inner">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
            <span>Bal: <strong className="text-emerald-700 dark:text-emerald-400 font-bold">{formatCurrency(remaining)}</strong></span>
          </div>
          <div className="text-slate-600 dark:text-slate-300">
            Safe Pace: <strong className="text-slate-900 dark:text-white font-bold">{formatCurrency(safePace)}/d</strong>
          </div>
          <div>
            Today: <strong className="text-slate-900 dark:text-white font-bold">{formatCurrency(today)}</strong>
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
            🔒 Bank-Grade Zero Leakage: Account &amp; card numbers scrubbed locally before reasoning.
          </div>

          {messages.map((msg) => {
            const isUser = msg.sender === 'user';

            return (
              <div
                key={msg.id}
                className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}
              >
                <div
                  className={`max-w-[88%] sm:max-w-[80%] rounded-2xl px-3.5 py-2.5 shadow-xs relative text-xs leading-relaxed whitespace-pre-wrap ${
                    isUser
                      ? 'bg-[#E7FFDB] dark:bg-[#005c4b] text-slate-900 dark:text-white rounded-tr-none'
                      : 'bg-white dark:bg-[#202c33] text-slate-900 dark:text-slate-100 rounded-tl-none border border-black/5 dark:border-white/5'
                  }`}
                  data-testid={`whatsapp-bubble-${msg.sender}`}
                >
                  <div>{msg.text}</div>

                  {/* Contextual Interactive Action Buttons */}
                  {msg.actionButtons && msg.actionButtons.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-slate-200 dark:border-white/10 flex flex-wrap gap-1.5">
                      {msg.actionButtons.map((btn, bIdx) => (
                        <button
                          key={bIdx}
                          type="button"
                          onClick={() => handleSendMessage(btn.query)}
                          className="py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-xs flex items-center justify-center gap-1 active:scale-95 transition-all cursor-pointer flex-1 min-w-[120px]"
                        >
                          <span>{btn.label}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className={`flex items-center justify-end gap-1 text-[9.5px] mt-1.5 select-none ${
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
            Ask Copilot:
          </span>
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => handleSendMessage(p.text)}
              data-testid={`whatsapp-quick-prompt-${p.id}`}
              className="px-2.5 py-1 rounded-full bg-white dark:bg-[#202c33] hover:bg-emerald-50 dark:hover:bg-[#005c4b]/30 text-[11px] font-semibold text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-white/10 shadow-xs flex-shrink-0 transition-colors cursor-pointer active:scale-95"
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* ========================================================
            WhatsApp Bottom Input Bar with Voice & Receipt Camera
           ======================================================== */}
        <div className="bg-[#F0F2F5] dark:bg-[#202c33] p-2.5 flex items-center gap-2">
          {/* Attach receipt photo button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Scan Receipt Photo"
            data-testid="whatsapp-paperclip-btn"
            className="p-2 text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 transition-colors cursor-pointer rounded-full hover:bg-black/5 dark:hover:bg-white/5"
            aria-label="Attach receipt photo"
          >
            <Paperclip size={18} />
          </button>

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
              placeholder={isListening ? "Listening... speak now!" : "Ask copilot, type expense, or tap mic..."}
              className="w-full bg-transparent text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
            />
          </div>

          {/* Voice Mic Button */}
          <button
            type="button"
            onClick={toggleVoiceListening}
            title={isListening ? "Stop listening" : "Speak your message"}
            data-testid="whatsapp-voice-mic-btn"
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              isListening
                ? 'bg-rose-500 text-white animate-pulse shadow-md shadow-rose-500/40 ring-2 ring-rose-400'
                : 'bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 text-slate-700 dark:text-slate-200'
            }`}
            aria-label="Voice input"
          >
            <Mic size={17} className={isListening ? 'animate-bounce' : ''} />
          </button>

          {/* Send button */}
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
