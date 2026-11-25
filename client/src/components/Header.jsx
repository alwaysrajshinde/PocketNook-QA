import React, { useState, useEffect } from 'react';
import {
  Calendar, ChevronDown, Bell, CheckCircle2, Sun, Moon, LogOut, User,
  Upload, FileSpreadsheet, Download, Search, X
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { IS_QA } from '../utils/appBrand';

export default function Header({
  userName = "User",
  userEmail = "",
  selectedMonth = "2026-11",
  availableMonths = [],
  onSelectMonth,
  onOpenNotifications,
  onOpenProfile,
  onLogout,
  hasUnreadNotifications = false,
  activeTab = 'home',
  authProvider = 'password',
  emailVerified = false,
  onResendVerification,
  // Props for non-overview headers
  onOpenImport,
  onExportExcel,
  onExportJson,
  reportsActiveTab = 'overview',
  onSelectReportsTab,
  settingsSearch = '',
  onSettingsSearchChange
}) {
  const { theme, toggleTheme, isDark } = useTheme();
  const { t, language } = useLanguage();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        setProfileOpen(false);
        setDropdownOpen(false);
      }
    }
    if (profileOpen || dropdownOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [profileOpen, dropdownOpen]);

  // Time-based greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t('goodMorning', 'Good Morning');
    if (hour < 17) return t('goodAfternoon', 'Good Afternoon');
    return t('goodEvening', 'Good Evening');
  };

  const getTodayDateString = () => {
    const today = new Date();
    const locale = language === 'mr' ? 'mr-IN' : language === 'hi' ? 'hi-IN' : language === 'es' ? 'es-ES' : 'en-US';
    return today.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  };

  const initial = (userName || 'User').trim().charAt(0).toUpperCase() || 'R';

  return (
    <header className="px-4 sm:px-5 pt-3.5 pb-2 relative transition-colors">
      {/* Top Row: Title + Subtitle on Left, Theme Toggle + Avatar on Right */}
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1 mr-2">
          {activeTab === 'home' ? (
            <>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-1.5 transition-colors truncate">
                <span className="truncate">{getGreeting()}, {userName.split(' ')[0]}</span>
              </h1>
              <p className="text-[11px] text-slate-500 dark:text-[#A78BFA] mt-0.5 flex items-center gap-1.5 truncate">
                <Calendar size={11} className="text-[#6C47FF] dark:text-[#C084FC] shrink-0" />
                <span className="font-semibold text-slate-700 dark:text-slate-200">{getTodayDateString()}</span>
              </p>
            </>
          ) : activeTab === 'transactions' ? (
            <>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight truncate">
                {t('transactions', 'Transactions')}
              </h1>
              <h2 className="text-xs font-normal text-slate-500 dark:text-[#A78BFA]/80 mt-0.5 truncate">
                {t('expenseRecords', 'Expense records & history')}
              </h2>
            </>
          ) : activeTab === 'reports' ? (
            <>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight truncate">
                {t('reports', 'Reports')}
              </h1>
              <h2 className="text-xs font-normal text-slate-500 dark:text-[#A78BFA]/80 mt-0.5 truncate">
                {t('spendingAnalytics', 'Spending & expense analytics')}
              </h2>
            </>
          ) : (
            /* activeTab === 'settings' (More) */
            <>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight truncate">
                {t('more', 'More')}
              </h1>
              <h2 className="text-xs font-normal text-slate-500 dark:text-[#A78BFA]/80 mt-0.5 truncate">
                {t('moreSubtitle', 'Settings, data management and preferences')}
              </h2>
            </>
          )}
        </div>

        {/* Right Controls: QA Pill (in QA), Theme Toggle & Avatar with indicator dot */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {IS_QA && (
            <span
              data-testid="qa-env-badge"
              className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/40 text-[10px] font-black tracking-wider uppercase"
            >
              QA
            </span>
          )}
          {/* Theme Switcher Toggle */}
          <button
            onClick={toggleTheme}
            aria-label="Toggle Theme"
            title={`Switch to ${isDark ? 'Light' : 'Dark'} mode`}
            className="w-9 h-9 rounded-full bg-white dark:bg-[#16132A] border border-slate-200/80 dark:border-white/10 flex items-center justify-center text-slate-600 dark:text-amber-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors shadow-xs cursor-pointer"
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          {/* Avatar Pill with Profile Menu */}
          <div className="relative">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              aria-label="Profile and Settings"
              className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#6C47FF] to-[#A855F7] text-white font-bold text-xs flex items-center justify-center tracking-wider shadow-xs hover:opacity-95 transition-opacity cursor-pointer ring-2 ring-purple-500/20 relative"
            >
              {initial}
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-[#C084FC] rounded-full ring-2 ring-white dark:ring-[#16132A]" />
            </button>

            {profileOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setProfileOpen(false)} />
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-[#1A172B] rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 p-2 z-40 space-y-1 animate-slide-up">
                  <div className="px-3.5 py-2.5 border-b border-slate-100 dark:border-white/5">
                    <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
                      {userName}
                    </span>
                    <span className="text-[11px] text-slate-400 block truncate">
                      {userEmail}
                    </span>
                    {authProvider === 'google.com' ? (
                      <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[10px] font-semibold">
                        <CheckCircle2 size={11} />
                        <span>Google Account</span>
                      </span>
                    ) : emailVerified ? (
                      <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[10px] font-semibold">
                        <CheckCircle2 size={11} />
                        <span>Email Verified</span>
                      </span>
                    ) : (
                      <div className="mt-1.5 flex items-center justify-between gap-1">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-[10px] font-semibold">
                          <span>Pending Verification</span>
                        </span>
                        {onResendVerification && (
                          <button
                            onClick={onResendVerification}
                            className="text-[10px] text-[#6C47FF] dark:text-[#A78BFA] font-bold hover:underline cursor-pointer"
                          >
                            Resend
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      if (onOpenNotifications) onOpenNotifications();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Bell size={14} className="text-[#6C47FF] dark:text-[#A78BFA]" />
                      <span>{t('notifications', 'Notifications')}</span>
                    </div>
                    {hasUnreadNotifications && (
                      <span className="w-2 h-2 rounded-full bg-[#6C47FF] dark:bg-[#C084FC]" />
                    )}
                  </button>

                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      if (onOpenProfile) onOpenProfile();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors text-left cursor-pointer"
                  >
                    <User size={14} className="text-slate-400" />
                    <span>{t('accountSettings', 'Account Settings')}</span>
                  </button>

                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      if (onLogout) onLogout();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors text-left cursor-pointer"
                  >
                    <LogOut size={14} />
                    <span>{t('logOut', 'Log Out')}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Action Row for Tabs Other than Overview (Strictly matching reference design) */}
      {activeTab === 'transactions' && (
        <div className="mt-2.5 flex items-center gap-2">
          {onOpenImport && (
            <button
              type="button"
              onClick={onOpenImport}
              aria-label="Import Expenses"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#6C47FF] hover:bg-[#5835E5] text-white rounded-xl text-xs font-bold shadow-md shadow-purple-600/25 active:scale-95 transition-all cursor-pointer"
            >
              <Upload size={14} />
              <span>{t('import', 'Import')}</span>
            </button>
          )}
          <button
            type="button"
            onClick={onExportExcel}
            aria-label="Export to Excel"
            title="Export to Excel"
            className="w-9 h-9 rounded-xl bg-white dark:bg-[#16132A] border border-slate-200/80 dark:border-white/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 hover:border-emerald-500/50 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30 active:scale-95 transition-all shadow-xs cursor-pointer"
          >
            <FileSpreadsheet size={16} />
          </button>
          <button
            type="button"
            onClick={onExportJson}
            aria-label="Download Backup"
            title="Download JSON Backup"
            className="w-9 h-9 rounded-xl bg-white dark:bg-[#16132A] border border-slate-200/80 dark:border-white/10 flex items-center justify-center text-[#6C47FF] dark:text-[#C084FC] hover:border-purple-500/50 hover:bg-purple-50/50 dark:hover:bg-purple-950/30 active:scale-95 transition-all shadow-xs cursor-pointer"
          >
            <Download size={16} />
          </button>
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="mt-2.5 w-full bg-slate-100 dark:bg-[#16132A] p-1 rounded-2xl border border-slate-200/60 dark:border-white/5 flex items-center justify-between gap-0.5 shadow-inner">
          {[
            { id: 'overview', label: t('overview', 'Overview') },
            { id: 'category', label: t('categories', 'Categories') },
            { id: 'payment', label: t('paymentModes', 'Payment Modes') },
            { id: 'yearly', label: t('yearly', 'Yearly') }
          ].map((tab) => {
            const isActive = (reportsActiveTab || 'overview') === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectReportsTab && onSelectReportsTab(tab.id)}
                className={`flex-1 py-1.5 px-0.5 rounded-xl text-[10px] sm:text-xs tracking-tight transition-all cursor-pointer whitespace-nowrap text-center ${
                  isActive
                    ? 'bg-[#6C47FF] text-white font-bold shadow-sm shadow-purple-600/30'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-medium hover:bg-white/5'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="mt-2.5 relative w-full">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={settingsSearch || ''}
            onChange={(e) => onSettingsSearchChange && onSettingsSearchChange(e.target.value)}
            placeholder={t('searchSettingsPlaceholder', 'Search settings (e.g., Budget, Categories, Theme)')}
            className="w-full pl-9 pr-9 py-2 bg-white dark:bg-[#16132A] border border-slate-200/80 dark:border-purple-500/40 rounded-full text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#6C47FF] shadow-xs transition-all"
          />
          {settingsSearch && (
            <button
              type="button"
              onClick={() => onSettingsSearchChange && onSettingsSearchChange('')}
              aria-label="Clear Search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white p-0.5 cursor-pointer"
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}
    </header>
  );
}
