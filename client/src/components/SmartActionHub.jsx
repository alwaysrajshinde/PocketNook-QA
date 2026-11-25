import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles, Camera, MessageSquare, Repeat, Plus, Check, Trash2,
  BookmarkCheck, ArrowUpRight, ShieldCheck
} from 'lucide-react';
import { getCurrentUserId } from '../services/api';
import { useToast } from '../context/ToastContext';

function getPulseStatus(dashboardData) {
  const budget = Number(dashboardData?.budget || 0);
  const spent = Number(dashboardData?.total_spent || 0);
  const hasCategories = Array.isArray(dashboardData?.top_categories) && dashboardData.top_categories.length > 0;

  if (budget <= 0 && spent <= 0 && !hasCategories) {
    return {
      label: 'Fresh Start',
      tone: 'purple',
      headline: 'Ready when you are',
      hint: 'Snap a receipt, paste a bank alert, or chat to log in seconds.'
    };
  }

  if (budget <= 0) {
    return {
      label: 'Tracking Active',
      tone: 'blue',
      headline: 'Logging smoothly',
      hint: 'Your entries are flowing in cleanly—use the quick tools below anytime.'
    };
  }

  const ratio = spent / budget;
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthProgress = now.getDate() / daysInMonth;

  if (ratio >= 1) {
    return {
      label: 'Over Budget',
      tone: 'rose',
      headline: 'Time to pause extras',
      hint: 'Focus strictly on essentials and check recurring charges for the rest of this cycle.'
    };
  }
  if (ratio > monthProgress + 0.15 || ratio >= 0.85) {
    return {
      label: 'Watchful Pace',
      tone: 'amber',
      headline: 'Slow down non-essentials',
      hint: 'Spending is ahead of the calendar—stick to routine buys for a few days.'
    };
  }
  return {
    label: 'Comfortable Pace',
    tone: 'emerald',
    headline: 'Smooth & balanced',
    hint: 'You have healthy breathing room for the rest of this month.'
  };
}

export default function SmartActionHub({
  dashboardData,
  onOpenAddExpense,
  onOpenSmsParser,
  onOpenReceiptScanner,
  onOpenWhatsAppAssistant,
  onOpenRecurringModal,
  onViewAllCategories
}) {
  const { showToast } = useToast();
  const uid = getCurrentUserId() || '1';
  const notesKey = `et_zero_num_notes_${uid}`;

  const [notes, setNotes] = useState(() => {
    try {
      const saved = localStorage.getItem(notesKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });
  const [noteInput, setNoteInput] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem(notesKey, JSON.stringify(notes));
    } catch {}
  }, [notes, notesKey]);

  const pulse = useMemo(() => getPulseStatus(dashboardData), [dashboardData]);

  // Qualitative-only category visual bar (colors + category names only, zero numbers)
  const topChannelColors = useMemo(() => {
    const cats = Array.isArray(dashboardData?.top_categories) ? dashboardData.top_categories : [];
    return cats.slice(0, 5).map((c) => ({
      name: c.name,
      color: c.color || '#6C47FF',
      weight: Math.max(10, Number(c.percentage || 20))
    }));
  }, [dashboardData]);

  const pulseToneStyles = {
    emerald: {
      badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
      dot: 'bg-emerald-500'
    },
    amber: {
      badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
      dot: 'bg-amber-500'
    },
    rose: {
      badge: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
      dot: 'bg-rose-500'
    },
    blue: {
      badge: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30',
      dot: 'bg-sky-500'
    },
    purple: {
      badge: 'bg-[#6C47FF]/12 text-[#6C47FF] dark:text-[#C4B5FD] border-[#6C47FF]/30',
      dot: 'bg-[#6C47FF]'
    }
  }[pulse.tone];

  const handleAddNote = (e) => {
    e.preventDefault();
    const cleaned = noteInput.trim();
    if (!cleaned) return;
    setNotes((prev) => [{ id: `n_${Date.now()}`, text: cleaned, done: false }, ...prev]);
    setNoteInput('');
    showToast('Added to payment checklist', 'success');
  };

  const toggleNote = (id) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, done: !n.done } : n)));
  };

  const removeNote = (id) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  const actionTiles = [
    {
      id: 'scan',
      label: 'Scan Receipt',
      sub: 'Camera / Photo',
      icon: Camera,
      colorClass: 'bg-sky-500/12 text-sky-600 dark:text-sky-400',
      onClick: () => onOpenReceiptScanner && onOpenReceiptScanner()
    },
    {
      id: 'sms',
      label: 'Paste Bank SMS',
      sub: 'Auto-extract UPI',
      icon: MessageSquare,
      colorClass: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400',
      onClick: () => onOpenSmsParser && onOpenSmsParser()
    },
    {
      id: 'chat',
      label: 'Smart Assistant',
      sub: 'Chat & ask',
      icon: Sparkles,
      colorClass: 'bg-[#6C47FF]/12 text-[#6C47FF] dark:text-[#C4B5FD]',
      onClick: () => onOpenWhatsAppAssistant && onOpenWhatsAppAssistant()
    },
    {
      id: 'bills',
      label: 'Subscriptions',
      sub: 'Recurring bills',
      icon: Repeat,
      colorClass: 'bg-amber-500/12 text-amber-600 dark:text-amber-400',
      onClick: () => onOpenRecurringModal && onOpenRecurringModal()
    }
  ];

  return (
    <section
      data-testid="smart-action-hub"
      className="bg-white dark:bg-[#16132A] rounded-3xl p-4 sm:p-5 border border-slate-100 dark:border-white/10 shadow-xs space-y-4 transition-colors interactive-card"
    >
      {/* Qualitative Pace Status Header (Zero Numbers) */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              data-testid="pulse-status-badge"
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${pulseToneStyles.badge}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${pulseToneStyles.dot}`} />
              <span>{pulse.label}</span>
            </span>
            <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 flex items-center gap-1">
              <ShieldCheck size={12} />
              <span>Numbers hidden cleanly</span>
            </span>
          </div>
          <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white leading-snug">
            {pulse.headline}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {pulse.hint}
          </p>
        </div>

        {typeof onOpenAddExpense === 'function' && (
          <button
            type="button"
            onClick={() => onOpenAddExpense()}
            data-testid="hub-quick-add-btn"
            className="px-3 py-2 rounded-2xl bg-[#6C47FF] hover:bg-[#5835E5] text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-sm shadow-purple-500/25 cursor-pointer active:scale-95 transition-all flex-shrink-0"
          >
            <Plus size={14} />
            <span>Quick Entry</span>
          </button>
        )}
      </div>

      {/* Qualitative Visual Category Ribbon (Color balance only — zero numbers) */}
      {topChannelColors.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold text-slate-500 dark:text-slate-400">
              Where your attention went
            </span>
            {typeof onViewAllCategories === 'function' && (
              <button
                type="button"
                onClick={onViewAllCategories}
                className="font-semibold text-[#6C47FF] dark:text-[#A78BFA] hover:underline inline-flex items-center gap-0.5 cursor-pointer"
              >
                <span>Categories</span>
                <ArrowUpRight size={12} />
              </button>
            )}
          </div>
          <div
            data-testid="category-color-ribbon"
            className="w-full h-2.5 rounded-full overflow-hidden flex gap-0.5 bg-slate-100 dark:bg-white/[0.06]"
          >
            {topChannelColors.map((cat) => (
              <div
                key={cat.name}
                title={cat.name}
                className="h-full first:rounded-l-full last:rounded-r-full transition-all duration-500"
                style={{ flexGrow: cat.weight, backgroundColor: cat.color }}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-2 pt-0.5">
            {topChannelColors.map((cat) => (
              <span
                key={cat.name}
                className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-slate-600 dark:text-slate-300"
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                <span>{cat.name}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 1-Tap Smart Capture & Utility Tools */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {actionTiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <button
              key={tile.id}
              type="button"
              onClick={tile.onClick}
              data-testid={`hub-action-${tile.id}`}
              className="p-2.5 rounded-2xl bg-slate-50 dark:bg-[#100D1F] hover:bg-slate-100 dark:hover:bg-[#1B1633] border border-slate-200/70 dark:border-white/[0.07] text-left flex items-center gap-2.5 transition-all cursor-pointer active:scale-[0.98]"
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${tile.colorClass}`}>
                <Icon size={15} />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
                  {tile.label}
                </span>
                <span className="text-[10px] text-slate-400 block truncate">
                  {tile.sub}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Zero-Number Quick To-Pay / Expense Reminder Checklist */}
      <div className="p-3 rounded-2xl bg-slate-50 dark:bg-[#100D1F] border border-slate-200/70 dark:border-white/[0.07] space-y-2.5">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">
          <BookmarkCheck size={14} className="text-[#6C47FF] dark:text-[#A78BFA]" />
          <span>Pending Spends &amp; Reminders</span>
        </div>

        <form onSubmit={handleAddNote} className="flex items-center gap-2">
          <input
            type="text"
            value={noteInput}
            onChange={(e) => setNoteInput(e.target.value)}
            data-testid="hub-note-input"
            placeholder="Add reminder (e.g. Pay broadband, Buy groceries)..."
            className="flex-1 min-w-0 px-3 py-1.5 rounded-xl bg-white dark:bg-[#1A1633] border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#6C47FF]"
          />
          <button
            type="submit"
            data-testid="hub-note-add-btn"
            className="px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold cursor-pointer active:scale-95 flex-shrink-0"
          >
            Save
          </button>
        </form>

        {notes.length > 0 && (
          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-0.5">
            {notes.map((n) => (
              <div
                key={n.id}
                className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-xl bg-white dark:bg-[#16132A] border border-slate-100 dark:border-white/[0.05]"
              >
                <button
                  type="button"
                  onClick={() => toggleNote(n.id)}
                  className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer"
                >
                  <span
                    className={`w-4 h-4 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors ${
                      n.done
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : 'border-slate-300 dark:border-white/25'
                    }`}
                  >
                    {n.done && <Check size={11} strokeWidth={3} />}
                  </span>
                  <span
                    className={`text-xs font-medium truncate ${
                      n.done ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    {n.text}
                  </span>
                </button>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {!n.done && typeof onOpenAddExpense === 'function' && (
                    <button
                      type="button"
                      onClick={() => onOpenAddExpense()}
                      className="px-2 py-0.5 rounded-lg bg-[#6C47FF]/12 text-[#6C47FF] dark:text-[#C4B5FD] text-[10px] font-bold cursor-pointer"
                    >
                      Log
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => removeNote(n.id)}
                    aria-label="Remove reminder"
                    className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
