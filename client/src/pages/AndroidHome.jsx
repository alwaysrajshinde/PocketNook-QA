import React, { useState, useEffect } from 'react';
import { 
  Calendar, BarChart2, Plus, ArrowRight, Sparkles, Eye, EyeOff,
  CalendarClock
} from 'lucide-react';
import CategoryIcon from '../components/CategoryIcon';
import FiveOptionsShowcase from '../components/FiveOptionsShowcase';
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
          Interactive 5-Options Showcase (Replaces SpeedChips for testing 1-by-1)
         ======================================================== */}
      <FiveOptionsShowcase
        dashboardData={dashboardData}
        categories={categories}
        selectedMonth={selectedMonth}
        hideAmounts={hideAmounts}
        formatCurrency={formatCurrency}
        upcomingRenewals={upcomingRenewals}
        onQuickAddExpense={onQuickAddExpense}
        onOpenAddExpense={onOpenAddExpense}
        onEditTransaction={onEditTransaction}
        onDeleteTransaction={onDeleteTransaction}
        onOpenAddForDate={onOpenAddForDate}
        onViewAllCategories={onViewAllCategories}
        onViewAllTransactions={onViewAllTransactions}
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
          3. Top Categories Card (Matching Android UI Reference)
         ======================================================== */}
      <div className="bg-white dark:bg-[#16132A] rounded-3xl p-4 sm:p-5 border border-slate-100 dark:border-white/10 shadow-xs space-y-3.5 transition-colors interactive-card card-hover-lift">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            {t('topCategories', 'Top Categories')}
          </h3>
          <button
            onClick={onViewAllCategories}
            className="text-xs font-semibold text-[#6C47FF] dark:text-[#A78BFA] hover:underline flex items-center gap-1 transition-colors cursor-pointer"
          >
            <span>{t('seeAll', 'View All')}</span>
            <ArrowRight size={13} />
          </button>
        </div>

        <div className="space-y-3 pt-0.5">
          {top_categories.slice(0, 3).map((cat) => (
            <div key={cat.name} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center shadow-xs"
                    style={{ backgroundColor: `${cat.color || '#6C47FF'}18` }}
                  >
                    <CategoryIcon
                      name={cat.name}
                      icon={cat.icon}
                      color={cat.color || '#6C47FF'}
                      size={15}
                    />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {cat.name}
                    </span>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 ml-1.5 font-medium">
                      {cat.tx_count} txs
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs font-black text-slate-900 dark:text-white block">
                    {maskAmount(cat.total)}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                    {cat.percentage}%
                  </span>
                </div>
              </div>

              {/* Category Progress Bar */}
              <div className="w-full h-1.5 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(cat.percentage, 100)}%`,
                    backgroundColor: cat.color || '#6C47FF'
                  }}
                />
              </div>
            </div>
          ))}

          {top_categories.length === 0 && (
            <div className="py-4 text-center text-xs text-slate-400">
              No expenses recorded for this month
            </div>
          )}
        </div>
      </div>

      {/* ========================================================
          3.5. Recent Activity Card (Mobile Activity Stream)
         ======================================================== */}
      <div className="bg-white dark:bg-[#16132A] rounded-3xl p-4 sm:p-5 border border-slate-100 dark:border-white/10 shadow-xs space-y-3 transition-colors interactive-card card-hover-lift">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            {t('recentActivity', 'Recent Activity')}
          </h3>
          <button
            onClick={onViewAllTransactions}
            className="text-xs font-semibold text-[#6C47FF] dark:text-[#A78BFA] hover:underline flex items-center gap-1 transition-colors cursor-pointer"
          >
            <span>{t('seeAll', 'See All')}</span>
            <ArrowRight size={13} />
          </button>
        </div>

        <div className="divide-y divide-slate-50 dark:divide-white/5">
          {recent_transactions && recent_transactions.length > 0 ? (
            recent_transactions.slice(0, 3).map((tx) => (
              <div
                key={tx.id}
                onClick={() => onEditTransaction && onEditTransaction(tx)}
                className="py-2.5 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 px-2 -mx-2 rounded-xl transition-all tx-row active:scale-[0.99]"
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${tx.color || '#6C47FF'}18` }}
                  >
                    <CategoryIcon name={tx.category} icon={tx.icon} color={tx.color} size={15} />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block truncate max-w-[150px]">
                      {tx.description || tx.category}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">
                      {tx.date ? new Date(tx.date).toLocaleDateString('default', { day: 'numeric', month: 'short' }) : 'Today'} · {tx.payment_mode}
                    </span>
                  </div>
                </div>

                <span className={`text-xs font-extrabold ${tx.is_refund || tx.amount < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>
                  {tx.is_refund || tx.amount < 0 ? `+${maskAmount(Math.abs(tx.amount))}` : maskAmount(tx.amount)}
                </span>
              </div>
            ))
          ) : (
            <div className="py-3 text-center text-xs text-slate-400">
              No recent activity yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
