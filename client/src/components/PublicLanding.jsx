import React from 'react';
import { IS_QA, APP_DISPLAY_NAME } from '../utils/appBrand';
import { 
  Wallet, 
  ShieldCheck, 
  PieChart, 
  TrendingUp, 
  ArrowRight, 
  FileSpreadsheet, 
  Lock, 
  CheckCircle2, 
  Sparkles,
  Sun,
  Moon,
  Zap,
  Smartphone,
  Database,
  BarChart3,
  Coffee,
  ShoppingBag,
  Zap as PowerIcon,
  ShieldAlert
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';

export default function PublicLanding({ onOpenAuth, onOpenLegal }) {
  const { theme, toggleTheme, isDark } = useTheme();
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-slate-800 dark:text-slate-100 flex flex-col transition-colors selection:bg-[#6C47FF] selection:text-white overflow-x-hidden">
      
      {/* 1. TOP NAVBAR */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-[#120F24]/85 backdrop-blur-xl border-b border-slate-200/80 dark:border-white/10 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`relative w-9 h-9 rounded-2xl text-white flex items-center justify-center font-black text-base shadow-md ${IS_QA ? 'bg-gradient-to-tr from-amber-700 via-amber-600 to-amber-400 shadow-amber-600/30' : 'bg-gradient-to-tr from-[#5B27DC] via-[#6C47FF] to-[#A855F7] shadow-purple-600/30'}`}>
            ₹
            {IS_QA && (
              <span className="absolute -bottom-1 -right-1 px-1 bg-slate-900 text-amber-300 border border-amber-300 text-[8px] font-black rounded">
                QA
              </span>
            )}
          </div>
          <div>
            <span className="font-extrabold text-base text-slate-900 dark:text-white tracking-tight block">
              {APP_DISPLAY_NAME}
            </span>
            <span className={`text-[10px] font-medium ${IS_QA ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-400'}`}>
              {IS_QA ? 'QA Staging Build' : 'Smart Personal Finance'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Theme Switcher */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="w-9 h-9 rounded-xl flex items-center justify-center border border-slate-200/80 dark:border-white/10 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 dark:text-amber-300 transition-colors cursor-pointer"
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </header>

      {/* 2. HERO SECTION */}
      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 pt-12 sm:pt-20 pb-16 flex flex-col items-center text-center space-y-8">
        
        {/* Quality Pill Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-50 dark:bg-purple-950/50 border border-purple-200/70 dark:border-purple-800/50 text-xs font-extrabold text-[#6C47FF] dark:text-[#C084FC] shadow-sm animate-fade-in">
          <Sparkles size={14} className="text-[#6C47FF] dark:text-[#C084FC]" />
          <span>Next-Gen Personal Finance • 100% Free &amp; Private</span>
        </div>

        {/* Big Headline */}
        <div className="space-y-3 max-w-3xl">
          <h1 className="text-4xl sm:text-6xl font-black text-slate-900 dark:text-white tracking-tight leading-[1.1]">
            Master Your Money.{' '}
            <span className="bg-gradient-to-r from-[#6C47FF] via-[#A855F7] to-[#EC4899] bg-clip-text text-transparent">
              Effortlessly.
            </span>
          </h1>
          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed pt-2">
            Log daily expenses in seconds, conquer your monthly budget, and understand your financial pace with bank-grade local encryption.
          </p>
        </div>

        {/* High-Converting CTA Buttons */}
        <div className="w-full max-w-md flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
          <button
            type="button"
            onClick={() => onOpenAuth('signup')}
            className="w-full sm:flex-1 py-4 px-6 rounded-2xl bg-gradient-to-r from-[#5B27DC] via-[#6C47FF] to-[#8B5CF6] hover:brightness-110 text-white font-extrabold text-sm shadow-xl shadow-purple-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
          >
            <span>Start Tracking Free</span>
            <ArrowRight size={17} />
          </button>
          
          <button
            type="button"
            onClick={() => onOpenAuth('signin')}
            className="w-full sm:flex-1 py-4 px-6 rounded-2xl border border-slate-200 dark:border-white/10 hover:border-purple-400 bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 text-slate-800 dark:text-white font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
          >
            <span>Sign In to Vault</span>
          </button>
        </div>

        {/* Trust Points */}
        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs font-semibold text-slate-500 dark:text-slate-400 pt-2">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={15} className="text-emerald-500" />
            <span>No Credit Card Required</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={15} className="text-emerald-500" />
            <span>Works 100% Offline</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={15} className="text-emerald-500" />
            <span>Zero Ads &amp; Never Sells Data</span>
          </div>
        </div>

        {/* 3. 4-CARD BENTO FEATURES GRID */}
        <div className="w-full pt-4 space-y-6">
          <div className="text-center space-y-1">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Built for Speed, Privacy &amp; Simplicity
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Everything you need to master your personal finances without clutter.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
            {/* Bento Card 1 */}
            <div className="p-6 rounded-3xl bg-white dark:bg-[#16122E] border border-slate-200/80 dark:border-white/10 shadow-sm space-y-3 hover:border-purple-500/30 transition-all">
              <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-purple-950/60 text-[#6C47FF] dark:text-[#C084FC] flex items-center justify-center shadow-xs">
                <Zap size={20} />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                ⚡ 3-Second Speed Logging
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Log transactions with one tap using smart category chips, quick payment modes, and zero friction keyboard shortcuts.
              </p>
            </div>

            {/* Bento Card 2 */}
            <div className="p-6 rounded-3xl bg-white dark:bg-[#16122E] border border-slate-200/80 dark:border-white/10 shadow-sm space-y-3 hover:border-purple-500/30 transition-all">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-xs">
                <Lock size={20} />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                🔒 Bank-Grade Local Privacy
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Your data is stored in your private local vault. Zero advertisements, zero third-party telemetry, and absolute user ownership.
              </p>
            </div>

            {/* Bento Card 3 */}
            <div className="p-6 rounded-3xl bg-white dark:bg-[#16122E] border border-slate-200/80 dark:border-white/10 shadow-sm space-y-3 hover:border-purple-500/30 transition-all">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-xs">
                <PieChart size={20} />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                📊 Complete 360° Visual Analytics
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Uncover spending patterns with complete category donuts, 6-month historical trends, and net cashflow summaries.
              </p>
            </div>

            {/* Bento Card 4 */}
            <div className="p-6 rounded-3xl bg-white dark:bg-[#16122E] border border-slate-200/80 dark:border-white/10 shadow-sm space-y-3 hover:border-purple-500/30 transition-all">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-xs">
                <FileSpreadsheet size={20} />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                📑 Instant Excel &amp; Cloud Export
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Export your transactions anytime in Excel, CSV, or JSON formats, with seamless Google Sheets cloud sync on the horizon.
              </p>
            </div>
          </div>
        </div>

        {/* 5. FOOTER */}
        <footer className="w-full pt-12 pb-6 border-t border-slate-200/80 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <div>
            © {new Date().getFullYear()} PocketNook. Encrypted &amp; Offline-First.
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => onOpenLegal && onOpenLegal('privacy')}
              className="hover:text-purple-600 dark:hover:text-purple-400 transition-colors cursor-pointer"
            >
              Privacy Policy
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => onOpenLegal && onOpenLegal('terms')}
              className="hover:text-purple-600 dark:hover:text-purple-400 transition-colors cursor-pointer"
            >
              Terms of Service
            </button>
          </div>
        </footer>
      </main>
    </div>
  );
}
