import React, { useState, useEffect } from 'react';
import { IS_QA, APP_DISPLAY_NAME } from '../utils/appBrand';
import {
  Wallet,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Loader2,
  ShieldCheck,
  FileSpreadsheet,
  Database,
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  X,
  ArrowLeft,
  Sun,
  Moon
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import LegalModal from './LegalModal';
import PublicLanding from './PublicLanding';
import PublicLegalView from './PublicLegalView';
import { saveIntendedRoute, consumeIntendedRoute } from '../services/routeService';

export default function AuthGate({ children }) {
  const { isDark, toggleTheme } = useTheme();
  const {
    isAuthenticated,
    isLoading,
    authError,
    loginWithEmail,
    registerWithEmail,
    loginWithGoogle,
    resetPassword,
    handleConfirmPasswordReset,
    handleVerifyEmailCode
  } = useAuth();

  // Tab state: 'signin' | 'signup'
  const [activeAuthTab, setActiveAuthTab] = useState('signin');

  // Sign In state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Sign Up state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);

  // Forgot password state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetSuccessMsg, setResetSuccessMsg] = useState('');

  // Branded Password Reset action code state
  const [resetOobCode, setResetOobCode] = useState(null);
  const [newPasswordVal, setNewPasswordVal] = useState('');
  const [confirmNewPasswordVal, setConfirmNewPasswordVal] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  // In-flight progress indicator
  const [onboardingStep, setOnboardingStep] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [legalModalType, setLegalModalType] = useState(null);

  // Hash route & Public Homepage state (Resolves Google OAuth Verification Requirements)
  const [currentHash, setCurrentHash] = useState(() => (typeof window !== 'undefined' ? window.location.hash : ''));
  const [showAuthCard, setShowAuthCard] = useState(false);

  useEffect(() => {
    const onHashChange = () => setCurrentHash(window.location.hash);
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Check URL for Firebase Action Codes (resetPassword / verifyEmail)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const mode = params.get('mode');
      const oobCode = params.get('oobCode');

      if (mode === 'resetPassword' && oobCode) {
        setResetOobCode(oobCode);
      } else if (mode === 'verifyEmail' && oobCode && handleVerifyEmailCode) {
        handleVerifyEmailCode(oobCode).then(() => {
          setResetSuccessMsg('Email verified successfully! You can now sign in.');
          window.history.replaceState({}, document.title, window.location.pathname);
        }).catch(err => {
          setErrorMsg(err.message || 'Email verification link has expired or is invalid.');
        });
      }
    } catch (e) { }
  }, [handleVerifyEmailCode]);

  // Reset view state when logged out & save intended route
  useEffect(() => {
    if (!isAuthenticated) {
      setShowForgotModal(false);
      setErrorMsg('');
      setResetSuccessMsg('');
      if (!isLoading) {
        saveIntendedRoute();
      }
    }
  }, [isAuthenticated, isLoading]);

  // Restore intended route once user authenticates
  useEffect(() => {
    if (isAuthenticated) {
      const intended = consumeIntendedRoute();
      if (intended) {
        let clean = intended.replace(/^#\/?/, '').replace(/^\//, '');
        clean = clean.replace(/^(?:expense-tracker|pocketnook(?:-[a-z0-9_-]+)?)(?:\/|$)/i, '');
        clean = clean.replace(/^-qa(?:\/|$)/i, '');
        clean = clean.replace(/^\/+/, '').replace(/\/+$/, '');
        
        if (!clean || clean === 'home' || clean === 'overview' || clean === 'pocketnook' || clean === 'pocketnook-qa' || clean === '-qa' || clean === 'expense-tracker') {
          if (window.location.hash !== '#/overview') {
            window.location.hash = '#/overview';
          }
        } else {
          const canonical = `#/${clean}`;
          if (window.location.hash !== canonical) {
            window.location.hash = canonical;
          }
        }
      }
    }
  }, [isAuthenticated]);

  // If already authenticated, show the application
  if (isAuthenticated) {
    return children;
  }

  // Loading existing session on startup
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f4f5fa] dark:bg-[#0d0b18] flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <div className="w-10 h-10 border-3 border-[#6C47FF] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold tracking-wide">Connecting to your personal vault...</span>
        </div>
      </div>
    );
  }

  // Public standalone legal pages (Direct access for Google OAuth verification & public compliance)
  if (currentHash === '#privacy' || currentHash === '#terms') {
    return (
      <PublicLegalView
        initialTab={currentHash === '#terms' ? 'terms' : 'privacy'}
        onBack={() => {
          window.location.hash = '';
          setCurrentHash('');
        }}
      />
    );
  }

  // Public Landing Page (Homepage is NOT behind a login wall, complying with Google OAuth guidelines)
  if (!showAuthCard && !resetOobCode) {
    return (
      <PublicLanding
        onOpenAuth={(tab) => {
          setActiveAuthTab(tab);
          setShowAuthCard(true);
        }}
        onOpenLegal={(tab) => {
          window.location.hash = '#' + tab;
          setCurrentHash('#' + tab);
        }}
      />
    );
  }

  // Stepwise transition animation
  const handleFlowTransition = async (actionFn, userEmail = '') => {
    setErrorMsg('');
    setSubmitting(true);
    try {
      setOnboardingStep('auth');
      await new Promise(r => setTimeout(r, 250));

      const isRaj = userEmail.toLowerCase() === 'raaajshinde@gmail.com';
      setOnboardingStep(isRaj ? 'vault' : 'sync');

      const result = await actionFn();
      await new Promise(r => setTimeout(r, 300));

      setOnboardingStep('ready');
      await new Promise(r => setTimeout(r, 200));
      setOnboardingStep(null);
      setSubmitting(false);
      return result;
    } catch (err) {
      setErrorMsg(err.message || 'Authentication failed. Please check your credentials.');
      setOnboardingStep(null);
      setSubmitting(false);
    }
  };

  // Submit Sign In (Email + Password)
  const handleEmailSignIn = async (e) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setErrorMsg('Please enter a valid email address');
      return;
    }
    if (!password) {
      setErrorMsg('Please enter your password');
      return;
    }

    await handleFlowTransition(() => loginWithEmail(email, password), email);
  };

  // Submit Registration (Email + Password)
  const handleEmailSignUp = async (e) => {
    e.preventDefault();
    if (!regEmail || !regEmail.includes('@')) {
      setErrorMsg('Please enter a valid email address');
      return;
    }
    if (regPassword.length < 8) {
      setErrorMsg('Password must be at least 8 characters long');
      return;
    }
    if (!(/[0-9]/.test(regPassword) || /[^A-Za-z0-9]/.test(regPassword))) {
      setErrorMsg('Password must contain at least one number or special symbol');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setErrorMsg('Passwords do not match');
      return;
    }

    await handleFlowTransition(() => registerWithEmail(regEmail, regPassword, regName), regEmail);
  };

  // Submit Google Sign In
  const handleGoogleSignIn = async () => {
    await handleFlowTransition(() => loginWithGoogle());
  };

  // Submit Password Reset
  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    if (!forgotEmail || !forgotEmail.includes('@')) {
      setErrorMsg('Please enter a valid email address');
      return;
    }
    setErrorMsg('');
    try {
      setSubmitting(true);
      await resetPassword(forgotEmail);
      setResetSuccessMsg(`Password reset instructions sent to ${forgotEmail}.`);
      setSubmitting(false);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to send password reset email.');
      setSubmitting(false);
    }
  };

  // Submit New Password via Action Code
  const handleSubmitNewPassword = async (e) => {
    e.preventDefault();
    if (!newPasswordVal || newPasswordVal.length < 8) {
      setErrorMsg('Password must be at least 8 characters long');
      return;
    }
    if (newPasswordVal !== confirmNewPasswordVal) {
      setErrorMsg('Passwords do not match');
      return;
    }
    try {
      setSubmitting(true);
      setErrorMsg('');
      if (handleConfirmPasswordReset) {
        await handleConfirmPasswordReset(resetOobCode, newPasswordVal);
      }
      setResetSuccessMsg('Password updated successfully! Please sign in with your new password.');
      setResetOobCode(null);
      setNewPasswordVal('');
      setConfirmNewPasswordVal('');
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update password. Reset link may have expired.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f8f9fe] via-[#ede9fe] to-[#e0e7ff] dark:from-[#0d0b18] dark:via-[#16132a] dark:to-[#1a1435] flex items-center justify-center p-4 sm:p-6 transition-colors">
      <div className="w-full max-w-md bg-white dark:bg-[#16132A] rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200/80 dark:border-white/10 relative overflow-hidden transition-all">
        {/* Ambient background glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-purple-500/15 rounded-full blur-2xl pointer-events-none" />

        {/* Top Header: Back to Overview & Accessible Theme Toggle */}
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={() => {
              setShowAuthCard(false);
              setErrorMsg('');
            }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft size={14} />
            <span>Back to Overview</span>
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="w-8 h-8 rounded-xl flex items-center justify-center border border-slate-200/80 dark:border-white/10 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
          >
            {isDark ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>

        {/* Brand Header */}
        <div className="text-center space-y-2 mb-6">
          <div className={`relative w-14 h-14 rounded-2xl text-white flex items-center justify-center mx-auto shadow-lg ${IS_QA ? 'bg-gradient-to-tr from-amber-700 to-amber-500 shadow-amber-600/30' : 'bg-gradient-to-tr from-[#371485] to-[#763cf8] shadow-purple-600/30'}`}>
            <Wallet size={28} />
            {IS_QA && (
              <span className="absolute -bottom-1.5 -right-1.5 px-1.5 py-0.5 bg-slate-900 text-amber-300 border border-amber-300 text-[9px] font-black rounded-md tracking-wider">
                QA
              </span>
            )}
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            {APP_DISPLAY_NAME}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium max-w-xs mx-auto">
            {IS_QA ? 'QA staging environment for testing — not production' : 'Your personal financial sanctuary with multi-device synchronization and private records'}
          </p>
        </div>

        {/* Error / Success Notifications */}
        {(authError || errorMsg) && (
          <div className="mb-5 p-3.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-2xl flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300 animate-fadeIn">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <span className="font-semibold">{authError || errorMsg}</span>
          </div>
        )}
        {resetSuccessMsg && (
          <div className="mb-5 p-3.5 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex items-start gap-2.5 text-xs text-emerald-700 dark:text-emerald-300 animate-fadeIn">
            <CheckCircle2 size={16} className="flex-shrink-0 mt-0.5" />
            <span className="font-semibold">{resetSuccessMsg}</span>
          </div>
        )}

        {/* In-Flight Onboarding Animation */}
        {onboardingStep ? (
          <div className="py-8 px-4 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-purple-50 dark:bg-purple-900/40 text-[#6C47FF] dark:text-[#A78BFA] flex items-center justify-center mx-auto">
              <Loader2 size={24} className="animate-spin" />
            </div>

            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {onboardingStep === 'auth' && 'Authenticating credentials...'}
                {onboardingStep === 'vault' && 'Loading your historical records...'}
                {onboardingStep === 'sync' && 'Initializing personal isolated vault...'}
                {onboardingStep === 'ready' && 'Vault ready! Opening dashboard...'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {onboardingStep === 'vault'
                  ? 'Preserving your historical transactions, categories, and monthly budget'
                  : 'Securing your isolated session across devices'}
              </p>
            </div>
          </div>
        ) : resetOobCode ? (
          /* ========================================================
             BRANDED PASSWORD RESET VIEW (Action Code Handler)
             ======================================================== */
          <form noValidate onSubmit={handleSubmitNewPassword} className="space-y-4">
            <div className="pb-2 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Choose New Account Password
              </span>
              <button
                type="button"
                onClick={() => { setResetOobCode(null); setErrorMsg(''); }}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-white font-medium cursor-pointer"
              >
                Back to Sign In
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                New Password (minimum 8 characters)
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  placeholder="Enter new password"
                  value={newPasswordVal}
                  onChange={(e) => setNewPasswordVal(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#6C47FF]"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Confirm New Password
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  placeholder="Re-enter new password"
                  value={confirmNewPasswordVal}
                  onChange={(e) => setConfirmNewPasswordVal(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#6C47FF]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-gradient-to-r from-[#6C47FF] to-[#8B5CF6] text-white rounded-xl text-xs font-bold shadow-md shadow-purple-600/25 hover:opacity-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <span>Update Password &amp; Sign In</span>}
            </button>
          </form>
        ) : showForgotModal ? (
          /* ========================================================
             FORGOT PASSWORD MODAL
             ======================================================== */
          <form noValidate onSubmit={handleForgotSubmit} className="space-y-4">
            <div className="pb-2 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Reset Account Password
              </span>
              <button
                type="button"
                onClick={() => { setShowForgotModal(false); setErrorMsg(''); }}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-white font-medium cursor-pointer"
              >
                Back to Sign In
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Enter your account email
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#6C47FF]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-gradient-to-r from-[#6C47FF] to-[#8B5CF6] text-white rounded-xl text-xs font-bold shadow-md shadow-purple-600/25 hover:opacity-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <span>Send Reset Instructions</span>}
            </button>
          </form>
        ) : (
          /* ========================================================
             UNIVERSAL AUTHENTICATION VIEW: SIGN IN / CREATE ACCOUNT
             ======================================================== */
          <div className="space-y-5">
            {/* Tab Switcher: Sign In vs Create Account */}
            <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-white/5 rounded-2xl">
              <button
                type="button"
                onClick={() => { setActiveAuthTab('signin'); setErrorMsg(''); }}
                className={`py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${activeAuthTab === 'signin'
                  ? 'bg-white dark:bg-[#1E1B38] text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                  }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setActiveAuthTab('signup'); setErrorMsg(''); }}
                className={`py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${activeAuthTab === 'signup'
                  ? 'bg-white dark:bg-[#1E1B38] text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                  }`}
              >
                Create Account
              </button>
            </div>

            {activeAuthTab === 'signin' ? (
              /* --- SIGN IN FORM --- */
              <form onSubmit={handleEmailSignIn} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      required
                      name="email"
                      autoComplete="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#6C47FF]"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => { setShowForgotModal(true); setForgotEmail(email); }}
                      className="text-[11px] font-semibold text-[#6C47FF] dark:text-[#A78BFA] hover:underline cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      name="password"
                      autoComplete="current-password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#6C47FF]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 px-5 bg-gradient-to-r from-[#6C47FF] to-[#8B5CF6] hover:opacity-95 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-purple-600/25 active:scale-[0.99] transition-all cursor-pointer"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <span>Sign In</span>}
                  <ArrowRight size={14} />
                </button>
              </form>
            ) : (
              /* --- CREATE ACCOUNT FORM --- */
              <form onSubmit={handleEmailSignUp} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Full Name
                  </label>
                  <div className="relative">
                    <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      name="name"
                      autoComplete="name"
                      placeholder="Your Full Name"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#6C47FF]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      required
                      name="email"
                      autoComplete="email"
                      placeholder="name@example.com"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#6C47FF]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Password <span className="text-[10px] font-normal text-slate-400">(min 8 chars, with number/symbol)</span>
                  </label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      required
                      name="password"
                      autoComplete="new-password"
                      placeholder="At least 8 chars with number/symbol"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#6C47FF]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {showRegPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="password"
                      required
                      name="confirmPassword"
                      autoComplete="new-password"
                      placeholder="Re-enter password"
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#6C47FF]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 px-5 bg-gradient-to-r from-[#6C47FF] to-[#8B5CF6] hover:opacity-95 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-purple-600/25 active:scale-[0.99] transition-all cursor-pointer"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <span>Create Account</span>}
                  <ArrowRight size={14} />
                </button>
              </form>
            )}

            {/* Centered OR Divider with equal spacing on both sides */}
            <div className="flex items-center my-3.5">
              <div className="flex-grow border-t border-slate-200 dark:border-white/10" />
              <span className="flex-shrink mx-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                or
              </span>
              <div className="flex-grow border-t border-slate-200 dark:border-white/10" />
            </div>

            {/* Universal Continue with Google Button */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={submitting}
              className="w-full py-3 px-4 bg-white dark:bg-[#1E1B38] border border-slate-200 dark:border-white/15 hover:border-slate-300 dark:hover:border-white/30 text-slate-700 dark:text-slate-200 rounded-2xl font-bold text-xs flex items-center justify-center gap-2.5 shadow-xs hover:shadow-sm transition-all active:scale-[0.99] cursor-pointer"
            >
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>Continue with Google</span>
            </button>
          </div>
        )}

        {/* Consumer Trust & Privacy Footer */}
        <div className="mt-7 pt-4 border-t border-slate-100 dark:border-white/5 space-y-3">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <div className="flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-500" />
              <span>100% Private</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Database size={14} className="text-[#6C47FF] dark:text-[#A78BFA]" />
              <span>Cloud Firestore</span>
            </div>
            <div className="flex items-center gap-1.5">
              <FileSpreadsheet size={14} className="text-blue-500" />
              <span>Excel / CSV Export</span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 text-[11px] text-slate-400">
            <button
              type="button"
              onClick={() => {
                window.location.hash = '#privacy';
                setCurrentHash('#privacy');
              }}
              className="hover:text-[#6C47FF] dark:hover:text-[#A78BFA] transition-colors underline cursor-pointer"
            >
              Privacy Policy
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => {
                window.location.hash = '#terms';
                setCurrentHash('#terms');
              }}
              className="hover:text-[#6C47FF] dark:hover:text-[#A78BFA] transition-colors underline cursor-pointer"
            >
              Terms of Service
            </button>
          </div>
        </div>

        {/* Legal Modal */}
        <LegalModal
          isOpen={Boolean(legalModalType)}
          onClose={() => setLegalModalType(null)}
          initialTab={legalModalType || 'privacy'}
        />
      </div>
    </div>
  );
}
