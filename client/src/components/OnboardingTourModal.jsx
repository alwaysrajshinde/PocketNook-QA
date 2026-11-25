import React, { useState } from 'react';
import { 
  Sparkles, Target, Tag, Zap, ArrowRight, ArrowLeft, Check, 
  Utensils, ShoppingBag, Car, Shirt, X, ShieldCheck
} from 'lucide-react';
import CategoryIcon from './CategoryIcon';

export default function OnboardingTourModal({
  isOpen,
  onClose,
  onSaveBudget,
  currency = '₹',
  userName = 'User'
}) {
  const [step, setStep] = useState(1);
  const [budgetVal, setBudgetVal] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const presets = [5000, 10000, 15000, 20000];

  const starterCategories = [
    { name: 'Food & Dining', icon: 'Utensils', color: '#6C47FF' },
    { name: 'Groceries', icon: 'ShoppingBag', color: '#10B981' },
    { name: 'Transportation', icon: 'Car', color: '#F59E0B' },
    { name: 'Shopping', icon: 'Shirt', color: '#EC4899' },
    { name: 'Bills & Utilities', icon: 'Zap', color: '#3B82F6' },
    { name: 'Entertainment', icon: 'Film', color: '#8B5CF6' },
    { name: 'Health', icon: 'HeartPulse', color: '#EF4444' },
    { name: 'Other', icon: 'Tag', color: '#64748B' }
  ];

  const handleFinish = async () => {
    try {
      setIsSaving(true);
      const numericBudget = parseFloat(budgetVal) || 0;
      if (onSaveBudget) {
        await onSaveBudget(numericBudget);
      }
      onClose();
    } catch (e) {
      console.error('Error saving onboarding budget:', e);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-white dark:bg-[#16132A] rounded-3xl shadow-2xl p-6 border border-slate-100 dark:border-white/10 space-y-5 animate-scale-in transition-colors">
        
        {/* Header / Stepper indicators */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-[#6C47FF] dark:text-[#A78BFA] flex items-center justify-center shadow-xs">
              <Sparkles size={16} />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                Quick Tour · Step {step} of 3
              </span>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {step === 1 && 'Set Your Monthly Budget'}
                {step === 2 && 'Clean & Minimal Categories'}
                {step === 3 && 'Effortless Expense Logging'}
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close Tour"
            data-testid="onboarding-tour-close-btn"
            className="w-7 h-7 rounded-full bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* ========================================================
            STEP 1: Monthly Budget Setup
           ======================================================== */}
        {step === 1 && (
          <div className="space-y-4 py-1">
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Welcome, <strong className="text-slate-800 dark:text-white">{userName}</strong>! Start by entering your target spending limit for this month. You can adjust this anytime in Settings.
            </p>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Monthly Target Budget
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-4 text-xl font-extrabold text-slate-700 dark:text-slate-300">
                  {currency}
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="0 (e.g. 15000)"
                  value={budgetVal}
                  onChange={(e) => setBudgetVal(e.target.value)}
                  className="w-full pl-9 pr-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-xl font-extrabold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#6C47FF] transition-all"
                />
              </div>
            </div>

            {/* Quick preset chips */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] font-semibold text-slate-400 block">
                Quick Presets:
              </span>
              <div className="grid grid-cols-4 gap-2">
                {presets.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setBudgetVal(String(amt))}
                    className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition-all ${
                      budgetVal === String(amt)
                        ? 'border-[#6C47FF] bg-purple-50 dark:bg-purple-900/40 text-[#6C47FF] dark:text-[#A78BFA] shadow-xs'
                        : 'border-slate-200 dark:border-white/10 hover:border-slate-300 text-slate-700 dark:text-slate-300 bg-white dark:bg-white/5'
                    }`}
                  >
                    {currency}{amt.toLocaleString('en-IN')}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            STEP 2: Minimal Categories
           ======================================================== */}
        {step === 2 && (
          <div className="space-y-4 py-1">
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              We keep things clutter-free. Your vault starts with <strong>8 essential starter categories</strong>. You can rename, add, or delete categories anytime.
            </p>

            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
              {starterCategories.map((c) => (
                <div
                  key={c.name}
                  className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5"
                >
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${c.color}20` }}
                  >
                    <CategoryIcon name={c.name} icon={c.icon} color={c.color} size={14} />
                  </div>
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                    {c.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================
            STEP 3: Fast Expense Entry
           ======================================================== */}
        {step === 3 && (
          <div className="space-y-4 py-1">
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Logging expenses takes less than 2 seconds. Tap <strong>"+ Add Expense"</strong> or use the inline quick form on desktop.
            </p>

            <div className="space-y-2.5">
              <div className="p-3 rounded-2xl bg-purple-50/70 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-900/30 flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#6C47FF] text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                  <Zap size={16} />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white block">
                    Save &amp; Add Another
                  </span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                    Quickly record multiple expenses in a row without reopening the modal.
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/30 flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                  <ShieldCheck size={16} />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white block">
                    Private &amp; Offline Ready
                  </span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                    Your expenses are cached offline in IndexedDB and securely isolated in Cloud Firestore.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stepper Navigation Buttons */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-white/10">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft size={14} />
              <span>Back</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              Skip Tour
            </button>
          )}

          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              className="py-2.5 px-5 bg-[#6C47FF] hover:bg-[#5B36EE] text-white rounded-xl text-xs font-bold shadow-md shadow-purple-600/20 flex items-center gap-1.5 transition-all"
            >
              <span>Next</span>
              <ArrowRight size={14} />
            </button>
          ) : (
            <button
              type="button"
              disabled={isSaving}
              onClick={handleFinish}
              className="py-2.5 px-5 bg-gradient-to-r from-[#6C47FF] to-[#8B5CF6] hover:from-[#5B36EE] hover:to-[#7A4BE5] text-white rounded-xl text-xs font-bold shadow-md shadow-purple-600/25 flex items-center gap-1.5 transition-all"
            >
              <Check size={15} strokeWidth={2.5} />
              <span>{isSaving ? 'Saving...' : 'Start Tracking'}</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
