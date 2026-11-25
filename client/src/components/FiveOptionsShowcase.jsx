import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp, CheckCircle2, ClipboardPaste, CreditCard, ShieldAlert,
  Plus, Check, X, Pencil, Trash2, Zap, Sparkles, Repeat, AlertTriangle, ArrowUpRight
} from 'lucide-react';
import { getTransactions, getCurrentUserId } from '../services/api';
import { parseSmsNotification } from '../services/smsParserService';
import { useToast } from '../context/ToastContext';

const OPTIONS_META = [
  { id: '1', shortLabel: '1 · Runway', label: 'Month-End Runway', icon: TrendingUp },
  { id: '2', shortLabel: '2 · Usuals', label: "Today's Usuals", icon: CheckCircle2 },
  { id: '3', shortLabel: '3 · Fast Drop', label: 'Multi / SMS Drop', icon: ClipboardPaste },
  { id: '4', shortLabel: '4 · Wallets', label: 'UPI / Card / Cash', icon: CreditCard },
  { id: '5', shortLabel: '5 · Inspector', label: 'Leak & Dup Audit', icon: ShieldAlert }
];

const OPTION_TAB_KEY = 'et_meaningful_option_tab';

const DEFAULT_FIXED_KEYWORDS = [
  'rent', 'mutual fund', 'emi', 'loan', 'electricity', 'bill', 'utilities',
  'recharge', 'mobile recharge', 'subscription', 'housing', 'insurance', 'sip', 'broadband', 'wifi'
];

function safeReadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch {}
  return fallback;
}

function isDefaultFixedCategory(catName = '', desc = '') {
  const hay = `${catName} ${desc}`.toLowerCase();
  return DEFAULT_FIXED_KEYWORDS.some((kw) => hay.includes(kw));
}

function getMonthDayStats(monthKey) {
  const m = String(monthKey || '').match(/^(\d{4})-(\d{2})$/);
  const now = new Date();
  const year = m ? Number(m[1]) : now.getFullYear();
  const monthIdx = m ? Number(m[2]) - 1 : now.getMonth();
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  let daysElapsed = daysInMonth;
  if (`${year}-${String(monthIdx + 1).padStart(2, '0')}` === currentMonthKey) {
    daysElapsed = Math.max(1, now.getDate());
  } else if (`${year}-${String(monthIdx + 1).padStart(2, '0')}` > currentMonthKey) {
    daysElapsed = 1;
  }
  const daysLeft = Math.max(0, daysInMonth - daysElapsed);
  return { year, monthIdx, daysInMonth, daysElapsed, daysLeft };
}

export default function FiveOptionsShowcase({
  dashboardData,
  categories = [],
  selectedMonth,
  hideAmounts = false,
  formatCurrency = (v) => `₹${Number(v || 0).toLocaleString('en-IN')}`,
  onQuickAddExpense,
  onOpenAddExpense,
  onEditTransaction,
  onDeleteTransaction,
  onViewAllTransactions
}) {
  const { showToast } = useToast();
  const uid = getCurrentUserId() || '1';
  const activeMonth = selectedMonth || dashboardData?.month || new Date().toISOString().slice(0, 7);
  const todayIso = dashboardData?.today_date || new Date().toISOString().slice(0, 10);

  const [activeOption, setActiveOption] = useState(() => {
    try {
      const saved = localStorage.getItem(OPTION_TAB_KEY);
      if (saved && ['1', '2', '3', '4', '5'].includes(saved)) return saved;
    } catch {}
    return '1';
  });

  const handleSelectOption = (id) => {
    setActiveOption(id);
    try {
      localStorage.setItem(OPTION_TAB_KEY, id);
    } catch {}
  };

  const maskAmount = (val) => (hideAmounts ? '₹ ••••••' : formatCurrency(val));

  // Real month + recent history transactions
  const [monthTxs, setMonthTxs] = useState(dashboardData?.recent_transactions || []);
  const [allHistoryTxs, setAllHistoryTxs] = useState(dashboardData?.recent_transactions || []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [monthRes, histRes] = await Promise.all([
          getTransactions({ month: activeMonth, limit: 1000 }),
          getTransactions({ limit: 500 })
        ]);
        if (!active) return;
        if (monthRes && Array.isArray(monthRes.transactions) && monthRes.transactions.length > 0) {
          setMonthTxs(monthRes.transactions);
        } else if (Array.isArray(dashboardData?.recent_transactions)) {
          setMonthTxs(dashboardData.recent_transactions);
        }
        if (histRes && Array.isArray(histRes.transactions) && histRes.transactions.length > 0) {
          setAllHistoryTxs(histRes.transactions);
        } else if (Array.isArray(monthRes?.transactions)) {
          setAllHistoryTxs(monthRes.transactions);
        }
      } catch {
        if (active && Array.isArray(dashboardData?.recent_transactions)) {
          setMonthTxs(dashboardData.recent_transactions);
        }
      }
    })();
    return () => { active = false; };
  }, [activeMonth, dashboardData?.total_spent, dashboardData?.recent_transactions]);

  // ========================================================
  // OPTION 1: Month-End Runway & Fixed vs. Variable Split
  // ========================================================
  const fixedCatsKey = `et_fixed_cats_${uid}`;
  const [customFixedMap, setCustomFixedMap] = useState(() => safeReadJson(fixedCatsKey, {}));
  useEffect(() => {
    try {
      localStorage.setItem(fixedCatsKey, JSON.stringify(customFixedMap));
    } catch {}
  }, [customFixedMap, fixedCatsKey]);

  const runwayAnalysis = useMemo(() => {
    const budget = Number(dashboardData?.budget || 0);
    const { monthIdx, daysInMonth, daysElapsed, daysLeft } = getMonthDayStats(activeMonth);
    const expenses = (monthTxs || []).filter((t) => !t.is_refund && Number(t.amount || 0) > 0);

    let fixedTotal = 0;
    let variableTotal = 0;
    const catMeta = {};

    for (const tx of expenses) {
      const amt = Number(tx.amount || 0);
      const cat = String(tx.category || 'Other').trim();
      const customFlag = customFixedMap[cat];
      const isFixed = customFlag !== undefined ? Boolean(customFlag) : isDefaultFixedCategory(cat, tx.description);
      if (isFixed) fixedTotal += amt;
      else variableTotal += amt;
      if (!catMeta[cat]) catMeta[cat] = { name: cat, total: 0, isFixed };
      catMeta[cat].total += amt;
    }

    // Fall back gracefully if monthTxs lacked full items relative to dashboard total_spent
    const txSum = fixedTotal + variableTotal;
    const dashSpent = Number(dashboardData?.total_spent || 0);
    if (dashSpent > txSum + 1) {
      variableTotal += dashSpent - txSum;
    }

    const totalSpent = fixedTotal + variableTotal;
    const variableDailyBurn = daysElapsed > 0 ? Math.round(variableTotal / daysElapsed) : 0;
    const projectedVariableRemaining = variableDailyBurn * daysLeft;
    const projectedEndTotal = Math.round(totalSpent + projectedVariableRemaining);
    const variance = budget > 0 ? budget - projectedEndTotal : 0;
    const remainingBudget = budget > 0 ? budget - totalSpent : 0;
    const safeDailyAllowance = daysLeft > 0 ? Math.max(0, Math.round(remainingBudget / daysLeft)) : 0;

    let runOutDayLabel = null;
    if (budget > 0 && totalSpent < budget && variableDailyBurn > 0 && variance < 0) {
      const daysUntilZero = Math.floor(remainingBudget / variableDailyBurn);
      const runOutDayNum = Math.min(daysInMonth, daysElapsed + Math.max(1, daysUntilZero));
      const dt = new Date(2026, monthIdx, runOutDayNum);
      runOutDayLabel = dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    }

    const topToggleCats = Object.values(catMeta)
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);

    return {
      budget,
      totalSpent,
      fixedTotal,
      variableTotal,
      daysElapsed,
      daysLeft,
      variableDailyBurn,
      projectedEndTotal,
      variance,
      safeDailyAllowance,
      runOutDayLabel,
      trim50Saves: 50 * daysLeft,
      topToggleCats
    };
  }, [monthTxs, dashboardData, activeMonth, customFixedMap]);

  const toggleCategoryFixed = (catName, currentFixed) => {
    setCustomFixedMap((prev) => ({ ...prev, [catName]: !currentFixed }));
  };

  // ========================================================
  // OPTION 2: Did-I-Log-It Today + Auto-Learned Usuals
  // ========================================================
  const [usualAmounts, setUsualAmounts] = useState({});
  const [loggingUsualKey, setLoggingUsualKey] = useState(null);

  const learnedUsuals = useMemo(() => {
    const todayTxs = (monthTxs || []).filter((t) => String(t.date || '').slice(0, 10) === todayIso && !t.is_refund);
    const freqMap = {};

    for (const tx of allHistoryTxs || []) {
      const amt = Number(tx.amount || 0);
      if (tx.is_refund || amt <= 0) continue;
      const label = (tx.description || tx.category || '').trim();
      if (!label || label.length > 30) continue;
      // Focus on frequent repeatable expenses
      const key = `${label.toLowerCase()}__${(tx.category || 'Other').toLowerCase()}`;
      if (!freqMap[key]) {
        freqMap[key] = {
          key,
          description: label,
          category: tx.category || 'Other',
          payment_mode: tx.payment_mode || 'UPI',
          count: 0,
          amounts: [],
          latestDate: tx.date || ''
        };
      }
      freqMap[key].count += 1;
      freqMap[key].amounts.push(amt);
      if ((tx.date || '') >= freqMap[key].latestDate) {
        freqMap[key].latestDate = tx.date || '';
        freqMap[key].latestAmount = amt;
      }
    }

    let items = Object.values(freqMap)
      .filter((x) => x.count >= 2)
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
      .map((x) => {
        const sorted = [...x.amounts].sort((a, b) => a - b);
        const medianAmt = sorted[Math.floor(sorted.length / 2)] || x.latestAmount || 50;
        const matchedToday = todayTxs.filter(
          (t) =>
            (t.description || t.category || '').trim().toLowerCase() === x.description.toLowerCase() &&
            (t.category || '').toLowerCase() === x.category.toLowerCase()
        );
        return {
          ...x,
          defaultAmount: Math.round(medianAmt),
          loggedTodayTotal: matchedToday.reduce((s, t) => s + Number(t.amount || 0), 0),
          loggedTodayCount: matchedToday.length
        };
      });

    if (items.length < 3) {
      const starter = [
        { key: 'tea__food', description: 'Tea / Chai', category: categories[0]?.name || 'Food & Dining', payment_mode: 'UPI', count: 1, defaultAmount: 20 },
        { key: 'lunch__food', description: 'Lunch', category: categories[0]?.name || 'Food & Dining', payment_mode: 'UPI', count: 1, defaultAmount: 120 },
        { key: 'auto__trans', description: 'Auto / Commute', category: 'Transportation', payment_mode: 'Cash', count: 1, defaultAmount: 50 },
        { key: 'milk__groc', description: 'Milk / Essentials', category: 'Groceries', payment_mode: 'UPI', count: 1, defaultAmount: 35 }
      ].map((s) => {
        const matchedToday = todayTxs.filter((t) => (t.description || '').toLowerCase().includes(s.description.split(' ')[0].toLowerCase()));
        return {
          ...s,
          loggedTodayTotal: matchedToday.reduce((acc, t) => acc + Number(t.amount || 0), 0),
          loggedTodayCount: matchedToday.length
        };
      });
      const existingKeys = new Set(items.map((i) => i.description.toLowerCase()));
      items = [...items, ...starter.filter((s) => !existingKeys.has(s.description.toLowerCase()))].slice(0, 6);
    }

    return {
      items,
      todayCount: todayTxs.length,
      todayTotal: todayTxs.reduce((s, t) => s + Number(t.amount || 0), 0)
    };
  }, [allHistoryTxs, monthTxs, todayIso, categories]);

  const handleLogUsual = async (item) => {
    if (loggingUsualKey || typeof onQuickAddExpense !== 'function') return;
    const raw = usualAmounts[item.key] !== undefined ? parseFloat(usualAmounts[item.key]) : item.defaultAmount;
    const amt = !isNaN(raw) && raw > 0 ? raw : item.defaultAmount;
    setLoggingUsualKey(item.key);
    try {
      await onQuickAddExpense({
        amount: amt,
        description: item.description,
        category: item.category,
        payment_mode: item.payment_mode || 'UPI',
        date: todayIso,
        is_refund: false
      });
      showToast(`Logged ${item.description} (${formatCurrency(amt)})`, 'success');
    } catch (err) {
      showToast(err?.message || 'Failed to log expense', 'error');
    } finally {
      setLoggingUsualKey(null);
    }
  };

  // ========================================================
  // OPTION 3: Instant Multi-Expense & SMS Quick-Drop Bar
  // ========================================================
  const [dropInput, setDropInput] = useState('');
  const [dismissedParsedIdx, setDismissedParsedIdx] = useState([]);
  const [savingDrop, setSavingDrop] = useState(false);

  const parsedDropItems = useMemo(() => {
    const raw = dropInput.trim();
    if (!raw) return [];
    const customCatNames = (categories || []).filter((c) => !c.archived).map((c) => c.name);
    const looksLikeBankSms = /\b(?:debited|credited|a\/c|acct|avl\s*bal|upi\s*ref)\b/i.test(raw);
    const chunks = looksLikeBankSms
      ? raw.split(/\n+/).map((s) => s.trim()).filter(Boolean)
      : raw.split(/\n|,(?!\d{3}\b)/).map((s) => s.trim()).filter(Boolean);

    const out = [];
    chunks.forEach((chunk, idx) => {
      if (dismissedParsedIdx.includes(idx)) return;
      const res = parseSmsNotification(chunk, { customCategories: customCatNames });
      if (res?.success && res.amount > 0) {
        out.push({
          idx,
          amount: res.amount,
          description: res.merchant || chunk,
          category: res.category || categories[0]?.name || 'Other',
          payment_mode: res.paymentMode || 'UPI',
          date: res.date || todayIso,
          is_refund: res.type === 'income'
        });
      }
    });
    return out;
  }, [dropInput, dismissedParsedIdx, categories, todayIso]);

  const handlePasteDropClipboard = async () => {
    try {
      if (navigator?.clipboard?.readText) {
        const txt = await navigator.clipboard.readText();
        if (txt) {
          setDismissedParsedIdx([]);
          setDropInput(txt);
          return;
        }
      }
    } catch {}
    showToast('Clipboard read unavailable — paste directly in the box', 'info');
  };

  const handleSaveAllDropped = async () => {
    if (savingDrop || parsedDropItems.length === 0 || typeof onQuickAddExpense !== 'function') return;
    setSavingDrop(true);
    let saved = 0;
    try {
      for (const item of parsedDropItems) {
        await onQuickAddExpense({
          amount: item.amount,
          description: item.description,
          category: item.category,
          payment_mode: item.payment_mode,
          date: item.date,
          is_refund: item.is_refund
        });
        saved += 1;
      }
      setDropInput('');
      setDismissedParsedIdx([]);
      showToast(`Saved ${saved} ${saved === 1 ? 'entry' : 'entries'} cleanly`, 'success');
    } catch (err) {
      showToast(err?.message || 'Failed to save some entries', 'error');
    } finally {
      setSavingDrop(false);
    }
  };

  // ========================================================
  // OPTION 4: Card / Bank / Cash Ledger & Balance Watcher
  // ========================================================
  const walletCfgKey = `et_wallet_cfg_${uid}`;
  const [walletCfg, setWalletCfg] = useState(() => safeReadJson(walletCfgKey, { cashStart: 2000, cardCap: 10000 }));
  const [editingWalletField, setEditingWalletField] = useState(null);
  const [walletDraftVal, setWalletDraftVal] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem(walletCfgKey, JSON.stringify(walletCfg));
    } catch {}
  }, [walletCfg, walletCfgKey]);

  const walletStats = useMemo(() => {
    const groups = {
      UPI: { label: 'UPI / GPay / PhonePe', spent: 0, count: 0, color: '#6C47FF' },
      'Credit Card': { label: 'Credit Card', spent: 0, count: 0, color: '#F59E0B' },
      Cash: { label: 'Cash in Hand', spent: 0, count: 0, color: '#10B981' },
      Bank: { label: 'Debit / Net Banking', spent: 0, count: 0, color: '#0EA5E9' }
    };
    let grandTotal = 0;

    for (const tx of monthTxs || []) {
      const amt = Number(tx.amount || 0);
      if (tx.is_refund || amt <= 0) continue;
      grandTotal += amt;
      const mode = String(tx.payment_mode || 'UPI').toLowerCase();
      if (mode.includes('credit')) {
        groups['Credit Card'].spent += amt;
        groups['Credit Card'].count += 1;
      } else if (mode.includes('cash')) {
        groups.Cash.spent += amt;
        groups.Cash.count += 1;
      } else if (mode.includes('debit') || mode.includes('net') || mode.includes('bank')) {
        groups.Bank.spent += amt;
        groups.Bank.count += 1;
      } else {
        groups.UPI.spent += amt;
        groups.UPI.count += 1;
      }
    }

    const cashRemaining = Math.max(0, Number(walletCfg.cashStart || 0) - groups.Cash.spent);
    const cardCap = Number(walletCfg.cardCap || 0);
    const cardPct = cardCap > 0 ? Math.min(100, Math.round((groups['Credit Card'].spent / cardCap) * 100)) : 0;

    return { groups, grandTotal, cashRemaining, cardCap, cardPct };
  }, [monthTxs, walletCfg]);

  // ========================================================
  // OPTION 5: Leak, Spike & Duplicate Inspector
  // ========================================================
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deletedIds, setDeletedIds] = useState([]);

  const inspectorFindings = useMemo(() => {
    const activeTxs = (monthTxs || []).filter(
      (t) => !t.is_refund && Number(t.amount || 0) > 0 && !deletedIds.includes(String(t.id))
    );
    const sortedAmts = activeTxs.map((t) => Number(t.amount || 0)).sort((a, b) => a - b);
    const medianAmt = sortedAmts.length > 0 ? sortedAmts[Math.floor(sortedAmts.length / 2)] : 150;

    // 1. Possible duplicates: same YYYY-MM-DD & same amount & similar/same category or description
    const dupMap = {};
    for (const tx of activeTxs) {
      const key = `${String(tx.date || '').slice(0, 10)}__${Number(tx.amount)}__${(tx.category || '').toLowerCase()}`;
      if (!dupMap[key]) dupMap[key] = [];
      dupMap[key].push(tx);
    }
    const duplicates = Object.values(dupMap).filter((arr) => arr.length >= 2).slice(0, 4);

    // 2. Spending spikes >= 2.5x median (and >= 400)
    const spikeThreshold = Math.max(400, medianAmt * 2.5);
    const spikes = activeTxs
      .filter((t) => Number(t.amount || 0) >= spikeThreshold)
      .sort((a, b) => Number(b.amount) - Number(a.amount))
      .slice(0, 4);

    // 3. Unclear / Generic category or missing description
    const unclear = activeTxs
      .filter((t) => ['Other', 'General'].includes(t.category) || !String(t.description || '').trim())
      .slice(0, 5);

    // 4. Repeating merchants (2+ times across different dates)
    const merchantMap = {};
    for (const tx of activeTxs) {
      const label = String(tx.description || '').trim();
      if (!label) continue;
      const k = label.toLowerCase();
      if (!merchantMap[k]) merchantMap[k] = { label, dates: new Set(), count: 0, total: 0 };
      merchantMap[k].dates.add(String(tx.date || '').slice(0, 10));
      merchantMap[k].count += 1;
      merchantMap[k].total += Number(tx.amount || 0);
    }
    const repeats = Object.values(merchantMap)
      .filter((m) => m.dates.size >= 2)
      .sort((a, b) => b.total - a.total)
      .slice(0, 3);

    return { medianAmt, duplicates, spikes, unclear, repeats };
  }, [monthTxs, deletedIds]);

  const handleDeleteDuplicate = async (tx) => {
    if (!tx?.id || typeof onDeleteTransaction !== 'function') return;
    try {
      await onDeleteTransaction(tx.id);
      setDeletedIds((prev) => [...prev, String(tx.id)]);
      setConfirmDeleteId(null);
      showToast(`Deleted duplicate ${tx.description || tx.category}`, 'success');
    } catch (err) {
      showToast(err?.message || 'Failed to delete entry', 'error');
    }
  };

  return (
    <div data-testid="five-options-showcase" className="space-y-3">
      {/* Option Selector Pill Bar (Replaces SpeedChips for 1-by-1 verification) */}
      <div className="bg-white dark:bg-[#16132A] rounded-2xl p-2 border border-slate-100 dark:border-white/10 shadow-xs space-y-2 transition-colors">
        <div className="flex items-center justify-between px-1.5">
          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
            <Zap size={12} className="text-[#6C47FF] dark:text-[#A78BFA]" />
            <span>Test 5 Practical Home Workflows (1–5)</span>
          </span>
          <span className="text-[10px] font-semibold text-slate-400">
            Option {activeOption} of 5
          </span>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {OPTIONS_META.map((opt) => {
            const Icon = opt.icon;
            const selected = activeOption === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleSelectOption(opt.id)}
                data-testid={`preview-option-tab-${opt.id}`}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap cursor-pointer transition-all flex-shrink-0 ${
                  selected
                    ? 'bg-[#6C47FF] text-white shadow-sm shadow-purple-500/25'
                    : 'bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-white/10'
                }`}
              >
                <Icon size={12} />
                <span>{opt.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* OPTION 1: Month-End Runway & Fixed vs. Variable Split */}
      {activeOption === '1' && (
        <div
          data-testid="option-runway-card"
          className="bg-white dark:bg-[#16132A] rounded-3xl p-4 sm:p-5 border border-slate-100 dark:border-white/10 shadow-xs space-y-3.5 transition-colors"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#6C47FF]/12 text-[#6C47FF] dark:text-[#C4B5FD] flex items-center justify-center">
                <TrendingUp size={16} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                  Month-End Runway &amp; Fixed Split
                </h3>
                <p className="text-[10.5px] text-slate-500 dark:text-slate-400">
                  Day {runwayAnalysis.daysElapsed} · {runwayAnalysis.daysLeft} days left · Variable pace {maskAmount(runwayAnalysis.variableDailyBurn)}/d
                </p>
              </div>
            </div>
          </div>

          {/* Projection Verdict Banner */}
          <div
            className={`p-3 rounded-2xl border space-y-1 ${
              runwayAnalysis.budget === 0
                ? 'bg-slate-50 dark:bg-[#100D1F] border-slate-200/70 dark:border-white/[0.08]'
                : runwayAnalysis.variance >= 0
                  ? 'bg-emerald-500/10 border-emerald-500/25'
                  : 'bg-rose-500/10 border-rose-500/25'
            }`}
          >
            {runwayAnalysis.budget > 0 ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                    {runwayAnalysis.variance >= 0
                      ? `On track to save ${maskAmount(runwayAnalysis.variance)} by month-end`
                      : runwayAnalysis.runOutDayLabel
                        ? `Budget runs out around ${runwayAnalysis.runOutDayLabel}`
                        : `Projected ${maskAmount(Math.abs(runwayAnalysis.variance))} over budget`}
                  </span>
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                    Safe: {maskAmount(runwayAnalysis.safeDailyAllowance)}/d
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                  Projected month total: <strong>{maskAmount(runwayAnalysis.projectedEndTotal)}</strong> vs{' '}
                  {maskAmount(runwayAnalysis.budget)} budget
                  {runwayAnalysis.trim50Saves > 0 && ` · Trimming ₹50/day saves ${formatCurrency(runwayAnalysis.trim50Saves)}`}
                </p>
              </>
            ) : (
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Set a monthly budget in Settings to see exact month-end survival date &amp; safe daily pace.
              </p>
            )}
          </div>

          {/* Fixed vs Variable 2-Column Split */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-[#100D1F] border border-slate-200/60 dark:border-white/[0.06]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Fixed Must-Pays
              </span>
              <span className="text-base font-black text-slate-900 dark:text-white block mt-0.5">
                {maskAmount(runwayAnalysis.fixedTotal)}
              </span>
              <span className="text-[10px] text-slate-400">Rent, SIP, Bills, EMI</span>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-[#100D1F] border border-slate-200/60 dark:border-white/[0.06]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Day-to-Day Variable
              </span>
              <span className="text-base font-black text-[#6C47FF] dark:text-[#C4B5FD] block mt-0.5">
                {maskAmount(runwayAnalysis.variableTotal)}
              </span>
              <span className="text-[10px] text-slate-400">{maskAmount(runwayAnalysis.variableDailyBurn)}/day avg</span>
            </div>
          </div>

          {/* Tap categories to classify Fixed vs Variable */}
          {runwayAnalysis.topToggleCats.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-semibold text-slate-400 block">
                Tap a category to toggle Fixed vs Variable:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {runwayAnalysis.topToggleCats.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => toggleCategoryFixed(c.name, c.isFixed)}
                    className={`px-2.5 py-1 rounded-xl text-[10.5px] font-bold border cursor-pointer transition-colors ${
                      c.isFixed
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent'
                        : 'bg-slate-50 dark:bg-white/[0.05] text-slate-700 dark:text-slate-200 border-slate-200 dark:border-white/10'
                    }`}
                  >
                    {c.name} · {c.isFixed ? 'Fixed' : 'Variable'}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* OPTION 2: Did-I-Log-It Today + Auto-Learned Usuals */}
      {activeOption === '2' && (
        <div
          data-testid="option-usuals-card"
          className="bg-white dark:bg-[#16132A] rounded-3xl p-4 sm:p-5 border border-slate-100 dark:border-white/10 shadow-xs space-y-3 transition-colors"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <CheckCircle2 size={16} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                  Did-I-Log-It Today + Your Usuals
                </h3>
                <p className="text-[10.5px] text-slate-500 dark:text-slate-400">
                  Learned from your history · Today: {learnedUsuals.todayCount} entries ({maskAmount(learnedUsuals.todayTotal)})
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {learnedUsuals.items.map((item) => {
              const doneToday = item.loggedTodayCount > 0;
              const currentAmt = usualAmounts[item.key] !== undefined ? usualAmounts[item.key] : String(item.defaultAmount);
              return (
                <div
                  key={item.key}
                  className={`p-2.5 rounded-2xl border flex items-center justify-between gap-2 ${
                    doneToday
                      ? 'bg-emerald-500/[0.07] border-emerald-500/25'
                      : 'bg-slate-50 dark:bg-[#100D1F] border-slate-200/70 dark:border-white/[0.07]'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {item.description}
                      </span>
                      {doneToday && (
                        <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[9px] font-extrabold flex-shrink-0">
                          ✓ Today {formatCurrency(item.loggedTodayTotal)}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 block truncate">
                      {item.category} · {item.payment_mode}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <input
                      type="number"
                      value={currentAmt}
                      onChange={(e) => setUsualAmounts((prev) => ({ ...prev, [item.key]: e.target.value }))}
                      aria-label={`Amount for ${item.description}`}
                      className="w-14 px-1.5 py-1 rounded-lg bg-white dark:bg-[#1A1633] border border-slate-200 dark:border-white/15 text-[11px] font-bold text-slate-900 dark:text-white text-right"
                    />
                    <button
                      type="button"
                      disabled={Boolean(loggingUsualKey)}
                      onClick={() => handleLogUsual(item)}
                      className="px-2.5 py-1 rounded-lg bg-[#6C47FF] hover:bg-[#5835E5] text-white text-[11px] font-bold cursor-pointer active:scale-95"
                    >
                      {doneToday ? '+1' : 'Log'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* OPTION 3: Instant Multi-Expense & SMS Quick-Drop Bar */}
      {activeOption === '3' && (
        <div
          data-testid="option-fast-drop-card"
          className="bg-white dark:bg-[#16132A] rounded-3xl p-4 sm:p-5 border border-slate-100 dark:border-white/10 shadow-xs space-y-3 transition-colors"
        >
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-sky-500/12 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                <ClipboardPaste size={16} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                  Multi-Expense &amp; SMS Quick-Drop
                </h3>
                <p className="text-[10.5px] text-slate-500 dark:text-slate-400">
                  Type e.g. &ldquo;tea 20, auto 50, lunch 140&rdquo; or paste a bank/UPI SMS
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setDismissedParsedIdx([]);
                  setDropInput('tea 20, lunch 130, auto 50 cash');
                }}
                data-testid="fast-drop-sample-btn"
                className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-white/10 text-[10.5px] font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                Sample
              </button>
              <button
                type="button"
                onClick={handlePasteDropClipboard}
                className="px-2.5 py-1 rounded-xl bg-sky-600 text-white text-[10.5px] font-bold cursor-pointer"
              >
                Paste Clipboard
              </button>
            </div>
          </div>

          <textarea
            rows={2}
            value={dropInput}
            onChange={(e) => {
              setDismissedParsedIdx([]);
              setDropInput(e.target.value);
            }}
            data-testid="fast-drop-textarea"
            placeholder="tea 20, auto 50, biryani 180 upi&#10;or paste: INR 450 debited at Zomato via UPI..."
            className="w-full p-2.5 rounded-2xl bg-slate-50 dark:bg-[#100D1F] border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#6C47FF] resize-none"
          />

          {parsedDropItems.length > 0 && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {parsedDropItems.map((item) => (
                  <div
                    key={item.idx}
                    className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-xl bg-purple-50 dark:bg-[#231D42] border border-purple-200 dark:border-purple-500/30 text-[11px]"
                  >
                    <span className="font-bold text-slate-900 dark:text-white">{item.description}</span>
                    <span className="font-black text-[#6C47FF] dark:text-[#C4B5FD]">
                      {item.is_refund ? '+' : ''}
                      {formatCurrency(item.amount)}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                      · {item.category} · {item.payment_mode}
                    </span>
                    <button
                      type="button"
                      onClick={() => setDismissedParsedIdx((p) => [...p, item.idx])}
                      className="p-0.5 text-slate-400 hover:text-rose-500 cursor-pointer"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                disabled={savingDrop}
                onClick={handleSaveAllDropped}
                data-testid="fast-drop-save-all-btn"
                className="w-full py-2 rounded-xl bg-[#6C47FF] hover:bg-[#5835E5] text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.99] disabled:opacity-50"
              >
                <Check size={14} />
                <span>
                  {savingDrop
                    ? 'Saving...'
                    : `Save All (${parsedDropItems.length} ${parsedDropItems.length === 1 ? 'entry' : 'entries'})`}
                </span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* OPTION 4: Card / Bank / Cash Ledger & Balance Watcher */}
      {activeOption === '4' && (
        <div
          data-testid="option-wallets-card"
          className="bg-white dark:bg-[#16132A] rounded-3xl p-4 sm:p-5 border border-slate-100 dark:border-white/10 shadow-xs space-y-3 transition-colors"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/12 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <CreditCard size={16} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                  UPI / Credit Card / Cash Watcher
                </h3>
                <p className="text-[10.5px] text-slate-500 dark:text-slate-400">
                  Track where money leaves &amp; monitor cash-in-hand + card bill
                </p>
              </div>
            </div>
            {typeof onOpenAddExpense === 'function' && (
              <button
                type="button"
                onClick={() => onOpenAddExpense()}
                className="px-2.5 py-1 rounded-xl bg-[#6C47FF] text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
              >
                <Plus size={12} />
                <span>Add</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* UPI */}
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-[#100D1F] border border-slate-200/70 dark:border-white/[0.07] space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800 dark:text-slate-100">UPI / GPay / PhonePe</span>
                <span className="font-black text-[#6C47FF] dark:text-[#C4B5FD]">
                  {maskAmount(walletStats.groups.UPI.spent)}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 block">
                {walletStats.groups.UPI.count} transactions ·{' '}
                {walletStats.grandTotal > 0 ? Math.round((walletStats.groups.UPI.spent / walletStats.grandTotal) * 100) : 0}% of spend
              </span>
            </div>

            {/* Credit Card with editable limit */}
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-[#100D1F] border border-slate-200/70 dark:border-white/[0.07] space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800 dark:text-slate-100">Credit Card Bill</span>
                <span className="font-black text-amber-600 dark:text-amber-400">
                  {maskAmount(walletStats.groups['Credit Card'].spent)}
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${walletStats.cardPct >= 85 ? 'bg-rose-500' : 'bg-amber-500'}`}
                  style={{ width: `${walletStats.cardPct}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span>{walletStats.groups['Credit Card'].count} swipes</span>
                {editingWalletField === 'cardCap' ? (
                  <span className="flex items-center gap-1">
                    <input
                      type="number"
                      value={walletDraftVal}
                      onChange={(e) => setWalletDraftVal(e.target.value)}
                      className="w-16 px-1 py-0.5 rounded bg-white dark:bg-[#1A1633] border border-slate-300 dark:border-white/20 text-slate-900 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const n = parseFloat(walletDraftVal);
                        if (!isNaN(n) && n >= 0) setWalletCfg((c) => ({ ...c, cardCap: n }));
                        setEditingWalletField(null);
                      }}
                      className="font-bold text-emerald-600 cursor-pointer"
                    >
                      Save
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingWalletField('cardCap');
                      setWalletDraftVal(String(walletStats.cardCap));
                    }}
                    className="flex items-center gap-1 hover:text-[#6C47FF] cursor-pointer"
                  >
                    <span>Cap {maskAmount(walletStats.cardCap)}</span>
                    <Pencil size={9} />
                  </button>
                )}
              </div>
            </div>

            {/* Cash Wallet with remaining cash-in-hand */}
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-[#100D1F] border border-slate-200/70 dark:border-white/[0.07] space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800 dark:text-slate-100">Cash in Hand</span>
                <span className="font-black text-emerald-600 dark:text-emerald-400">
                  {maskAmount(walletStats.cashRemaining)} left
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span>Spent {maskAmount(walletStats.groups.Cash.spent)}</span>
                {editingWalletField === 'cashStart' ? (
                  <span className="flex items-center gap-1">
                    <input
                      type="number"
                      value={walletDraftVal}
                      onChange={(e) => setWalletDraftVal(e.target.value)}
                      className="w-16 px-1 py-0.5 rounded bg-white dark:bg-[#1A1633] border border-slate-300 dark:border-white/20 text-slate-900 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const n = parseFloat(walletDraftVal);
                        if (!isNaN(n) && n >= 0) setWalletCfg((c) => ({ ...c, cashStart: n }));
                        setEditingWalletField(null);
                      }}
                      className="font-bold text-emerald-600 cursor-pointer"
                    >
                      Save
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingWalletField('cashStart');
                      setWalletDraftVal(String(walletCfg.cashStart));
                    }}
                    className="flex items-center gap-1 hover:text-[#6C47FF] cursor-pointer"
                  >
                    <span>Wallet {maskAmount(walletCfg.cashStart)}</span>
                    <Pencil size={9} />
                  </button>
                )}
              </div>
            </div>

            {/* Debit / Net Banking */}
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-[#100D1F] border border-slate-200/70 dark:border-white/[0.07] space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800 dark:text-slate-100">Debit / Net Banking</span>
                <span className="font-black text-sky-600 dark:text-sky-400">
                  {maskAmount(walletStats.groups.Bank.spent)}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 block">
                {walletStats.groups.Bank.count} bank transfers / card debits
              </span>
            </div>
          </div>
        </div>
      )}

      {/* OPTION 5: Leak, Spike & Duplicate Inspector */}
      {activeOption === '5' && (
        <div
          data-testid="option-inspector-card"
          className="bg-white dark:bg-[#16132A] rounded-3xl p-4 sm:p-5 border border-slate-100 dark:border-white/10 shadow-xs space-y-3 transition-colors"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-rose-500/12 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                <ShieldAlert size={16} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                  Leak, Spike &amp; Duplicate Audit
                </h3>
                <p className="text-[10.5px] text-slate-500 dark:text-slate-400">
                  Typical entry ~{maskAmount(inspectorFindings.medianAmt)} · Automatic monthly check
                </p>
              </div>
            </div>
            {typeof onViewAllTransactions === 'function' && (
              <button
                type="button"
                onClick={onViewAllTransactions}
                className="text-xs font-semibold text-[#6C47FF] dark:text-[#A78BFA] hover:underline flex items-center gap-0.5 cursor-pointer"
              >
                <span>Ledger</span>
                <ArrowUpRight size={13} />
              </button>
            )}
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto pr-0.5">
            {/* Possible Duplicates */}
            {inspectorFindings.duplicates.map((group, gi) => {
              const latest = group[0];
              return (
                <div
                  key={`dup_${gi}`}
                  className="p-2.5 rounded-2xl bg-rose-500/[0.07] border border-rose-500/25 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <span className="text-[10px] font-extrabold text-rose-600 dark:text-rose-400 uppercase flex items-center gap-1">
                      <AlertTriangle size={11} />
                      <span>Possible Duplicate ({group.length}×)</span>
                    </span>
                    <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
                      {latest.description || latest.category} · {maskAmount(latest.amount)} on {latest.date}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => onEditTransaction && onEditTransaction(latest)}
                      className="px-2 py-1 rounded-lg bg-white dark:bg-[#1A1633] text-[10.5px] font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
                    >
                      Check
                    </button>
                    {typeof onDeleteTransaction === 'function' && (
                      confirmDeleteId === latest.id ? (
                        <button
                          type="button"
                          onClick={() => handleDeleteDuplicate(latest)}
                          className="px-2 py-1 rounded-lg bg-rose-600 text-white text-[10.5px] font-bold cursor-pointer"
                        >
                          Confirm
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(latest.id)}
                          aria-label="Delete duplicate"
                          className="p-1.5 rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400 cursor-pointer"
                        >
                          <Trash2 size={12} />
                        </button>
                      )
                    )}
                  </div>
                </div>
              );
            })}

            {/* Spending Spikes */}
            {inspectorFindings.spikes.map((tx, si) => {
              const mult = Math.max(2, Math.round(Number(tx.amount) / Math.max(1, inspectorFindings.medianAmt)));
              return (
                <div
                  key={`spk_${tx.id || si}`}
                  className="p-2.5 rounded-2xl bg-amber-500/[0.08] border border-amber-500/25 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <span className="text-[10px] font-extrabold text-amber-600 dark:text-amber-400 uppercase block">
                      Spike ({mult}× usual)
                    </span>
                    <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
                      {tx.description || tx.category} · {maskAmount(tx.amount)} ({tx.date})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onEditTransaction && onEditTransaction(tx)}
                    className="px-2.5 py-1 rounded-lg bg-white dark:bg-[#1A1633] border border-slate-200 dark:border-white/10 text-[10.5px] font-bold text-slate-700 dark:text-slate-200 cursor-pointer flex-shrink-0"
                  >
                    Inspect
                  </button>
                </div>
              );
            })}

            {/* Repeating Merchants */}
            {inspectorFindings.repeats.map((rep, ri) => (
              <div
                key={`rep_${ri}`}
                className="p-2.5 rounded-2xl bg-slate-50 dark:bg-[#100D1F] border border-slate-200/70 dark:border-white/[0.07] flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <span className="text-[10px] font-extrabold text-[#6C47FF] dark:text-[#C4B5FD] uppercase flex items-center gap-1">
                    <Repeat size={11} />
                    <span>Repeating ({rep.count} entries)</span>
                  </span>
                  <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
                    {rep.label} · {maskAmount(rep.total)} total this month
                  </span>
                </div>
              </div>
            ))}

            {/* Unclear / Generic */}
            {inspectorFindings.unclear.slice(0, 2).map((tx, ui) => (
              <div
                key={`unc_${tx.id || ui}`}
                className="p-2.5 rounded-2xl bg-slate-50 dark:bg-[#100D1F] border border-slate-200/70 dark:border-white/[0.07] flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 uppercase block">
                    Needs Clean Label
                  </span>
                  <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
                    {tx.category} · {maskAmount(tx.amount)} on {tx.date}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onEditTransaction && onEditTransaction(tx)}
                  className="px-2.5 py-1 rounded-lg bg-[#6C47FF]/12 text-[#6C47FF] dark:text-[#C4B5FD] text-[10.5px] font-bold cursor-pointer flex-shrink-0"
                >
                  Edit
                </button>
              </div>
            ))}

            {inspectorFindings.duplicates.length === 0 &&
              inspectorFindings.spikes.length === 0 &&
              inspectorFindings.repeats.length === 0 &&
              inspectorFindings.unclear.length === 0 && (
                <div className="py-5 text-center text-xs text-slate-500 dark:text-slate-400 flex flex-col items-center gap-1.5">
                  <Sparkles size={18} className="text-emerald-500" />
                  <span>Your ledger looks spotless — no duplicates, spikes, or unlabeled entries detected!</span>
                </div>
              )}
          </div>
        </div>
      )}
    </div>
  );
}
