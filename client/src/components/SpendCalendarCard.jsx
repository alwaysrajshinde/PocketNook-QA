import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar, Plus, ArrowRight, ChevronRight, Flame
} from 'lucide-react';
import CategoryIcon from './CategoryIcon';
import { getTransactions } from '../services/api';

function parseMonthKey(monthKey) {
  const m = String(monthKey || '').match(/^(\d{4})-(\d{2})$/);
  if (m) {
    return { year: Number(m[1]), monthIdx: Number(m[2]) - 1 };
  }
  const now = new Date();
  return { year: now.getFullYear(), monthIdx: now.getMonth() };
}

function toIsoDate(year, monthIdx, day) {
  return `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default function SpendCalendarCard({
  dashboardData,
  selectedMonth,
  hideAmounts = false,
  formatCurrency = (v) => `₹${Number(v || 0).toLocaleString('en-IN')}`,
  onEditTransaction,
  onOpenAddForDate,
  onViewAllCategories
}) {
  const {
    month: dashMonth,
    budget = 0,
    total_spent = 0,
    today_date,
    top_categories = [],
    recent_transactions = []
  } = dashboardData || {};

  const activeMonth = selectedMonth || dashMonth || new Date().toISOString().slice(0, 7);
  const { year, monthIdx } = useMemo(() => parseMonthKey(activeMonth), [activeMonth]);
  const daysInMonth = useMemo(() => new Date(year, monthIdx + 1, 0).getDate(), [year, monthIdx]);

  // Monday-first weekday offset (Mon=0 ... Sun=6)
  const firstDayOffset = useMemo(() => {
    const jsDay = new Date(year, monthIdx, 1).getDay(); // 0=Sun..6=Sat
    return (jsDay + 6) % 7;
  }, [year, monthIdx]);

  const todayIso = today_date || new Date().toISOString().slice(0, 10);
  const defaultSelectedDate = todayIso.startsWith(activeMonth)
    ? todayIso
    : toIsoDate(year, monthIdx, 1);

  const [selectedDate, setSelectedDate] = useState(defaultSelectedDate);
  const [monthTransactions, setMonthTransactions] = useState(recent_transactions || []);
  const [viewMode, setViewMode] = useState('calendar'); // 'calendar' | 'categories'

  useEffect(() => {
    setSelectedDate(
      todayIso.startsWith(activeMonth) ? todayIso : toIsoDate(year, monthIdx, 1)
    );
  }, [activeMonth, todayIso, year, monthIdx]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await getTransactions({ month: activeMonth, limit: 1000 });
        if (!active) return;
        if (res && Array.isArray(res.transactions) && res.transactions.length > 0) {
          setMonthTransactions(res.transactions);
        } else if (Array.isArray(recent_transactions) && recent_transactions.length > 0) {
          setMonthTransactions(recent_transactions);
        } else if (res && Array.isArray(res.transactions)) {
          setMonthTransactions(res.transactions);
        }
      } catch {
        if (active && Array.isArray(recent_transactions)) {
          setMonthTransactions(recent_transactions);
        }
      }
    })();
    return () => { active = false; };
  }, [activeMonth, total_spent, recent_transactions]);

  const maskAmount = (val) => (hideAmounts ? '₹ ••••••' : formatCurrency(val));

  // Group expenses by YYYY-MM-DD
  const byDayMap = useMemo(() => {
    const map = {};
    for (const tx of monthTransactions || []) {
      const dateStr = String(tx.date || '').slice(0, 10);
      if (!dateStr.startsWith(activeMonth)) continue;
      if (!map[dateStr]) {
        map[dateStr] = { totalSpent: 0, txs: [] };
      }
      const amt = Number(tx.amount || 0);
      const isRefund = Boolean(tx.is_refund || tx.type === 'income' || amt < 0);
      if (!isRefund && amt > 0) {
        map[dateStr].totalSpent += amt;
      }
      map[dateStr].txs.push(tx);
    }
    return map;
  }, [monthTransactions, activeMonth]);

  // Thresholds relative to daily target pace (or median/max spend if no budget)
  const dailyBaseline = useMemo(() => {
    if (budget > 0) return Math.max(100, Math.round(budget / daysInMonth));
    const totals = Object.values(byDayMap).map((d) => d.totalSpent).filter((v) => v > 0);
    if (totals.length === 0) return 500;
    return Math.max(150, Math.round(totals.reduce((a, b) => a + b, 0) / totals.length));
  }, [budget, daysInMonth, byDayMap]);

  const dayCells = useMemo(() => {
    const cells = [];
    for (let i = 0; i < firstDayOffset; i++) {
      cells.push({ empty: true, key: `pad_${i}` });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = toIsoDate(year, monthIdx, d);
      const info = byDayMap[iso] || { totalSpent: 0, txs: [] };
      const spent = info.totalSpent;
      let level = 0; // 0 = ₹0, 1 = low, 2 = medium, 3 = high
      if (spent > 0) {
        const ratio = spent / dailyBaseline;
        if (ratio <= 0.75) level = 1;
        else if (ratio <= 1.6) level = 2;
        else level = 3;
      }
      cells.push({
        empty: false,
        day: d,
        iso,
        spent,
        txCount: info.txs.length,
        level,
        isToday: iso === todayIso
      });
    }
    return cells;
  }, [firstDayOffset, daysInMonth, year, monthIdx, byDayMap, dailyBaseline, todayIso]);

  const selectedDayInfo = byDayMap[selectedDate] || { totalSpent: 0, txs: [] };
  const selectedDayDisplay = useMemo(() => {
    try {
      return new Date(`${selectedDate}T00:00:00`).toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short'
      });
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  const monthHeading = useMemo(() => {
    try {
      return new Date(year, monthIdx, 1).toLocaleDateString('en-IN', {
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return activeMonth;
    }
  }, [year, monthIdx, activeMonth]);

  const levelClasses = {
    0: 'bg-slate-100/80 dark:bg-white/[0.04] text-slate-500 dark:text-slate-400 border-transparent hover:border-slate-300 dark:hover:border-white/20',
    1: 'bg-emerald-500/18 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 border-emerald-500/30',
    2: 'bg-[#6C47FF]/20 dark:bg-[#7C3AED]/30 text-[#4C1D95] dark:text-[#DDD6FE] border-[#6C47FF]/35',
    3: 'bg-amber-500/22 dark:bg-rose-500/25 text-amber-900 dark:text-rose-200 border-amber-500/40 dark:border-rose-500/40'
  };

  return (
    <div
      data-testid="spend-calendar-card"
      className="bg-white dark:bg-[#16132A] rounded-3xl p-4 sm:p-5 border border-slate-100 dark:border-white/10 shadow-xs space-y-3.5 transition-colors interactive-card card-hover-lift"
    >
      {/* Top Header + Mode Pill */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-[#6C47FF]/12 text-[#6C47FF] dark:text-[#C4B5FD] flex items-center justify-center flex-shrink-0">
            <Calendar size={16} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight truncate">
              Spend Heatmap · {monthHeading}
            </h3>
            <p className="text-[10.5px] text-slate-500 dark:text-slate-400 truncate">
              Tap any day to inspect or backdate expenses
            </p>
          </div>
        </div>

        {/* Toggle between Calendar Heatmap & Top Categories */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#100D1F] p-0.5 rounded-xl flex-shrink-0">
          <button
            type="button"
            onClick={() => setViewMode('calendar')}
            data-testid="heatmap-tab-calendar"
            className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold cursor-pointer transition-all ${
              viewMode === 'calendar'
                ? 'bg-white dark:bg-[#231D42] text-[#5B27DC] dark:text-[#C4B5FD] shadow-2xs'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            Calendar
          </button>
          <button
            type="button"
            onClick={() => setViewMode('categories')}
            data-testid="heatmap-tab-categories"
            className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold cursor-pointer transition-all ${
              viewMode === 'categories'
                ? 'bg-white dark:bg-[#231D42] text-[#5B27DC] dark:text-[#C4B5FD] shadow-2xs'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            Top Categories
          </button>
        </div>
      </div>

      {viewMode === 'calendar' ? (
        <>
          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1.5 text-center">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
              <span key={i} className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">
                {d}
              </span>
            ))}
          </div>

          {/* Interactive Calendar Day Grid */}
          <div className="grid grid-cols-7 gap-1.5" data-testid="spend-heatmap-grid">
            {dayCells.map((cell) => {
              if (cell.empty) {
                return <div key={cell.key} className="h-9" />;
              }
              const isSelected = cell.iso === selectedDate;
              return (
                <button
                  key={cell.iso}
                  type="button"
                  onClick={() => setSelectedDate(cell.iso)}
                  data-testid={`heatmap-day-${cell.iso}`}
                  aria-label={`${cell.iso}: spent ${formatCurrency(cell.spent)}`}
                  className={`relative h-9 rounded-xl border text-xs font-bold flex flex-col items-center justify-center transition-all cursor-pointer active:scale-95 ${
                    levelClasses[cell.level]
                  } ${
                    isSelected
                      ? 'ring-2 ring-[#6C47FF] dark:ring-[#A78BFA] ring-offset-1 ring-offset-white dark:ring-offset-[#16132A] scale-[1.03]'
                      : ''
                  }`}
                >
                  <span className="leading-none">{cell.day}</span>
                  {cell.txCount > 0 && (
                    <span
                      className={`w-1.5 h-1.5 rounded-full mt-0.5 ${
                        cell.level === 3
                          ? 'bg-rose-500'
                          : cell.level === 2
                          ? 'bg-[#6C47FF] dark:bg-[#A78BFA]'
                          : 'bg-emerald-500'
                      }`}
                    />
                  )}
                  {cell.isToday && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#6C47FF] border border-white dark:border-[#16132A]" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Intensity Legend */}
          <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 px-0.5">
            <span>Selected: <strong className="text-slate-700 dark:text-slate-200">{selectedDayDisplay}</strong></span>
            <div className="flex items-center gap-1.5">
              <span>₹0</span>
              <span className="w-2.5 h-2.5 rounded bg-slate-200 dark:bg-white/10 inline-block" />
              <span className="w-2.5 h-2.5 rounded bg-emerald-500/40 inline-block" />
              <span className="w-2.5 h-2.5 rounded bg-[#6C47FF]/50 inline-block" />
              <span className="w-2.5 h-2.5 rounded bg-rose-500/60 inline-block" />
              <span>High</span>
            </div>
          </div>

          {/* Selected Day Expanded Drawer / Timeline */}
          <div
            data-testid="heatmap-day-detail"
            className="rounded-2xl bg-slate-50 dark:bg-[#100D1F] border border-slate-200/70 dark:border-white/[0.08] p-3 space-y-2.5"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="text-xs font-extrabold text-slate-900 dark:text-white block">
                  {selectedDayDisplay} · {selectedDayInfo.txs.length} {selectedDayInfo.txs.length === 1 ? 'entry' : 'entries'}
                </span>
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  Day Spend: <strong className="text-slate-900 dark:text-white">{maskAmount(selectedDayInfo.totalSpent)}</strong>
                </span>
              </div>

              {typeof onOpenAddForDate === 'function' && (
                <button
                  type="button"
                  onClick={() => onOpenAddForDate(selectedDate)}
                  data-testid="heatmap-add-date-btn"
                  className="px-2.5 py-1.5 rounded-xl bg-[#6C47FF] hover:bg-[#5835E5] text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer active:scale-95 transition-all flex-shrink-0"
                >
                  <Plus size={12} />
                  <span>Add Expense</span>
                </button>
              )}
            </div>

            {selectedDayInfo.txs.length > 0 ? (
              <div className="divide-y divide-slate-200/60 dark:divide-white/[0.06] max-h-44 overflow-y-auto pr-0.5">
                {selectedDayInfo.txs.map((tx, idx) => {
                  const amt = Number(tx.amount || 0);
                  const isRefund = Boolean(tx.is_refund || tx.type === 'income' || amt < 0);
                  return (
                    <button
                      key={tx.id || idx}
                      type="button"
                      onClick={() => onEditTransaction && onEditTransaction(tx)}
                      className="w-full py-2 flex items-center justify-between gap-2 text-left hover:bg-white/60 dark:hover:bg-white/[0.04] px-1.5 -mx-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: `${tx.color || '#6C47FF'}18` }}
                        >
                          <CategoryIcon name={tx.category} icon={tx.icon} color={tx.color} size={13} />
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block truncate">
                            {tx.description || tx.category}
                          </span>
                          <span className="text-[10px] text-slate-400 block truncate">
                            {tx.category} · {tx.payment_mode || 'UPI'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span className={`text-xs font-extrabold ${isRefund ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>
                          {isRefund ? `+${maskAmount(Math.abs(amt))}` : maskAmount(amt)}
                        </span>
                        <ChevronRight size={13} className="text-slate-400" />
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="py-2 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Flame size={13} className="text-emerald-500" />
                  No expenses logged on {selectedDayDisplay}.
                </span>
              </div>
            )}
          </div>
        </>
      ) : (
        /* Top Categories Sub-View */
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Top spending channels
            </span>
            {typeof onViewAllCategories === 'function' && (
              <button
                type="button"
                onClick={onViewAllCategories}
                className="text-xs font-semibold text-[#6C47FF] dark:text-[#A78BFA] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>View All</span>
                <ArrowRight size={12} />
              </button>
            )}
          </div>
          {top_categories.slice(0, 4).map((cat) => (
            <div key={cat.name} className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-7 h-7 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${cat.color || '#6C47FF'}18` }}
                  >
                    <CategoryIcon name={cat.name} icon={cat.icon} color={cat.color || '#6C47FF'} size={14} />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{cat.name}</span>
                    <span className="text-[10.5px] text-slate-400 ml-1.5">{cat.tx_count} txs</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-black text-slate-900 dark:text-white">{maskAmount(cat.total ?? cat.amount)}</span>
                  <span className="text-[10px] text-slate-400 ml-1.5">{cat.percentage}%</span>
                </div>
              </div>
              <div className="w-full h-1.5 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(cat.percentage || 0, 100)}%`, backgroundColor: cat.color || '#6C47FF' }}
                />
              </div>
            </div>
          ))}
          {top_categories.length === 0 && (
            <div className="py-4 text-center text-xs text-slate-400">No expenses recorded for this month</div>
          )}
        </div>
      )}
    </div>
  );
}
