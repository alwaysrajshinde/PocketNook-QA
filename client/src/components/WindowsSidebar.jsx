import React, { useState } from 'react';
import {
  Home, ReceiptText, Plus, BarChart2, Tag, Target, ArrowLeftRight,
  Cloud, Settings, ChevronDown, Wallet, LogOut, CheckCircle2, User, Calendar
} from 'lucide-react';
import { APP_VERSION, APP_SHORT_DATE, APP_RELEASE_DATE, APP_RELEASE_TIME } from '../constants/version';
import { useLanguage } from '../context/LanguageContext';
import { IS_QA, APP_DISPLAY_NAME } from '../utils/appBrand';

export default function WindowsSidebar({
  activeTab,
  onTabChange,
  onOpenAddExpense,
  userName = "User",
  userEmail = "",
  onLogout,
  onOpenReleaseNotes
}) {
  const { t } = useLanguage();
  const [profileOpen, setProfileOpen] = useState(false);

  const menuItems = [
    { id: 'home', label: t('home', 'Home'), icon: Home },
    { id: 'transactions', label: t('transactions', 'Transactions'), icon: ReceiptText },
    { id: 'add_expense', label: t('addExpense', 'Add Expense'), icon: Plus, isAction: true },
    { id: 'reports', label: t('reports', 'Reports'), icon: BarChart2 },
    { id: 'categories', label: t('categoriesTab', 'Categories'), icon: Tag },
    { id: 'budget', label: t('budgetTab', 'Budget'), icon: Target },
    { id: 'import_export', label: t('importExportTab', 'Import / Export'), icon: ArrowLeftRight },
    { id: 'backup_restore', label: t('backupRestoreTab', 'Backup & Restore'), icon: Cloud },
    { id: 'settings', label: t('more', 'More'), icon: Settings }
  ];

  const handleClick = (item) => {
    if (item.isAction) {
      onOpenAddExpense();
    } else {
      onTabChange(item.id);
    }
  };

  const initials = userName
    .split(' ')
    .map(p => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'RS';

  return (
    <aside className="w-[260px] h-screen bg-white dark:bg-[#131024] border-r border-slate-200/80 dark:border-white/10 flex flex-col justify-between select-none relative sticky top-0 transition-colors">
      {/* Top Brand & Navigation */}
      <div>
        {/* Brand Header */}
        <div className="p-6 pb-4 flex items-center gap-3">
          <div className={`relative w-9 h-9 rounded-xl text-white flex items-center justify-center shadow-md ${IS_QA ? 'bg-gradient-to-tr from-amber-700 to-amber-500 shadow-amber-900/25' : 'bg-gradient-to-tr from-[#371485] to-[#763cf8] shadow-purple-900/20'}`}>
            <Wallet size={18} />
            {IS_QA && (
              <span className="absolute -bottom-1 -right-1 px-1 py-0.2 bg-slate-900 text-amber-300 border border-amber-300 text-[8px] font-black rounded leading-tight">
                QA
              </span>
            )}
          </div>
          <div>
            <span className="text-sm font-black text-slate-900 dark:text-white tracking-tight block">
              {APP_DISPLAY_NAME}
            </span>
            <span className={`text-[10px] font-semibold tracking-wider uppercase block ${IS_QA ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>
              {IS_QA ? 'QA Environment' : 'Personal Vault'}
            </span>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="px-3 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            if (item.isAction) {
              return (
                <button
                  key={item.id}
                  onClick={() => handleClick(item)}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <Icon size={17} className="text-[#6C47FF] dark:text-[#A78BFA]" />
                    <span>{item.label}</span>
                  </div>
                  <span className="w-5 h-5 rounded-md bg-[#6C47FF] text-white flex items-center justify-center text-[10px] font-bold group-hover:scale-105 transition-transform">
                    +
                  </span>
                </button>
              );
            }

            return (
              <button
                key={item.id}
                onClick={() => handleClick(item)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${isActive
                  ? 'bg-[#F0EEFF] dark:bg-purple-900/40 text-[#6C47FF] dark:text-[#A78BFA] font-bold shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
                  }`}
              >
                <Icon size={17} strokeWidth={isActive ? 2.5 : 2} />
                <span>{item.label}</span>
                {item.id === 'settings' && (
                  <span className="text-[10px] text-slate-400 font-normal ml-auto">Settings</span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom User Profile Card & Logout */}
      <div className="relative m-3">
        {/* Profile Dropdown Menu */}
        {profileOpen && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setProfileOpen(false)} />
            <div className="absolute bottom-full left-0 right-0 mb-2 bg-white dark:bg-[#1A172B] rounded-2xl shadow-xl border border-slate-200 dark:border-white/10 p-2 z-40 space-y-1 animate-slide-up">
              <div className="px-3 py-2 border-b border-slate-100 dark:border-white/5">
                <span className="text-[11px] font-bold text-slate-900 dark:text-white block truncate">
                  {userName}
                </span>
                <span className="text-[10px] text-slate-400 block truncate">
                  {userEmail}
                </span>
                <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[10px] font-semibold">
                  <CheckCircle2 size={10} />
                  <span>Authorized Session</span>
                </span>
              </div>

              <button
                onClick={() => {
                  setProfileOpen(false);
                  onTabChange('settings');
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors text-left"
              >
                <User size={14} className="text-slate-400" />
                <span>Account Settings</span>
              </button>

              <button
                onClick={() => {
                  setProfileOpen(false);
                  if (onLogout) onLogout();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors text-left cursor-pointer"
              >
                <LogOut size={14} />
                <span>Log Out</span>
              </button>
            </div>
          </>
        )}

        {/* Profile Card Button */}
        <div
          data-testid="sidebar-profile-card"
          title="User profile menu"
          onClick={() => setProfileOpen(!profileOpen)}
          className="p-3 rounded-2xl border border-slate-100 dark:border-white/5 bg-slate-50/70 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#4B1FC8] to-[#7B42F6] text-white font-bold text-xs flex items-center justify-center flex-shrink-0 shadow-xs">
                {initials}
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
                  {userName}
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-400 block truncate">
                  {userEmail}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onLogout) onLogout();
                }}
                title="Log Out"
                className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
              >
                <LogOut size={13} />
              </button>
              <ChevronDown size={14} className={`text-slate-400 flex-shrink-0 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
            </div>
          </div>
        </div>

        {/* Inked Version & Build Date Badge */}
        <div className="pt-2 px-1 flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 font-mono">
          <button
            type="button"
            onClick={onOpenReleaseNotes}
            title={`PocketNook ${APP_VERSION} (Last updated: ${APP_RELEASE_DATE} at ${APP_RELEASE_TIME})`}
            className="hover:text-[#6C47FF] dark:hover:text-[#C084FC] transition-colors flex items-center gap-1.5 cursor-pointer group"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold text-slate-500 dark:text-slate-400 group-hover:text-[#6C47FF]">{APP_VERSION}</span>
            <span>·</span>
            <span>{APP_SHORT_DATE} · {APP_RELEASE_TIME}</span>
          </button>
          <span className="text-[9px] uppercase tracking-wider text-slate-400">Offline PWA</span>
        </div>
      </div>
    </aside>
  );
}
