import React, { useState, useEffect } from 'react';
import { 
  Calendar, BarChart2, Plus, ArrowRight, Sparkles, Eye, EyeOff,
  CalendarClock
} from 'lucide-react';
import CategoryIcon from '../components/CategoryIcon';
import SpeedChips from '../components/SpeedChips';
import SpendVisualGraphCard from '../components/SpendVisualGraphCard';
import { 
  getRecurringSubscriptions, 
  getUpcomingRenewals, 
  recordBillPaymentAsExpense 
} from '../services/recurringExpensesService';
import { useToast } from '../context/ToastContext';
import { useLanguage } from '../context/LanguageContext';

export default function AndroidHome({
  dashboardData,
  selectedMonth,
  onOpenAddExpense,
  onOpenAddForDate,
  onQuickAddExpense,
  onViewAllCategories,
  onViewAllTransactions,
  onSetBudget,
  onEditTransaction,
  onDeleteTransaction,
  formatCurrency,
  categories = [],
  onOpenSmsParser,
  onOpenWhatsAppAssistant,
  onOpenReceiptScanner,
  onOpenRecurringModal
}) {
  const { t } = useLanguage();
  const { showToast } = useToast();

  // Groww-style Show / Hide Financial Amounts on Overview
  const [hideAmounts, setHideAmounts] = useState(() => {
    try {
      return localStorage.getItem('expense_tracker_hide_amounts') === 'true';
    } catch (e) {
      return false;
    }
  });

  const [upcomingRenewals, setUpcomingRenewals] = useState([]);

  useEffect(() => {
    try {
      const subs = getRecurringSubscriptions();
      const renewals = getUpcomingRenewals(subs, 7);
      setUpcomingRenewals(renewals || []);
    } catch (e) {}
  }, []);

  const handleLogRecurringBill = async (sub) => {
    try {
      await recordBillPaymentAsExpense(sub);
      showToast(`Logged ₹${sub.amount} for ${sub.name}!`, 'success');
      const subs = getRecurringSubscriptions();
      setUpcomingRenewals(getUpcomingRenewals(subs, 7));
      window.dispatchEvent(new Event('expense_tracker_updated'));
    } catch (e) {
      showToast('Failed to log recurring bill', 'error');
    }
  };

  const toggleHideAmounts = () => {
    const next = !hideAmounts;
    setHideAmounts(next);
    try {
      localStorage.setItem('expense_tracker_hide_amounts', String(next));
      window.dispatchEvent(new Event('expense_tracker_hide_amounts_changed'));
    } catch (e) {}
  };

  useEffect(() => {
    const handleSync = () => {
      try {
        setHideAmounts(localStorage.getItem('expense_tracker_hide_amounts') === 'true');
      } catch (e) {}
    };
    window.addEventListener('expense_tracker_hide_amounts_changed', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('expense_tracker_hide_amounts_changed', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  const maskAmount = (val) => {
    if (hideAmounts) return '₹ ••••••';
    return formatCurrency(val);
  };

  if (!dashboardData) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-400 text-sm">
        Loading overview...
      </div>
    );
  }

  const {
    budget = 0,
    total_spent = 0,
    remaining_budget = 0,
    percent_spent = 0,
    today_spent = 0,
    week_spent = 0,
    top_categories = [],
    recent_transactions = []
  } = dashboardData;

  const percentSpentVal = Math.round(percent_spent * 10) / 10;
  const todayFormatted = new Date().toLocaleDateString('default', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

  // Circular progress math
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(percentSpentVal, 100) / 100) * circumference;

  return (
    <div className="space-y-4 px-4 pb-28 pt-1">
      {/* ========================================================
          1. Hero Purple Card (Matching Modern Purple Expense Tracker UI.png)
         ======================================================== */}
      <div className="purple-hero-gradient rounded-3xl p-5 text-white shadow-xl shadow-purple-900/15 relative flex flex-col justify-between min-h-[175px] animate-card interactive-card card-hover-lift">
        <div className="flex items-center justify-between z-10">
          <div className="space-y-2 min-w-0 flex-1 mr-2">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-white/80 text-[11px] font-semibold tracking-wide uppercase">
                  {t('monthlyBudget', 'Monthly Budget')}
                </span>
                <button
                  type="button"
                  onClick={toggleHideAmounts}
                  data-testid="toggle-hide-amounts"
                  aria-label={hideAmounts ? "Show amounts" : "Hide amounts"}
                  title={hideAmounts ? "Show amounts" : "Hide amounts"}
                  className="p-1 rounded-full text-white/80 hover:text-white hover:bg-white/20 active:scale-90 transition-all cursor-pointer inline-flex items-center justify-center"
                >
                  {hideAmounts ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <p className="text-white text-base font-bold tracking-tight truncate mt-0.5" title={hideAmounts ? '••••••' : formatCurrency(budget)}>
                {budget > 0 ? maskAmount(budget) : t('noBudgetSet', 'No budget set')}
              </p>
            </div>

            <div>
              <span className="text-white/80 text-[11px] font-semibold tracking-wide uppercase">
                {t('spent', 'Spent')}
              </span>
              <p className="text-white text-2xl sm:text-3xl font-black tracking-tight truncate max-w-[170px] sm:max-w-none" title={hideAmounts ? '••••••' : formatCurrency(total_spent)}>
                {maskAmount(total_spent)}
              </p>
            </div>

            <div className="pt-0.5">
              {budget > 0 ? (
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold shadow-xs truncate max-w-full ${remaining_budget >= 0
                  ? 'bg-emerald-100 text-emerald-950'
                  : 'bg-rose-100 text-rose-950'
                  }`}>
                  {remaining_budget >= 0 ? `${t('remaining', 'Remaining')}: ` : `${t('remaining', 'Remaining')}: Over by `}
                  {maskAmount(Math.abs(remaining_budget))}
                </span>
              ) : (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-purple-200/90 text-purple-950 shadow-xs">
                  {t('noBudgetSet', 'No budget set')}
                </span>
              )}
            </div>
          </div>

          {/* Circular Progress Gauge */}
          <div className="relative flex items-center justify-center flex-shrink-0 mr-1">
            <svg viewBox="0 0 96 96" className="w-20 h-20 sm:w-24 sm:h-24 transform -rotate-90">
              <circle
                cx="48"
                cy="48"
                r={radius}
                className="text-white/20"
                strokeWidth="7"
                stroke="currentColor"
                fill="transparent"
              />
              <circle
                cx="48"
                cy="48"
                r={radius}
                className="text-white"
                strokeWidth="7"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                stroke="currentColor"
                fill="transparent"
                style={{ transition: 'stroke-dashoffset 0.8s ease-in-out' }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-white text-xs sm:text-sm font-extrabold tracking-tight">
                {percentSpentVal}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================
          2. Quick Stat Cards (3 Cards in a Row)
         ======================================================== */}
      <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
        {/* Today */}
        <div className="bg-white dark:bg-[#16132A] rounded-2xl p-2.5 sm:p-3.5 border border-slate-100 dark:border-white/10 shadow-xs flex flex-col justify-between transition-colors min-w-0 interactive-card card-hover-lift">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-[#6C47FF] dark:text-[#A78BFA] flex items-center justify-center mb-1.5 sm:mb-2">
            <Calendar size={14} />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 block mb-0.5 truncate">
              {t('today', 'Today')}
            </span>
            <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white tracking-tight truncate block" title={hideAmounts ? '••••••' : formatCurrency(today_spent)}>
              {maskAmount(today_spent)}
            </span>
          </div>
        </div>

        {/* This Week */}
        <div className="bg-white dark:bg-[#16132A] rounded-2xl p-2.5 sm:p-3.5 border border-slate-100 dark:border-white/10 shadow-xs flex flex-col justify-between transition-colors min-w-0 interactive-card card-hover-lift">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-[#6C47FF] dark:text-[#A78BFA] flex items-center justify-center mb-1.5 sm:mb-2">
            <BarChart2 size={14} />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 block mb-0.5 truncate">
              {t('thisWeek', 'This Week')}
            </span>
            <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white tracking-tight truncate block" title={hideAmounts ? '••••••' : formatCurrency(week_spent)}>
              {maskAmount(week_spent)}
            </span>
          </div>
        </div>

        {/* This Month */}
        <div className="bg-white dark:bg-[#16132A] rounded-2xl p-2.5 sm:p-3.5 border border-slate-100 dark:border-white/10 shadow-xs flex flex-col justify-between transition-colors min-w-0 interactive-card card-hover-lift">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-[#6C47FF] dark:text-[#A78BFA] flex items-center justify-center mb-1.5 sm:mb-2">
            <Calendar size={14} />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 block mb-0.5 truncate">
              {t('thisMonth', 'This Month')}
            </span>
            <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white tracking-tight truncate block" title={hideAmounts ? '••••••' : formatCurrency(total_spent)}>
              {maskAmount(total_spent)}
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================
          Feature 3: Speed Chips 1-Tap Frequent Expense Widget
         ======================================================== */}
      <SpeedChips
        onQuickAdd={onQuickAddExpense}
        categories={categories}
        formatCurrency={formatCurrency}
      />


      {/* ========================================================
          Feature 4: Upcoming Recurring Bills Alert (Mobile)
         ======================================================== */}
      {upcomingRenewals.length > 0 && (
        <div 
          data-testid="android-upcoming-bills-banner"
          className="rounded-2xl bg-amber-500/10 border border-amber-500/25 p-3 flex items-center justify-between gap-2 text-xs"
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
              <CalendarClock size={14} />
            </div>
            <div className="min-w-0">
              <span className="font-bold text-slate-800 dark:text-slate-100 truncate block">
                {upcomingRenewals[0].name} ({formatCurrency(upcomingRenewals[0].amount)})
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">
                Due in {upcomingRenewals[0].daysRemaining}d ({upcomingRenewals[0].nextDueDate})
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleLogRecurringBill(upcomingRenewals[0])}
            data-testid="android-log-recurring-bill-btn"
            className="px-2.5 py-1.5 rounded-xl bg-amber-600 text-white font-bold text-[11px] shadow-xs flex-shrink-0 cursor-pointer active:scale-95"
          >
            Log 1-Tap
          </button>
        </div>
      )}

      {/* ========================================================
          3. Visual Spend Pulse Graph (Replaces Top Categories & Recent Activity)
         ======================================================== */}
      <SpendVisualGraphCard
        dashboardData={dashboardData}
        selectedMonth={selectedMonth}
      />
    </div>
  );
}
