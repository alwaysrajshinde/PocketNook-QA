import React, { useState, useEffect } from 'react';
import {
  Calendar, BarChart2, Plus, ArrowRight, MoreVertical, Receipt,
  RotateCcw, Tag, FileText, Check, ChevronDown, Eye, EyeOff,
  CalendarClock, MessageSquare, Camera, Sparkles
} from 'lucide-react';
import CategoryIcon from '../components/CategoryIcon';
import CustomDropdown from '../components/CustomDropdown';
import SpeedChips from '../components/SpeedChips';
import { 
  getRecurringSubscriptions, 
  getUpcomingRenewals, 
  recordBillPaymentAsExpense 
} from '../services/recurringExpensesService';
import { useToast } from '../context/ToastContext';
import { useLanguage } from '../context/LanguageContext';

export default function Home({
  dashboardData,
  reportsData,
  categories = [],
  selectedMonth = new Date().toISOString().slice(0, 7),
  availableMonths = [],
  onOpenAddExpense,
  onQuickAddExpense,
  onViewAllCategories,
  onViewAllTransactions,
  onSetBudget,
  formatCurrency,
  onSelectMonth,
  onOpenSmsParser,
  onOpenWhatsAppAssistant,
  onOpenReceiptScanner,
  onOpenRecurringModal
}) {
  const { showToast } = useToast();
  const { t } = useLanguage();
  // Quick Add Expense Inline Form State (Must be top level before any early return)
  const [quickAmount, setQuickAmount] = useState('');
  const [quickCategory, setQuickCategory] = useState(categories[0]?.name || 'Food & Dining');
  const [quickDate, setQuickDate] = useState(dashboardData?.today_date || new Date().toISOString().slice(0, 10));
  const [quickDesc, setQuickDesc] = useState('');
  const [quickIsRefund, setQuickIsRefund] = useState(false);
  const [quickPaymentMode, setQuickPaymentMode] = useState('UPI');
  const [quickSaving, setQuickSaving] = useState(false);
  const [quickSuccess, setQuickSuccess] = useState(false);

  // Groww-style Show / Hide Financial Amounts on Overview
  const [hideAmounts, setHideAmounts] = useState(() => {
    try {
      return localStorage.getItem('expense_tracker_hide_amounts') === 'true';
    } catch (e) {
      return false;
    }
  });

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

  // Feature 4: Recurring Subscriptions Foregound Check
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
      if (onQuickAddExpense) {
        window.dispatchEvent(new Event('expense_tracker_updated'));
      }
    } catch (e) {
      showToast('Failed to log recurring bill', 'error');
    }
  };

  if (!dashboardData) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-400 text-sm">
        Loading overview...
      </div>
    );
  }

  const {
    budget = 12000,
    total_spent = 0,
    remaining_budget = 0,
    percent_spent = 0,
    today_spent = 0,
    week_spent = 0,
    top_categories = [],
    recent_transactions = []
  } = dashboardData;

  const {
    chart_data = [],
    monthly_trend = []
  } = reportsData || {};

  const percentSpentVal = Math.round(percent_spent * 10) / 10;

  // Circular progress math
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(percentSpentVal, 100) / 100) * circumference;

  // Donut chart math
  const donutSize = 135;
  const strokeWidth = 22;
  const center = donutSize / 2;
  const donutRadius = center - strokeWidth / 2;
  const donutCircumference = 2 * Math.PI * donutRadius;

  const totalRawPct = chart_data.reduce((sum, item) => sum + (parseFloat(item.percentage) || 0), 0);
  const normalizedScale = totalRawPct > 0 ? (100 / totalRawPct) : 1;

  let cumulativeAngle = 0;
  const donutSlices = chart_data.map((item) => {
    const normalizedPct = (parseFloat(item.percentage) || 0) * normalizedScale;
    const strokeDasharray = `${(normalizedPct / 100) * donutCircumference} ${donutCircumference}`;
    const strokeDashoffset = -((cumulativeAngle / 100) * donutCircumference);
    cumulativeAngle += normalizedPct;
    return {
      ...item,
      strokeDasharray,
      strokeDashoffset
    };
  });

  const handleQuickSubmit = async (e) => {
    e.preventDefault();
    if (!quickAmount || isNaN(parseFloat(quickAmount)) || parseFloat(quickAmount) <= 0) {
      showToast('Please enter a valid amount', 'warning');
      return;
    }

    try {
      setQuickSaving(true);
      await onQuickAddExpense({
        amount: parseFloat(quickAmount),
        category: quickCategory,
        payment_mode: quickPaymentMode,
        date: quickDate,
        description: quickDesc,
        is_refund: quickIsRefund
      });
      setQuickAmount('');
      setQuickDesc('');
      setQuickSuccess(true);
      showToast('Expense added successfully!', 'success');
      setTimeout(() => setQuickSuccess(false), 2000);
    } catch (err) {
      showToast(err.message || 'Failed to add expense', 'error');
    } finally {
      setQuickSaving(false);
    }
  };

  return (
    <div className="space-y-5 pb-6">
      {/* ========================================================
          ROW 1: Hero Purple Card + 3 Quick Stat Cards
         ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left: Hero Purple Card (takes ~45-50% on desktop) */}
        <div className="lg:col-span-5 purple-hero-gradient rounded-3xl p-5 sm:p-6 text-white shadow-xl shadow-purple-900/15 relative flex flex-col justify-between min-h-[185px] animate-card interactive-card card-hover-lift">
          <div className="flex items-center justify-between z-10">
            <div className="space-y-2.5">
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
                <p className="text-white text-base sm:text-lg font-bold tracking-tight mt-0.5">
                  {budget > 0 ? maskAmount(budget) : t('noBudgetSet', 'No budget set')}
                </p>
              </div>

              <div>
                <span className="text-white/80 text-[11px] font-semibold tracking-wide uppercase">
                  {t('spent', 'Spent')}
                </span>
                <p className="text-white text-3xl sm:text-4xl font-extrabold tracking-tight">
                  {maskAmount(total_spent)}
                </p>
              </div>

              <div className="pt-0.5">
                {budget > 0 ? (
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold shadow-sm ${remaining_budget >= 0
                    ? 'bg-emerald-100 text-emerald-950'
                    : 'bg-rose-100 text-rose-950'
                    }`}>
                    {remaining_budget >= 0 ? `${t('remaining', 'Remaining')}: ` : `${t('remaining', 'Remaining')}: `}
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
            <div className="relative flex items-center justify-center flex-shrink-0 mr-1 sm:mr-2">
              <svg className="w-28 h-28 transform -rotate-90">
                <circle
                  cx="56"
                  cy="56"
                  r={radius}
                  className="text-white/20"
                  strokeWidth="7"
                  stroke="currentColor"
                  fill="transparent"
                />
                <circle
                  cx="56"
                  cy="56"
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
                <span className="text-white text-base font-extrabold tracking-tight">
                  {percentSpentVal}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: 3 Stat Cards in a row (takes ~50-55% on desktop) */}
        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Today */}
          <div className="bg-white dark:bg-[#16132A] rounded-3xl p-5 border border-slate-100 dark:border-white/10 shadow-sm flex flex-col justify-between transition-colors interactive-card card-hover-lift">
            <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-purple-900/30 text-[#6C47FF] dark:text-[#A78BFA] flex items-center justify-center mb-4">
              <Calendar size={18} />
            </div>
            <div>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">
                {t('today', 'Today')}
              </span>
              <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {maskAmount(today_spent)}
              </span>
            </div>
          </div>

          {/* This Week */}
          <div className="bg-white dark:bg-[#16132A] rounded-3xl p-5 border border-slate-100 dark:border-white/10 shadow-sm flex flex-col justify-between transition-colors interactive-card card-hover-lift">
            <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-purple-900/30 text-[#6C47FF] dark:text-[#A78BFA] flex items-center justify-center mb-4">
              <BarChart2 size={18} />
            </div>
            <div>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">
                {t('thisWeek', 'This Week')}
              </span>
              <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {maskAmount(week_spent)}
              </span>
            </div>
          </div>

          {/* This Month */}
          <div className="bg-white dark:bg-[#16132A] rounded-3xl p-5 border border-slate-100 dark:border-white/10 shadow-sm flex flex-col justify-between transition-colors interactive-card card-hover-lift">
            <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-purple-900/30 text-[#6C47FF] dark:text-[#A78BFA] flex items-center justify-center mb-4">
              <Calendar size={18} />
            </div>
            <div>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">
                {t('thisMonth', 'This Month')}
              </span>
              <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {maskAmount(total_spent)}
              </span>
            </div>
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
          Smart Automation Strip (SMS Parser, Receipt OCR, WhatsApp Assistant)
         ======================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 bg-gradient-to-r from-purple-500/5 via-blue-500/5 to-emerald-500/5 dark:bg-white/[0.02] border border-purple-500/15 dark:border-white/10 rounded-2xl p-3">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-[#6C47FF] dark:text-[#A78BFA]" />
          <span className="text-xs font-bold text-slate-800 dark:text-white">Smart Automations:</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={onOpenSmsParser}
            data-testid="home-open-sms-parser-btn"
            className="px-3 py-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <MessageSquare size={13} />
            <span>SMS / UPI Parser</span>
          </button>
          <button
            type="button"
            onClick={onOpenReceiptScanner}
            data-testid="home-open-receipt-scanner-btn"
            className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Camera size={13} />
            <span>Scan Receipt</span>
          </button>
          <button
            type="button"
            onClick={onOpenWhatsAppAssistant}
            data-testid="home-open-whatsapp-assistant-btn"
            className="px-3 py-1.5 rounded-xl bg-[#008069] text-white hover:bg-[#00705c] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
          >
            <span>💬 WhatsApp Assistant</span>
          </button>
          <button
            type="button"
            onClick={onOpenRecurringModal}
            data-testid="home-open-recurring-modal-btn"
            className="px-3 py-1.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <CalendarClock size={13} />
            <span>Recurring Bills</span>
          </button>
        </div>
      </div>

      {/* ========================================================
          Feature 4: Upcoming Recurring Bills Banner
         ======================================================== */}
      {upcomingRenewals.length > 0 && (
        <div 
          data-testid="upcoming-bills-banner"
          className="rounded-2xl bg-amber-500/10 border border-amber-500/25 p-3 flex flex-wrap items-center justify-between gap-3 text-xs"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <CalendarClock size={16} />
            </div>
            <div>
              <span className="font-bold text-slate-800 dark:text-slate-100">
                Upcoming Bill Renewal: {upcomingRenewals[0].name} ({formatCurrency(upcomingRenewals[0].amount)})
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                Due in {upcomingRenewals[0].daysRemaining} {upcomingRenewals[0].daysRemaining === 1 ? 'day' : 'days'} ({upcomingRenewals[0].nextDueDate})
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleLogRecurringBill(upcomingRenewals[0])}
            data-testid="log-recurring-bill-1tap-btn"
            className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-xs cursor-pointer transition-colors"
          >
            Log Now (1-Tap)
          </button>
        </div>
      )}

      {/* ========================================================
          ROW 2: Top Categories + Spending by Category + Monthly Trend
         ======================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* CARD 1: Top Categories */}
        <div className="bg-white dark:bg-[#16132A] rounded-3xl p-5 border border-slate-100 dark:border-white/10 shadow-sm space-y-4 transition-colors interactive-card card-hover-lift">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {t('topCategories', 'Top Categories')}
            </h3>
            <button
              onClick={onViewAllCategories}
              className="text-xs font-semibold text-[#6C47FF] dark:text-[#A78BFA] hover:underline flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>{t('viewAll', 'View All')}</span>
              <ArrowRight size={13} />
            </button>
          </div>

          <div className="space-y-3.5 pt-1">
            {top_categories.slice(0, 3).map((cat) => (
              <div key={cat.name} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center shadow-xs"
                      style={{ backgroundColor: `${cat.color || '#6C47FF'}18` }}
                    >
                      <CategoryIcon name={cat.name} icon={cat.icon} color={cat.color} size={16} />
                    </div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {cat.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      {maskAmount(cat.amount)}
                    </span>
                    <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 w-11 text-right">
                      {cat.percentage}%
                    </span>
                  </div>
                </div>

                <div className="w-full bg-slate-100 dark:bg-white/10 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#6C47FF] dark:bg-[#8B5CF6] transition-all duration-500"
                    style={{ width: `${Math.min(cat.percentage, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CARD 2: Spending by Category (Donut + Legend) */}
        <div className="bg-white dark:bg-[#16132A] rounded-3xl p-5 border border-slate-100 dark:border-white/10 shadow-sm space-y-3 transition-colors interactive-card card-hover-lift">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Spending by Category
          </h3>

          <div className="flex items-center justify-between gap-3 pt-1">
            {/* Donut Chart */}
            <div className="relative flex-shrink-0 flex items-center justify-center">
              <svg width={donutSize} height={donutSize} className="transform -rotate-90">
                {donutSlices.map((slice, i) => (
                  <circle
                    key={slice.name || i}
                    cx={center}
                    cy={center}
                    r={donutRadius}
                    fill="transparent"
                    stroke={slice.color || '#6C47FF'}
                    strokeWidth={strokeWidth}
                    strokeDasharray={slice.strokeDasharray}
                    strokeDashoffset={slice.strokeDashoffset}
                    className="transition-all duration-500"
                  />
                ))}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-xs font-black text-slate-900 dark:text-white leading-tight">
                  {maskAmount(total_spent)}
                </span>
                <span className="text-[9px] text-slate-400 font-medium">
                  Total
                </span>
              </div>
            </div>

            {/* Legend */}
            <div className="flex-1 space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {chart_data.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5 truncate">
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: item.color || '#6C47FF' }}
                    />
                    <span className="text-slate-700 dark:text-slate-300 font-medium truncate">
                      {item.name}
                    </span>
                  </div>
                  <span className="font-bold text-slate-900 dark:text-white ml-1.5">
                    {item.percentage}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CARD 3: Monthly Trend */}
        <div className="bg-white dark:bg-[#16132A] rounded-3xl p-5 border border-slate-100 dark:border-white/10 shadow-sm space-y-2 transition-colors interactive-card card-hover-lift">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Monthly Trend
          </h3>

          <div className="flex gap-2 pt-3 pb-1">
            {/* Y Axis ticks */}
            <div className="flex flex-col justify-between text-[9px] font-semibold text-slate-400 pr-1 h-36">
              <span>20K</span>
              <span>16K</span>
              <span>12K</span>
              <span>8K</span>
              <span>4K</span>
              <span>0</span>
            </div>

            {/* Bars */}
            <div className="flex-1 flex items-end justify-between gap-1.5 h-36 border-b border-slate-200 dark:border-white/10 pb-0.5">
              {monthly_trend.map((m) => {
                const heightPercent = Math.min(100, Math.max(8, (m.total / 20000) * 100));
                const isCurrent = m.month_key === selectedMonth;

                return (
                  <div
                    key={m.month_key}
                    onClick={() => onSelectMonth(m.month_key)}
                    className="flex-1 flex flex-col items-center gap-1 cursor-pointer group"
                  >
                    <div className="h-5 flex items-center justify-center">
                      {isCurrent && (
                        <span className="text-[9px] font-black bg-[#6C47FF] dark:bg-[#8B5CF6] text-white px-1.5 py-0.5 rounded shadow-xs whitespace-nowrap">
                          {maskAmount(m.total)}
                        </span>
                      )}
                    </div>

                    {/* Bar */}
                    <div className="w-full max-w-[24px] h-24 flex items-end">
                      <div
                        className={`w-full rounded-t-md transition-all duration-500 ${isCurrent
                          ? 'bg-gradient-to-t from-[#5B27DC] to-[#7B42F6] dark:from-[#7C3AED] dark:to-[#A78BFA] shadow-xs'
                          : 'bg-purple-100 dark:bg-white/10 hover:bg-purple-200 dark:hover:bg-white/20'
                          }`}
                        style={{ height: `${heightPercent}%` }}
                      />
                    </div>

                    <span className={`text-[10px] ${isCurrent ? 'font-bold text-[#6C47FF] dark:text-[#A78BFA]' : 'text-slate-400'
                      }`}>
                      {m.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================
          ROW 3: Recent Transactions Table + Quick Add Expense
         ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left: Recent Transactions Table (takes 7 cols on desktop) */}
        <div className="lg:col-span-7 bg-white dark:bg-[#16132A] rounded-3xl p-5 border border-slate-100 dark:border-white/10 shadow-sm space-y-3 transition-colors interactive-card card-hover-lift">
          <div className="flex items-center justify-between pb-1">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Recent Transactions
            </h3>
            <button
              onClick={onViewAllTransactions}
              className="text-xs font-semibold text-[#6C47FF] dark:text-[#A78BFA] hover:underline flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>View All</span>
              <ArrowRight size={13} />
            </button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-white/10 text-slate-400 dark:text-slate-500 text-[11px] font-semibold">
                  <th className="pb-2.5 font-semibold">Date</th>
                  <th className="pb-2.5 font-semibold">Description</th>
                  <th className="pb-2.5 font-semibold">Category</th>
                  <th className="pb-2.5 font-semibold">Payment Mode</th>
                  <th className="pb-2.5 font-semibold text-right">Amount</th>
                  <th className="pb-2.5 w-6"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                {recent_transactions && recent_transactions.length > 0 ? (
                  recent_transactions.slice(0, 5).map((tx) => (
                    <tr key={tx.id} className="group hover:bg-slate-50/80 dark:hover:bg-white/5 transition-colors tx-row">
                      <td className="py-3 flex items-center gap-2">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: `${tx.color || '#6C47FF'}18` }}
                        >
                          <CategoryIcon name={tx.category} icon={tx.icon} color={tx.color} size={14} />
                        </div>
                        <span className="font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                          {tx.date ? new Date(tx.date).toLocaleDateString('default', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Today'}
                        </span>
                      </td>
                      <td className="py-3 font-bold text-slate-900 dark:text-white">
                        {tx.description || tx.category}
                      </td>
                      <td className="py-3 text-slate-600 dark:text-slate-300">
                        {tx.category}
                      </td>
                      <td className="py-3 text-slate-600 dark:text-slate-300">
                        <span className="bg-slate-100 dark:bg-white/10 px-2 py-0.5 rounded text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                          {tx.payment_mode}
                        </span>
                      </td>
                      <td className="py-3 text-right font-black text-slate-900 dark:text-white whitespace-nowrap">
                        {tx.is_refund || tx.amount < 0 ? (
                          <span className="text-emerald-600 dark:text-emerald-400">+{maskAmount(Math.abs(tx.amount))}</span>
                        ) : (
                          maskAmount(tx.amount)
                        )}
                      </td>
                      <td className="py-3 text-center text-slate-400 hover:text-slate-600">
                        <MoreVertical size={14} className="cursor-pointer" />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-xs text-slate-400">
                      No transactions recorded for this month yet. Use the Quick Add form on the right to log your first expense.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Quick Add Expense Widget (takes 5 cols on desktop) */}
        <div className="lg:col-span-5 bg-white dark:bg-[#16132A] rounded-3xl p-5 border border-slate-100 dark:border-white/10 shadow-sm space-y-3.5 transition-colors interactive-card card-hover-lift">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Quick Add Expense
            </h3>

            {/* Expense vs Refund Toggle */}
            <div className="flex bg-slate-100 dark:bg-white/10 p-0.5 rounded-xl text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => setQuickIsRefund(false)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all ${!quickIsRefund
                  ? 'bg-[#6C47FF] text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                  }`}
              >
                <Receipt size={13} />
                <span>Expense</span>
              </button>
              <button
                type="button"
                onClick={() => setQuickIsRefund(true)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all ${quickIsRefund
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                  }`}
              >
                <RotateCcw size={13} />
                <span>Refund / Return</span>
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleQuickSubmit} className="space-y-3">
            {/* Amount Input */}
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                ₹
              </span>
              <input
                type="number"
                step="any"
                min="0.01"
                required
                placeholder="0"
                value={quickAmount}
                onChange={(e) => setQuickAmount(e.target.value)}
                className="w-full pl-8 pr-4 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#6C47FF] transition-all"
              />
            </div>

            {/* Category & Date Pickers in one row */}
            <div className="grid grid-cols-2 gap-2.5">
              {/* Custom Category Dropdown */}
              <CustomDropdown
                value={quickCategory}
                onChange={(val) => setQuickCategory(val)}
                options={categories.map((c) => ({
                  value: c.name,
                  label: c.name,
                  color: c.color
                }))}
                searchable={true}
                placeholder="Category"
                className="w-full"
              />

              {/* Date Input */}
              <div className="relative">
                <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="date"
                  required
                  value={quickDate}
                  onChange={(e) => setQuickDate(e.target.value)}
                  className="w-full pl-8 pr-3 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#6C47FF]"
                />
              </div>
            </div>

            {/* Description Input */}
            <div className="relative">
              <FileText size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Add description (optional)"
                value={quickDesc}
                onChange={(e) => setQuickDesc(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-xs font-medium text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#6C47FF] transition-all"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={quickSaving}
              className="w-full py-3 px-6 rounded-2xl bg-gradient-to-r from-[#5B27DC] to-[#7B42F6] hover:from-[#4E1FC5] hover:to-[#6E32E9] text-white font-bold text-xs shadow-md shadow-purple-600/25 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
            >
              <Plus size={16} strokeWidth={2.5} />
              <span>{quickSaving ? 'Saving...' : quickSuccess ? '✓ Expense Added!' : 'Add Expense'}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
