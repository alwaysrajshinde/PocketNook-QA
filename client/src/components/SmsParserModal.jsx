import React, { useState } from 'react';
import { 
  MessageSquare, Sparkles, Check, X, Clipboard, ArrowRight, ShieldCheck, 
  RotateCcw, DollarSign, Calendar, Tag, CreditCard 
} from 'lucide-react';
import { parseSmsNotification } from '../services/smsParserService';
import { useToast } from '../context/ToastContext';

export default function SmsParserModal({
  isOpen,
  onClose,
  onSaveExpense,
  formatCurrency = (v) => `₹${Number(v || 0).toLocaleString('en-IN')}`,
  categories = []
}) {
  const { showToast } = useToast();
  const [inputText, setInputText] = useState('');
  const [parsedData, setParsedData] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form override fields
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [category, setCategory] = useState('Food & Dining');
  const [paymentMode, setPaymentMode] = useState('UPI');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  if (!isOpen) return null;

  const handleParse = (text) => {
    const res = parseSmsNotification(text);
    if (res.success) {
      setParsedData(res);
      setAmount(String(res.amount));
      setMerchant(res.merchant);
      setCategory(res.category);
      setPaymentMode(res.paymentMode);
      setDate(res.date);
    } else {
      setParsedData(null);
    }
  };

  const handleTextChange = (e) => {
    const val = e.target.value;
    setInputText(val);
    handleParse(val);
  };

  const handlePasteClipboard = async () => {
    try {
      if (navigator?.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          setInputText(text);
          handleParse(text);
          showToast('Pasted from clipboard!', 'success');
          return;
        }
      }
    } catch (e) {
      // Browser permission blocked or not supported
    }
    showToast('Please paste text manually into the box', 'info');
  };

  const handleApplySample = (sampleText) => {
    setInputText(sampleText);
    handleParse(sampleText);
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      showToast('Please enter a valid amount', 'error');
      return;
    }
    if (!merchant.trim()) {
      showToast('Please enter a merchant or description', 'error');
      return;
    }

    try {
      setIsSaving(true);
      await onSaveExpense({
        amount: numAmount,
        description: merchant.trim(),
        category,
        payment_mode: paymentMode,
        date: date || new Date().toISOString().slice(0, 10),
        is_refund: parsedData?.type === 'income'
      });
      showToast(`Logged ₹${numAmount} for ${merchant}!`, 'success');
      handleReset();
      onClose();
    } catch (err) {
      showToast(err.message || 'Failed to save expense', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setInputText('');
    setParsedData(null);
    setAmount('');
    setMerchant('');
    setCategory('Food & Dining');
    setPaymentMode('UPI');
    setDate(new Date().toISOString().slice(0, 10));
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
      data-testid="sms-parser-modal"
    >
      <div className="relative w-full max-w-2xl bg-white dark:bg-[#16132A] rounded-3xl border border-slate-200/80 dark:border-purple-500/20 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-scale-in">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-white/10 flex items-center justify-between bg-gradient-to-r from-blue-500/10 via-purple-500/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <MessageSquare size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  SMS &amp; UPI 1-Tap Smart Parser
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30">
                  Instant Auto-Fill
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                100% On-Device · Zero Cloud Requests · HDFC, SBI, ICICI, GPay, PhonePe, Paytm
              </p>
            </div>
          </div>
          <button
            onClick={() => { handleReset(); onClose(); }}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          
          {/* Paste Input Area */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Paste Bank SMS or UPI Notification Alert
              </label>
              <button
                type="button"
                onClick={handlePasteClipboard}
                data-testid="sms-clipboard-paste-btn"
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Clipboard size={12} />
                <span>Paste Clipboard</span>
              </button>
            </div>
            <textarea
              rows={3}
              value={inputText}
              onChange={handleTextChange}
              data-testid="sms-input-textarea"
              placeholder="e.g. Alert: Rs.450.00 debited from HDFC Bank A/c **1234 on 24-NOV-26 to ZOMATO. Avl bal: Rs.14,250.00&#10;or simply: Chai 20"
              className="w-full rounded-2xl p-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none transition-all"
            />
          </div>

          {/* Quick Samples Pill Strip */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-slate-400">
              Try quick sample notifications:
            </span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => handleApplySample("Alert: Rs.450.00 debited from HDFC Bank A/c **1234 on 24-NOV-26 to ZOMATO. Avl bal: Rs.14,250.00")}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-[11px] font-medium text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
              >
                HDFC Zomato ₹450
              </button>
              <button
                type="button"
                onClick={() => handleApplySample("You paid ₹150.00 to Starbucks India using Google Pay UPI Ref: 334455667788")}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-[11px] font-medium text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
              >
                GPay Starbucks ₹150
              </button>
              <button
                type="button"
                onClick={() => handleApplySample("Dear SBI User, your A/c ending 4567 debited by Rs 1,200.00 on 24Nov26 transfer to SHELL PETROL. Bal Rs 25,400.")}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-[11px] font-medium text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
              >
                SBI Shell Petrol ₹1,200
              </button>
              <button
                type="button"
                onClick={() => handleApplySample("Paid ₹35 at Chai Point using Paytm UPI")}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-[11px] font-medium text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
              >
                Chai ₹35
              </button>
            </div>
          </div>

          {/* Parsed Result Card */}
          {parsedData && (
            <div className="rounded-2xl border border-blue-200 dark:border-blue-500/30 bg-blue-50/50 dark:bg-blue-950/20 p-4 space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                  <Sparkles size={14} />
                  <span>Parsed Successfully ({parsedData.bankOrApp})</span>
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  {parsedData.confidence}% Confidence
                </span>
              </div>

              {/* Editable Fields Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Amount (₹)
                  </label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    data-testid="sms-parsed-amount"
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/30 text-slate-900 dark:text-white font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Merchant / Payee
                  </label>
                  <input
                    type="text"
                    value={merchant}
                    onChange={(e) => setMerchant(e.target.value)}
                    data-testid="sms-parsed-merchant"
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/30 text-slate-900 dark:text-white font-medium"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    data-testid="sms-parsed-category"
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/30 text-slate-900 dark:text-white"
                  >
                    {categories.length > 0 ? (
                      categories.map(c => <option key={c.name} value={c.name}>{c.name}</option>)
                    ) : (
                      <>
                        <option value="Food & Dining">Food & Dining</option>
                        <option value="Groceries">Groceries</option>
                        <option value="Transportation">Transportation</option>
                        <option value="Shopping">Shopping</option>
                        <option value="Entertainment">Entertainment</option>
                        <option value="Bills & Utilities">Bills & Utilities</option>
                        <option value="Healthcare">Healthcare</option>
                        <option value="Other">Other</option>
                      </>
                    )}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Payment Mode
                  </label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    data-testid="sms-parsed-payment-mode"
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/30 text-slate-900 dark:text-white"
                  >
                    <option value="UPI">UPI</option>
                    <option value="Card">Card</option>
                    <option value="Net Banking">Net Banking</option>
                    <option value="Cash">Cash</option>
                  </select>
                </div>
              </div>

              {parsedData.accountLast4 && (
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Account ending in: <span className="font-semibold text-slate-700 dark:text-slate-300">**{parsedData.accountLast4}</span>
                  {parsedData.balance !== null && (
                    <span className="ml-3">Available Balance: <span className="font-semibold text-slate-700 dark:text-slate-300">{formatCurrency(parsedData.balance)}</span></span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Privacy Footnote */}
          <div className="flex items-center gap-2 text-[11px] text-slate-400 pt-1">
            <ShieldCheck size={14} className="text-emerald-500 flex-shrink-0" />
            <span>Bank SMS never leaves your device. Parsed client-side with zero external tracking.</span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 dark:border-white/10 flex items-center justify-between bg-slate-50/50 dark:bg-white/[0.02]">
          <button
            type="button"
            onClick={handleReset}
            className="text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
          >
            Clear
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!parsedData || isSaving}
              data-testid="sms-confirm-save-btn"
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center gap-2 shadow-md shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all"
            >
              <Check size={14} />
              <span>{isSaving ? 'Logging...' : 'Log Expense'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
