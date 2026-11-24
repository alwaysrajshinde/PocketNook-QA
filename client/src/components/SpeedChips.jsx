import React, { useState, useEffect } from 'react';
import { Plus, X, Sparkles, Check, RotateCcw, Zap } from 'lucide-react';
import { useToast } from '../context/ToastContext';

const DEFAULT_SPEED_CHIPS = [
  { id: 'sc_chai', label: 'Chai', icon: '☕', amount: 20, category: 'Food & Dining', paymentMode: 'UPI' },
  { id: 'sc_lunch', label: 'Lunch', icon: '🍛', amount: 120, category: 'Food & Dining', paymentMode: 'UPI' },
  { id: 'sc_auto', label: 'Auto', icon: '🛺', amount: 50, category: 'Transportation', paymentMode: 'Cash' },
  { id: 'sc_milk', label: 'Milk', icon: '🥛', amount: 35, category: 'Groceries', paymentMode: 'UPI' },
  { id: 'sc_petrol', label: 'Petrol', icon: '⛽', amount: 200, category: 'Transportation', paymentMode: 'UPI' },
  { id: 'sc_snacks', label: 'Snacks', icon: '🥪', amount: 60, category: 'Food & Dining', paymentMode: 'UPI' }
];

const STORAGE_KEY = 'expense_tracker_speed_chips';

export default function SpeedChips({
  onQuickAdd,
  categories = [],
  formatCurrency = (v) => `₹${Number(v || 0).toLocaleString('en-IN')}`
}) {
  const { showToast } = useToast();
  const [chips, setChips] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return DEFAULT_SPEED_CHIPS;
  });

  const [loggingId, setLoggingId] = useState(null);
  const [justLoggedId, setJustLoggedId] = useState(null);
  const [isAddingChip, setIsAddingChip] = useState(false);

  // New Chip Form state
  const [newLabel, setNewLabel] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newEmoji, setNewEmoji] = useState('⚡');
  const [newCategory, setNewCategory] = useState(categories[0]?.name || 'Food & Dining');

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(chips));
    } catch (e) {}
  }, [chips]);

  const handleChipClick = async (chip) => {
    if (loggingId) return;
    try {
      setLoggingId(chip.id);
      const res = await onQuickAdd({
        amount: chip.amount,
        description: chip.label,
        category: chip.category || 'Food & Dining',
        payment_mode: chip.paymentMode || 'UPI',
        date: new Date().toISOString().slice(0, 10),
        is_refund: false
      });

      setJustLoggedId(chip.id);
      setTimeout(() => setJustLoggedId(null), 1500);

      showToast(`Logged ${chip.icon} ${chip.label} ${formatCurrency(chip.amount)}`, 'success');
    } catch (err) {
      showToast(err.message || 'Failed to log quick expense', 'error');
    } finally {
      setLoggingId(null);
    }
  };

  const handleSaveNewChip = (e) => {
    e.preventDefault();
    if (!newLabel.trim()) {
      showToast('Please enter a label for the chip', 'error');
      return;
    }
    const num = parseFloat(newAmount);
    if (isNaN(num) || num <= 0) {
      showToast('Please enter a valid amount', 'error');
      return;
    }

    const newChip = {
      id: `sc_${Date.now()}`,
      label: newLabel.trim(),
      icon: newEmoji || '⚡',
      amount: num,
      category: newCategory,
      paymentMode: 'UPI'
    };

    setChips([...chips, newChip]);
    setNewLabel('');
    setNewAmount('');
    setIsAddingChip(false);
    showToast(`Added speed chip for ${newChip.label}!`, 'success');
  };

  const handleDeleteChip = (chipId, e) => {
    e.stopPropagation();
    setChips(chips.filter(c => c.id !== chipId));
  };

  return (
    <div className="w-full bg-white dark:bg-[#16132A] rounded-2xl p-3 sm:p-3.5 border border-slate-100 dark:border-white/10 shadow-xs space-y-2">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Zap size={12} strokeWidth={2.5} />
          </div>
          <span className="text-xs font-bold text-slate-800 dark:text-white tracking-tight">
            Speed Chips
          </span>
          <span className="text-[10px] font-semibold text-slate-400">
            • 1-Tap Daily Expenses
          </span>
        </div>
        
        <button
          type="button"
          onClick={() => setIsAddingChip(!isAddingChip)}
          data-testid="toggle-add-speed-chip"
          className="text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 cursor-pointer"
        >
          <Plus size={12} />
          <span>{isAddingChip ? 'Cancel' : 'New Chip'}</span>
        </button>
      </div>

      {/* Add New Chip Inline Form */}
      {isAddingChip && (
        <form onSubmit={handleSaveNewChip} className="p-2.5 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/30 grid grid-cols-2 sm:grid-cols-4 gap-2 animate-fade-in text-xs">
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Emoji</label>
            <input
              type="text"
              value={newEmoji}
              maxLength={2}
              onChange={(e) => setNewEmoji(e.target.value)}
              className="w-full px-2 py-1 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-black/30 text-center font-bold"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Title</label>
            <input
              type="text"
              placeholder="e.g. Metro"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="w-full px-2 py-1 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-black/30"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Amount (₹)</label>
            <input
              type="number"
              placeholder="40"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              className="w-full px-2 py-1 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-black/30 font-bold"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              data-testid="save-speed-chip-btn"
              className="w-full py-1.5 rounded-lg bg-[#6C47FF] hover:bg-[#5835E5] text-white font-bold text-xs shadow-xs cursor-pointer"
            >
              Add Chip
            </button>
          </div>
        </form>
      )}

      {/* Horizontal Scrollable Chips Row */}
      <div 
        className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none"
        data-testid="speed-chips-strip"
      >
        {chips.map((chip) => {
          const isLogging = loggingId === chip.id;
          const isSuccess = justLoggedId === chip.id;

          return (
            <div
              key={chip.id}
              className="relative group flex-shrink-0"
            >
              <button
                type="button"
                disabled={Boolean(loggingId)}
                onClick={() => handleChipClick(chip)}
                data-testid={`speed-chip-${chip.id}`}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer select-none active:scale-95 ${
                  isSuccess
                    ? 'bg-emerald-500 text-white border-emerald-600 shadow-md scale-102'
                    : 'bg-slate-50 hover:bg-purple-50/80 dark:bg-white/5 dark:hover:bg-purple-950/30 border-slate-200/80 dark:border-white/10 text-slate-800 dark:text-slate-100 hover:border-purple-300 dark:hover:border-purple-500/40'
                }`}
              >
                <span className="text-sm">{chip.icon}</span>
                <span>{chip.label}</span>
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold ${
                  isSuccess 
                    ? 'bg-white/20 text-white' 
                    : 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300'
                }`}>
                  {isLogging ? '...' : isSuccess ? '✓' : formatCurrency(chip.amount)}
                </span>
              </button>

              {/* Delete hover button on custom chips */}
              {chip.id.startsWith('sc_') && !['sc_chai', 'sc_lunch', 'sc_auto'].includes(chip.id) && (
                <button
                  type="button"
                  onClick={(e) => handleDeleteChip(chip.id, e)}
                  title="Remove chip"
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-slate-300 dark:bg-slate-700 hover:bg-rose-500 hover:text-white text-slate-600 dark:text-slate-300 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                >
                  <X size={10} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
