import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Activity, Sparkles, Flame, Wind, ArrowUpRight } from 'lucide-react';
import { getTransactions } from '../services/api';

function getMonthLength(monthKey) {
  const m = String(monthKey || '').match(/^(\d{4})-(\d{2})$/);
  if (!m) return 30;
  return new Date(Number(m[1]), Number(m[2]), 0).getDate();
}

function formatDayPhase(isoDate) {
  try {
    const dt = new Date(`${isoDate}T00:00:00`);
    if (isNaN(dt.getTime())) return 'Day Flow';
    const dayNum = dt.getDate();
    const weekday = dt.toLocaleDateString('en-IN', { weekday: 'short' });
    const monthName = dt.toLocaleDateString('en-IN', { month: 'short' });
    const phase = dayNum <= 10 ? 'Early' : dayNum <= 20 ? 'Mid' : 'Late';
    return `${weekday} · ${phase} ${monthName}`;
  } catch {
    return 'Day Flow';
  }
}

/**
 * Smooth Catmull-Rom-inspired cubic bezier spline clamped cleanly inside plot bounds
 */
function buildSmoothWavePath(points, minY, maxY) {
  if (!points || points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  const clampY = (val) => Math.max(minY, Math.min(maxY, val));
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const pPrev = points[Math.max(0, i - 1)];
    const p0 = points[i];
    const p1 = points[i + 1];
    const pNext = points[Math.min(points.length - 1, i + 2)];
    const c1x = p0.x + (p1.x - pPrev.x) / 6;
    const c1y = clampY(p0.y + (p1.y - pPrev.y) / 6);
    const c2x = p1.x - (pNext.x - p0.x) / 6;
    const c2y = clampY(p1.y - (pNext.y - p0.y) / 6);
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
  }
  return d;
}

export default function SpendVisualGraphCard({
  dashboardData,
  selectedMonth
}) {
  const activeMonth = selectedMonth || dashboardData?.month || new Date().toISOString().slice(0, 7);
  const [monthTxs, setMonthTxs] = useState(dashboardData?.recent_transactions || []);
  const [activeWaveIdx, setActiveWaveIdx] = useState(null);
  const waveSvgRef = useRef(null);
  const svgRectRef = useRef(null);

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

  // Reset user scrub selection when switching months
  useEffect(() => {
    setActiveWaveIdx(null);
  }, [activeMonth]);

  const waveData = useMemo(() => {
    const daysLen = getMonthLength(activeMonth);
    const dailyMap = {};

    for (const tx of monthTxs || []) {
      const amt = Number(tx.amount || 0);
      if (tx.is_refund || amt <= 0) continue;
      const iso = String(tx.date || '').slice(0, 10);
      if (!iso.startsWith(activeMonth)) continue;
      const dNum = parseInt(iso.slice(8, 10), 10);
      if (!dailyMap[dNum]) dailyMap[dNum] = { total: 0, iso, items: [], categories: [] };
      dailyMap[dNum].total += amt;
      const label = (tx.description || tx.category || '').trim();
      if (label && !dailyMap[dNum].items.includes(label) && dailyMap[dNum].items.length < 3) {
        dailyMap[dNum].items.push(label);
      }
      if (tx.category && !dailyMap[dNum].categories.includes(tx.category) && dailyMap[dNum].categories.length < 2) {
        dailyMap[dNum].categories.push(tx.category);
      }
    }

    const activeDayNums = Object.keys(dailyMap).map(Number);
    const latestActiveDay = activeDayNums.length > 0 ? Math.max(...activeDayNums) : Math.min(14, daysLen);
    const count = Math.max(7, latestActiveDay);

    const budget = Number(dashboardData?.budget || 0);
    const totals = Object.values(dailyMap).map((d) => d.total);
    const avgDaily = totals.length > 0 ? totals.reduce((a, b) => a + b, 0) / totals.length : 300;
    const calmRef = budget > 0 ? Math.max(120, budget / daysLen) : Math.max(150, avgDaily);
    const peakMax = Math.max(calmRef * 1.9, ...(totals.length ? totals : [calmRef * 1.5]));

    const W = 320;
    const H = 136;
    const padX = 12;
    const padTop = 16;
    const padBottom = 16;
    const plotH = H - padTop - padBottom;

    const points = [];
    for (let d = 1; d <= count; d++) {
      const iso = `${activeMonth}-${String(d).padStart(2, '0')}`;
      const info = dailyMap[d] || { total: 0, iso, items: [], categories: [] };
      const ratio = Math.min(1, info.total / peakMax);
      const x = padX + ((d - 1) / Math.max(1, count - 1)) * (W - padX * 2);
      const y = padTop + plotH - ratio * plotH;

      let zone = 'rest';
      if (info.total > calmRef * 1.35) zone = 'peak';
      else if (info.total > calmRef) zone = 'warm';
      else if (info.total > 0) zone = 'calm';

      const color =
        zone === 'peak'
          ? '#FB7185'
          : zone === 'warm'
            ? '#F59E0B'
            : zone === 'calm'
              ? '#A78BFA'
              : '#34D399';

      points.push({
        day: d,
        iso,
        x,
        y,
        spent: info.total,
        items: info.items,
        categories: info.categories,
        zone,
        color,
        isCalm: info.total <= calmRef,
        phaseLabel: formatDayPhase(iso)
      });
    }

    const horizonY = padTop + plotH - Math.min(0.85, calmRef / peakMax) * plotH;
    const linePath = buildSmoothWavePath(points, padTop, H - padBottom);
    const areaPath = points.length > 0
      ? `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${H - padBottom} L ${points[0].x.toFixed(1)} ${H - padBottom} Z`
      : '';

    const peakIdx = points.reduce((best, p, idx) => (p.spent >= points[best].spent ? idx : best), 0);
    const latestIdx = points.reduce((best, p, idx) => (p.spent > 0 ? idx : best), points.length - 1);

    const calmDays = points.filter((p) => p.isCalm).length;
    const flowVerdict =
      totals.length === 0
        ? 'Calm horizon ready for your rhythm'
        : calmDays >= points.length * 0.7
          ? 'Smooth & steady pulse across the cycle'
          : 'Energetic peaks blended with quiet pauses';

    return {
      W,
      H,
      padX,
      padBottom,
      horizonY,
      points,
      linePath,
      areaPath,
      peakIdx,
      latestIdx,
      flowVerdict
    };
  }, [monthTxs, activeMonth, dashboardData?.budget]);

  const spotIdx = activeWaveIdx !== null && waveData.points[activeWaveIdx]
    ? activeWaveIdx
    : waveData.latestIdx;
  const activePoint = waveData.points[spotIdx] || null;

  const updateIndexFromClientX = useCallback((clientX) => {
    const rect = svgRectRef.current || waveSvgRef.current?.getBoundingClientRect();
    if (!rect || waveData.points.length === 0) return;
    svgRectRef.current = rect;
    const rel = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)));
    const idx = Math.round(rel * (waveData.points.length - 1));
    setActiveWaveIdx(idx);
  }, [waveData.points.length]);

  const handlePointerDown = (e) => {
    svgRectRef.current = waveSvgRef.current?.getBoundingClientRect() || null;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    updateIndexFromClientX(e.clientX);
  };

  const handlePointerMove = (e) => {
    if (e.buttons === 1 || e.pointerType === 'touch') {
      updateIndexFromClientX(e.clientX);
    }
  };

  const handlePointerUp = (e) => {
    svgRectRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  };

  const zoneMeta = {
    rest: { badge: 'Quiet Pause', cls: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30', icon: Wind },
    calm: { badge: 'Calm Flow', cls: 'bg-violet-500/25 text-violet-200 border-violet-400/30', icon: Wind },
    warm: { badge: 'Active Day', cls: 'bg-amber-500/20 text-amber-200 border-amber-400/30', icon: Activity },
    peak: { badge: 'Peak Wave', cls: 'bg-rose-500/25 text-rose-200 border-rose-400/35', icon: Flame }
  }[activePoint?.zone || 'calm'];
  const ZoneIcon = zoneMeta.icon;

  return (
    <section
      data-testid="spend-graph-card"
      className="relative overflow-hidden rounded-3xl bg-[#110C24] text-white p-4 sm:p-5 border border-white/10 shadow-xl shadow-purple-950/25 select-none"
    >
      {/* Living Ambient Glow Background */}
      <div
        aria-hidden="true"
        className="aura-orb-primary pointer-events-none absolute -top-16 -left-14 w-56 h-56 rounded-full blur-3xl opacity-45"
        style={{ background: 'radial-gradient(circle, #7C3AED, transparent 70%)' }}
      />
      <div
        aria-hidden="true"
        className="aura-orb-secondary pointer-events-none absolute -bottom-20 -right-10 w-64 h-64 rounded-full blur-3xl opacity-40"
        style={{ background: 'radial-gradient(circle, #10B981, transparent 70%)' }}
      />

      <div className="relative z-10 space-y-3">
        {/* Header + Quick Snap Pills (Zero Numbers) */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="space-y-0.5 min-w-0">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 border border-white/15 text-[10.5px] font-bold tracking-wide text-purple-100">
              <Sparkles size={11} className="text-emerald-300" />
              <span>Liquid Spend Wave</span>
            </span>
            <p className="text-[11px] text-white/65 truncate pl-0.5">
              {waveData.flowVerdict}
            </p>
          </div>

          <div className="flex items-center gap-1 bg-white/10 p-0.5 rounded-xl border border-white/10">
            <button
              type="button"
              onClick={() => setActiveWaveIdx(waveData.latestIdx)}
              data-testid="wave-jump-latest"
              className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold cursor-pointer transition-all ${
                spotIdx === waveData.latestIdx
                  ? 'bg-white text-[#110C24] shadow-xs'
                  : 'text-white/75 hover:text-white'
              }`}
            >
              Latest
            </button>
            <button
              type="button"
              onClick={() => setActiveWaveIdx(waveData.peakIdx)}
              data-testid="wave-jump-peak"
              className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold cursor-pointer transition-all inline-flex items-center gap-1 ${
                spotIdx === waveData.peakIdx
                  ? 'bg-amber-400 text-[#110C24] shadow-xs'
                  : 'text-white/75 hover:text-white'
              }`}
            >
              <Flame size={10} />
              <span>Peak</span>
            </button>
          </div>
        </div>

        {/* High-Smoothness Dynamic SVG Wave Canvas */}
        <div className="rounded-2xl bg-white/[0.05] border border-white/10 p-2 backdrop-blur-md">
          <div className="flex items-center justify-between px-1 pb-1 text-[10px] text-white/55">
            <span>Slide finger anywhere across the wave</span>
            <span className="inline-flex items-center gap-1 text-white/65">
              <span className="w-3 border-t border-dashed border-white/45 inline-block" />
              <span>Calm Pace</span>
            </span>
          </div>

          <svg
            ref={waveSvgRef}
            data-testid="liquid-wave-svg"
            viewBox={`0 0 ${waveData.W} ${waveData.H}`}
            className="w-full h-36 touch-none cursor-crosshair overflow-visible"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <defs>
              {/* Per-day color-reactive stroke gradient along curve */}
              <linearGradient
                id="waveDynamicStroke"
                gradientUnits="userSpaceOnUse"
                x1={waveData.padX}
                y1="0"
                x2={waveData.W - waveData.padX}
                y2="0"
              >
                {waveData.points.map((p, idx) => (
                  <stop
                    key={p.day}
                    offset={`${(idx / Math.max(1, waveData.points.length - 1)) * 100}%`}
                    stopColor={p.color}
                  />
                ))}
              </linearGradient>

              {/* Soft vertical translucent area fill */}
              <linearGradient id="waveAreaGlow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#C4B5FD" stopOpacity="0.52" />
                <stop offset="55%" stopColor="#34D399" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
              </linearGradient>

              <filter id="waveLineGlow" x="-10%" y="-20%" width="120%" height="140%">
                <feGaussianBlur stdDeviation="2.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Dotted Calm Pace Horizon */}
            <line
              x1={waveData.padX}
              y1={waveData.horizonY}
              x2={waveData.W - waveData.padX}
              y2={waveData.horizonY}
              stroke="rgba(255,255,255,0.28)"
              strokeWidth="1"
              strokeDasharray="4 4"
            />

            {/* Area Under Wave */}
            {waveData.areaPath && (
              <path d={waveData.areaPath} fill="url(#waveAreaGlow)" />
            )}

            {/* Glowing Dynamic-Color Curve */}
            {waveData.linePath && (
              <path
                d={waveData.linePath}
                fill="none"
                stroke="url(#waveDynamicStroke)"
                strokeWidth="2.8"
                strokeLinecap="round"
                filter="url(#waveLineGlow)"
              />
            )}

            {/* Subtle Peak Anchor Dots */}
            {waveData.points.map((p, idx) =>
              p.zone === 'peak' && idx !== spotIdx ? (
                <circle
                  key={`pk_${p.day}`}
                  cx={p.x}
                  cy={p.y}
                  r="2.2"
                  fill="#FB7185"
                  fillOpacity="0.75"
                />
              ) : null
            )}

            {/* Active Interactive Scrubber Halo & Pin */}
            {activePoint && (
              <g>
                <line
                  x1={activePoint.x}
                  y1={8}
                  x2={activePoint.x}
                  y2={waveData.H - waveData.padBottom}
                  stroke="rgba(255,255,255,0.38)"
                  strokeWidth="1.2"
                  strokeDasharray="2 2"
                />
                <circle
                  cx={activePoint.x}
                  cy={activePoint.y}
                  r="9"
                  fill={activePoint.color}
                  fillOpacity="0.3"
                />
                <circle
                  cx={activePoint.x}
                  cy={activePoint.y}
                  r="4.2"
                  fill="#FFFFFF"
                  stroke={activePoint.color}
                  strokeWidth="2.2"
                />
              </g>
            )}
          </svg>
        </div>

        {/* Scrubber Spotlight Strip (Zero Numbers) */}
        <div
          data-testid="wave-spotlight-pill"
          className="px-3.5 py-2.5 rounded-2xl bg-white/[0.08] border border-white/10 flex items-center justify-between gap-2.5"
        >
          <div className="min-w-0 space-y-0.5">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-white">
              <span>{activePoint ? activePoint.phaseLabel : 'Monthly Flow'}</span>
              {activePoint?.categories?.length > 0 && (
                <span className="text-[10.5px] font-semibold text-white/55 truncate inline-flex items-center gap-0.5">
                  <ArrowUpRight size={11} />
                  <span>{activePoint.categories.join(', ')}</span>
                </span>
              )}
            </div>
            <p className="text-[11px] text-white/80 truncate">
              {activePoint && activePoint.items.length > 0
                ? activePoint.items.join(' · ')
                : 'Quiet pause — nothing logged on this day'}
            </p>
          </div>

          <span
            className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold border inline-flex items-center gap-1 flex-shrink-0 ${zoneMeta.cls}`}
          >
            <ZoneIcon size={11} />
            <span>{zoneMeta.badge}</span>
          </span>
        </div>
      </div>
    </section>
  );
}
