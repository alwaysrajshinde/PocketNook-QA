import {
  Target, Tag, Moon, Globe, Upload, Download, FileSpreadsheet,
  User, ShieldCheck, Bell, Info, Shield, HelpCircle, Sparkles,
  Key, Database, History, Sun, Droplets, Heart, CheckCircle2,
  DollarSign, RefreshCw, LogOut, CheckSquare, Layers, Type, Sliders,
  Camera, CalendarClock, Landmark, Lock, Smartphone, MessageCircle, MessageSquare
} from 'lucide-react';
import { APP_VERSION, APP_INKED_VERSION } from '../constants/version';

/**
 * Centralized Search Index for the More Page
 * Indexes all top-level settings, sub-features, nested dialog controls, and hidden settings.
 *
 * @param {Object} context - Dynamic handlers, props, translation and auth state
 * @returns {Array} List of searchable items
 */
export function buildMoreSearchIndex(context = {}) {
  const {
    t = (k, def) => def,
    user = null,
    settings = {},
    availableThemes = [],
    availableLanguages = [],
    setTheme = () => {},
    setLanguage = () => {},
    setFontPreset = () => {},
    setFontCustom = () => {},
    resetFont = () => {},
    openModal = () => {},
    openGoogleSheets = () => {},
    openComingSoon = () => {},
    openRecurring = () => {},
    openReceiptScanner = () => {},
    openWhatsAppAssistant = () => {},
    openSmsParser = () => {},
    openImport = () => {},
    openImportHistory = () => {},
    openTour = () => {},
    openReleaseNotes = () => {},
    openNotifications = () => {},
    openInstallModal = () => {},
    openPrivacyPolicy = () => {},
    openTermsOfService = () => {},
    exportExcel = () => {},
    exportJson = () => {},
    triggerRestoreJson = () => {},
    sendPasswordReset = () => {},
    checkEmailVerification = () => {},
    resendVerificationEmail = () => {},
    logout = () => {}
  } = context;

  const currency = settings.currency || '₹';

  return [
    // ==========================================
    // 1. PROFILE & ACCOUNT (Parent: Profile & Account)
    // ==========================================
    {
      id: 'profile_main',
      title: t('profile', 'User Profile'),
      subtitle: 'View display name, email, authentication provider and preferences',
      parentCategory: 'Profile & Account',
      keywords: 'profile account user email name credentials raaajshinde display खाते प्रोफाईल नाव ईमेल वापरकर्ता',
      aliases: ['Account', 'User Settings', 'My Profile'],
      icon: User,
      color: '#8B5CF6',
      action: () => openModal('profile')
    },
    {
      id: 'profile_display_name',
      title: 'Change Display Name',
      subtitle: `Current name: "${settings.user_name || user?.displayName || user?.name || 'User'}" · Used in greetings and reports`,
      parentCategory: 'Profile & Account',
      keywords: 'display name change name edit name user name full name nickname नाव बदला नाव प्रोफाईल नाव',
      aliases: ['Edit Name', 'User Name', 'Full Name'],
      icon: User,
      color: '#8B5CF6',
      action: () => openModal('profile')
    },
    {
      id: 'profile_currency',
      title: 'Currency Symbol & Preferences',
      subtitle: `Current: ${currency} · Options: ₹ INR, $ USD, € EUR, £ GBP`,
      parentCategory: 'Profile & Account',
      keywords: 'currency symbol rupee dollar euro pound inr usd eur gbp money sign चलन रुपये डॉलर चिन्ह',
      aliases: ['Currency', 'Rupee Symbol', 'Dollar Symbol'],
      icon: DollarSign,
      color: '#10B981',
      action: () => openModal('profile')
    },
    {
      id: 'account_auth_method',
      title: 'Authentication Method',
      subtitle: user?.isGoogleUser ? 'Google OAuth 2.0 (Single Sign-On)' : 'Firebase Email & Password Auth',
      parentCategory: 'Profile & Account',
      keywords: 'auth authentication method google sso single sign on password credentials लॉगिन खाते गुगल पासवर्ड',
      aliases: ['Sign In Method', 'Login Provider', 'Google Login'],
      icon: ShieldCheck,
      color: '#6366F1',
      action: () => openModal('security')
    },
    {
      id: 'account_logout',
      title: 'Log Out of Account',
      subtitle: 'Safely end your current session and lock local access',
      parentCategory: 'Profile & Account',
      keywords: 'logout signout log out sign out exit leave session disconnect बाहेर पडा लॉग आउट',
      aliases: ['Sign Out', 'Logout', 'Exit App'],
      icon: LogOut,
      color: '#EF4444',
      action: () => logout()
    },

    // ==========================================
    // 2. BUDGET & SPENDING GOALS (Parent: Budget)
    // ==========================================
    {
      id: 'budget_main',
      title: t('monthlyBudget', 'Monthly Budget Target'),
      subtitle: `Spending ceiling: ${currency}${settings.monthly_budget || '12000'} · Track spending pace against goal`,
      parentCategory: 'Budget',
      keywords: 'budget monthly budget limit spend ceiling target expense target महिना बजेट मर्यादा खर्च नियोजन',
      aliases: ['Budget', 'Monthly Limit', 'Spending Goal', 'Expense Ceiling'],
      icon: Target,
      color: '#6C47FF',
      action: () => openModal('budget')
    },
    {
      id: 'budget_presets',
      title: 'Budget Quick Presets',
      subtitle: '1-tap budget amounts: ₹10,000, ₹15,000, ₹20,000, ₹25,000, ₹30,000',
      parentCategory: 'Budget',
      keywords: 'budget presets quick amounts 10000 15000 20000 25000 30000 fast target झटपट बजेट पर्याय',
      aliases: ['Quick Budget', 'Preset Amounts'],
      icon: Target,
      color: '#6C47FF',
      action: () => openModal('budget')
    },
    {
      id: 'budget_alerts',
      title: 'Budget Alerts & Threshold Warnings',
      subtitle: '80% threshold pace warning and 100% budget limit exceeded alerts',
      parentCategory: 'Budget',
      keywords: 'budget alerts warnings 80 percent 100 percent threshold limit exceeded overspending चेतावणी अलर्ट मर्यादा',
      aliases: ['Budget Alerts', 'Overspending Warning', '80% Alert', '100% Alert'],
      icon: Bell,
      color: '#F59E0B',
      action: () => openNotifications()
    },
    {
      id: 'budget_pace',
      title: 'Budget Spending Pace',
      subtitle: 'Health indicator showing whether your spending is on healthy pace',
      parentCategory: 'Budget',
      keywords: 'budget pace health on track spending speed progress स्थिती वेग ट्रॅक',
      aliases: ['Spending Pace', 'Budget Health'],
      icon: Target,
      color: '#10B981',
      action: () => openNotifications()
    },

    // ==========================================
    // 3. CATEGORIES MANAGEMENT (Parent: Categories)
    // ==========================================
    {
      id: 'categories_manage',
      title: t('categoriesTab', 'Manage Categories'),
      subtitle: 'View, edit, color-code and organize all active expense categories',
      parentCategory: 'Categories',
      keywords: 'categories category tags labels icons colors वर्गवारी कॅटेगरी व्यवस्थापन चिन्हे रंग',
      aliases: ['Categories', 'Expense Categories', 'Category List'],
      icon: Tag,
      color: '#A855F7',
      action: () => openModal('categories', { tab: 'active', add: false })
    },
    {
      id: 'categories_add',
      title: 'Add New Category',
      subtitle: 'Create custom expense category with custom icon, accent color and quick pin',
      parentCategory: 'Categories',
      keywords: 'add category new category create category custom category नवीन कॅटेगरी जोडा तयार करा वर्गवारी',
      aliases: ['New Category', 'Create Category'],
      icon: Tag,
      color: '#A855F7',
      action: () => openModal('categories', { tab: 'active', add: true })
    },
    {
      id: 'categories_quick',
      title: 'Quick Categories Pin',
      subtitle: 'Pin frequent categories to Add Expense screen for 1-tap logging',
      parentCategory: 'Categories',
      keywords: 'quick categories pin favorites shortcuts chips home frequent जलद आवडत्या शॉर्टकट',
      aliases: ['Favorite Categories', 'Pinned Categories'],
      icon: CheckSquare,
      color: '#6C47FF',
      action: () => openModal('categories', { tab: 'active', add: false })
    },
    {
      id: 'categories_archived',
      title: 'Archived Categories',
      subtitle: 'View deactivated categories and restore them with historical data intact',
      parentCategory: 'Categories',
      keywords: 'archived categories restore category hidden inactive जुन्या अर्काइव्ह केलेल्या कॅटेगरी पुनर्संचयित',
      aliases: ['Restore Category', 'Inactive Categories'],
      icon: Layers,
      color: '#64748B',
      action: () => openModal('categories', { tab: 'archived', add: false })
    },
    {
      id: 'categories_icons',
      title: 'Category Icon Palette',
      subtitle: 'Choose from 24+ financial icons (Food, Transport, Groceries, Shopping, Health...)',
      parentCategory: 'Categories',
      keywords: 'category icons symbols food transport shopping health travel utilities चिन्हे आयकॉन',
      aliases: ['Icons', 'Category Symbols'],
      icon: Sparkles,
      color: '#EC4899',
      action: () => openModal('categories', { tab: 'active', add: true })
    },
    {
      id: 'categories_colors',
      title: 'Category Color Palette',
      subtitle: 'Pick chart accents from 12 distinct fintech color swatches',
      parentCategory: 'Categories',
      keywords: 'category color palette swatches chart colors रंग पॅलेट',
      aliases: ['Colors', 'Category Colors'],
      icon: Tag,
      color: '#F43F5E',
      action: () => openModal('categories', { tab: 'active', add: true })
    },

    // ==========================================
    // 4. APPEARANCE & ACCESSIBILITY (Parent: Appearance & Accessibility)
    // ==========================================
    {
      id: 'appearance_main',
      title: t('appearanceAccessibility', 'Appearance & Accessibility'),
      subtitle: 'Color schemes, dark mode, and application-wide font size customization',
      parentCategory: 'Appearance & Accessibility',
      keywords: 'appearance accessibility theme dark light midnight font size text size रंग थीम लूक दिखावट आकार',
      aliases: ['Theme', 'Theme Settings', 'Styles', 'Appearance', 'Accessibility'],
      icon: Moon,
      color: '#6366F1',
      action: () => openModal('theme', { tab: 'theme' })
    },
    {
      id: 'app_font_size',
      title: 'App Font Size',
      subtitle: 'Preset sizes (Small, Medium, Large, Extra Large) & custom px slider (12px - 24px) with separate Mobile & Desktop storage',
      parentCategory: 'Appearance & Accessibility',
      keywords: 'app font size text size typography scale zoom accessibility custom slider अक्षरांचा आकार फॉन्ट साईझ मोठा लहान मजकूर',
      aliases: ['Font Size', 'Text Size', 'Font Customization', 'Accessibility Text', 'App Font Size', 'Change Font'],
      icon: Type,
      color: '#8B5CF6',
      action: () => openModal('theme', { tab: 'font' })
    },
    {
      id: 'font_preset_small',
      title: 'Font Size: Small (14px)',
      subtitle: 'Compact typography density, fits maximum content per screen',
      parentCategory: 'Appearance & Accessibility',
      keywords: 'font small 14px compact density लहान फॉन्ट कमी आकार',
      aliases: ['Small Font', 'Compact Text', '14px Font'],
      icon: Type,
      color: '#06B6D4',
      action: () => { setFontPreset('small'); openModal('theme', { tab: 'font' }); }
    },
    {
      id: 'font_preset_medium',
      title: 'Font Size: Medium (16px Default)',
      subtitle: 'Standard balanced readability across mobile and desktop displays',
      parentCategory: 'Appearance & Accessibility',
      keywords: 'font medium 16px default normal मध्यम फॉन्ट डिफॉल्ट',
      aliases: ['Medium Font', 'Default Font', '16px Font', 'Normal Text'],
      icon: Type,
      color: '#6C47FF',
      action: () => { setFontPreset('medium'); openModal('theme', { tab: 'font' }); }
    },
    {
      id: 'font_preset_large',
      title: 'Font Size: Large (18px)',
      subtitle: 'Enhanced reading comfort and clarity across all menus and tables',
      parentCategory: 'Appearance & Accessibility',
      keywords: 'font large 18px big comfort मोठा फॉन्ट स्पष्ट',
      aliases: ['Large Font', 'Big Text', '18px Font'],
      icon: Type,
      color: '#10B981',
      action: () => { setFontPreset('large'); openModal('theme', { tab: 'font' }); }
    },
    {
      id: 'font_preset_extra_large',
      title: 'Font Size: Extra Large (20px)',
      subtitle: 'Maximum prominent text sizing for enhanced visual accessibility',
      parentCategory: 'Appearance & Accessibility',
      keywords: 'font extra large 20px huge prominent accessibility खूप मोठा फॉन्ट',
      aliases: ['Extra Large Font', 'Huge Text', '20px Font', 'XL Font'],
      icon: Type,
      color: '#F59E0B',
      action: () => { setFontPreset('extra-large'); openModal('theme', { tab: 'font' }); }
    },
    {
      id: 'font_custom_slider',
      title: 'Custom Font Size Slider (12px - 24px)',
      subtitle: 'Fine-tuned numerical text slider with instant live preview and reset to default',
      parentCategory: 'Appearance & Accessibility',
      keywords: 'custom font size slider range 12px 24px स्लायडर अक्षरांचा आकार',
      aliases: ['Font Slider', 'Custom Font Size', 'Custom Text Slider'],
      icon: Sliders,
      color: '#EC4899',
      action: () => openModal('theme', { tab: 'font' })
    },
    {
      id: 'theme_dark_violet',
      title: 'Dark Violet Theme',
      subtitle: 'Deep violet fintech aesthetic with high contrast purple accents (Default)',
      parentCategory: 'Appearance',
      keywords: 'dark violet theme purple fintech default dark mode जांभळा डीप व्हायलेट',
      aliases: ['Dark Mode', 'Dark Theme', 'Purple Theme'],
      icon: Moon,
      color: '#6C47FF',
      action: () => { setTheme('dark'); openModal('theme'); }
    },
    {
      id: 'theme_pure_black',
      title: 'Pure Black OLED Theme',
      subtitle: 'Ultra-dark pure black background optimized for OLED displays and battery saving',
      parentCategory: 'Appearance',
      keywords: 'pure black oled midnight theme dark dark mode battery save काळा ओलेड',
      aliases: ['OLED Theme', 'Pure Black', 'True Dark'],
      icon: Shield,
      color: '#000000',
      action: () => { setTheme('midnight'); openModal('theme'); }
    },
    {
      id: 'theme_light',
      title: 'Light Theme',
      subtitle: 'Crisp, high-contrast bright daytime visual presentation',
      parentCategory: 'Appearance',
      keywords: 'light theme light mode day bright white contrast पांढरा प्रकाश डे मोड',
      aliases: ['Light Mode', 'Day Mode', 'White Theme'],
      icon: Sun,
      color: '#F59E0B',
      action: () => { setTheme('light'); openModal('theme'); }
    },
    {
      id: 'theme_midnight_blue',
      title: 'Midnight Blue Theme',
      subtitle: 'Deep oceanic navy night mode with royal blue accents',
      parentCategory: 'Appearance',
      keywords: 'midnight blue theme navy ocean deep blue night mode निळा रात्रीचा',
      aliases: ['Midnight Blue', 'Navy Theme'],
      icon: Droplets,
      color: '#3B82F6',
      action: () => { setTheme('ocean'); openModal('theme'); }
    },
    {
      id: 'theme_sunset_rose',
      title: 'Sunset Rose Theme',
      subtitle: 'Warm crimson and rose twilight gradient aesthetic',
      parentCategory: 'Appearance',
      keywords: 'sunset rose theme crimson pink warm twilight गुलाबी',
      aliases: ['Rose Theme', 'Pink Theme', 'Sunset Theme'],
      icon: Heart,
      color: '#EC4899',
      action: () => { setTheme('rose'); openModal('theme'); }
    },
    {
      id: 'theme_emerald_forest',
      title: 'Emerald Forest Theme',
      subtitle: 'Mint and emerald green wealth aesthetic',
      parentCategory: 'Appearance',
      keywords: 'emerald forest theme green mint wealth prosperity निसर्ग हिरवा',
      aliases: ['Emerald Theme', 'Green Theme', 'Mint Theme'],
      icon: Sparkles,
      color: '#10B981',
      action: () => { setTheme('emerald'); openModal('theme'); }
    },

    // ==========================================
    // 5. LANGUAGE & LOCALIZATION (Parent: Language)
    // ==========================================
    {
      id: 'language_main',
      title: t('language', 'Language & Localization'),
      subtitle: 'Choose between English, मराठी (Marathi), हिंदी (Hindi), and Español (Spanish)',
      parentCategory: 'Language',
      keywords: 'language भाषा मराठी हिंदी english spanish locale translation बोली भाषांतर',
      aliases: ['Language', 'Locale', 'Change Language'],
      icon: Globe,
      color: '#06B6D4',
      action: () => openModal('language')
    },
    {
      id: 'lang_marathi',
      title: 'मराठी (Marathi)',
      subtitle: 'Modern conversational Marathi with regional financial terms',
      parentCategory: 'Language',
      keywords: 'marathi मराठी भाषा महाराष्ट्र मुंबई पुणे खर्च बजेट',
      aliases: ['Marathi Language', 'मराठी'],
      icon: Globe,
      color: '#F97316',
      action: () => { setLanguage('mr'); openModal('language'); }
    },
    {
      id: 'lang_hindi',
      title: 'हिंदी (Hindi)',
      subtitle: 'Conversational Hindi finance interface',
      parentCategory: 'Language',
      keywords: 'hindi हिंदी भाषा भारत खर्च बचत बजट',
      aliases: ['Hindi Language', 'हिंदी'],
      icon: Globe,
      color: '#EF4444',
      action: () => { setLanguage('hi'); openModal('language'); }
    },
    {
      id: 'lang_english',
      title: 'English Language',
      subtitle: 'Standard international English digital finance interface',
      parentCategory: 'Language',
      keywords: 'english us uk international format',
      aliases: ['English'],
      icon: Globe,
      color: '#3B82F6',
      action: () => { setLanguage('en'); openModal('language'); }
    },
    {
      id: 'lang_spanish',
      title: 'Español (Spanish)',
      subtitle: 'Spanish international financial interface',
      parentCategory: 'Language',
      keywords: 'spanish espanol idioma gastos finanzas',
      aliases: ['Spanish Language', 'Español'],
      icon: Globe,
      color: '#EAB308',
      action: () => { setLanguage('es'); openModal('language'); }
    },

    // ==========================================
    // 6. DATA, IMPORT & EXPORT (Parent: Data & Backup)
    // ==========================================
    {
      id: 'data_intelligent_import',
      title: t('importTransactions', 'Intelligent Expense Import'),
      subtitle: 'Import expenses from Excel (.xlsx), CSV or bank statement with auto column detection',
      parentCategory: 'Data & Backup',
      keywords: 'intelligent import upload excel csv bank statement file statement parser डेटा इम्पोर्ट फाईल आयात',
      aliases: ['Import', 'Import Excel', 'Import CSV', 'Bank Statement Import'],
      icon: Upload,
      color: '#10B981',
      action: () => openImport()
    },
    {
      id: 'data_import_history',
      title: 'Import History & Safe Undo',
      subtitle: 'Review past import batches, row counts, and revert erroneous imports with 1-click safe undo',
      parentCategory: 'Data & Backup',
      keywords: 'import history safe undo revert batch transactions previous uploads इतिहास पूर्ववत आयात इतिहास',
      aliases: ['Import History', 'Undo Import', 'Revert Transactions'],
      icon: History,
      color: '#8B5CF6',
      action: () => openImportHistory()
    },
    {
      id: 'data_sheets_export',
      title: 'Google Sheets Cloud Export & Sync',
      subtitle: '1-Click direct cloud export & sync to Google Sheets in your Google Drive (₹0 Cloud Cost)',
      parentCategory: 'Data & Backup',
      keywords: 'google sheets export spreadsheet cloud drive sync ledger active cloud backup coming soon upcoming planned गुगल शीट्स क्लाउड सिंक',
      aliases: ['Google Sheets', 'Sheets Sync', 'Drive Export', 'Cloud Sync', 'Export Sheets', 'Coming Soon', 'Upcoming Features'],
      icon: FileSpreadsheet,
      color: '#10B981',
      action: () => openGoogleSheets()
    },
    {
      id: 'feature_receipt_scanner',
      title: 'Smart Receipt Scanner & OCR',
      subtitle: 'Scan receipts via camera or photo to automatically extract amount, date & vendor on-device',
      parentCategory: 'Smart Tools & Automation',
      keywords: 'receipt scanner ocr camera photo bill scan machine learning on device privacy active पावती स्कॅनर कॅमेरा',
      aliases: ['Receipt Scanner', 'Scan Receipt', 'OCR', 'Camera Bill Scanner', 'Bill Scanner'],
      icon: Camera,
      color: '#10B981',
      action: () => openReceiptScanner()
    },
    {
      id: 'feature_recurring_expenses',
      title: 'Recurring Subscriptions & Bills',
      subtitle: 'Track recurring subscriptions, monthly burn rate, and get advance renewal alerts (₹0 Server Cost)',
      parentCategory: 'Budgeting & Planning',
      keywords: 'recurring expenses subscriptions bills renewal monthly netflix spotify burn rate alerts active सबस्क्रिप्शन मासिक खर्च',
      aliases: ['Subscriptions', 'Recurring Bills', 'Recurring', 'Burn Rate', 'Bill Alerts'],
      icon: CalendarClock,
      color: '#6C47FF',
      action: () => openRecurring()
    },
    {
      id: 'feature_whatsapp_assistant',
      title: 'WhatsApp Chatbox Assistant',
      subtitle: 'Chat naturally to log expenses (e.g. "Chai 20") and check budget summaries in real time',
      parentCategory: 'Smart Tools & Automation',
      keywords: 'whatsapp chat assistant bot conversational nlp chai 20 summary webhook व्हॉट्सॲप असिस्टंट',
      aliases: ['WhatsApp Assistant', 'WhatsApp Chat', 'Chat Assistant', 'Chat Bot', 'WhatsApp'],
      icon: MessageCircle,
      color: '#008069',
      action: () => openWhatsAppAssistant()
    },
    {
      id: 'feature_sms_parser',
      title: 'SMS & UPI 1-Tap Smart Parser',
      subtitle: 'Parse bank debit notifications and UPI alerts instantly on-device with zero cloud leaks',
      parentCategory: 'Smart Tools & Automation',
      keywords: 'sms parser upi alert hdfc sbi icici gpay phonepe paytm clipboard parse ऑन-डिव्हाइस एसएमएस',
      aliases: ['SMS Parser', 'UPI Parser', 'Bank SMS', 'Smart Parser', 'Notification Parser'],
      icon: MessageSquare,
      color: '#3B82F6',
      action: () => openSmsParser()
    },
    {
      id: 'feature_bank_auto_sync',
      title: 'Smart Bank Statement Import',
      subtitle: 'Import PDF, Excel & CSV bank statements with zero API fees and complete client privacy',
      parentCategory: 'Data & Backup',
      keywords: 'bank import statement pdf excel csv account feeds hdfc sbi icici axis free import coming soon upcoming planned बँक खाते विवरण',
      aliases: ['Bank Statement Import', 'Bank Feeds', 'Import Statement', 'Bank Upload', 'Bank Sync', 'Coming Soon', 'Upcoming Features'],
      icon: Landmark,
      color: '#3B82F6',
      action: () => openImport()
    },
    {
      id: 'data_excel_export',
      title: 'Export Excel Spreadsheet (.xlsx)',
      subtitle: 'Download formatted workbook with summaries and categorization for Microsoft Excel',
      parentCategory: 'Data & Backup',
      keywords: 'export excel xlsx spreadsheet download ledger workbook ऑफलाइन एक्सेल डाऊनलोड निर्यात',
      aliases: ['Excel Export', 'Download Excel', 'XLSX Export'],
      icon: FileSpreadsheet,
      color: '#059669',
      action: () => exportExcel()
    },
    {
      id: 'data_json_backup',
      title: 'Full JSON Data Backup',
      subtitle: 'Generate and download complete sovereign JSON backup with all transactions and custom categories',
      parentCategory: 'Data & Backup',
      keywords: 'full json data backup export download database archive संपूर्ण बॅकअप डेटा सुरक्षित',
      aliases: ['JSON Backup', 'Backup Data', 'Download Backup'],
      icon: Database,
      color: '#3B82F6',
      action: () => exportJson()
    },
    {
      id: 'data_json_restore',
      title: 'Restore Data from JSON Backup',
      subtitle: 'Safely restore expense records and categories from a previously exported JSON backup file',
      parentCategory: 'Data & Backup',
      keywords: 'restore backup json upload import file recovery डेटा रीस्टोर परत मिळवा',
      aliases: ['Restore Backup', 'Restore JSON', 'Data Recovery'],
      icon: Upload,
      color: '#6366F1',
      action: () => triggerRestoreJson()
    },

    // ==========================================
    // 7. SECURITY & VAULT (Parent: Security)
    // ==========================================
    {
      id: 'security_main',
      title: 'Security & Account Vault',
      subtitle: 'Credentials, verification status, private cloud vault, and password recovery',
      parentCategory: 'Security',
      keywords: 'security vault password email credentials encryption सुरक्षा पासवर्ड कूटबद्ध खाते',
      aliases: ['Security', 'Account Security', 'Vault'],
      icon: ShieldCheck,
      color: '#F59E0B',
      action: () => openModal('security')
    },
    {
      id: 'security_email_verification',
      title: 'Check Email Verification Status',
      subtitle: 'Verify ownership of your registered email address to protect your account and data',
      parentCategory: 'Security',
      keywords: 'check email verification status verified unverified ownership confirm ईमेल पडताळणी स्थिती',
      aliases: ['Email Verification', 'Verify Email', 'Verification Status'],
      icon: CheckCircle2,
      color: '#10B981',
      action: () => { checkEmailVerification(); openModal('security'); }
    },
    {
      id: 'security_resend_email',
      title: 'Resend Verification Email',
      subtitle: 'Dispatch a new verification link to your registered email address',
      parentCategory: 'Security',
      keywords: 'resend verification email link send confirm पडताळणी लिंक पुन्हा पाठवा',
      aliases: ['Resend Email', 'Resend Link'],
      icon: RefreshCw,
      color: '#F59E0B',
      action: () => resendVerificationEmail()
    },
    {
      id: 'security_password_reset',
      title: 'Send Password Reset Email',
      subtitle: 'Send a secure password recovery and reset link to your email inbox',
      parentCategory: 'Security',
      keywords: 'password reset change password forgot password recovery पासवर्ड बदला विसरलात',
      aliases: ['Password Reset', 'Forgot Password', 'Change Password'],
      icon: Key,
      color: '#6366F1',
      action: () => sendPasswordReset()
    },
    {
      id: 'security_cloud_vault',
      title: 'Cloud Vault & Offline Sync',
      subtitle: 'Local-first offline encryption with automated synchronization to your private cloud storage',
      parentCategory: 'Security',
      keywords: 'cloud vault offline sync encrypted local first privacy व्हॉल्ट क्लाउड सिंक',
      aliases: ['Cloud Vault', 'Offline Sync', 'Data Privacy'],
      icon: Shield,
      color: '#8B5CF6',
      action: () => openModal('security')
    },

    // ==========================================
    // 8. NOTIFICATIONS & ALERTS (Parent: Notifications)
    // ==========================================
    {
      id: 'notifications_center',
      title: t('notifications', 'Notifications & Alerts'),
      subtitle: 'View budget threshold warnings, pace reminders, and application update notices',
      parentCategory: 'Notifications',
      keywords: 'notifications alerts bell updates warnings messages सूचना नोटिफिकेशन्स मेसेज',
      aliases: ['Notifications', 'Alerts Center', 'Messages'],
      icon: Bell,
      color: '#EC4899',
      action: () => openNotifications()
    },
    {
      id: 'notifications_mark_read',
      title: 'Mark All Notifications Read',
      subtitle: 'Clear all unread notification badges and indicators across the application',
      parentCategory: 'Notifications',
      keywords: 'mark all read clear notifications unread badge dismiss सर्व वाचलेले करा',
      aliases: ['Mark Read', 'Clear Notifications'],
      icon: CheckCircle2,
      color: '#10B981',
      action: () => openNotifications()
    },

    // ==========================================
    // 9. HELP, SUPPORT & ABOUT (Parent: Help & About)
    // ==========================================
    {
      id: 'help_tour',
      title: 'Restart Guided Interactive Tour',
      subtitle: 'Take the 3-step walkthrough covering Dashboard, Quick Expenses, and Monthly Budget',
      parentCategory: 'Help & About',
      keywords: 'restart guided tour onboarding walkthrough tutorial help app guide मदत मार्गदर्शक टूर',
      aliases: ['Tour', 'Onboarding', 'Tutorial', 'Walkthrough'],
      icon: Sparkles,
      color: '#6C47FF',
      action: () => openTour()
    },
    {
      id: 'help_release_notes',
      title: "What's New & Release Notes",
      subtitle: `${APP_INKED_VERSION} · Full changelog, latest features and improvements`,
      parentCategory: 'Help & About',
      keywords: 'whats new release notes changelog version updates latest features काय नवीन अपडेट्स व्हर्जन',
      aliases: ['Release Notes', 'What is New', 'Version', 'Changelog'],
      icon: Info,
      color: '#A78BFA',
      action: () => openReleaseNotes()
    },
    {
      id: 'help_privacy_policy',
      title: 'Privacy Policy',
      subtitle: 'Read how your financial records are kept strictly private, encrypted, and sovereign',
      parentCategory: 'Help & About',
      keywords: 'privacy policy data protection security gdpr confidential legal प्रायव्हसी गोपनीयता धोरण',
      aliases: ['Privacy', 'Privacy Policy', 'Data Policy'],
      icon: Shield,
      color: '#10B981',
      action: () => openPrivacyPolicy()
    },
    {
      id: 'help_terms',
      title: 'Terms of Service',
      subtitle: 'Software license, open-source usage guidelines and application terms',
      parentCategory: 'Help & About',
      keywords: 'terms of service legal conditions rules software license सेवा अटी नियम',
      aliases: ['Terms', 'Terms of Service', 'License'],
      icon: HelpCircle,
      color: '#64748B',
      action: () => openTermsOfService()
    },
    {
      id: 'help_install_app',
      title: 'Install PocketNook App (iOS & Android)',
      subtitle: 'Add to iPhone, iPad, Android, or Desktop home screen for full-screen offline use',
      parentCategory: 'Help & About',
      keywords: 'install app pwa ios iphone ipad safari add to home screen download apk desktop इन्स्टॉल ॲप',
      aliases: ['Install App', 'Add to Home Screen', 'iOS Install', 'iPhone App', 'PWA'],
      icon: Smartphone,
      color: '#6C47FF',
      action: () => openInstallModal()
    },
    {
      id: 'help_contact_support',
      title: 'Contact Developer Support',
      subtitle: 'Reach out to the lead engineer at raaajshinde@gmail.com for feedback and assistance',
      parentCategory: 'Help & About',
      keywords: 'contact developer support email help raaajshinde feedback मदत संपर्क ईमेल सहाय्य',
      aliases: ['Support', 'Contact', 'Email Support', 'Help'],
      icon: HelpCircle,
      color: '#3B82F6',
      action: () => openModal('help')
    },
    {
      id: 'help_github_repo',
      title: 'Open Source GitHub Repository',
      subtitle: 'Explore source code, contribute, star, or submit issues on GitHub',
      parentCategory: 'Help & About',
      keywords: 'github open source repository code git pull requests गिटहब कोड',
      aliases: ['GitHub', 'Source Code', 'Repository'],
      icon: Globe,
      color: '#6366F1',
      action: () => openModal('help')
    }
  ];
}

/**
 * Executes resilient, multi-word, ranked search over the More page search index.
 *
 * @param {string} query - Raw user search input
 * @param {Array} items - Search index returned by buildMoreSearchIndex
 * @returns {Array|null} Ranked matching items, or null if query is empty
 */
export function searchMoreIndex(query, items = []) {
  if (!query || typeof query !== 'string') return null;
  const cleanQuery = query.trim().toLowerCase();
  if (!cleanQuery) return null;

  // Split into individual terms for multi-word search
  const terms = cleanQuery.split(/\s+/).filter(Boolean);
  if (terms.length === 0) return null;

  const results = [];
  const seenIds = new Set();

  for (const item of items) {
    if (!item || !item.id || seenIds.has(item.id)) continue;

    const title = (item.title || '').toLowerCase();
    const subtitle = (item.subtitle || '').toLowerCase();
    const parentCategory = (item.parentCategory || '').toLowerCase();
    const keywords = (item.keywords || '').toLowerCase();
    const aliases = Array.isArray(item.aliases) ? item.aliases.map(a => a.toLowerCase()) : [];

    // All search terms must match at least one field
    const matchesAllTerms = terms.every(term => {
      return (
        title.includes(term) ||
        subtitle.includes(term) ||
        parentCategory.includes(term) ||
        keywords.includes(term) ||
        aliases.some(alias => alias.includes(term))
      );
    });

    if (matchesAllTerms) {
      // Calculate relevance score
      let score = 0;

      // Exact title match gets massive boost
      if (title === cleanQuery) score += 100;
      else if (title.startsWith(cleanQuery)) score += 60;
      else if (title.includes(cleanQuery)) score += 40;

      // Match in aliases
      if (aliases.some(a => a === cleanQuery)) score += 50;
      else if (aliases.some(a => a.includes(cleanQuery))) score += 25;

      // Match in parent category
      if (parentCategory === cleanQuery) score += 30;
      else if (parentCategory.includes(cleanQuery)) score += 15;

      // Match in subtitle / description
      if (subtitle.includes(cleanQuery)) score += 20;

      // Match in keywords
      if (keywords.includes(cleanQuery)) score += 15;

      // Bonus for shorter titles matching query closely
      score += Math.max(0, 20 - Math.abs(title.length - cleanQuery.length));

      seenIds.add(item.id);
      results.push({
        ...item,
        score
      });
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  return results;
}
