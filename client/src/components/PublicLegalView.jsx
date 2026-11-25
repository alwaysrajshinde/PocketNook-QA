import React, { useState, useEffect } from 'react';
import { ShieldCheck, FileText, Lock, Globe, ArrowLeft, Mail, ExternalLink, Trash2, Download, CheckCircle } from 'lucide-react';

export default function PublicLegalView({ initialTab = 'privacy', onBack }) {
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const handleTabSwitch = (tab) => {
    setActiveTab(tab);
    window.location.hash = tab === 'privacy' ? '#privacy' : '#terms';
  };

  return (
    <div className="min-h-screen bg-[#f8f9fe] dark:bg-[#0d0b18] text-slate-800 dark:text-slate-200 transition-colors">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-[#16132A]/90 backdrop-blur-md border-b border-slate-200/80 dark:border-white/10 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-[#6C47FF] dark:hover:text-[#A78BFA] transition-colors px-3 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5"
            >
              <ArrowLeft size={16} />
              <span>Back to App</span>
            </button>
          )}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#371485] to-[#763cf8] text-white flex items-center justify-center font-bold text-sm shadow-sm">
              ₹
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                PocketNook
              </h1>
              <p className="text-[10px] text-slate-400">Legal Governance & Transparency</p>
            </div>
          </div>
        </div>

        {/* Tab switch */}
        <div className="flex bg-slate-100 dark:bg-white/10 p-1 rounded-xl text-xs font-semibold">
          <button
            onClick={() => handleTabSwitch('privacy')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'privacy'
                ? 'bg-[#6C47FF] text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Privacy Policy
          </button>
          <button
            onClick={() => handleTabSwitch('terms')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'terms'
                ? 'bg-[#6C47FF] text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Terms of Service
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
        {activeTab === 'privacy' ? (
          /* ========================================================
             COMPREHENSIVE GOOGLE OAUTH COMPLIANT PRIVACY POLICY
             ======================================================== */
          <article className="bg-white dark:bg-[#16132A] rounded-3xl p-6 sm:p-10 shadow-xl border border-slate-200/80 dark:border-white/10 space-y-8 leading-relaxed">
            {/* Header */}
            <div className="border-b border-slate-100 dark:border-white/10 pb-6 space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50 dark:bg-purple-900/30 text-[#6C47FF] dark:text-[#A78BFA] text-xs font-bold">
                <ShieldCheck size={14} />
                <span>Data Privacy &amp; User Protection Charter</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                Privacy Policy
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Effective Date: November 21, 2026 · Application: <strong>PocketNook</strong> · Developer: <strong>Raj Shinde</strong>
              </p>
            </div>

            {/* Section 1: Overview */}
            <section className="space-y-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Globe size={18} className="text-[#6C47FF]" />
                1. Overview &amp; Data Controller
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                <strong>PocketNook</strong> (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) is a personal finance management tool created and maintained by <strong>Raj Shinde</strong> (contact: <a href="mailto:raaajshinde@gmail.com" className="text-[#6C47FF] hover:underline font-semibold">raaajshinde@gmail.com</a>). This Privacy Policy explains how our web application collects, uses, protects, and discloses personal information when you access our service hosted at <a href="https://alwaysrajshinde.github.io/PocketNook/" className="text-[#6C47FF] hover:underline">https://alwaysrajshinde.github.io/PocketNook/</a>.
              </p>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                We believe that personal financial records belong strictly to the user. We adhere to privacy-by-design principles, collecting only the absolute minimum data required to deliver expense accounting and monthly budget calculations.
              </p>
            </section>

            {/* Section 2: Data We Collect */}
            <section className="space-y-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Lock size={18} className="text-[#6C47FF]" />
                2. Information We Collect
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                We collect and store only information that you explicitly provide when using the service:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/5 space-y-1.5">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">Account &amp; Identity Data</h4>
                  <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1 list-disc pl-4">
                    <li>Email address (for authentication &amp; isolation)</li>
                    <li>Display name (optional)</li>
                    <li>Profile picture URL (from Google Sign-In)</li>
                    <li>Firebase User ID (UUID)</li>
                  </ul>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/5 space-y-1.5">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">Financial Ledger Data</h4>
                  <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1 list-disc pl-4">
                    <li>Transaction amount, date, and description</li>
                    <li>Expense category (e.g. Food, Travel, Utilities)</li>
                    <li>Payment method (e.g. UPI, Cash, Card)</li>
                    <li>Configured monthly budget limit</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Section 3: Google User Data Policy & Limited Use Disclosure */}
            <section className="space-y-3 bg-purple-50/50 dark:bg-purple-950/20 p-5 rounded-2xl border border-purple-100 dark:border-purple-900/30">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldCheck size={18} className="text-[#6C47FF]" />
                3. Google API Services &amp; Limited Use Disclosure
              </h3>
              <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                When you choose to sign in with Google, PocketNook requests only standard, non-sensitive identity scopes:
              </p>
              <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1 list-disc pl-5">
                <li><code>openid</code>: To verify authentication state.</li>
                <li><code>.../auth/userinfo.email</code>: To associate your transactions with your private account.</li>
                <li><code>.../auth/userinfo.profile</code>: To personalize your dashboard display name and profile picture.</li>
              </ul>
              <div className="mt-3 p-3.5 bg-white dark:bg-[#16132A] rounded-xl border border-purple-200 dark:border-purple-800/50 text-xs text-slate-800 dark:text-slate-200">
                <strong>Google Limited Use Compliance Statement:</strong><br />
                PocketNook&apos;s use and transfer to any other app of information received from Google APIs will adhere to the{' '}
                <a
                  href="https://developers.google.com/terms/api-services-user-data-policy"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#6C47FF] dark:text-[#A78BFA] underline font-semibold inline-flex items-center gap-0.5"
                >
                  Google API Services User Data Policy
                  <ExternalLink size={11} className="inline ml-0.5" />
                </a>, including the Limited Use requirements for Google Sign-In profile scopes. Optional online AI chat uses the Gemini API free tier via an isolated proxy where Google may use submitted prompts to improve its products under Gemini free-tier terms; sensitive account/card/phone numbers are masked beforehand and Summary Sharing is OFF by default.
              </div>
            </section>

            {/* Section 4: Data Sharing & Non-Sale Commitment */}
            <section className="space-y-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <CheckCircle size={18} className="text-emerald-500" />
                4. Zero Data Selling &amp; Third-Party Sharing Commitment
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                <strong>We do not sell, rent, monetize, or trade your personal or financial data to third parties, data brokers, advertising networks, or financial marketing entities.</strong>
              </p>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                Your data is shared exclusively with our cloud infrastructure provider (Google Cloud Firestore / Firebase) solely to host, authenticate, and encrypt your ledger records.
              </p>
            </section>

            {/* Section 5: Security & Encryption */}
            <section className="space-y-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Lock size={18} className="text-[#6C47FF]" />
                5. Storage, Security &amp; Encryption
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                All data transmitted between your browser and our servers is protected using industry-standard Transport Layer Security (TLS 1.3 / HTTPS). Data at rest is stored in Google Cloud Firestore with granular Firebase Security Rules ensuring that only your authenticated User ID can read or write your financial documents.
              </p>
            </section>

            {/* Section 6: Data Retention, Export & Erasure (Forget Me) */}
            <section className="space-y-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Trash2 size={18} className="text-rose-500" />
                6. Data Retention, Portability &amp; Right to Erasure
              </h3>
              <div className="space-y-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                <p>You have full sovereignty over your data at all times:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="p-3.5 rounded-xl border border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-white/[0.02]">
                    <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white text-xs mb-1">
                      <Download size={14} className="text-blue-500" />
                      Right to Export
                    </div>
                    <p className="text-xs text-slate-500">
                      Download your entire ledger anytime in Microsoft Excel (.xlsx), CSV, or structured JSON directly from the Settings page.
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl border border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-white/[0.02]">
                    <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white text-xs mb-1">
                      <Trash2 size={14} className="text-rose-500" />
                      Right to Deletion (Forget Me)
                    </div>
                    <p className="text-xs text-slate-500">
                      Delete your account and all associated transactions instantly from Settings, or email <a href="mailto:raaajshinde@gmail.com" className="text-[#6C47FF]">raaajshinde@gmail.com</a>. All records are purged within 48 hours.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Section 7: Contact Info */}
            <section className="border-t border-slate-100 dark:border-white/10 pt-6 space-y-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Mail size={18} className="text-[#6C47FF]" />
                7. Contact Information
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                If you have questions, feedback, or data privacy requests regarding PocketNook, please contact the developer:
              </p>
              <div className="text-xs text-slate-700 dark:text-slate-300 space-y-1 pt-1 font-mono">
                <p>Developer: Raj Shinde</p>
                <p>Email: <a href="mailto:raaajshinde@gmail.com" className="text-[#6C47FF] hover:underline font-bold">raaajshinde@gmail.com</a></p>
                <p>Application Website: <a href="https://alwaysrajshinde.github.io/PocketNook/" className="text-[#6C47FF] hover:underline">https://alwaysrajshinde.github.io/PocketNook/</a></p>
              </div>
            </section>
          </article>
        ) : (
          /* ========================================================
             TERMS OF SERVICE
             ======================================================== */
          <article className="bg-white dark:bg-[#16132A] rounded-3xl p-6 sm:p-10 shadow-xl border border-slate-200/80 dark:border-white/10 space-y-8 leading-relaxed">
            <div className="border-b border-slate-100 dark:border-white/10 pb-6 space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-bold">
                <FileText size={14} />
                <span>Service Agreement</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                Terms of Service
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Effective Date: November 21, 2026 · Application: <strong>PocketNook</strong>
              </p>
            </div>

            <section className="space-y-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">1. Acceptance of Terms</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                By accessing or using the <strong>PocketNook</strong> application hosted at <a href="https://alwaysrajshinde.github.io/PocketNook/" className="text-[#6C47FF] hover:underline">https://alwaysrajshinde.github.io/PocketNook/</a>, you agree to comply with and be bound by these Terms of Service. If you do not agree, you should not access or use this software.
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">2. Permitted Personal Use</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                The platform is provided for personal, non-commercial expense logging and monthly budget monitoring. You agree not to abuse the service, attempt unauthorized access to other users&apos; databases, or use automated scrapers against the application.
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">3. Informational Utility &amp; Financial Disclaimer</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                PocketNook is a digital bookkeeping software tool, not a certified financial planner, banking institution, or tax advisor. Calculations, category charts, and monthly burn-rate pacing are provided solely for informational and personal budgeting convenience.
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">4. Availability &amp; Disclaimer of Warranties</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                The application is provided &quot;AS IS&quot; and &quot;AS AVAILABLE&quot;. While we implement redundant offline caching and automated cloud sync, we recommend users export regular local backup copies (Excel / JSON) via the Settings section.
              </p>
            </section>

            <section className="border-t border-slate-100 dark:border-white/10 pt-6 text-xs text-slate-500">
              For support inquiries, contact Raj Shinde at <a href="mailto:raaajshinde@gmail.com" className="text-[#6C47FF] font-semibold">raaajshinde@gmail.com</a>.
            </section>
          </article>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-white/10 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
        <p>© 2026 PocketNook · Developed by Raj Shinde · All Rights Reserved</p>
      </footer>
    </div>
  );
}
