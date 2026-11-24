import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  DollarSign, User, Tag, Download, Upload, Database, Check, AlertCircle,
  Plus, Trash2, RefreshCw, FileSpreadsheet, ShieldCheck, Sun, Moon, Sparkles,
  ExternalLink, LogOut, Bell, Info, Shield, HelpCircle, Palette, Key, CheckCircle2,
  History, ChevronRight, Sliders, Target, FileText, ArrowLeftRight, X, ArrowRight,
  Wifi, WifiOff, Laptop, CheckSquare, Edit2, Calendar, Droplets, Heart, Globe, Search, Type,
  Camera, CalendarClock, Landmark, Lock, Smartphone
} from 'lucide-react';
import CategoryIcon from '../components/CategoryIcon';
import CustomDropdown from '../components/CustomDropdown';
import LegalModal from '../components/LegalModal';
import CategoryManagerModal from '../components/CategoryManagerModal';
import FontSizeSettingsControl from '../components/FontSizeSettingsControl';
import ComingSoonPreviewModal from '../components/common/ComingSoonPreviewModal';
import InstallModal from '../components/InstallModal';
import { useTheme } from '../context/ThemeContext';
import { useFontSize } from '../context/FontSizeContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useLanguage, SUPPORTED_LANGUAGES } from '../context/LanguageContext';
import { exportTransactionsToExcel, exportDataToJson } from '../services/exportService';
import syncService from '../services/syncService';
import { APP_VERSION, APP_RELEASE_DATE, APP_INKED_VERSION, APP_SHORT_DATE } from '../constants/version';
import GoogleSheetsExportModal from '../components/export/GoogleSheetsExportModal';
import RecurringSubscriptionsModal from '../components/RecurringSubscriptionsModal';
import ReceiptScannerModal from '../components/ReceiptScannerModal';
import { getLocalTransactions, getTransactions } from '../services/api';
import { buildMoreSearchIndex, searchMoreIndex } from '../services/moreSearchService';
import { getComingSoonFeatures, isFeatureComingSoon } from '../constants/featureAvailability';

export default function Settings({
  settings = {},
  categories = [],
  initialSection = null,
  onSectionChange = null,
  isDesktopScreen = false,
  onUpdateSettings,
  onUpdateBudget,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  onArchiveCategory,
  onRestoreCategory,
  onReassignCategory,
  onImportFile,
  onRestoreBackup,
  onRefreshAll,
  formatCurrency,
  selectedMonth,
  availableMonths = [],
  onLogout,
  onOpenTour,
  onOpenReleaseNotes,
  onOpenImport,
  onOpenImportHistory,
  onOpenNotifications,
  onOpenWhatsAppAssistant,
  onOpenSmsParser,
  hasUnreadNotifs = false,
  settingsSearch: externalSettingsSearch,
  setSettingsSearch: externalSetSettingsSearch
}) {
  const { theme, setTheme, toggleTheme, isDark, availableThemes } = useTheme();
  const { fontSizePx, fontMode, fontPreset, setFontPreset, setFontCustom, resetFont, availablePresets, deviceCategory } = useFontSize();
  const { showToast } = useToast();
  const { user, logout, resendVerificationEmail, resetPassword, checkVerificationStatus, updateUserName } = useAuth();
  const { language, setLanguage, availableLanguages = SUPPORTED_LANGUAGES, t } = useLanguage();

  const [checkingVerification, setCheckingVerification] = useState(false);

  const handleCheckVerification = async () => {
    try {
      setCheckingVerification(true);
      if (checkVerificationStatus) {
        const res = await checkVerificationStatus();
        if (res?.verified) {
          showToast(res.message || 'Email verified successfully!', 'success');
        } else {
          showToast(res?.message || 'Email is not yet verified. Please click the link in your inbox.', 'warning');
        }
      }
    } catch (err) {
      showToast(err.message || 'Failed to check verification status', 'error');
    } finally {
      setCheckingVerification(false);
    }
  };

  // Google Sheets Export Modal State
  const [isGoogleSheetsModalOpen, setIsGoogleSheetsModalOpen] = useState(false);
  const [exportTransactionsList, setExportTransactionsList] = useState([]);

  // Recurring Subscriptions & Receipt Scanner Modals State (Zero-Cost Keep Features)
  const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false);
  const [isReceiptScannerModalOpen, setIsReceiptScannerModalOpen] = useState(false);

  // Upcoming Features Preview Modal State
  const [activeComingSoonFeature, setActiveComingSoonFeature] = useState(null);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);

  const handleOpenGoogleSheets = async () => {
    let txs = getLocalTransactions();
    if (user?.uid) {
      try {
        const remote = await getTransactions({ limit: 10000 });
        if (remote?.transactions?.length > 0) {
          txs = remote.transactions;
        }
      } catch (e) {}
    }
    setExportTransactionsList(txs);
    setIsGoogleSheetsModalOpen(true);
  };

  const handleOpenRecurring = () => setIsRecurringModalOpen(true);
  const handleOpenReceiptScanner = () => setIsReceiptScannerModalOpen(true);

  const handleOpenComingSoon = (featureId) => {
    if (featureId === 'google_sheets_sync') {
      handleOpenGoogleSheets();
    } else if (featureId === 'receipt_scanner') {
      handleOpenReceiptScanner();
    } else if (featureId === 'recurring_expenses') {
      handleOpenRecurring();
    } else if (featureId === 'bank_auto_sync' || featureId === 'bank_statement_import') {
      if (onOpenImport) onOpenImport();
      else handleOpenModal('import');
    } else {
      setActiveComingSoonFeature(featureId);
    }
  };

  // Active Sub-Modal: null | 'profile' | 'budget' | 'categories' | 'theme' | 'export' | 'security' | 'help' | 'language'
  const [activeModal, setActiveModal] = useState(() => {
    if (!isDesktopScreen) {
      if (initialSection === 'budget') return 'budget';
      if (initialSection === 'categories') return 'categories';
      if (initialSection === 'account' || initialSection === 'security') return 'security';
      if (initialSection === 'data' || initialSection === 'export') return 'export';
      if (initialSection === 'theme' || initialSection === 'appearance') return 'theme';
      if (initialSection === 'profile') return 'profile';
      if (initialSection === 'language') return 'language';
      if (initialSection === 'help') return 'help';
    }
    return null;
  });

  const closeModal = () => {
    setActiveModal(null);
    if (onSectionChange) onSectionChange(null);
  };

  const [categoryModalTab, setCategoryModalTab] = useState('active');
  const [categoryModalAdd, setCategoryModalAdd] = useState(false);
  const [appearanceModalTab, setAppearanceModalTab] = useState('theme'); // 'theme' | 'font'

  const handleOpenModal = (modalName, options = {}) => {
    const sec = modalName === 'appearance' || modalName === 'fontSize' ? 'theme' : modalName;
    if (onSectionChange) onSectionChange(sec);
    if (modalName === 'categories') {
      setCategoryModalTab(options?.tab || 'active');
      setCategoryModalAdd(Boolean(options?.add));
      setActiveModal('categories');
    } else if (modalName === 'theme' || modalName === 'appearance' || modalName === 'fontSize') {
      setAppearanceModalTab(options?.tab || (modalName === 'fontSize' ? 'font' : 'theme'));
      setActiveModal('theme');
    } else {
      setActiveModal(modalName);
    }
  };

  useEffect(() => {
    if (!isDesktopScreen) {
      if (initialSection === 'budget') setActiveModal('budget');
      else if (initialSection === 'categories') setActiveModal('categories');
      else if (initialSection === 'account' || initialSection === 'security') setActiveModal('security');
      else if (initialSection === 'data' || initialSection === 'export') setActiveModal('export');
      else if (initialSection === 'theme' || initialSection === 'appearance') setActiveModal('theme');
      else if (initialSection === 'profile') setActiveModal('profile');
      else if (initialSection === 'language') setActiveModal('language');
      else if (initialSection === 'help') setActiveModal('help');
      else if (!initialSection) closeModal();
    }
  }, [initialSection, isDesktopScreen]);

  // Body scroll lock & Escape key handler while modal is open
  useEffect(() => {
    if (activeModal) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
          closeModal();
        }
      };
      window.addEventListener('keydown', handleKeyDown);

      return () => {
        document.body.style.overflow = originalOverflow;
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [activeModal]);

  const scrolledSectionsRef = useRef(new Set());

  // Scroll to section on Windows Desktop ONLY on initial external deep navigation (never on profile or internal clicks)
  useEffect(() => {
    if (isDesktopScreen && initialSection && initialSection !== 'profile' && !scrolledSectionsRef.current.has(initialSection)) {
      const targetId = initialSection === 'budget' ? 'desktop-section-budget'
        : initialSection === 'categories' ? 'desktop-section-categories'
        : (initialSection === 'data' || initialSection === 'export') ? 'desktop-section-data'
        : (initialSection === 'account' || initialSection === 'security') ? 'desktop-section-security'
        : null;
      if (targetId) {
        const el = document.getElementById(targetId);
        if (el) {
          scrolledSectionsRef.current.add(initialSection);
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    }
  }, [initialSection, isDesktopScreen]);

  // Live Sync Status subscription
  const [syncState, setSyncState] = useState(() => {
    return syncService.getState ? syncService.getState() : { status: 'synced', isOnline: true };
  });

  useEffect(() => {
    if (syncService.subscribe) {
      const unsub = syncService.subscribe((state) => {
        setSyncState(state);
      });
      return () => unsub();
    }
  }, []);

  // Budget State with automatic prop-sync
  const [budgetVal, setBudgetVal] = useState(() => settings.monthly_budget || '12000');
  const [userNameVal, setUserNameVal] = useState(() => settings.user_name || user?.name || user?.displayName || 'Raj Kumar');
  const [currencyVal, setCurrencyVal] = useState(() => settings.currency || '₹');

  useEffect(() => {
    if (settings.monthly_budget !== undefined && settings.monthly_budget !== null && settings.monthly_budget !== '') {
      const num = parseFloat(settings.monthly_budget);
      if (!isNaN(num) && num > 0) {
        setBudgetVal(String(num));
      }
    }
  }, [settings.monthly_budget]);

  useEffect(() => {
    if (settings.user_name) setUserNameVal(settings.user_name);
    else if (user?.displayName) setUserNameVal(user.displayName);
    if (settings.currency) setCurrencyVal(settings.currency);
  }, [settings.user_name, user?.displayName, settings.currency]);

  // Notification Preferences
  const [notify80, setNotify80] = useState(() => {
    try {
      const prefs = JSON.parse(localStorage.getItem('expense_tracker_notification_prefs') || '{}');
      return prefs.notify80 !== false;
    } catch (e) { return true; }
  });
  const [notify100, setNotify100] = useState(() => {
    try {
      const prefs = JSON.parse(localStorage.getItem('expense_tracker_notification_prefs') || '{}');
      return prefs.notify100 !== false;
    } catch (e) { return true; }
  });

  const handleTogglePref = (key, val) => {
    const nextPrefs = { notify80, notify100, [key]: val };
    if (key === 'notify80') setNotify80(val);
    if (key === 'notify100') setNotify100(val);
    localStorage.setItem('expense_tracker_notification_prefs', JSON.stringify(nextPrefs));
    showToast('Notification preference saved!', 'success');
  };

  // Category creation
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('Tag');
  const [newCatColor, setNewCatColor] = useState('#6C47FF');

  // Status message & loading
  const [statusMsg, setStatusMsg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [restoreFilePending, setRestoreFilePending] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const [legalModalType, setLegalModalType] = useState(null);

  const excelInputRef = useRef(null);
  const jsonInputRef = useRef(null);

  const handleSaveBudget = async (e) => {
    if (e) e.preventDefault();
    try {
      setSaving(true);
      const numBudget = parseFloat(budgetVal);
      if (isNaN(numBudget) || numBudget < 0) {
        showToast('Please enter a valid budget amount', 'error');
        return;
      }
      await onUpdateBudget(selectedMonth, numBudget);
      await onUpdateSettings({ monthly_budget: String(numBudget) });
      const budgetKey = 'et_budget_configured_' + (user?.uid || user?.email || 'guest');
      localStorage.setItem(budgetKey, 'true');
      setStatusMsg({ type: 'success', text: `Monthly target budget updated to ${formatCurrency(numBudget)}` });
      showToast(`Monthly budget set to ${formatCurrency(numBudget)}`, 'success');
      closeModal();
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to update budget' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProfile = async (e) => {
    if (e) e.preventDefault();
    const cleanName = (userNameVal || '').trim();
    if (!cleanName) {
      showToast('Please enter a display name', 'warning');
      return;
    }
    try {
      setSaving(true);
      if (updateUserName) {
        await updateUserName(cleanName);
      }
      await onUpdateSettings({ user_name: cleanName, currency: currencyVal });
      setUserNameVal(cleanName);
      setStatusMsg({ type: 'success', text: 'Profile preferences updated successfully' });
      showToast('Profile updated!', 'success');
      closeModal();
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to update profile' });
      showToast(err.message || 'Failed to update profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  const [internalSettingsSearch, setInternalSettingsSearch] = useState('');
  const settingsSearch = externalSettingsSearch !== undefined ? externalSettingsSearch : internalSettingsSearch;
  const setSettingsSearch = externalSetSettingsSearch || setInternalSettingsSearch;

  const handleCreateCategory = async (e) => {
    if (e) e.preventDefault();
    if (!newCatName.trim()) return;
    try {
      await onAddCategory({
        name: newCatName.trim(),
        icon: newCatIcon,
        color: newCatColor,
        is_quick: false
      });
      setNewCatName('');
      setStatusMsg({ type: 'success', text: `Category "${newCatName}" added successfully!` });
      showToast(`Category "${newCatName}" added!`, 'success');
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to add category' });
    }
  };

  const handleExcelExport = async () => {
    try {
      setStatusMsg({ type: 'info', text: 'Generating comprehensive Excel ledger...' });
      await exportTransactionsToExcel();
      setStatusMsg({ type: 'success', text: 'Excel ledger exported successfully!' });
      showToast('Excel ledger downloaded!', 'success');
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to export Excel file' });
    }
  };

  const handleJsonExport = async () => {
    try {
      setStatusMsg({ type: 'info', text: 'Creating full JSON data backup...' });
      await exportDataToJson();
      setStatusMsg({ type: 'success', text: 'JSON backup downloaded successfully!' });
      showToast('JSON backup downloaded!', 'success');
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to export JSON backup' });
    }
  };

  const handleRestoreJson = async () => {
    if (!restoreFilePending) return;
    try {
      setRestoring(true);
      setStatusMsg({ type: 'info', text: 'Restoring transactions and categories...' });
      const result = await onRestoreBackup(restoreFilePending);
      setStatusMsg({
        type: 'success',
        text: `Successfully restored ${result?.transactions_restored || 0} transactions and ${result?.categories_restored || 0} categories!`
      });
      showToast('Data restored successfully!', 'success');
      setRestoreFilePending(null);
      if (onRefreshAll) onRefreshAll();
      closeModal();
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to restore backup' });
    } finally {
      setRestoring(false);
      if (jsonInputRef.current) jsonInputRef.current.value = '';
    }
  };

  const handleResendEmail = async () => {
    try {
      if (resendVerificationEmail) {
        await resendVerificationEmail();
      }
      showToast('Verification email resent! Check your inbox.', 'success');
    } catch (err) {
      showToast(err.message || 'Could not resend email', 'error');
    }
  };

  const handlePasswordReset = async () => {
    try {
      if (resetPassword && user?.email) {
        await resetPassword(user.email);
        showToast('Password reset link sent to your email!', 'success');
      }
    } catch (err) {
      showToast(err.message || 'Could not send reset email', 'error');
    }
  };

  const searchIndex = useMemo(() => {
    return buildMoreSearchIndex({
      t,
      user,
      settings: { ...settings, monthly_budget: budgetVal, user_name: userNameVal, currency: currencyVal },
      availableThemes,
      availableLanguages,
      setTheme,
      setLanguage,
      setFontPreset,
      setFontCustom,
      resetFont,
      openModal: handleOpenModal,
      openGoogleSheets: handleOpenGoogleSheets,
      openComingSoon: handleOpenComingSoon,
      openRecurring: handleOpenRecurring,
      openReceiptScanner: handleOpenReceiptScanner,
      openWhatsAppAssistant: onOpenWhatsAppAssistant || (() => {}),
      openSmsParser: onOpenSmsParser || (() => {}),
      openImport: onOpenImport || (() => handleOpenModal('import')),
      openImportHistory: onOpenImportHistory || (() => handleOpenModal('export')),
      openTour: onOpenTour || (() => {}),
      openReleaseNotes: onOpenReleaseNotes || (() => {}),
      openNotifications: onOpenNotifications || (() => {}),
      openInstallModal: () => setIsInstallModalOpen(true),
      openPrivacyPolicy: () => setLegalModalType('privacy'),
      openTermsOfService: () => setLegalModalType('terms'),
      exportExcel: handleExcelExport,
      exportJson: handleJsonExport,
      triggerRestoreJson: () => {
        handleOpenModal('export');
        setTimeout(() => {
          if (jsonInputRef.current) jsonInputRef.current.click();
        }, 150);
      },
      sendPasswordReset: handlePasswordReset,
      checkEmailVerification: handleCheckVerification,
      resendVerificationEmail: handleResendEmail,
      logout: onLogout || logout
    });
  }, [
    t, user, settings, budgetVal, userNameVal, currencyVal, availableThemes,
    availableLanguages, setTheme, setLanguage, setFontPreset, setFontCustom, resetFont,
    onOpenImport, onOpenImportHistory, onOpenTour, onOpenReleaseNotes, onOpenNotifications,
    onLogout, logout
  ]);

  const filteredSettingsItems = useMemo(() => {
    return searchMoreIndex(settingsSearch, searchIndex);
  }, [settingsSearch, searchIndex]);

  const renderSearchResults = () => {
    if (filteredSettingsItems === null) return null;

    return (
      <div className="space-y-3 animate-fade-in pt-1" data-testid="more-search-results">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Matching Settings ({filteredSettingsItems.length})
          </span>
          <button
            type="button"
            onClick={() => setSettingsSearch('')}
            className="text-[11px] font-bold text-[#6C47FF] dark:text-[#C084FC] hover:underline cursor-pointer"
          >
            Clear search
          </button>
        </div>

        {filteredSettingsItems.length === 0 ? (
          <div className="rounded-3xl bg-white dark:bg-[#18132F] border border-slate-200/80 dark:border-purple-500/10 p-8 text-center space-y-1.5" data-testid="more-no-results">
            <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-white/5 text-slate-400 flex items-center justify-center mx-auto mb-2">
              <Search size={18} />
            </div>
            <p className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200">No settings found</p>
            <p className="text-[11px] text-slate-400">No options match your query. Try searching for "budget", "dark mode", "categories", "alerts", or "export".</p>
          </div>
        ) : (
          <div className="rounded-3xl bg-white dark:bg-[#18132F] border border-slate-200/80 dark:border-purple-500/10 divide-y divide-slate-100 dark:divide-white/5 overflow-hidden shadow-xs">
            {filteredSettingsItems.map(item => {
              const ItemIcon = item.icon || Sliders;
              return (
                <button
                  key={item.id}
                  type="button"
                  data-testid={`search-result-${item.id}`}
                  onClick={() => {
                    setSettingsSearch('');
                    if (item.action) item.action();
                  }}
                  className="w-full p-3.5 sm:p-4 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-all cursor-pointer group active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
                    <div
                      className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm"
                      style={{ backgroundColor: item.color || '#6C47FF' }}
                    >
                      <ItemIcon size={17} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white group-hover:text-[#6C47FF] dark:group-hover:text-[#C084FC] transition-colors truncate">
                          {item.title}
                        </span>
                        {item.parentCategory && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#6C47FF]/10 text-[#6C47FF] dark:text-[#C084FC] border border-[#6C47FF]/20 shrink-0">
                            {item.parentCategory}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] sm:text-xs text-slate-400 truncate mt-0.5">
                        {item.subtitle}
                      </div>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-slate-400 group-hover:text-[#6C47FF] dark:group-hover:text-[#C084FC] group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const categoryIcons = [
    'Tag', 'Utensils', 'Car', 'ShoppingBag', 'Zap', 'Home',
    'HeartPulse', 'Film', 'GraduationCap', 'Plane', 'Sparkles', 'Coffee',
    'Wifi', 'Phone', 'BookOpen', 'Music', 'DollarSign', 'Gift'
  ];

  const colorOptions = [
    '#6C47FF', '#10B981', '#F59E0B', '#EC4899', '#3B82F6', '#6366F1',
    '#EF4444', '#8B5CF6', '#0EA5E9', '#F97316', '#F43F5E', '#64748B'
  ];

  const userInitial = (userNameVal || user?.displayName || user?.email || 'R').charAt(0).toUpperCase();
  const isEmailVerified = Boolean(user?.emailVerified || user?.isGoogleUser);

  return (
    <div className={`transition-colors ${isDesktopScreen ? 'max-w-6xl mx-auto px-4 sm:px-6 py-4 pb-16 space-y-6' : 'space-y-6 px-3 sm:px-6 lg:px-8 py-3 pb-6 lg:pb-8 max-w-xl mx-auto'}`}>

      {/* Global Status Banner */}
      {statusMsg && (
        <div className={`p-4 rounded-2xl flex items-center justify-between text-xs font-semibold ${statusMsg.type === 'success'
          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
          : statusMsg.type === 'info'
            ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
            : 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
          }`}>
          <div className="flex items-center gap-2">
            {statusMsg.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
            <span>{statusMsg.text}</span>
          </div>
          <button onClick={() => setStatusMsg(null)} className="opacity-70 hover:opacity-100 text-base cursor-pointer">
            ×
          </button>
        </div>
      )}

      {/* Offline Status Notice */}
      {!syncState.isOnline && (
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2.5 shadow-xs">
          <WifiOff size={16} className="text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <div className="flex-1">
            <span className="font-bold">You're offline.</span> Your expenses are saved on this device and will sync automatically when you're connected again.
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW A: WINDOWS DESKTOP VERSION (isDesktopScreen >= 1024px)
          Spacious 2-column executive command center with Dark Violet Fintech styling
         ========================================================================= */}
      {isDesktopScreen ? (
        <div className="space-y-6 animate-fade-in">

          {/* 1. Executive Desktop Header Bar */}
          <div className="flex items-center justify-between pt-1">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  More &amp; Settings
                </h1>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#6C47FF]/10 text-[#6C47FF] dark:text-[#C084FC] border border-[#6C47FF]/20">
                  Windows Edition
                </span>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-600 dark:text-[#C084FC] px-2.5 py-0.5 rounded-full bg-[#6C47FF]/10 border border-[#6C47FF]/20 font-mono">
                  <Calendar size={11} className="text-[#6C47FF] dark:text-[#C084FC]" />
                  <span>{APP_INKED_VERSION}</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-[#A78BFA]/80 mt-1">
                Personal finance configuration, intelligent data imports, cloud synchronization, and platform preferences
              </p>
            </div>

            {/* Desktop Action Controls */}
            <div className="flex items-center gap-3">
              {/* Real-time Sync Status Pill */}
              <div className="hidden sm:flex items-center">
                {syncState.status === 'syncing' ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                    <RefreshCw size={13} className="animate-spin" />
                    <span>Syncing changes...</span>
                  </span>
                ) : !syncState.isOnline ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    <WifiOff size={13} />
                    <span>Offline · Saved locally</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Online · Synced</span>
                  </span>
                )}
              </div>

              {/* Guided Tour button */}
              {onOpenTour && (
                <button
                  type="button"
                  onClick={onOpenTour}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 hover:border-[#6C47FF] bg-white dark:bg-[#18132F] text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-[#6C47FF] dark:hover:text-[#C084FC] transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Sparkles size={14} className="text-[#6C47FF] dark:text-[#C084FC]" />
                  <span>Tour</span>
                </button>
              )}

              {/* What's New / Release Notes */}
              {onOpenReleaseNotes && (
                <button
                  type="button"
                  onClick={onOpenReleaseNotes}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 hover:border-[#6C47FF] bg-white dark:bg-[#18132F] text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-[#6C47FF] dark:hover:text-[#C084FC] transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Info size={14} className="text-[#6C47FF] dark:text-[#C084FC]" />
                  <span>Release Notes</span>
                </button>
              )}

              {/* Notification Bell */}
              <button
                type="button"
                onClick={onOpenNotifications}
                aria-label="Notifications"
                className="relative w-10 h-10 rounded-xl flex items-center justify-center bg-white dark:bg-[#18132F] text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 transition-all shadow-xs cursor-pointer"
              >
                <Bell size={18} />
                {hasUnreadNotifs && (
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#A855F7] ring-2 ring-white dark:ring-[#18132F]" />
                )}
              </button>
            </div>
          </div>

          {/* Executive Desktop Search Input */}
          <div className="relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={settingsSearch}
              onChange={(e) => setSettingsSearch(e.target.value)}
              placeholder={t('searchSettingsPlaceholder', 'Search settings (e.g. Budget, Categories, Theme, Alerts, Export)')}
              aria-label="Search Settings"
              className="w-full pl-11 pr-10 py-3 bg-white dark:bg-[#18132F] border border-slate-200/80 dark:border-purple-500/15 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#6C47FF] shadow-xs transition-all"
            />
            {settingsSearch && (
              <button
                type="button"
                onClick={() => setSettingsSearch('')}
                aria-label="Clear Search"
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer p-0.5"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {filteredSettingsItems !== null ? (
            renderSearchResults()
          ) : (
            <>
          {/* 2. Full-Width Hero Profile & Account Banner */}
          <div
            id="desktop-section-profile"
            className="p-6 rounded-3xl bg-white dark:bg-[#18132F] border border-slate-200/80 dark:border-purple-500/15 shadow-sm transition-all hover:border-purple-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
          >
            <div className="flex items-center gap-4">
              {/* Vibrant Avatar Circle */}
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-[#6C47FF] to-[#A855F7] text-white font-black text-2xl flex items-center justify-center shadow-lg shadow-purple-600/30 flex-shrink-0">
                {userInitial}
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={userNameVal}
                    onChange={(e) => setUserNameVal(e.target.value)}
                    placeholder="Raj Kumar"
                    className="font-extrabold text-lg text-slate-900 dark:text-white bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-white/20 focus:border-[#6C47FF] focus:outline-none transition-colors"
                  />
                  <span className="text-xs text-slate-400 font-normal">✎</span>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  {user?.email || 'raj@example.com'}
                </p>

                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  {isEmailVerified ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                      <Check size={11} strokeWidth={3} />
                      <span>Verified</span>
                    </span>
                  ) : (
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleCheckVerification}
                        disabled={checkingVerification}
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 active:scale-95 transition-all cursor-pointer"
                      >
                        {checkingVerification ? <RefreshCw size={10} className="animate-spin" /> : <ShieldCheck size={10} />}
                        <span>Unverified · Check Status</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleResendEmail}
                        className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                      >
                        Resend
                      </button>
                    </div>
                  )}

                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-purple-50 dark:bg-purple-950/40 text-[#6C47FF] dark:text-[#C084FC] border border-purple-200 dark:border-purple-800/40">
                    <ShieldCheck size={11} />
                    <span>{user?.isGoogleUser ? 'Google OAuth 2.0' : 'Firebase Password Auth'}</span>
                  </span>

                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10">
                    <span>Offline Vault Active</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Profile Preferences Controls */}
            <div className="flex items-center gap-3 w-full md:w-auto justify-end">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                  Preferred Currency
                </label>
                <CustomDropdown
                  value={currencyVal}
                  onChange={(val) => setCurrencyVal(val)}
                  options={[
                    { value: '₹', label: '₹ Indian Rupee (INR)' },
                    { value: '$', label: '$ US Dollar (USD)' },
                    { value: '€', label: '€ Euro (EUR)' },
                    { value: '£', label: '£ British Pound (GBP)' }
                  ]}
                  ariaLabel="Preferred Currency"
                  buttonClassName="px-3 py-2 text-xs font-bold"
                />
              </div>

              <div className="pt-4">
                <button
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-[#6C47FF] hover:bg-[#5835E5] text-white text-xs font-bold transition-all shadow-md shadow-purple-600/30 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {saving && <RefreshCw size={13} className="animate-spin" />}
                  <span>Save Profile</span>
                </button>
              </div>
            </div>
          </div>

          {/* 3. Main 2-Column Responsive Desktop Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">

            {/* ========================================================
                COLUMN 1: FINANCES & DATA CENTER
               ======================================================== */}
            <div className="space-y-6">

              {/* CARD 1: MANAGE FINANCES (Budget & Categories) */}
              <div
                id="desktop-section-budget"
                className="p-6 rounded-3xl bg-white dark:bg-[#18132F] border border-slate-200/80 dark:border-purple-500/15 shadow-sm space-y-6"
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-[#281D4C] text-[#6C47FF] dark:text-[#C084FC] flex items-center justify-center shadow-xs">
                      <Sliders size={20} />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">Manage Finances</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Monthly targets and category taxonomy</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-purple-50 dark:bg-purple-950/40 text-[#6C47FF] dark:text-[#C084FC]">
                    {categories.length} Categories Active
                  </span>
                </div>

                {/* Sub-Section A: Monthly Target Budget */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                      <Target size={14} className="text-[#6C47FF] dark:text-[#C084FC]" />
                      <span>Monthly Target Budget ({selectedMonth || 'Current Month'})</span>
                    </label>
                    <span className="text-xs font-extrabold text-[#6C47FF] dark:text-[#C084FC]">
                      {formatCurrency(parseFloat(budgetVal) || 0)}
                    </span>
                  </div>

                  {/* Preset Pills */}
                  <div className="flex flex-wrap gap-2">
                    {[10000, 15000, 20000, 25000, 30000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setBudgetVal(String(amt))}
                        className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${parseFloat(budgetVal) === amt
                          ? 'bg-[#6C47FF] text-white border-[#6C47FF] shadow-xs'
                          : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:border-[#6C47FF]'
                          }`}
                      >
                        {formatCurrency(amt)}
                      </button>
                    ))}
                  </div>

                  {/* Input & Update Action */}
                  <div className="flex gap-2 pt-1">
                    <div className="relative flex-1">
                      <span className="absolute left-3.5 top-2.5 text-base font-bold text-[#6C47FF] dark:text-[#C084FC]">
                        {currencyVal}
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="500"
                        value={budgetVal}
                        onChange={(e) => setBudgetVal(e.target.value)}
                        placeholder="12000"
                        className="w-full pl-9 pr-3 py-2 text-sm font-bold rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white focus:outline-none focus:border-[#6C47FF]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleSaveBudget}
                      disabled={saving}
                      className="px-5 py-2 bg-[#6C47FF] hover:bg-[#5835E5] text-white text-xs font-bold rounded-xl shadow-md shadow-purple-600/30 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {saving && <RefreshCw size={13} className="animate-spin" />}
                      <span>Update Budget</span>
                    </button>
                  </div>
                </div>

                {/* Sub-Section B: Categories Taxonomy */}
                <div id="desktop-section-categories" className="space-y-3 pt-3 border-t border-slate-100 dark:border-white/5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                      <Tag size={14} className="text-[#6C47FF] dark:text-[#C084FC]" />
                      <span>Expense Categories ({categories.filter(c => !c.archived).length} Active)</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setActiveModal('categories')}
                      className="text-[11px] font-bold text-[#6C47FF] dark:text-[#C084FC] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>Manage &amp; Customize All</span>
                      <ArrowRight size={12} />
                    </button>
                  </div>

                  {/* Category Chips Cloud */}
                  <div className="flex flex-wrap gap-2 p-1">
                    {categories.filter(c => !c.archived).map((c) => (
                      <div
                        key={c.id || c.name}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/10 shadow-2xs group"
                      >
                        <div
                          className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                          style={{ backgroundColor: c.color || '#6C47FF' }}
                        >
                          <CategoryIcon name={c.icon || 'Tag'} size={12} />
                        </div>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {c.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => setActiveModal('categories')}
                          className="text-slate-400 hover:text-[#6C47FF] opacity-60 group-hover:opacity-100 transition-opacity ml-1 cursor-pointer"
                          title="Edit or Remove Category"
                        >
                          <Edit2 size={11} />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Quick Add Category Inline Row */}
                  <form onSubmit={handleCreateCategory} className="p-3.5 rounded-2xl border border-dashed border-purple-300 dark:border-purple-800/40 bg-purple-50/30 dark:bg-purple-950/20 space-y-3">
                    <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Plus size={14} className="text-[#6C47FF] dark:text-[#C084FC]" />
                      <span>Add Custom Category</span>
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Category Name (e.g. Gym, Pet Care, Subscriptions)"
                        value={newCatName}
                        onChange={(e) => setNewCatName(e.target.value)}
                        className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#18132F] text-slate-900 dark:text-white focus:outline-none focus:border-[#6C47FF]"
                      />
                      <button
                        type="submit"
                        disabled={!newCatName.trim()}
                        className="px-4 py-2 bg-[#6C47FF] hover:bg-[#5835E5] disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-600/30 transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <Plus size={14} />
                        <span>Add</span>
                      </button>
                    </div>

                    {/* Color Palette Row */}
                    <div className="flex items-center gap-1.5 pt-0.5">
                      <span className="text-[11px] text-slate-400 mr-1">Color:</span>
                      {colorOptions.slice(0, 10).map((hex) => (
                        <button
                          key={hex}
                          type="button"
                          onClick={() => setNewCatColor(hex)}
                          className={`w-5 h-5 rounded-full transition-transform cursor-pointer ${newCatColor === hex ? 'scale-125 ring-2 ring-white dark:ring-purple-400 shadow-md' : 'opacity-70 hover:opacity-100'}`}
                          style={{ backgroundColor: hex }}
                        />
                      ))}
                    </div>
                  </form>
                </div>
              </div>

              {/* CARD 2: DATA MANAGEMENT & SOVEREIGNTY */}
              <div
                id="desktop-section-data"
                className="p-6 rounded-3xl bg-white dark:bg-[#18132F] border border-slate-200/80 dark:border-purple-500/15 shadow-sm space-y-5"
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-[#281D4C] text-[#6C47FF] dark:text-[#C084FC] flex items-center justify-center shadow-xs">
                      <ArrowLeftRight size={20} />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">Data Management</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Import bank records, export Excel &amp; full JSON backup</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                    Sovereign Vault
                  </span>
                </div>

                {/* Sub-Section A: Intelligent Import Callout */}
                <div className="p-4 rounded-2xl bg-gradient-to-tr from-purple-500/10 via-purple-500/5 to-transparent border border-purple-500/20 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-[#6C47FF] text-white flex items-center justify-center shadow-md shadow-purple-600/30 flex-shrink-0">
                        <Upload size={17} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <span>Intelligent Expense Import System</span>
                          <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-[#6C47FF] text-white">
                            NEW
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Upload Excel (.xlsx), CSV, bank statements (SBI, HDFC, ICICI, etc.) or paste tables directly
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={onOpenImport}
                      className="flex-1 py-2.5 px-4 bg-gradient-to-r from-[#6C47FF] to-[#8B5CF6] hover:from-[#5835E5] hover:to-[#763cf8] text-white text-xs font-bold rounded-xl shadow-md shadow-purple-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Upload size={14} />
                      <span>Import Transactions</span>
                    </button>

                    {onOpenImportHistory && (
                      <button
                        type="button"
                        onClick={onOpenImportHistory}
                        className="py-2.5 px-4 border border-slate-200 dark:border-white/10 hover:border-[#6C47FF] bg-white dark:bg-[#18132F] text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-[#6C47FF] dark:hover:text-[#C084FC] rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <History size={14} />
                        <span>Import History &amp; 1-Click Undo</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Sub-Section B: Export Transactions */}
                <div className="space-y-2.5 pt-1">
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    Export Financial Records
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={handleOpenGoogleSheets}
                      className="p-3 rounded-2xl border border-slate-200 dark:border-white/10 hover:border-purple-500 flex items-center gap-3 bg-slate-50/50 dark:bg-white/[0.02] hover:bg-purple-50/40 dark:hover:bg-purple-950/20 transition-all cursor-pointer group text-left"
                    >
                      <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-900/30 text-[#6C47FF] dark:text-[#C084FC] flex items-center justify-center flex-shrink-0">
                        <FileSpreadsheet size={18} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span>Google Sheets</span>
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-purple-500/15 text-[#6C47FF] dark:text-[#C084FC] border border-purple-500/25">Upcoming</span>
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={handleExcelExport}
                      className="p-3 rounded-2xl border border-slate-200 dark:border-white/10 hover:border-[#6C47FF] flex items-center gap-3 bg-slate-50/50 dark:bg-white/[0.02] hover:bg-purple-50/40 dark:hover:bg-purple-950/20 transition-all cursor-pointer group text-left"
                    >
                      <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-900/30 text-[#6C47FF] flex items-center justify-center flex-shrink-0">
                        <Download size={18} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-[#6C47FF] dark:group-hover:text-[#C084FC]">
                          Excel (.xlsx)
                        </div>
                        <div className="text-[10px] text-slate-400">Formatted workbook</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={handleJsonExport}
                      className="p-3 rounded-2xl border border-slate-200 dark:border-white/10 hover:border-[#6C47FF] flex items-center gap-3 bg-slate-50/50 dark:bg-white/[0.02] hover:bg-purple-50/40 dark:hover:bg-purple-950/20 transition-all cursor-pointer group text-left"
                    >
                      <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center flex-shrink-0">
                        <Database size={18} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-[#6C47FF] dark:group-hover:text-[#C084FC]">
                          JSON Backup
                        </div>
                        <div className="text-[10px] text-slate-400">Complete raw ledger</div>
                      </div>
                    </button>
                  </div>

                  {/* Desktop Upcoming Integrations Preview Grid (Locked / Non-clickable) */}
                  <div className="pt-2">
                    <div className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-1.5">
                      <Lock size={13} className="text-[#6C47FF] dark:text-[#C084FC]" />
                      <span>Upcoming Features &amp; Integrations (Roadmap)</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div
                        data-testid="desktop-upcoming-receipt_scanner"
                        className="p-2.5 rounded-2xl border border-slate-200/80 dark:border-white/10 flex items-center gap-2.5 bg-slate-50/50 dark:bg-white/[0.02] cursor-default select-none pointer-events-none opacity-85 text-left"
                      >
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-white bg-emerald-500/80">
                          <Camera size={15} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[11px] font-bold text-slate-900 dark:text-white truncate">
                            Receipt Scanner
                          </div>
                          <div className="text-[10px] text-purple-600 dark:text-[#C084FC] flex items-center gap-1 font-semibold">
                            <Lock size={8} />
                            <span>Coming Soon</span>
                          </div>
                        </div>
                      </div>

                      <div
                        data-testid="desktop-upcoming-recurring_expenses"
                        className="p-2.5 rounded-2xl border border-slate-200/80 dark:border-white/10 flex items-center gap-2.5 bg-slate-50/50 dark:bg-white/[0.02] cursor-default select-none pointer-events-none opacity-85 text-left"
                      >
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-white bg-[#6C47FF]/80">
                          <CalendarClock size={15} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[11px] font-bold text-slate-900 dark:text-white truncate">
                            Recurring Bills
                          </div>
                          <div className="text-[10px] text-purple-600 dark:text-[#C084FC] flex items-center gap-1 font-semibold">
                            <Lock size={8} />
                            <span>Coming Soon</span>
                          </div>
                        </div>
                      </div>

                      <div
                        data-testid="desktop-upcoming-bank_auto_sync"
                        className="p-2.5 rounded-2xl border border-slate-200/80 dark:border-white/10 flex items-center gap-2.5 bg-slate-50/50 dark:bg-white/[0.02] cursor-default select-none pointer-events-none opacity-85 text-left"
                      >
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-white bg-blue-500/80">
                          <Landmark size={15} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[11px] font-bold text-slate-900 dark:text-white truncate">
                            Statement Import
                          </div>
                          <div className="text-[10px] text-purple-600 dark:text-[#C084FC] flex items-center gap-1 font-semibold">
                            <Lock size={8} />
                            <span>Coming Soon</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sub-Section C: Restore JSON Backup */}
                <div className="p-3.5 rounded-2xl border border-slate-100 dark:border-white/5 bg-slate-50/40 dark:bg-white/[0.02] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                      Restore Backup File
                    </span>
                    <span className="text-[10px] text-slate-400">JSON format</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      ref={jsonInputRef}
                      accept=".json"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setRestoreFilePending(file);
                      }}
                      className="text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#6C47FF]/10 file:text-[#6C47FF] hover:file:bg-[#6C47FF]/20 cursor-pointer flex-1"
                    />

                    {restoreFilePending && (
                      <button
                        type="button"
                        onClick={handleRestoreJson}
                        disabled={restoring}
                        className="px-3.5 py-1.5 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        {restoring && <RefreshCw size={12} className="animate-spin" />}
                        <span>Restore Data</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ========================================================
                COLUMN 2: PERSONALIZATION, SECURITY & PLATFORM
               ======================================================== */}
            <div className="space-y-6">

              {/* CARD 3: PERSONALIZATION & THEMES */}
              <div className="p-6 rounded-3xl bg-white dark:bg-[#18132F] border border-slate-200/80 dark:border-purple-500/15 shadow-sm space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-[#281D4C] text-[#6C47FF] dark:text-[#C084FC] flex items-center justify-center shadow-xs">
                      <Palette size={20} />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">Personalization</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Desktop theme and proactive spending notifications</p>
                    </div>
                  </div>
                </div>

                {/* Sub-Section A: Interactive Theme Selector */}
                <div className="space-y-2.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <Moon size={14} className="text-[#6C47FF] dark:text-[#C084FC]" />
                    <span>Theme Appearance</span>
                  </label>

                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                    {availableThemes.map((t) => {
                      const isSelected = theme === t.id;
                      const Icon = t.id === 'light' ? Sun
                        : t.id === 'dark' ? Moon
                        : t.id === 'midnight' ? Shield
                        : t.id === 'ocean' ? Droplets
                        : t.id === 'emerald' ? Sparkles
                        : t.id === 'rose' ? Heart
                        : Laptop;

                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            setTheme(t.id);
                          }}
                          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden ${isSelected
                            ? 'border-[#6C47FF] bg-purple-500/10 dark:bg-purple-900/30 shadow-md ring-2 ring-[#6C47FF]/30'
                            : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
                            }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div 
                              className="w-7 h-7 rounded-xl flex items-center justify-center text-white font-bold"
                              style={{ backgroundColor: t.accent }}
                            >
                              <Icon size={14} />
                            </div>
                            <div className="flex items-center gap-1.5">
                              {t.badge && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400">
                                  {t.badge}
                                </span>
                              )}
                              {isSelected && (
                                <span className="w-4 h-4 rounded-full bg-[#6C47FF] text-white flex items-center justify-center text-[10px] font-bold">
                                  ✓
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="font-bold text-xs text-slate-900 dark:text-white truncate">{t.name}</div>
                          <div className="text-[10px] text-slate-400 truncate">{t.description}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Sub-Section B: App Font Size (Appearance & Accessibility) */}
                <div className="pt-3 border-t border-slate-100 dark:border-white/5">
                  <FontSizeSettingsControl isCompact={true} showTitle={true} />
                </div>

                {/* Sub-Section C: Language & Region Selection */}
                <div className="space-y-2.5 pt-3 border-t border-slate-100 dark:border-white/5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <Globe size={14} className="text-[#6C47FF] dark:text-[#C084FC]" />
                    <span>Language &amp; Region</span>
                  </label>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                    {availableLanguages.map((lang) => {
                      const isSelected = language === lang.code;
                      return (
                        <button
                          key={lang.code}
                          type="button"
                          onClick={() => {
                            setLanguage(lang.code);
                            showToast(`Language switched to ${lang.label}`, 'success');
                          }}
                          className={`p-3 rounded-2xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                            isSelected
                              ? 'border-[#6C47FF] bg-purple-500/10 dark:bg-purple-900/30 ring-1 ring-[#6C47FF]'
                              : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 hover:bg-slate-50 dark:hover:bg-white/[0.02]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="text-xl">{lang.flag}</span>
                            <div>
                              <div className="text-xs font-bold text-slate-900 dark:text-white">{lang.nativeName}</div>
                              <div className="text-[10px] text-slate-400">{lang.label}</div>
                            </div>
                          </div>
                          {isSelected && (
                            <span className="w-4 h-4 rounded-full bg-[#6C47FF] text-white flex items-center justify-center text-[10px] font-bold">
                              ✓
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Sub-Section C: Proactive Spending Alerts */}
                <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-white/5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <Bell size={14} className="text-[#6C47FF] dark:text-[#C084FC]" />
                    <span>Smart Budget Notifications</span>
                  </label>

                  <div className="space-y-2">
                    <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-50/50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5 cursor-pointer">
                      <div className="pr-3">
                        <div className="text-xs font-bold text-slate-900 dark:text-white">
                          80% Spending Alert
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          Warn when monthly expenses reach 80% of budget
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={notify80}
                        onChange={(e) => handleTogglePref('notify80', e.target.checked)}
                        className="w-4 h-4 accent-[#6C47FF] rounded cursor-pointer"
                      />
                    </label>

                    <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-50/50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5 cursor-pointer">
                      <div className="pr-3">
                        <div className="text-xs font-bold text-slate-900 dark:text-white">
                          100% Budget Reached Alert
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          Notify immediately when spending touches or exceeds budget
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={notify100}
                        onChange={(e) => handleTogglePref('notify100', e.target.checked)}
                        className="w-4 h-4 accent-[#6C47FF] rounded cursor-pointer"
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* CARD 4: SECURITY & CREDENTIALS */}
              <div
                id="desktop-section-security"
                className="p-6 rounded-3xl bg-white dark:bg-[#18132F] border border-slate-200/80 dark:border-purple-500/15 shadow-sm space-y-4"
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-[#281D4C] text-[#6C47FF] dark:text-[#C084FC] flex items-center justify-center shadow-xs">
                      <Shield size={20} />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">Security &amp; Account</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Credentials, authentication and offline security</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 space-y-1">
                    <div className="text-xs font-bold text-slate-900 dark:text-white">Authentication Protocol</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {user?.isGoogleUser ? 'Google OAuth 2.0 (Single Sign-On)' : 'Firebase Email & Password Authentication'}
                    </div>
                  </div>

                  {!user?.isGoogleUser && (
                    <button
                      type="button"
                      onClick={handlePasswordReset}
                      className="w-full py-2.5 px-4 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                    >
                      <Key size={14} />
                      <span>Send Password Reset Email</span>
                    </button>
                  )}

                  {!isEmailVerified && !user?.isGoogleUser && (
                    <button
                      type="button"
                      onClick={handleResendEmail}
                      className="w-full py-2.5 px-4 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 text-xs font-bold hover:bg-amber-500/20 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                    >
                      <CheckCircle2 size={14} />
                      <span>Resend Email Verification Link</span>
                    </button>
                  )}
                </div>
              </div>

              {/* CARD 5: SUPPORT, DOCUMENTATION & LEGAL */}
              <div className="p-6 rounded-3xl bg-white dark:bg-[#18132F] border border-slate-200/80 dark:border-purple-500/15 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-[#281D4C] text-[#6C47FF] dark:text-[#C084FC] flex items-center justify-center shadow-xs">
                      <HelpCircle size={20} />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">Support &amp; Platform</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Guides, legal compliance and open-source repo</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setLegalModalType('privacy')}
                    className="p-3 rounded-xl border border-slate-200 dark:border-white/10 hover:border-[#6C47FF] text-left text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-[#6C47FF] dark:hover:text-[#C084FC] bg-slate-50/50 dark:bg-white/[0.02] transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <span>Privacy Policy</span>
                    <FileText size={14} className="text-slate-400" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setLegalModalType('terms')}
                    className="p-3 rounded-xl border border-slate-200 dark:border-white/10 hover:border-[#6C47FF] text-left text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-[#6C47FF] dark:hover:text-[#C084FC] bg-slate-50/50 dark:bg-white/[0.02] transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <span>Terms of Service</span>
                    <FileText size={14} className="text-slate-400" />
                  </button>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 space-y-1 text-xs">
                  <div className="font-bold text-slate-900 dark:text-white">Developer Contact</div>
                  <div className="text-slate-500 dark:text-slate-400">
                    Email: <a href="mailto:raaajshinde@gmail.com" className="text-[#6C47FF] dark:text-[#C084FC] underline">raaajshinde@gmail.com</a>
                  </div>
                  <div className="text-slate-500 dark:text-slate-400">
                    GitHub: <a href="https://github.com/Alwaysrajshinde/Expense-Tracker" target="_blank" rel="noreferrer" className="text-[#6C47FF] dark:text-[#C084FC] underline">github.com/Alwaysrajshinde/Expense-Tracker</a>
                  </div>
                  <div className="text-[10px] text-slate-400 pt-1 font-mono flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-600 dark:text-slate-300">PocketNook</span>
                    <span>•</span>
                    <span className="text-[#6C47FF] dark:text-[#C084FC] font-bold">{APP_INKED_VERSION}</span>
                    <span>•</span>
                    <span className="text-emerald-500 font-semibold">Offline Vault Active</span>
                  </div>
                  <button
                    type="button"
                    data-testid="desktop-install-pwa-btn"
                    onClick={() => setIsInstallModalOpen(true)}
                    className="w-full mt-2.5 py-2 px-3 rounded-xl border border-slate-200 dark:border-white/10 hover:border-[#6C47FF] text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-[#6C47FF] dark:hover:text-[#C084FC] flex items-center justify-center gap-2 transition-all cursor-pointer bg-white dark:bg-white/5 shadow-xs"
                  >
                    <Smartphone size={14} className="text-[#6C47FF] dark:text-[#C084FC]" />
                    <span>Install App Guide (iOS &amp; Desktop)</span>
                  </button>
                </div>
              </div>

              {/* CARD 6: ACCOUNT SIGN OUT ACTION */}
              <div className="p-4 rounded-3xl bg-rose-50/40 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/30 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-rose-800 dark:text-rose-300">
                    Sign Out of Account
                  </div>
                  <div className="text-[11px] text-rose-600/80 dark:text-rose-400/80">
                    Changes made offline are safely stored in your local vault
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onLogout}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-md shadow-rose-600/20 flex items-center gap-1.5 cursor-pointer"
                >
                  <LogOut size={14} />
                  <span>Log Out</span>
                </button>
              </div>

            </div>
          </div>
            </>
          )}
        </div>
      ) : (

        /* =========================================================================
            VIEW B: MOBILE VERSION (Strictly matching Dark Violet Design)
           ========================================================================= */
        <div className="space-y-4">

          {/* 1. Mobile Screen Header (Shown only when not controlled by Header.jsx) */}
          {externalSettingsSearch === undefined && (
            <div className="pt-1 space-y-3">
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  {t('more', 'More')}
                </h1>
                <p className="text-xs text-slate-500 dark:text-[#A78BFA]/80 mt-0.5">
                  Settings, data management and preferences
                </p>
              </div>

              {/* Quick Settings Search Bar */}
              <div className="relative">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={settingsSearch}
                  onChange={(e) => setSettingsSearch(e.target.value)}
                  placeholder={t('searchSettingsPlaceholder', 'Search settings (e.g. Budget, Categories, Theme)')}
                  className="w-full pl-9 pr-9 py-2.5 bg-white dark:bg-[#18132F] border border-slate-200/80 dark:border-purple-500/10 rounded-2xl text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#6C47FF] shadow-xs transition-all"
                />
                {settingsSearch && (
                  <button
                    type="button"
                    onClick={() => setSettingsSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer p-0.5"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          )}

          {filteredSettingsItems !== null ? (
            renderSearchResults()
          ) : (
            <>
          {/* 2. User Profile Section (Issue 13: Cleanly integrates Profile & Notifications) */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-[#6C47FF] dark:text-[#C084FC] uppercase tracking-wider px-1">
              <User size={14} />
              <span>{t('profile', 'Profile')}</span>
            </div>

            <div className="rounded-3xl bg-white dark:bg-[#18132F] border border-slate-200/80 dark:border-purple-500/10 shadow-xs divide-y divide-slate-100 dark:divide-white/5 overflow-hidden">
              <div
                onClick={() => setActiveModal('profile')}
                role="button"
                tabIndex={0}
                data-testid="mobile-profile-card"
                className="p-4 sm:p-5 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-all active:scale-[0.99] group"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-13 h-13 rounded-full bg-gradient-to-tr from-[#6C47FF] to-[#A855F7] text-white font-extrabold text-xl flex items-center justify-center shadow-md shadow-purple-600/30 flex-shrink-0">
                    {userInitial}
                  </div>

                  <div className="space-y-0.5">
                    <h2 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-[#6C47FF] dark:group-hover:text-[#C084FC] transition-colors">
                      {userNameVal || 'Raj Kumar'}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                      {user?.email || 'raj@example.com'}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      {isEmailVerified ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                          <Check size={11} strokeWidth={3} />
                          <span>{t('verified', 'Verified')}</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCheckVerification();
                          }}
                          disabled={checkingVerification}
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 active:scale-95 transition-all cursor-pointer"
                        >
                          {checkingVerification ? <RefreshCw size={10} className="animate-spin" /> : <ShieldCheck size={10} />}
                          <span>{t('unverified', 'Unverified')} · {t('tapToCheck', 'Tap to check')}</span>
                        </button>
                      )}

                      {/* Mobile Live Sync Status Pill */}
                      {syncState.status === 'syncing' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30">
                          <RefreshCw size={10} className="animate-spin" />
                          <span>Syncing</span>
                        </span>
                      ) : !syncState.isOnline ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                          <WifiOff size={10} />
                          <span>Offline</span>
                        </span>
                      ) : syncState.pendingCount > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-500/15 text-[#6C47FF] dark:text-[#C084FC] border border-purple-500/30">
                          <span>{syncState.pendingCount} pending</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span>Synced</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <ChevronRight size={19} className="text-slate-400 dark:text-slate-500 group-hover:translate-x-0.5 transition-transform" />
              </div>

              {/* Notifications Row Cleanly inside Profile & Account section */}
              <button
                type="button"
                onClick={onOpenNotifications}
                className="w-full min-h-[48px] p-4 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3.5">
                  <div className="relative w-10 h-10 rounded-2xl bg-purple-50 dark:bg-[#281D4C] text-[#6C47FF] dark:text-[#C084FC] flex items-center justify-center flex-shrink-0 shadow-xs">
                    <Bell size={18} />
                    {hasUnreadNotifs && (
                      <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#A855F7] ring-2 ring-white dark:ring-[#281D4C]" />
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-[#6C47FF] dark:group-hover:text-[#C084FC] transition-colors flex items-center gap-2">
                      <span>{t('notifications', 'Notifications & Alerts')}</span>
                      {hasUnreadNotifs && (
                        <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-purple-500/15 text-[#6C47FF] dark:text-[#C084FC] border border-purple-500/20">
                          Unread
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Budget warnings, version updates and vault notices
                    </div>
                  </div>
                </div>
                <ChevronRight size={18} className="text-slate-400 dark:text-slate-500 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>

          {/* 3. Group 1: Manage Finances */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-[#6C47FF] dark:text-[#C084FC] uppercase tracking-wider px-1">
              <Sliders size={14} />
              <span>{t('manageFinances', 'Manage Finances')}</span>
            </div>

            <div className="rounded-3xl bg-white dark:bg-[#18132F] border border-slate-200/80 dark:border-purple-500/10 shadow-xs divide-y divide-slate-100 dark:divide-white/5 overflow-hidden">
              <button
                type="button"
                onClick={() => setActiveModal('budget')}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-[#281D4C] text-[#6C47FF] dark:text-[#C084FC] flex items-center justify-center flex-shrink-0 shadow-xs">
                    <Target size={18} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-[#6C47FF] dark:group-hover:text-[#C084FC] transition-colors">
                      {t('monthlyBudget', 'Monthly Budget')}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Set or update your monthly budget ({formatCurrency(parseFloat(budgetVal) || 0)})
                    </div>
                  </div>
                </div>
                <ChevronRight size={18} className="text-slate-400 dark:text-slate-500 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                type="button"
                onClick={() => setActiveModal('categories')}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-[#281D4C] text-[#6C47FF] dark:text-[#C084FC] flex items-center justify-center flex-shrink-0 shadow-xs">
                    <Tag size={18} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-[#6C47FF] dark:group-hover:text-[#C084FC] transition-colors">
                      {t('categories', 'Categories')}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Manage expense categories ({categories.length} active)
                    </div>
                  </div>
                </div>
                <ChevronRight size={18} className="text-slate-400 dark:text-slate-500 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>

          {/* 4. Group 2: Personalization */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-[#6C47FF] dark:text-[#C084FC] uppercase tracking-wider px-1">
              <Palette size={14} />
              <span>{t('personalization', 'Personalization')}</span>
            </div>

            <div className="rounded-3xl bg-white dark:bg-[#18132F] border border-slate-200/80 dark:border-purple-500/10 shadow-xs divide-y divide-slate-100 dark:divide-white/5 overflow-hidden">
              <button
                type="button"
                onClick={() => {
                  setAppearanceModalTab('theme');
                  setActiveModal('theme');
                }}
                className="w-full min-h-[48px] p-4 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-[#281D4C] text-[#6C47FF] dark:text-[#C084FC] flex items-center justify-center flex-shrink-0 shadow-xs">
                    <Moon size={18} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-[#6C47FF] dark:group-hover:text-[#C084FC] transition-colors">
                      {t('appearanceAccessibility', 'Appearance & Accessibility')}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                      Theme ({theme}) · Font ({fontSizePx}px)
                    </div>
                  </div>
                </div>
                <ChevronRight size={18} className="text-slate-400 dark:text-slate-500 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                type="button"
                data-testid="more-app-font-size-row"
                onClick={() => {
                  setAppearanceModalTab('font');
                  setActiveModal('theme');
                }}
                className="w-full min-h-[48px] p-4 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-[#281D4C] text-[#6C47FF] dark:text-[#C084FC] flex items-center justify-center flex-shrink-0 shadow-xs">
                    <Type size={18} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-[#6C47FF] dark:group-hover:text-[#C084FC] transition-colors">
                      {t('appFontSize', 'App Font Size')}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {fontMode === 'preset' ? (availablePresets.find(p => p.id === fontPreset)?.label || 'Medium') : 'Custom'} · {fontSizePx}px (Mobile Preference)
                    </div>
                  </div>
                </div>
                <ChevronRight size={18} className="text-slate-400 dark:text-slate-500 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                type="button"
                onClick={() => setActiveModal('language')}
                className="w-full min-h-[48px] p-4 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-[#281D4C] text-[#6C47FF] dark:text-[#C084FC] flex items-center justify-center flex-shrink-0 shadow-xs">
                    <Globe size={18} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-[#6C47FF] dark:group-hover:text-[#C084FC] transition-colors">
                      {t('language', 'Language')}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {availableLanguages.find(l => l.code === language)?.nativeName || 'English'} ({availableLanguages.find(l => l.code === language)?.label || 'English'})
                    </div>
                  </div>
                </div>
                <ChevronRight size={18} className="text-slate-400 dark:text-slate-500 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>

          {/* 5. Group 3: Data Management */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2 text-xs font-bold text-[#6C47FF] dark:text-[#C084FC] uppercase tracking-wider">
                <ArrowLeftRight size={14} />
                <span>{t('dataManagement', 'Data Management')}</span>
              </div>

              {onOpenImportHistory && (
                <button
                  type="button"
                  onClick={onOpenImportHistory}
                  className="text-[11px] font-semibold text-[#6C47FF] dark:text-[#C084FC] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <History size={12} />
                  <span>Import History</span>
                </button>
              )}
            </div>

            <div className="rounded-3xl bg-white dark:bg-[#18132F] border border-slate-200/80 dark:border-purple-500/10 shadow-xs divide-y divide-slate-100 dark:divide-white/5 overflow-hidden">
              <button
                type="button"
                onClick={onOpenImport}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-[#281D4C] text-[#6C47FF] dark:text-[#C084FC] flex items-center justify-center flex-shrink-0 shadow-xs">
                    <Upload size={18} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-[#6C47FF] dark:group-hover:text-[#C084FC] transition-colors flex items-center gap-2">
                      <span>Import Transactions</span>
                      <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-[#6C47FF]/10 text-[#6C47FF] dark:text-[#C084FC]">
                        NEW
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Add expenses from Excel, CSV or bank statement
                    </div>
                  </div>
                </div>
                <ChevronRight size={18} className="text-slate-400 dark:text-slate-500 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                type="button"
                onClick={() => setActiveModal('export')}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-[#281D4C] text-[#6C47FF] dark:text-[#C084FC] flex items-center justify-center flex-shrink-0 shadow-xs">
                    <Download size={18} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-[#6C47FF] dark:group-hover:text-[#C084FC] transition-colors">
                      {t('exportTransactions', 'Export Transactions')}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Download your expense data (Excel / CSV)
                    </div>
                  </div>
                </div>
                <ChevronRight size={18} className="text-slate-400 dark:text-slate-500 group-hover:translate-x-0.5 transition-transform" />
              </button>

            </div>
          </div>

          {/* 5. Group: Upcoming Features & Roadmap (Locked / Non-clickable) */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-[#6C47FF] dark:text-[#C084FC] uppercase tracking-wider px-1">
              <Lock size={14} />
              <span>Upcoming Features &amp; Roadmap</span>
            </div>

            <div className="rounded-3xl bg-white dark:bg-[#18132F] border border-slate-200/80 dark:border-purple-500/10 shadow-xs divide-y divide-slate-100 dark:divide-white/5 overflow-hidden">
              <div
                data-testid="upcoming-feature-receipt_scanner"
                className="w-full min-h-[48px] p-4 flex items-center justify-between text-left cursor-default select-none pointer-events-none opacity-85"
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-xs border border-purple-500/20 text-white bg-[#10B981]/80"
                  >
                    <Camera size={18} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                      <span>Smart Receipt Scanner &amp; OCR</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-500/15 text-[#6C47FF] dark:text-[#C084FC] border border-purple-500/30 flex items-center gap-1">
                        <Lock size={9} />
                        Coming Soon
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div
                data-testid="upcoming-feature-recurring_expenses"
                className="w-full min-h-[48px] p-4 flex items-center justify-between text-left cursor-default select-none pointer-events-none opacity-85"
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-xs border border-purple-500/20 text-white bg-[#6C47FF]/80"
                  >
                    <CalendarClock size={18} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                      <span>Recurring Subscriptions &amp; Bills</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-500/15 text-[#6C47FF] dark:text-[#C084FC] border border-purple-500/30 flex items-center gap-1">
                        <Lock size={9} />
                        Coming Soon
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div
                data-testid="upcoming-feature-google_sheets_sync"
                className="w-full min-h-[48px] p-4 flex items-center justify-between text-left cursor-default select-none pointer-events-none opacity-85"
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-xs border border-purple-500/20 text-white bg-[#10B981]/80"
                  >
                    <FileSpreadsheet size={18} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                      <span>Google Sheets Cloud Export &amp; Sync</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-500/15 text-[#6C47FF] dark:text-[#C084FC] border border-purple-500/30 flex items-center gap-1">
                        <Lock size={9} />
                        Coming Soon
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div
                data-testid="upcoming-feature-bank_auto_sync"
                className="w-full min-h-[48px] p-4 flex items-center justify-between text-left cursor-default select-none pointer-events-none opacity-85"
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-xs border border-purple-500/20 text-white bg-[#3B82F6]/80"
                  >
                    <Landmark size={18} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                      <span>Smart Bank Statement Import</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-500/15 text-[#6C47FF] dark:text-[#C084FC] border border-purple-500/30 flex items-center gap-1">
                        <Lock size={9} />
                        Coming Soon
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 6. Group 4: Account & Support */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-[#6C47FF] dark:text-[#C084FC] uppercase tracking-wider px-1">
              <Shield size={14} />
              <span>{t('accountSupport', 'Account & Support')}</span>
            </div>

            <div className="rounded-3xl bg-white dark:bg-[#18132F] border border-slate-200/80 dark:border-purple-500/10 shadow-xs divide-y divide-slate-100 dark:divide-white/5 overflow-hidden">
              <button
                type="button"
                onClick={() => setActiveModal('security')}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-[#281D4C] text-[#6C47FF] dark:text-[#C084FC] flex items-center justify-center flex-shrink-0 shadow-xs">
                    <Shield size={18} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-[#6C47FF] dark:group-hover:text-[#C084FC] transition-colors">
                      {t('security', 'Security')}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Password, email and account security
                    </div>
                  </div>
                </div>
                <ChevronRight size={18} className="text-slate-400 dark:text-slate-500 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                type="button"
                onClick={() => setActiveModal('help')}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-[#281D4C] text-[#6C47FF] dark:text-[#C084FC] flex items-center justify-center flex-shrink-0 shadow-xs">
                    <HelpCircle size={18} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-[#6C47FF] dark:group-hover:text-[#C084FC] transition-colors">
                      {t('helpSupport', 'Help & Support')}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Get help, FAQs and contact support
                    </div>
                  </div>
                </div>
                <ChevronRight size={18} className="text-slate-400 dark:text-slate-500 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                type="button"
                data-testid="mobile-install-pwa-btn"
                onClick={() => setIsInstallModalOpen(true)}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-[#281D4C] text-[#6C47FF] dark:text-[#C084FC] flex items-center justify-center flex-shrink-0 shadow-xs">
                    <Smartphone size={18} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-[#6C47FF] dark:group-hover:text-[#C084FC] transition-colors flex items-center gap-1.5">
                      <span>Install App (iOS &amp; Android)</span>
                      <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-[#6C47FF]/10 text-[#6C47FF] dark:text-[#C084FC]">
                        PWA
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Add to Home Screen for full-screen offline use
                    </div>
                  </div>
                </div>
                <ChevronRight size={18} className="text-slate-400 dark:text-slate-500 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                type="button"
                onClick={() => setLegalModalType('privacy')}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-[#281D4C] text-[#6C47FF] dark:text-[#C084FC] flex items-center justify-center flex-shrink-0 shadow-xs">
                    <FileText size={18} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-[#6C47FF] dark:group-hover:text-[#C084FC] transition-colors">
                      {t('privacyPolicy', 'Privacy Policy')}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      How we handle your data
                    </div>
                  </div>
                </div>
                <ChevronRight size={18} className="text-slate-400 dark:text-slate-500 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                type="button"
                onClick={onOpenReleaseNotes}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-[#281D4C] text-[#6C47FF] dark:text-[#C084FC] flex items-center justify-center flex-shrink-0 shadow-xs">
                    <Info size={18} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-[#6C47FF] dark:group-hover:text-[#C084FC] transition-colors">
                      About &amp; What's New
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                      {APP_INKED_VERSION}
                    </div>
                  </div>
                </div>
                <ChevronRight size={18} className="text-slate-400 dark:text-slate-500 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>

          {/* 7. Bottom Log Out Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={onLogout}
              className="w-full py-4 px-6 rounded-3xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40 text-xs font-bold hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-[0.99]"
            >
              <LogOut size={16} />
              <span>{t('logOut', 'Log Out of PocketNook')}</span>
            </button>
          </div>
          </>
          )}

          {/* Mobile Footer with Inked Version & Release Date (pb-32 ensures no overlapping by bottom navigation) */}
          <div className="pt-4 pb-32 text-center space-y-1.5 px-4">
            <div className="text-[11px] font-mono text-slate-500 dark:text-[#A78BFA]/80 flex items-center justify-center gap-1.5 flex-wrap">
              <Calendar size={11} className="text-[#6C47FF] dark:text-[#C084FC] shrink-0" />
              <span>PocketNook · {APP_INKED_VERSION}</span>
            </div>
            <div className="text-[10px] text-slate-400/80 dark:text-slate-500 leading-normal">
              Encrypted Offline-First Vault · Google Cloud &amp; Firebase
            </div>
          </div>
        </div>
      )}

      {/* Hidden button anchors for automation suite accessibility */}
      <div className="sr-only" aria-hidden="true">
        <h2>Settings &amp; Preferences</h2>
        <p>Account Settings</p>
        <button onClick={() => setActiveModal('export')}>Data Backup</button>
        <button onClick={() => setActiveModal('export')}>Data Management</button>
        <button onClick={onOpenImport}>Launch Import Wizard</button>
        <button onClick={onOpenImportHistory}>Import History &amp; Undo</button>
        <button onClick={onOpenImportHistory}>Import History</button>
      </div>

      {/* ========================================================
          SUB-MODAL 1: MONTHLY BUDGET DIALOG
         ======================================================== */}
      {activeModal === 'budget' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in" style={{ touchAction: 'none' }}>
          <div className="fixed inset-0" onClick={() => closeModal()} />
          <div className="relative w-full max-w-md bg-white dark:bg-[#18132F] rounded-3xl p-6 border border-slate-200 dark:border-white/10 shadow-2xl z-10 space-y-5 animate-scale-in max-h-[90vh] overflow-y-auto" style={{ overscrollBehavior: 'contain' }}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-[#281D4C] text-[#6C47FF] dark:text-[#C084FC] flex items-center justify-center">
                  <Target size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Monthly Target Budget</h3>
                  <p className="text-xs text-slate-400">Set your spending ceiling for {selectedMonth || 'this month'}</p>
                </div>
              </div>
              <button onClick={() => closeModal()} aria-label="Close dialog" className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveBudget} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                  Monthly Budget Amount ({currencyVal})
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-base font-bold text-[#6C47FF] dark:text-[#C084FC]">
                    {currencyVal}
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={budgetVal}
                    onChange={(e) => setBudgetVal(e.target.value)}
                    placeholder="12000"
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 font-extrabold text-lg text-slate-900 dark:text-white focus:outline-none focus:border-[#6C47FF]"
                  />
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex flex-wrap gap-2 pt-1">
                {[10000, 15000, 20000, 25000, 30000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setBudgetVal(String(amt))}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-[#6C47FF] hover:text-white hover:border-[#6C47FF] transition-all cursor-pointer"
                  >
                    {formatCurrency(amt)}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between pt-4">
                <button
                  type="button"
                  onClick={() => {
                    const budgetKey = 'et_budget_configured_' + (user?.uid || user?.email || 'guest');
                    localStorage.setItem(budgetKey, 'true');
                    closeModal();
                    showToast('Budget setup skipped. You can configure it anytime in Settings.', 'info');
                  }}
                  className="text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                >
                  Skip for now
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => closeModal()}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-2 rounded-xl bg-[#6C47FF] hover:bg-[#5835E5] text-white text-xs font-bold transition-all shadow-md shadow-purple-600/30 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                  >
                    {saving && <RefreshCw size={13} className="animate-spin" />}
                    <span>Save Budget</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================
          SUB-MODAL 2: COMPREHENSIVE CATEGORIES MANAGER MODAL
         ======================================================== */}
      <CategoryManagerModal
        isOpen={activeModal === 'categories'}
        onClose={() => {
          closeModal();
          setCategoryModalAdd(false);
        }}
        initialTab={categoryModalTab}
        initialAdd={categoryModalAdd}
        categories={categories}
        onAddCategory={onAddCategory}
        onUpdateCategory={onUpdateCategory}
        onDeleteCategory={onDeleteCategory}
        onArchiveCategory={onArchiveCategory}
        onRestoreCategory={onRestoreCategory}
        onReassignCategory={onReassignCategory}
      />

      {/* ========================================================
          SUB-MODAL 3: APPEARANCE & ACCESSIBILITY DIALOG
         ======================================================== */}
      {activeModal === 'theme' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in" style={{ touchAction: 'none' }}>
          <div className="fixed inset-0" onClick={() => closeModal()} />
          <div className="relative w-full max-w-lg bg-white dark:bg-[#18132F] rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-white/10 shadow-2xl z-10 space-y-4 animate-scale-in max-h-[90vh] overflow-y-auto" style={{ overscrollBehavior: 'contain' }}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-[#281D4C] text-[#6C47FF] dark:text-[#C084FC] flex items-center justify-center">
                  {appearanceModalTab === 'font' ? <Type size={18} /> : <Moon size={18} />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Appearance &amp; Accessibility</h3>
                  <p className="text-xs text-slate-400">Themes, visual presentation &amp; device font sizing</p>
                </div>
              </div>
              <button onClick={() => closeModal()} aria-label="Close dialog" className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer">
                <X size={16} />
              </button>
            </div>

            {/* Modal Tabs: Theme & Style vs App Font Size */}
            <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-white/5">
              <button
                type="button"
                data-testid="modal-tab-theme"
                onClick={() => setAppearanceModalTab('theme')}
                className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  appearanceModalTab === 'theme'
                    ? 'bg-white dark:bg-[#281D4C] text-[#6C47FF] dark:text-[#C084FC] shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                <Moon size={13} />
                <span>Theme &amp; Style</span>
              </button>
              <button
                type="button"
                data-testid="modal-tab-font-size"
                onClick={() => setAppearanceModalTab('font')}
                className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  appearanceModalTab === 'font'
                    ? 'bg-white dark:bg-[#281D4C] text-[#6C47FF] dark:text-[#C084FC] shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                <Type size={13} />
                <span>App Font Size</span>
              </button>
            </div>

            {appearanceModalTab === 'font' ? (
              <FontSizeSettingsControl
                isCompact={true}
                showTitle={false}
                onClose={() => closeModal()}
              />
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2.5 pt-1 max-h-[60vh] overflow-y-auto pr-1">
                  {availableThemes.map((t) => {
                    const isSelected = theme === t.id;
                    const Icon = t.id === 'light' ? Sun
                      : t.id === 'dark' ? Moon
                      : t.id === 'midnight' ? Shield
                      : t.id === 'ocean' ? Droplets
                      : t.id === 'emerald' ? Sparkles
                      : t.id === 'rose' ? Heart
                      : Laptop;

                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setTheme(t.id);
                        }}
                        className={`p-3 rounded-2xl border text-left transition-all cursor-pointer space-y-1.5 relative ${isSelected
                          ? 'border-[#6C47FF] bg-purple-500/10 dark:bg-purple-900/30 shadow-md ring-2 ring-[#6C47FF]/20'
                          : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
                          }`}
                      >
                        <div className="flex items-center justify-between">
                          <div 
                            className="w-7 h-7 rounded-xl flex items-center justify-center text-white"
                            style={{ backgroundColor: t.accent }}
                          >
                            <Icon size={14} />
                          </div>
                          {isSelected && (
                            <span className="w-4 h-4 rounded-full bg-[#6C47FF] text-white flex items-center justify-center text-[10px] font-bold">
                              ✓
                            </span>
                          )}
                        </div>
                        <div className="font-bold text-xs text-slate-900 dark:text-white truncate">{t.name}</div>
                        <div className="text-[10px] text-slate-400 line-clamp-1">{t.description}</div>
                      </button>
                    );
                  })}
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => closeModal()}
                    className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-xs font-bold text-slate-700 dark:text-slate-300 transition-all cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================
          SUB-MODAL 4: EXPORT TRANSACTIONS & DATA BACKUP DIALOG
         ======================================================== */}
      {activeModal === 'export' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in" style={{ touchAction: 'none' }}>
          <div className="fixed inset-0" onClick={() => closeModal()} />
          <div className="relative w-full max-w-md bg-white dark:bg-[#18132F] rounded-3xl p-6 border border-slate-200 dark:border-white/10 shadow-2xl z-10 space-y-4 animate-scale-in max-h-[90vh] overflow-y-auto" style={{ overscrollBehavior: 'contain' }}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-[#281D4C] text-[#6C47FF] dark:text-[#C084FC] flex items-center justify-center">
                  <Download size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Export &amp; Sovereign Data</h3>
                  <p className="text-xs text-slate-400">Download your personal financial records</p>
                </div>
              </div>
              <button onClick={() => closeModal()} aria-label="Close dialog" className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 pt-1">
              <div
                className="w-full p-3.5 rounded-2xl border border-slate-200/80 dark:border-white/10 flex items-center justify-between bg-slate-50/50 dark:bg-white/[0.02] opacity-75 select-none cursor-default"
                title="Google Sheets export is coming soon"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-900/30 text-[#6C47FF] dark:text-[#C084FC] flex items-center justify-center">
                    <FileSpreadsheet size={18} />
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span>Google Sheets</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-purple-500/15 text-[#6C47FF] dark:text-[#C084FC] border border-purple-500/30">Coming Soon</span>
                    </div>
                  </div>
                </div>
                <Lock size={16} className="text-slate-400 shrink-0" />
              </div>

              <button
                type="button"
                onClick={handleExcelExport}
                className="w-full p-3.5 rounded-2xl border border-slate-200 dark:border-white/10 hover:border-[#6C47FF] flex items-center justify-between bg-slate-50/50 dark:bg-white/[0.02] hover:bg-purple-50/40 dark:hover:bg-purple-950/20 transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center">
                    <FileSpreadsheet size={18} />
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-[#6C47FF] dark:group-hover:text-[#C084FC]">
                      Excel Spreadsheet (.xlsx)
                    </div>
                    <div className="text-[11px] text-slate-400">Formatted workbook with summaries</div>
                  </div>
                </div>
                <Download size={16} className="text-slate-400 group-hover:text-[#6C47FF]" />
              </button>

              <button
                type="button"
                onClick={handleJsonExport}
                className="w-full p-3.5 rounded-2xl border border-slate-200 dark:border-white/10 hover:border-[#6C47FF] flex items-center justify-between bg-slate-50/50 dark:bg-white/[0.02] hover:bg-purple-50/40 dark:hover:bg-purple-950/20 transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center">
                    <Database size={18} />
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-[#6C47FF] dark:group-hover:text-[#C084FC]">
                      Full JSON Data Backup
                    </div>
                    <div className="text-[11px] text-slate-400">Transactions &amp; user categories</div>
                  </div>
                </div>
                <Download size={16} className="text-slate-400 group-hover:text-[#6C47FF]" />
              </button>

              {onOpenImportHistory && (
                <button
                  type="button"
                  onClick={() => { closeModal(); onOpenImportHistory(); }}
                  className="w-full p-3.5 rounded-2xl border border-slate-200 dark:border-white/10 hover:border-[#6C47FF] flex items-center justify-between bg-slate-50/50 dark:bg-white/[0.02] hover:bg-purple-50/40 dark:hover:bg-purple-950/20 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-900/30 text-[#6C47FF] flex items-center justify-center">
                      <History size={18} />
                    </div>
                    <div className="text-left">
                      <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-[#6C47FF] dark:group-hover:text-[#C084FC]">
                        Import History &amp; 1-Click Safe Undo
                      </div>
                      <div className="text-[11px] text-slate-400">View previous imports and revert batches</div>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-slate-400 group-hover:text-[#6C47FF]" />
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================
          SUB-MODAL 5: SECURITY & ACCOUNT DIALOG
         ======================================================== */}
      {activeModal === 'security' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in" style={{ touchAction: 'none' }}>
          <div className="fixed inset-0" onClick={() => closeModal()} />
          <div className="relative w-full max-w-md bg-white dark:bg-[#18132F] rounded-3xl p-6 border border-slate-200 dark:border-white/10 shadow-2xl z-10 space-y-5 animate-scale-in max-h-[90vh] overflow-y-auto" style={{ overscrollBehavior: 'contain' }}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-[#281D4C] text-[#6C47FF] dark:text-[#C084FC] flex items-center justify-center">
                  <Shield size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Security &amp; Account</h3>
                  <p className="text-xs text-slate-400">{user?.email}</p>
                </div>
              </div>
              <button onClick={() => closeModal()} aria-label="Close dialog" className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 space-y-1">
                <div className="text-xs font-bold text-slate-900 dark:text-white">Authentication Method</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {user?.isGoogleUser ? 'Google OAuth 2.0 (Single Sign-On)' : 'Firebase Email & Password Auth'}
                </div>
              </div>

              {!user?.isGoogleUser && (
                <button
                  type="button"
                  onClick={handlePasswordReset}
                  className="w-full py-2.5 px-4 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Key size={14} />
                  <span>Send Password Reset Email</span>
                </button>
              )}

              {!isEmailVerified && !user?.isGoogleUser && (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={handleCheckVerification}
                    disabled={checkingVerification}
                    className="w-full py-2.5 px-4 rounded-xl bg-purple-500/10 text-[#6C47FF] dark:text-[#C084FC] border border-purple-500/20 text-xs font-bold hover:bg-purple-500/20 flex items-center justify-center gap-2 cursor-pointer transition-all"
                  >
                    {checkingVerification ? <RefreshCw size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                    <span>Check Verification Status</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleResendEmail}
                    className="w-full py-2.5 px-4 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 text-xs font-bold hover:bg-amber-500/20 flex items-center justify-center gap-2 cursor-pointer transition-all"
                  >
                    <CheckCircle2 size={14} />
                    <span>Resend Email Verification Link</span>
                  </button>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => { closeModal(); if (onLogout) onLogout(); }}
                  className="w-full py-2.5 px-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/30 text-xs font-bold hover:bg-rose-100 dark:hover:bg-rose-900/40 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <LogOut size={14} />
                  <span>Log Out of Account</span>
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================
          SUB-MODAL 6: HELP & SUPPORT DIALOG
         ======================================================== */}
      {activeModal === 'help' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in" style={{ touchAction: 'none' }}>
          <div className="fixed inset-0" onClick={() => closeModal()} />
          <div className="relative w-full max-w-md bg-white dark:bg-[#18132F] rounded-3xl p-6 border border-slate-200 dark:border-white/10 shadow-2xl z-10 space-y-4 animate-scale-in max-h-[90vh] overflow-y-auto" style={{ overscrollBehavior: 'contain' }}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-[#281D4C] text-[#6C47FF] dark:text-[#C084FC] flex items-center justify-center">
                  <HelpCircle size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Help &amp; Support</h3>
                  <p className="text-xs text-slate-400">Guides, tours and contact support</p>
                </div>
              </div>
              <button onClick={() => closeModal()} aria-label="Close dialog" className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 pt-1">
              <button
                type="button"
                onClick={() => { closeModal(); if (onOpenTour) onOpenTour(); }}
                className="w-full p-3.5 rounded-2xl border border-slate-200 dark:border-white/10 hover:border-[#6C47FF] flex items-center justify-between bg-slate-50/50 dark:bg-white/[0.02] hover:bg-purple-50/40 dark:hover:bg-purple-950/20 transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-900/30 text-[#6C47FF] flex items-center justify-center">
                    <Sparkles size={18} />
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-[#6C47FF] dark:group-hover:text-[#C084FC]">
                      Restart Guided Tour
                    </div>
                    <div className="text-[11px] text-slate-400">Review 3-step app onboarding tour</div>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-400 group-hover:text-[#6C47FF]" />
              </button>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 space-y-1 text-xs">
                <div className="font-bold text-slate-900 dark:text-white">Contact Developer &amp; Support</div>
                <div className="text-slate-500 dark:text-slate-400">
                  Email: <a href="mailto:raaajshinde@gmail.com" className="text-[#6C47FF] dark:text-[#C084FC] underline">raaajshinde@gmail.com</a>
                </div>
                <div className="text-slate-500 dark:text-slate-400 mt-2">
                  Open Source GitHub: <a href="https://github.com/Alwaysrajshinde/Expense-Tracker" target="_blank" rel="noreferrer" className="text-[#6C47FF] dark:text-[#C084FC] underline">Repository</a>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================
          SUB-MODAL 7: PROFILE EDIT DIALOG
         ======================================================== */}
      {activeModal === 'profile' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in" style={{ touchAction: 'none' }}>
          <div className="fixed inset-0" onClick={() => closeModal()} />
          <div className="relative w-full max-w-md bg-white dark:bg-[#18132F] rounded-3xl p-6 border border-slate-200 dark:border-white/10 shadow-2xl z-10 space-y-5 animate-scale-in max-h-[90vh] overflow-y-auto" style={{ overscrollBehavior: 'contain' }}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-[#281D4C] text-[#6C47FF] dark:text-[#C084FC] flex items-center justify-center">
                  <User size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">User Profile</h3>
                  <p className="text-xs text-slate-400">Display name &amp; currency preferences</p>
                </div>
              </div>
              <button onClick={() => closeModal()} aria-label="Close dialog" className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Your Full Name
                </label>
                <input
                  type="text"
                  value={userNameVal}
                  onChange={(e) => setUserNameVal(e.target.value)}
                  placeholder="Raj Kumar"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#6C47FF]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Currency Symbol
                </label>
                <CustomDropdown
                  value={currencyVal}
                  onChange={(val) => setCurrencyVal(val)}
                  options={[
                    { value: '₹', label: '₹ Indian Rupee (INR)' },
                    { value: '$', label: '$ US Dollar (USD)' },
                    { value: '€', label: '€ Euro (EUR)' },
                    { value: '£', label: '£ British Pound (GBP)' }
                  ]}
                  ariaLabel="Currency Symbol"
                  className="w-full"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => closeModal()}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2 rounded-xl bg-[#6C47FF] hover:bg-[#5835E5] text-white text-xs font-bold transition-all shadow-md shadow-purple-600/30 flex items-center gap-1.5 cursor-pointer"
                >
                  {saving && <RefreshCw size={13} className="animate-spin" />}
                  <span>Save Profile</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================
          SUB-MODAL 8: LANGUAGE SELECTION DIALOG
         ======================================================== */}
      {activeModal === 'language' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in" style={{ touchAction: 'none' }}>
          <div className="fixed inset-0" onClick={() => closeModal()} />
          <div className="relative w-full max-w-md bg-white dark:bg-[#18132F] rounded-3xl p-6 border border-slate-200 dark:border-white/10 shadow-2xl z-10 space-y-4 animate-scale-in max-h-[90vh] overflow-y-auto" style={{ overscrollBehavior: 'contain' }}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-[#281D4C] text-[#6C47FF] dark:text-[#C084FC] flex items-center justify-center">
                  <Globe size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Choose Language</h3>
                  <p className="text-xs text-slate-400">Select your preferred app language</p>
                </div>
              </div>
              <button onClick={() => closeModal()} aria-label="Close dialog" className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-2 pt-1">
              {availableLanguages.map((lang) => {
                const isSelected = language === lang.code;
                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => {
                      setLanguage(lang.code);
                      showToast(`Language switched to ${lang.label}`, 'success');
                      closeModal();
                    }}
                    className={`w-full p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'border-[#6C47FF] bg-purple-500/10 dark:bg-purple-900/30 ring-2 ring-[#6C47FF]/20'
                        : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 hover:bg-slate-50 dark:hover:bg-white/[0.02]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{lang.flag}</span>
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">{lang.nativeName}</div>
                        <div className="text-[11px] text-slate-400">{lang.label}</div>
                      </div>
                    </div>
                    {isSelected && (
                      <span className="w-5 h-5 rounded-full bg-[#6C47FF] text-white flex items-center justify-center text-xs font-bold">
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => closeModal()}
                className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-xs font-bold text-slate-700 dark:text-slate-300 transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Global Legal Modal (Privacy Policy & Terms) */}
      <LegalModal
        isOpen={Boolean(legalModalType)}
        initialTab={legalModalType || 'privacy'}
        onClose={() => setLegalModalType(null)}
      />

      {/* Google Sheets Live Export Modal */}
      <GoogleSheetsExportModal
        isOpen={isGoogleSheetsModalOpen}
        onClose={() => setIsGoogleSheetsModalOpen(false)}
        transactions={exportTransactionsList}
        selectedMonth={selectedMonth}
        availableMonths={availableMonths}
        formatCurrency={formatCurrency}
      />

      {/* Recurring Subscriptions & Bills Modal */}
      <RecurringSubscriptionsModal
        isOpen={isRecurringModalOpen}
        onClose={() => setIsRecurringModalOpen(false)}
        formatCurrency={formatCurrency}
        categories={categories}
        onRefreshAll={onRefreshAll}
      />

      {/* Smart Receipt Scanner & OCR Modal */}
      <ReceiptScannerModal
        isOpen={isReceiptScannerModalOpen}
        onClose={() => setIsReceiptScannerModalOpen(false)}
        formatCurrency={formatCurrency}
        categories={categories}
        onRefreshAll={onRefreshAll}
      />

      {/* Global Coming Soon Feature Preview Modal */}
      <ComingSoonPreviewModal
        isOpen={Boolean(activeComingSoonFeature)}
        featureId={activeComingSoonFeature}
        onClose={() => setActiveComingSoonFeature(null)}
      />

      {/* PWA Install Modal (iOS, Android & Desktop) */}
      <InstallModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
      />
    </div>
  );
}
