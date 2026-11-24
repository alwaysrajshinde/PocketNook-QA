import React, { useState, useMemo } from 'react';
import { 
  X, Check, Plus, Calendar, DollarSign, Send, Banknote, CreditCard, Landmark, 
  RotateCcw, Receipt, Search, ChevronDown, ChevronUp, Sparkles, MessageSquare, Clipboard
} from 'lucide-react';
import CategoryIcon from './CategoryIcon';
import { useLanguage } from '../context/LanguageContext';
import { parseSmsNotification } from '../services/smsParserService';

export default function AddExpenseModal({
  isOpen,
  onClose,
  onSave,
  categories = [],
  editingTransaction = null,
  currency = "₹",
  initialDate = new Date().toISOString().slice(0, 10),
  onSaveAnotherSuccess
}) {
  const { t } = useLanguage();
  if (!isOpen) return null;

  const [isRefund, setIsRefund] = useState(editingTransaction ? Boolean(editingTransaction.is_refund) : false);
  const [amount, setAmount] = useState(editingTransaction ? String(Math.abs(editingTransaction.amount)) : '');
  const [category, setCategory] = useState(editingTransaction ? editingTransaction.category : 'Food');
  const [searchCat, setSearchCat] = useState('');
  const [paymentMode, setPaymentMode] = useState(editingTransaction ? (editingTransaction.payment_mode || 'UPI') : 'UPI');
  const [date, setDate] = useState(editingTransaction ? editingTransaction.date : initialDate);
  const [description, setDescription] = useState(editingTransaction ? (editingTransaction.description || '') : '');
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [miniSuccess, setMiniSuccess] = useState(false);
  const [showSmsPaste, setShowSmsPaste] = useState(false);
  const [smsPasteText, setSmsPasteText] = useState('');
  const [smsParsedBadge, setSmsParsedBadge] = useState('');

  const handleApplySmsText = (text) => {
    if (!text || !text.trim()) return;
    const res = parseSmsNotification(text);
    if (res.success) {
      setAmount(String(res.amount));
      if (res.merchant) setDescription(res.merchant);
      if (res.category) {
        const found = (categories || []).find(c => c.name.toLowerCase() === res.category.toLowerCase());
        setCategory(found ? found.name : res.category);
      }
      if (res.paymentMode) setPaymentMode(res.paymentMode);
      if (res.date) setDate(res.date);
      if (res.type === 'income') setIsRefund(true);
      else setIsRefund(false);
      setSmsParsedBadge(`Auto-filled: ₹${res.amount} (${res.bankOrApp || 'SMS'})`);
      setShowSmsPaste(false);
      setSmsPasteText('');
      setTimeout(() => setSmsParsedBadge(''), 4000);
    } else {
      setError(res.error || 'Could not parse SMS. Please check format.');
    }
  };

  const handlePasteClipboardDirect = async () => {
    try {
      if (navigator?.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          handleApplySmsText(text);
          return;
        }
      }
    } catch (e) {}
    setShowSmsPaste(true);
  };

  // Filter out archived categories
  const activeCategories = useMemo(() => {
    return (categories || []).filter(c => !c.archived);
  }, [categories]);

  // Curated quick categories
  const quickCategories = useMemo(() => {
    if (!activeCategories || activeCategories.length === 0) {
      return [
        { name: 'Food', icon: 'Utensils', color: '#6C47FF' },
        { name: 'Groceries', icon: 'ShoppingBasket', color: '#10B981' },
        { name: 'Transportation', icon: 'Car', color: '#F59E0B' },
        { name: 'Shopping', icon: 'ShoppingBag', color: '#EC4899' },
        { name: 'Bills', icon: 'Lightbulb', color: '#3B82F6' },
        { name: 'Entertainment', icon: 'Film', color: '#8B5CF6' },
        { name: 'Health', icon: 'HeartPulse', color: '#EF4444' },
        { name: 'Other', icon: 'MoreHorizontal', color: '#64748B' }
      ];
    }
    const quick = activeCategories.filter((c) => Boolean(c.is_quick));
    if (quick.length >= 4) return quick.slice(0, 8);
    return activeCategories.slice(0, 8);
  }, [activeCategories]);

  // Filtered categories for full search
  const filteredCategories = useMemo(() => {
    return activeCategories.filter((c) =>
      (c.name || '').toLowerCase().includes(searchCat.toLowerCase())
    );
  }, [activeCategories, searchCat]);

  const handleQuickAddAmount = (addVal) => {
    const current = parseFloat(amount) || 0;
    setAmount(String(current + addVal));
  };

  const handleSetQuickDate = (offsetDays) => {
    const target = new Date();
    target.setDate(target.getDate() - offsetDays);
    setDate(target.toISOString().slice(0, 10));
  };

  const handleSubmit = async (e, keepOpen = false) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      setError('Please enter a valid positive amount');
      return;
    }
    if (!category) {
      setError('Please select a category');
      return;
    }
    if (!date) {
      setError('Please choose a date');
      return;
    }

    try {
      setSaving(true);
      setError('');
      await onSave({
        id: editingTransaction?.id,
        amount: parseFloat(amount),
        category,
        payment_mode: paymentMode,
        date,
        description,
        is_refund: isRefund
      });

      if (keepOpen) {
        setAmount('');
        setDescription('');
        setMiniSuccess(true);
        setTimeout(() => setMiniSuccess(false), 2000);
        if (onSaveAnotherSuccess) onSaveAnotherSuccess();
      } else {
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Failed to save transaction');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/65 backdrop-blur-sm animate-fade-in">
      {/* Backdrop */}
      <div className="fixed inset-0" onClick={onClose} />

      {/* Modal Card / Bottom Sheet */}
      <div className="relative w-full max-w-lg bg-white dark:bg-[#16132A] rounded-t-3xl sm:rounded-3xl shadow-2xl z-10 max-h-[95vh] flex flex-col overflow-hidden border border-slate-100 dark:border-white/10 animate-slide-up transition-colors">
        
        {/* Mobile drag handle */}
        <div className="w-12 h-1.5 bg-slate-200 dark:bg-white/15 rounded-full mx-auto mt-2.5 sm:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 dark:border-white/10">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
              {editingTransaction
                ? (isRefund ? t('editExpense', 'Edit Income') : t('editExpense', 'Edit Expense'))
                : (isRefund ? t('addIncome', 'Add Income / Refund') : t('addExpense', 'Add Expense'))}
            </h2>
            {miniSuccess && (
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full animate-fade-in flex items-center gap-1">
                <Check size={11} strokeWidth={3} />
                <span>Saved!</span>
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 flex items-center justify-center text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {/* Form Body - Ultra Compact Grid fitting completely inside 640px viewport */}
        <form noValidate onSubmit={(e) => handleSubmit(e, false)} className="flex-1 overflow-y-auto px-4 py-2.5 space-y-2.5">
          {error && (
            <div className="p-2 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-300 text-xs font-semibold">
              {error}
            </div>
          )}

          {/* SMS / UPI Fast Paste Bar */}
          <div className="flex items-center justify-between bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/30 rounded-xl px-2.5 py-1.5">
            <button
              type="button"
              onClick={() => setShowSmsPaste(!showSmsPaste)}
              data-testid="toggle-sms-paste"
              className="text-[11px] font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1.5 hover:underline cursor-pointer"
            >
              <MessageSquare size={13} />
              <span>{showSmsPaste ? 'Hide SMS Parser' : 'Paste Bank SMS / UPI Alert'}</span>
            </button>
            <button
              type="button"
              onClick={handlePasteClipboardDirect}
              data-testid="sms-quick-clipboard-btn"
              className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-blue-600 text-white hover:bg-blue-500 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Clipboard size={10} />
              <span>Auto-Fill Clipboard</span>
            </button>
          </div>

          {showSmsPaste && (
            <div className="space-y-1.5 p-2 bg-blue-50/40 dark:bg-blue-950/20 rounded-xl border border-blue-100 dark:border-blue-900/40 animate-fade-in">
              <textarea
                rows={2}
                value={smsPasteText}
                onChange={(e) => setSmsPasteText(e.target.value)}
                data-testid="sms-modal-inline-textarea"
                placeholder="Paste SMS here (e.g. Debited INR 450 to Zomato, or 'Chai 20')..."
                className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-black/30 text-slate-900 dark:text-white resize-none"
              />
              <button
                type="button"
                onClick={() => handleApplySmsText(smsPasteText)}
                data-testid="sms-modal-inline-parse-btn"
                className="w-full py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Parse &amp; Auto-Fill Form
              </button>
            </div>
          )}

          {smsParsedBadge && (
            <div 
              data-testid="sms-parsed-badge"
              className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-600 dark:text-emerald-300 text-[11px] font-bold flex items-center gap-1.5 animate-fade-in"
            >
              <Check size={12} strokeWidth={3} />
              <span>{smsParsedBadge}</span>
            </div>
          )}

          {/* Type Toggle: Expense vs Income / Refund */}
          <div className="grid grid-cols-2 gap-1 bg-slate-100 dark:bg-white/10 p-0.5 rounded-xl">
            <button
              type="button"
              onClick={() => setIsRefund(false)}
              className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${!isRefund
                ? 'bg-[#6C47FF] dark:bg-[#7C3AED] text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
            >
              <Receipt size={13} />
              <span>{t('expense', 'Expense')}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsRefund(true)}
              className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${isRefund
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
            >
              <RotateCcw size={13} />
              <span>{t('incomeRefund', 'Income / Refund')}</span>
            </button>
          </div>

          {/* Amount Hero Section with Quick Increment Chips */}
          <div className="rounded-xl p-2.5 bg-purple-50/60 dark:bg-white/5 border border-purple-100 dark:border-white/10 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                {t('amount', 'Amount')} *
              </label>
              {parseFloat(amount) > 0 && (
                <button
                  type="button"
                  onClick={() => setAmount('')}
                  className="text-[10px] font-bold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="relative flex items-center">
              <span className="absolute left-3 text-lg font-black text-[#6C47FF] dark:text-[#C084FC]">
                {currency}
              </span>
              <input
                type="number"
                inputMode="decimal"
                step="any"
                min="0.01"
                required
                autoFocus
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-[#1D1936] border border-slate-200 dark:border-white/15 rounded-xl text-lg font-black text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#6C47FF] transition-all shadow-xs"
              />
            </div>

            {/* Quick Amount Increment Pills */}
            <div className="flex items-center gap-1.5 pt-0.5">
              <span className="text-[10px] font-bold text-slate-400 shrink-0">Quick:</span>
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar w-full">
                {[100, 500, 1000, 2000].map((quickVal) => (
                  <button
                    key={quickVal}
                    type="button"
                    onClick={() => handleQuickAddAmount(quickVal)}
                    className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-white dark:bg-white/10 border border-slate-200/80 dark:border-white/10 hover:border-purple-400 text-slate-700 dark:text-slate-200 transition-colors shadow-xs cursor-pointer active:scale-95 whitespace-nowrap"
                  >
                    +{currency}{quickVal}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Category Selection: Tactile 4-Col Grid of Category Chips */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                {t('category', 'Category')} * <span className="text-[#6C47FF] dark:text-[#C084FC]">({category})</span>
              </label>
              <button
                type="button"
                onClick={() => setShowAllCategories(!showAllCategories)}
                className="text-[10px] font-bold text-[#6C47FF] dark:text-[#C084FC] hover:underline flex items-center gap-0.5 cursor-pointer"
              >
                <span>{showAllCategories ? 'Less' : t('moreCategories', 'All Categories')}</span>
                {showAllCategories ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
            </div>

            {/* Tactile Category Grid */}
            <div className="grid grid-cols-4 gap-1">
              {quickCategories.slice(0, 8).map((cat) => {
                const isSelected = category === cat.name;
                return (
                  <button
                    key={cat.name}
                    type="button"
                    onClick={() => setCategory(cat.name)}
                    className={`flex flex-col items-center justify-center p-1.5 rounded-xl border text-center transition-all cursor-pointer active:scale-95 ${isSelected
                      ? 'border-[#6C47FF] bg-purple-50 dark:bg-purple-900/50 shadow-sm ring-1 ring-[#6C47FF]'
                      : 'border-slate-200/80 dark:border-white/10 bg-slate-50/60 dark:bg-white/5 hover:border-slate-300 text-slate-700 dark:text-slate-300'
                      }`}
                  >
                    <div
                      className="w-6 h-6 rounded-lg flex items-center justify-center mb-0.5"
                      style={{ backgroundColor: `${cat.color || '#6C47FF'}20` }}
                    >
                      <CategoryIcon name={cat.name} icon={cat.icon} color={cat.color || '#6C47FF'} size={13} />
                    </div>
                    <span className="text-[9px] font-bold truncate max-w-full">
                      {cat.name}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Expandable Full Category Drawer */}
            {showAllCategories && (
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 space-y-2 animate-fade-in mt-2">
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search all categories..."
                    value={searchCat}
                    onChange={(e) => setSearchCat(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-[#1A162E] border border-slate-200 dark:border-white/15 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#6C47FF]"
                  />
                </div>
                <div className="grid grid-cols-3 gap-1.5 max-h-36 overflow-y-auto pr-1">
                  {filteredCategories.map((c) => (
                    <button
                      key={c.id || c.name}
                      type="button"
                      onClick={() => {
                        setCategory(c.name);
                        setShowAllCategories(false);
                      }}
                      className={`px-2 py-1.5 rounded-lg text-[10px] font-bold truncate text-left border cursor-pointer ${
                        category === c.name
                          ? 'border-[#6C47FF] bg-purple-50 dark:bg-purple-900/60 text-[#6C47FF] dark:text-[#C084FC]'
                          : 'border-slate-200 dark:border-white/10 hover:border-slate-300 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Payment Mode Selector */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
              {t('paymentMode', 'Payment Mode')} *
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { id: 'UPI', label: 'UPI', icon: Send },
                { id: 'Cash', label: 'Cash', icon: Banknote },
                { id: 'Credit Card', label: 'Card', icon: CreditCard },
                { id: 'Net Banking', label: 'Bank', icon: Landmark }
              ].map((mode) => {
                const Icon = mode.icon;
                const isSelected = paymentMode === mode.id || (mode.id === 'Credit Card' && paymentMode === 'Debit Card');
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setPaymentMode(mode.id)}
                    className={`flex items-center justify-center gap-1.5 py-1.5 px-1 rounded-xl border text-xs font-bold transition-all cursor-pointer ${isSelected
                      ? 'bg-[#6C47FF] dark:bg-[#7C3AED] border-[#6C47FF] text-white shadow-xs'
                      : 'bg-slate-50/60 dark:bg-white/5 border-slate-200/80 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                      }`}
                  >
                    <Icon size={13} className={isSelected ? 'text-white' : 'text-slate-500'} />
                    <span>{mode.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date & Description Side-by-Side */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="flex items-center justify-between mb-0.5">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  {t('date', 'Date')} *
                </label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleSetQuickDate(0)}
                    className="text-[10px] font-bold text-[#6C47FF] dark:text-[#C084FC] hover:underline"
                  >
                    {t('today', 'Today')}
                  </button>
                  <span className="text-[10px] text-slate-400">•</span>
                  <button
                    type="button"
                    onClick={() => handleSetQuickDate(1)}
                    className="text-[10px] font-bold text-slate-500 hover:underline"
                  >
                    {t('yesterday', 'Yesterday')}
                  </button>
                </div>
              </div>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-2.5 py-1 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#6C47FF]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-0.5">
                {t('description', 'Description')}
              </label>
              <input
                type="text"
                placeholder={t('notesPlaceholder', 'e.g. Grocery, Coffee, Metro recharge...')}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-1 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#6C47FF]"
              />
            </div>
          </div>

          {/* Action Buttons: Instant 1-click submit directly on screen without scrolling */}
          <div className="pt-1.5 flex items-center gap-2 pb-0.5">
            {!editingTransaction && (
              <button
                type="button"
                disabled={saving}
                onClick={(e) => handleSubmit(e, true)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 border border-slate-200 dark:border-white/10 cursor-pointer active:scale-98"
              >
                <Plus size={14} strokeWidth={2.5} />
                <span>{t('addAnother', 'Add Another')}</span>
              </button>
            )}

            <button
              type="submit"
              disabled={saving}
              className={`w-full py-2.5 bg-gradient-to-r from-[#5B27DC] to-[#7B42F6] hover:from-[#4E1FC5] hover:to-[#6E32E9] text-white rounded-xl font-bold text-xs shadow-lg shadow-purple-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 ${
                editingTransaction ? 'w-full' : 'flex-1'
              }`}
            >
              <Check size={15} strokeWidth={2.5} />
              <span>
                {saving
                  ? 'Saving...'
                  : editingTransaction
                    ? (isRefund ? t('saveIncome', 'Update Income') : t('saveExpense', 'Update Expense'))
                    : (isRefund ? t('saveIncome', 'Save Income') : t('saveExpense', 'Save Expense'))}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
