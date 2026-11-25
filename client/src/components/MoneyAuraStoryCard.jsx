import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Sparkles, Share2, ChevronLeft, ChevronRight, Coffee, Utensils,
  Car, TrendingUp, Compass, Feather, Award, Sun, Moon, Shield, Zap
} from 'lucide-react';
import { getTransactions } from '../services/api';
import { useToast } from '../context/ToastContext';

const SLIDES = [
  { id: 'aura', label: 'Aura' },
  { id: 'rhythm', label: 'Rhythm' },
  { id: 'badges', label: 'Badges' }
];

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function deriveMoneyAura(monthTxs = [], dashboardData = null) {
  const expenses = (monthTxs || []).filter((t) => !t.is_refund && Number(t.amount || 0) > 0);
  const topCats = Array.isArray(dashboardData?.top_categories) ? dashboardData.top_categories : [];
  const budget = Number(dashboardData?.budget || 0);
  const totalSpent = Number(dashboardData?.total_spent || 0);

  if (expenses.length === 0 && topCats.length === 0) {
    return {
      persona: 'Fresh Canvas',
      tagline: 'Quiet beginnings carry the clearest focus—your rhythm takes shape as you live your week.',
      moodPills: ['Open Horizon', 'Zero Clutter', 'Calm Start'],
      orbA: '#7C3AED',
      orbB: '#10B981',
      orbC: '#38BDF8',
      PersonaIcon: Feather,
      rhythmMode: 'Balanced Every Day',
      paymentVibe: 'Digital Ready',
      weekdayLevels: WEEKDAYS.map((day) => ({ day, level: 'calm' })),
      badges: [
        {
          id: 'clean_start',
          title: 'Blank Slate Calm',
          subtitle: 'Clear mind, uncluttered ledger',
          detail: 'You are starting cleanly with space for mindful everyday choices.',
          Icon: Feather,
          glow: 'from-violet-500/30 to-emerald-500/20 text-violet-200 border-violet-400/30'
        },
        {
          id: 'ready_flow',
          title: 'Silent Observer',
          subtitle: 'Zero noisy distractions',
          detail: 'Your aura builds automatically from real habits without extra tapping.',
          Icon: Sparkles,
          glow: 'from-sky-500/25 to-indigo-500/20 text-sky-200 border-sky-400/30'
        },
        {
          id: 'steady_anchor',
          title: 'Future Anchored',
          subtitle: 'Intentional daily pacing',
          detail: 'Every thoughtful choice shapes tomorrow’s visual aura.',
          Icon: Shield,
          glow: 'from-emerald-500/25 to-teal-500/20 text-emerald-200 border-emerald-400/30'
        }
      ]
    };
  }

  // Analyze dominant category themes & habits qualitatively
  const allText = [
    ...topCats.slice(0, 4).map((c) => c.name || ''),
    ...expenses.slice(0, 40).map((t) => `${t.category || ''} ${t.description || ''}`)
  ]
    .join(' ')
    .toLowerCase();

  const weekdayTotals = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 };
  let upiHits = 0;
  let cardHits = 0;
  let cashHits = 0;
  let describedCount = 0;
  const distinctCats = new Set();
  const merchantCounts = {};

  for (const tx of expenses) {
    const amt = Number(tx.amount || 0);
    if (tx.date) {
      const dt = new Date(`${String(tx.date).slice(0, 10)}T00:00:00`);
      if (!isNaN(dt.getTime())) {
        const idx = (dt.getDay() + 6) % 7;
        const wk = WEEKDAYS[idx];
        weekdayTotals[wk] += amt;
      }
    }
    const mode = String(tx.payment_mode || '').toLowerCase();
    if (mode.includes('upi')) upiHits += 1;
    else if (mode.includes('card')) cardHits += 1;
    else if (mode.includes('cash')) cashHits += 1;

    if (String(tx.description || '').trim()) describedCount += 1;
    if (tx.category) distinctCats.add(tx.category);
    const label = String(tx.description || tx.category || '').trim().toLowerCase();
    if (label) merchantCounts[label] = (merchantCounts[label] || 0) + 1;
  }

  const maxDayVal = Math.max(1, ...Object.values(weekdayTotals));
  const weekdayLevels = WEEKDAYS.map((day) => {
    const ratio = weekdayTotals[day] / maxDayVal;
    let level = 'calm';
    if (ratio >= 0.72) level = 'peak';
    else if (ratio >= 0.42) level = 'vibrant';
    else if (ratio > 0.08) level = 'gentle';
    return { day, level };
  });

  const weekendTotal = weekdayTotals.Sat + weekdayTotals.Sun;
  const weekdayTotal = weekdayTotals.Mon + weekdayTotals.Tue + weekdayTotals.Wed + weekdayTotals.Thu + weekdayTotals.Fri;
  const rhythmMode =
    weekendTotal > weekdayTotal * 0.65
      ? 'Lively Weekend Pulse'
      : weekdayTotal > weekendTotal * 3
        ? 'Focused Weekday Groove'
        : 'Smooth All-Week Flow';

  const paymentVibe =
    upiHits >= cardHits && upiHits >= cashHits
      ? 'Pure UPI Flow'
      : cardHits > upiHits
        ? 'Card & Tap Savvy'
        : 'Grounded Cash & Digital';

  // Choose Aura Persona + custom multi-orb gradient palette
  const topCatName = (topCats[0]?.name || expenses[0]?.category || '').toLowerCase();
  const hasChaiVibe = /\b(tea|chai|coffee|nashta|milk|cafe)\b/.test(allText);
  const hasFutureVibe = /\b(mutual|fund|sip|invest|rent|emi|insurance|saving)\b/.test(topCatName);
  const hasTransitVibe = /\b(auto|metro|uber|ola|petrol|fuel|travel|cab)\b/.test(topCatName);
  const hasFoodVibe = /\b(food|dining|biryani|lunch|dinner|chicken|fish|fruits|vegitables|grocery|groceries|zomato|swiggy)\b/.test(topCatName);

  let persona = 'Mindful Minimalist';
  let tagline = 'Steady intuition and calm control—your money follows what actually matters to you.';
  let moodPills = ['Steady Flow', 'Balanced Mood', paymentVibe];
  let orbA = '#10B981';
  let orbB = '#6C47FF';
  let orbC = '#06B6D4';
  let PersonaIcon = Sparkles;

  if (hasFutureVibe) {
    persona = 'Future Builder';
    tagline = 'Priorities come first in your aura—quiet long-term moves anchor the rest of your month.';
    moodPills = ['Long-Term Mind', 'Anchored Priorities', paymentVibe];
    orbA = '#10B981';
    orbB = '#7C3AED';
    orbC = '#F59E0B';
    PersonaIcon = TrendingUp;
  } else if (hasChaiVibe && topCatName.includes('tea')) {
    persona = 'Morning Chai Ritualist';
    tagline = 'Small daily pauses give your week warmth—familiar rituals keep your rhythm grounded.';
    moodPills = ['Daily Warmth', 'Ritual Keeper', paymentVibe];
    orbA = '#F59E0B';
    orbB = '#6C47FF';
    orbC = '#EC4899';
    PersonaIcon = Coffee;
  } else if (hasTransitVibe) {
    persona = 'City Navigator';
    tagline = 'Always in motion across neighborhoods—your aura hums with kinetic weekday energy.';
    moodPills = ['On the Move', 'Kinetic Energy', paymentVibe];
    orbA = '#0EA5E9';
    orbB = '#6C47FF';
    orbC = '#14B8A6';
    PersonaIcon = Car;
  } else if (hasFoodVibe) {
    persona = 'Culinary Connoisseur';
    tagline = 'Fresh flavors and everyday meals shape your glow—life is lived around good food.';
    moodPills = ['Flavor-Driven', 'Everyday Comfort', paymentVibe];
    orbA = '#8B5CF6';
    orbB = '#EC4899';
    orbC = '#F59E0B';
    PersonaIcon = Utensils;
  } else if (weekendTotal > weekdayTotal * 0.65) {
    persona = 'Weekend Explorer';
    tagline = 'Calm focus from Monday to Friday, opening into vibrant experiences once the weekend hits.';
    moodPills = ['Weekend Spark', 'Steady Weekdays', paymentVibe];
    orbA = '#F43F5E';
    orbB = '#7C3AED';
    orbC = '#FB923C';
    PersonaIcon = Compass;
  }

  // Unlocked qualitative badges (strictly zero numbers)
  const badges = [];
  if (upiHits >= Math.max(1, expenses.length * 0.4)) {
    badges.push({
      id: 'upi_native',
      title: 'Instant Tap Native',
      subtitle: 'Frictionless digital flow',
      detail: 'Most of your everyday rhythm moves effortlessly through instant UPI taps.',
      Icon: Zap,
      glow: 'from-violet-500/30 to-fuchsia-500/20 text-violet-100 border-violet-400/30'
    });
  }
  if (describedCount >= Math.max(1, expenses.length * 0.5)) {
    badges.push({
      id: 'clear_story',
      title: 'Memory Keeper',
      subtitle: 'Crystal-clear everyday notes',
      detail: 'Your entries carry thoughtful labels instead of cryptic blanks, keeping clarity high.',
      Icon: Feather,
      glow: 'from-sky-500/30 to-cyan-500/20 text-sky-100 border-sky-400/30'
    });
  }
  if (budget > 0 && totalSpent <= budget) {
    badges.push({
      id: 'calm_compass',
      title: 'Balanced Compass',
      subtitle: 'Breathing room intact',
      detail: 'Your current rhythm leaves comfortable space ahead of the month-end horizon.',
      Icon: Shield,
      glow: 'from-emerald-500/30 to-teal-500/20 text-emerald-100 border-emerald-400/30'
    });
  } else if (Object.values(merchantCounts).some((v) => v >= 2)) {
    badges.push({
      id: 'ritual_keeper',
      title: 'Signature Ritual',
      subtitle: 'Loyal to your favorites',
      detail: 'You return naturally to the familiar spots and comforts that anchor your week.',
      Icon: Coffee,
      glow: 'from-amber-500/30 to-orange-500/20 text-amber-100 border-amber-400/30'
    });
  }
  if (distinctCats.size >= 3 && badges.length < 3) {
    badges.push({
      id: 'colorful_palette',
      title: 'Vibrant Palette',
      subtitle: 'Rich multi-interest rhythm',
      detail: 'Your lifestyle spans varied categories rather than getting stuck in a single groove.',
      Icon: Award,
      glow: 'from-pink-500/30 to-rose-500/20 text-pink-100 border-pink-400/30'
    });
  }
  while (badges.length < 3) {
    badges.push({
      id: `vibe_extra_${badges.length}`,
      title: badges.length === 1 ? 'Grounded Pace' : 'Mindful Flow',
      subtitle: 'Quiet awareness in action',
      detail: 'Staying present with your spending rhythm keeps surprises away cleanly.',
      Icon: Sparkles,
      glow: 'from-indigo-500/30 to-purple-500/20 text-indigo-100 border-indigo-400/30'
    });
  }

  return {
    persona,
    tagline,
    moodPills,
    orbA,
    orbB,
    orbC,
    PersonaIcon,
    rhythmMode,
    paymentVibe,
    weekdayLevels,
    badges: badges.slice(0, 3)
  };
}

export default function MoneyAuraStoryCard({
  dashboardData,
  selectedMonth
}) {
  const { showToast } = useToast();
  const activeMonth = selectedMonth || dashboardData?.month || new Date().toISOString().slice(0, 7);
  const [monthTxs, setMonthTxs] = useState(dashboardData?.recent_transactions || []);
  const [slideIdx, setSlideIdx] = useState(0);
  const [activeBadgeId, setActiveBadgeId] = useState(null);
  const touchStartX = useRef(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await getTransactions({ month: activeMonth, limit: 1000 });
        if (!active) return;
        if (res && Array.isArray(res.transactions) && res.transactions.length > 0) {
          setMonthTxs(res.transactions);
        } else if (Array.isArray(dashboardData?.recent_transactions)) {
          setMonthTxs(dashboardData.recent_transactions);
        }
      } catch {
        if (active && Array.isArray(dashboardData?.recent_transactions)) {
          setMonthTxs(dashboardData.recent_transactions);
        }
      }
    })();
    return () => { active = false; };
  }, [activeMonth, dashboardData?.total_spent, dashboardData?.recent_transactions]);

  const aura = useMemo(() => deriveMoneyAura(monthTxs, dashboardData), [monthTxs, dashboardData]);
  const PersonaIcon = aura.PersonaIcon;
  const activeSlide = SLIDES[slideIdx]?.id || 'aura';

  const handlePrev = () => setSlideIdx((i) => (i - 1 + SLIDES.length) % SLIDES.length);
  const handleNext = () => setSlideIdx((i) => (i + 1) % SLIDES.length);

  const onTouchStart = (e) => {
    touchStartX.current = e.touches?.[0]?.clientX ?? null;
  };

  const onTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const endX = e.changedTouches?.[0]?.clientX ?? touchStartX.current;
    const diff = touchStartX.current - endX;
    if (diff > 40) handleNext();
    else if (diff < -40) handlePrev();
    touchStartX.current = null;
  };

  const handleShareAura = async () => {
    const shareText = `My Money Aura: ${aura.persona} — ${aura.tagline} (${aura.rhythmMode})`;
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: 'My PocketNook Aura', text: shareText });
        return;
      }
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareText);
        showToast('Copied your Money Aura vibe!', 'success');
        return;
      }
    } catch {}
    showToast(`Aura: ${aura.persona}`, 'info');
  };

  const levelHeightClass = {
    calm: 'h-4 opacity-45',
    gentle: 'h-8 opacity-70',
    vibrant: 'h-12 opacity-90',
    peak: 'h-16 opacity-100 shadow-[0_0_14px_rgba(255,255,255,0.45)]'
  };

  return (
    <section
      data-testid="money-aura-card"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      className="relative overflow-hidden rounded-3xl bg-[#110C24] text-white p-4 sm:p-5 border border-white/10 shadow-xl shadow-purple-950/25 select-none"
    >
      {/* Living Animated Gradient Aurora Orbs */}
      <div
        aria-hidden="true"
        className="aura-orb-primary pointer-events-none absolute -top-16 -left-14 w-56 h-56 rounded-full blur-3xl opacity-55"
        style={{ background: `radial-gradient(circle, ${aura.orbA}, transparent 70%)` }}
      />
      <div
        aria-hidden="true"
        className="aura-orb-secondary pointer-events-none absolute -bottom-20 -right-10 w-64 h-64 rounded-full blur-3xl opacity-50"
        style={{ background: `radial-gradient(circle, ${aura.orbB}, transparent 70%)` }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 w-44 h-44 rounded-full blur-3xl opacity-25"
        style={{ background: `radial-gradient(circle, ${aura.orbC}, transparent 70%)` }}
      />

      {/* Story Content Layer */}
      <div className="relative z-10 space-y-4">
        {/* Top Story Progress Bars & Header */}
        <div className="space-y-2.5">
          <div className="grid grid-cols-3 gap-1.5">
            {SLIDES.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSlideIdx(idx)}
                data-testid={`aura-progress-${s.id}`}
                aria-label={`View ${s.label} story`}
                className="group py-1 cursor-pointer focus:outline-none"
              >
                <div className="h-1 rounded-full bg-white/20 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      idx === slideIdx
                        ? 'w-full bg-white'
                        : idx < slideIdx
                          ? 'w-full bg-white/60'
                          : 'w-0 bg-white/0'
                    }`}
                  />
                </div>
                <span
                  className={`block text-[10px] font-bold tracking-wider uppercase mt-1 transition-colors ${
                    idx === slideIdx ? 'text-white' : 'text-white/45 group-hover:text-white/75'
                  }`}
                >
                  {s.label}
                </span>
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-[10.5px] font-bold tracking-wide text-purple-100">
              <Sparkles size={11} className="text-amber-300" />
              <span>Live Money Aura</span>
            </span>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrev}
                data-testid="aura-prev-btn"
                aria-label="Previous story card"
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                type="button"
                onClick={handleNext}
                data-testid="aura-next-btn"
                aria-label="Next story card"
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* SLIDE 1: YOUR LIVING MONEY AURA */}
        {activeSlide === 'aura' && (
          <div data-testid="aura-slide-aura" className="space-y-3.5 animate-fade-in">
            <div className="flex items-start gap-3">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 border border-white/20 backdrop-blur-md shadow-lg"
                style={{
                  background: `linear-gradient(135deg, ${aura.orbA}88, ${aura.orbB}88)`
                }}
              >
                <PersonaIcon size={22} className="text-white" />
              </div>
              <div className="min-w-0">
                <span className="text-[10.5px] font-semibold uppercase tracking-widest text-white/60 block">
                  Current Persona
                </span>
                <h3 className="text-lg sm:text-xl font-black tracking-tight text-white leading-tight">
                  {aura.persona}
                </h3>
              </div>
            </div>

            <p className="text-xs sm:text-[13px] text-white/85 leading-relaxed">
              {aura.tagline}
            </p>

            <div className="flex items-center justify-between gap-2 flex-wrap pt-0.5">
              <div className="flex flex-wrap gap-1.5">
                {aura.moodPills.map((pill) => (
                  <span
                    key={pill}
                    className="px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-[10.5px] font-semibold text-white/90 backdrop-blur-sm"
                  >
                    {pill}
                  </span>
                ))}
              </div>

              <button
                type="button"
                onClick={handleShareAura}
                data-testid="aura-share-btn"
                className="px-3 py-1.5 rounded-full bg-white text-[#110C24] hover:bg-purple-50 text-[11px] font-extrabold inline-flex items-center gap-1.5 shadow-md cursor-pointer active:scale-95 transition-all"
              >
                <Share2 size={12} />
                <span>Share Vibe</span>
              </button>
            </div>
          </div>
        )}

        {/* SLIDE 2: WEEKLY & DAILY RHYTHM GLOW WAVE */}
        {activeSlide === 'rhythm' && (
          <div data-testid="aura-slide-rhythm" className="space-y-3.5 animate-fade-in">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <span className="text-[10.5px] font-semibold uppercase tracking-widest text-white/60 block">
                  Weekly Energy Wave
                </span>
                <h3 className="text-base sm:text-lg font-black text-white">
                  {aura.rhythmMode}
                </h3>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-[10.5px] font-semibold text-white/85">
                <Sun size={11} className="text-amber-300" />
                <span>to</span>
                <Moon size={11} className="text-indigo-200" />
                <span>{aura.paymentVibe}</span>
              </div>
            </div>

            {/* Glowing Weekly Light Pillars (Zero digits, visual luminosity only) */}
            <div className="grid grid-cols-7 gap-2 items-end h-24 px-2 py-2.5 rounded-2xl bg-white/[0.06] border border-white/10 backdrop-blur-md">
              {aura.weekdayLevels.map((item) => (
                <div key={item.day} className="flex flex-col items-center justify-end gap-1.5 h-full">
                  <div className="w-full flex items-end justify-center flex-1">
                    <div
                      className={`w-3 sm:w-4 rounded-full transition-all duration-700 ${levelHeightClass[item.level]}`}
                      style={{
                        background: `linear-gradient(to top, ${aura.orbB}, ${aura.orbA}, #FFFFFF)`
                      }}
                    />
                  </div>
                  <span className="text-[10px] font-bold text-white/75">{item.day}</span>
                </div>
              ))}
            </div>

            <p className="text-[11px] text-white/70">
              Taller glow marks your liveliest days—tap Badges or swipe to see what you unlocked.
            </p>
          </div>
        )}

        {/* SLIDE 3: UNLOCKED HABIT BADGES */}
        {activeSlide === 'badges' && (
          <div data-testid="aura-slide-badges" className="space-y-3 animate-fade-in">
            <div>
              <span className="text-[10.5px] font-semibold uppercase tracking-widest text-white/60 block">
                Unlocked Habit Aura
              </span>
              <h3 className="text-base sm:text-lg font-black text-white">
                Signatures of Your Flow
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {aura.badges.map((b) => {
                const Icon = b.Icon;
                const expanded = activeBadgeId === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setActiveBadgeId(expanded ? null : b.id)}
                    className={`p-3 rounded-2xl bg-gradient-to-br ${b.glow} border text-left space-y-1 transition-all cursor-pointer hover:brightness-110 active:scale-[0.98]`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon size={15} className="flex-shrink-0" />
                      <span className="text-xs font-extrabold text-white truncate">
                        {b.title}
                      </span>
                    </div>
                    <span className="text-[10.5px] text-white/75 block leading-snug">
                      {expanded ? b.detail : b.subtitle}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
