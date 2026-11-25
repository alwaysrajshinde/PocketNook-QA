import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Activity, Hexagon, Orbit as OrbitIcon, Sparkles } from 'lucide-react';
import { getTransactions } from '../services/api';

const MODES = [
  { id: 'wave', label: 'Wave', icon: Activity },
  { id: 'radar', label: 'Radar', icon: Hexagon },
  { id: 'orbit', label: 'Orbit', icon: OrbitIcon }
];

const RADAR_AXES = [
  { key: 'food', label: 'Food', match: /food|dining|biryani|tea|chai|coffee|lunch|dinner|snacks|fish|chicken|mutton|eggs|non veg|fast food|zomato|swiggy|office/i },
  { key: 'essentials', label: 'Essentials', match: /grocer|milk|vegitab|veg|fruit|salad|medical|health|pharmacy|general|water/i },
  { key: 'commute', label: 'Commute', match: /auto|metro|uber|ola|transport|petrol|fuel|travel|bus|cab/i },
  { key: 'lifestyle', label: 'Lifestyle', match: /shop|cloth|entertain|movie|personal|gift|amazon|flipkart/i },
  { key: 'bills', label: 'Bills', match: /bill|rent|electric|recharge|broadband|wifi|subscription|hous/i },
  { key: 'future', label: 'Future', match: /mutual|sip|invest|emi|loan|saving|insurance|educat|round/i }
];

const ORB_PALETTE = ['#8B5CF6', '#EC4899', '#10B981', '#0EA5E9', '#F59E0B'];

function getPreviousMonthKey(monthKey) {
  const m = String(monthKey || '').match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthLength(monthKey) {
  const m = String(monthKey || '').match(/^(\d{4})-(\d{2})$/);
  if (!m) return 30;
  return new Date(Number(m[1]), Number(m[2]), 0).getDate();
}

function formatDayPhase(isoDate) {
  try {
    const dt = new Date(`${isoDate}T00:00:00`);
    if (isNaN(dt.getTime())) return 'Day';
    const dayNum = dt.getDate();
    const weekday = dt.toLocaleDateString('en-IN', { weekday: 'short' });
    const monthName = dt.toLocaleDateString('en-IN', { month: 'short' });
    const phase = dayNum <= 10 ? 'Early' : dayNum <= 20 ? 'Mid' : 'Late';
    return `${weekday} · ${phase} ${monthName}`;
  } catch {
    return 'Day';
  }
}

function buildSmoothWavePath(points) {
  if (!points || points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const cx = ((p0.x + p1.x) / 2).toFixed(1);
    d += ` C ${cx} ${p0.y.toFixed(1)}, ${cx} ${p1.y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
  }
  return d;
}

function computeRadarPolygon(txs, radius, cx, cy) {
  const buckets = RADAR_AXES.map((a) => ({ ...a, total: 0, tags: [] }));
  for (const tx of txs || []) {
    const amt = Number(tx.amount || 0);
    if (tx.is_refund || amt <= 0) continue;
    const text = `${tx.category || ''} ${tx.description || ''}`;
    let matched = buckets.find((b) => b.match.test(text));
    if (!matched) matched = buckets[3]; // Lifestyle/General fallback
    matched.total += amt;
    const tag = (tx.description || tx.category || '').trim();
    if (tag && !matched.tags.includes(tag) && matched.tags.length < 4) {
      matched.tags.push(tag);
    }
  }
  const maxVal = Math.max(1, ...buckets.map((b) => b.total));
  const points = buckets.map((b, i) => {
    const angle = (-Math.PI / 2) + (i * 2 * Math.PI) / buckets.length;
    const norm = b.total > 0 ? Math.max(0.22, Math.min(1, b.total / maxVal)) : 0.14;
    const r = radius * norm;
    return {
      ...b,
      angle,
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
      labelX: cx + (radius + 20) * Math.cos(angle),
      labelY: cy + (radius + 17) * Math.sin(angle)
    };
  });
  return {
    points,
    path: points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') + ' Z'
  };
}

export default function SpendVisualGraphCard({
  dashboardData,
  selectedMonth
}) {
  const activeMonth = selectedMonth || dashboardData?.month || new Date().toISOString().slice(0, 7);
  const [mode, setMode] = useState('wave'); // 'wave' | 'radar' | 'orbit'
  const [monthTxs, setMonthTxs] = useState(dashboardData?.recent_transactions || []);
  const [prevTxs, setPrevTxs] = useState([]);
  const [activeWaveIdx, setActiveWaveIdx] = useState(null);
  const [selectedAxisKey, setSelectedAxisKey] = useState(null);
  const [selectedOrbitIdx, setSelectedOrbitIdx] = useState(0);
  const waveSvgRef = useRef(null);

  useEffect(() => {
    let active = true;
    const prevMonth = getPreviousMonthKey(activeMonth);
    (async () => {
      try {
        const [curRes, prevRes] = await Promise.all([
          getTransactions({ month: activeMonth, limit: 1000 }),
          prevMonth ? getTransactions({ month: prevMonth, limit: 1000 }) : Promise.resolve(null)
        ]);
        if (!active) return;
        if (curRes && Array.isArray(curRes.transactions) && curRes.transactions.length > 0) {
          setMonthTxs(curRes.transactions);
        } else if (Array.isArray(dashboardData?.recent_transactions)) {
          setMonthTxs(dashboardData.recent_transactions);
        }
        if (prevRes && Array.isArray(prevRes.transactions)) {
          setPrevTxs(prevRes.transactions);
        }
      } catch {
        if (active && Array.isArray(dashboardData?.recent_transactions)) {
          setMonthTxs(dashboardData.recent_transactions);
        }
      }
    })();
    return () => { active = false; };
  }, [activeMonth, dashboardData?.total_spent, dashboardData?.recent_transactions]);

  // ========================================================
  // WAVE DATA (Daily Flow Curve vs Calm Horizon — Zero Numbers)
  // ========================================================
  const waveData = useMemo(() => {
    const daysLen = getMonthLength(activeMonth);
    const dailyMap = {};
    for (const tx of monthTxs || []) {
      const amt = Number(tx.amount || 0);
      if (tx.is_refund || amt <= 0) continue;
      const iso = String(tx.date || '').slice(0, 10);
      if (!iso.startsWith(activeMonth)) continue;
      const dNum = parseInt(iso.slice(8, 10), 10);
      if (!dailyMap[dNum]) dailyMap[dNum] = { total: 0, iso, items: [] };
      dailyMap[dNum].total += amt;
      const label = (tx.description || tx.category || '').trim();
      if (label && !dailyMap[dNum].items.includes(label) && dailyMap[dNum].items.length < 3) {
        dailyMap[dNum].items.push(label);
      }
    }

    const activeDayNums = Object.keys(dailyMap).map(Number);
    const maxDayToPlot = activeDayNums.length > 0 ? Math.max(...activeDayNums) : daysLen;
    const budget = Number(dashboardData?.budget || 0);
    const totals = Object.values(dailyMap).map((d) => d.total);
    const avgDaily = totals.length > 0 ? totals.reduce((a, b) => a + b, 0) / totals.length : 300;
    const calmRef = budget > 0 ? Math.max(120, budget / daysLen) : Math.max(150, avgDaily);
    const peakMax = Math.max(calmRef * 1.9, ...(totals.length ? totals : [calmRef * 1.5]));

    const W = 320;
    const H = 124;
    const padX = 10;
    const padTop = 14;
    const padBottom = 16;
    const plotH = H - padTop - padBottom;
    const count = Math.max(7, maxDayToPlot);

    const points = [];
    for (let d = 1; d <= count; d++) {
      const iso = `${activeMonth}-${String(d).padStart(2, '0')}`;
      const info = dailyMap[d] || { total: 0, iso, items: [] };
      const ratio = Math.min(1, info.total / peakMax);
      const x = padX + ((d - 1) / Math.max(1, count - 1)) * (W - padX * 2);
      const y = padTop + plotH - ratio * plotH;
      points.push({
        day: d,
        iso,
        x,
        y,
        spent: info.total,
        items: info.items,
        isCalm: info.total <= calmRef,
        phaseLabel: formatDayPhase(iso)
      });
    }

    const horizonY = padTop + plotH - Math.min(0.85, calmRef / peakMax) * plotH;
    const linePath = buildSmoothWavePath(points);
    const areaPath = points.length > 0
      ? `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${H - padBottom} L ${points[0].x.toFixed(1)} ${H - padBottom} Z`
      : '';

    const defaultSpotIdx = points.reduce((best, p, idx) => (p.spent >= points[best].spent ? idx : best), 0);
    return { W, H, padBottom, horizonY, points, linePath, areaPath, defaultSpotIdx };
  }, [monthTxs, activeMonth, dashboardData?.budget]);

  const spotIdx = activeWaveIdx !== null && waveData.points[activeWaveIdx]
    ? activeWaveIdx
    : waveData.defaultSpotIdx;
  const activePoint = waveData.points[spotIdx] || null;

  const scrubWaveFromClientX = (clientX) => {
    const svg = waveSvgRef.current;
    if (!svg || waveData.points.length === 0) return;
    const rect = svg.getBoundingClientRect();
    const rel = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)));
    const idx = Math.round(rel * (waveData.points.length - 1));
    setActiveWaveIdx(idx);
  };

  // ========================================================
  // RADAR DATA (6-Axis Lifestyle Shape Graph — Zero Numbers)
  // ========================================================
  const radarData = useMemo(() => {
    const cur = computeRadarPolygon(monthTxs, 54, 150, 74);
    const prev = prevTxs.length > 0 ? computeRadarPolygon(prevTxs, 54, 150, 74) : null;
    return { cur, prev };
  }, [monthTxs, prevTxs]);

  const activeRadarAxis =
    radarData.cur.points.find((p) => p.key === selectedAxisKey) ||
    radarData.cur.points.reduce((best, p) => (p.total >= best.total ? p : best), radarData.cur.points[0]);

  // ========================================================
  // ORBIT DATA (Category Constellation Graph — Zero Numbers)
  // ========================================================
  const orbitNodes = useMemo(() => {
    const grouped = {};
    for (const tx of monthTxs || []) {
      const amt = Number(tx.amount || 0);
      if (tx.is_refund || amt <= 0) continue;
      const cat = String(tx.category || 'Other').trim();
      if (!grouped[cat]) grouped[cat] = { name: cat, total: 0, tags: [] };
      grouped[cat].total += amt;
      const tag = (tx.description || '').trim();
      if (tag && !grouped[cat].tags.includes(tag) && grouped[cat].tags.length < 4) {
        grouped[cat].tags.push(tag);
      }
    }

    let list = Object.values(grouped).sort((a, b) => b.total - a.total).slice(0, 5);
    if (list.length === 0 && Array.isArray(dashboardData?.top_categories)) {
      list = dashboardData.top_categories.slice(0, 5).map((c) => ({
        name: c.name,
        total: Number(c.total ?? c.amount ?? 1),
        tags: []
      }));
    }

    const maxTotal = Math.max(1, ...list.map((n) => n.total));
    const coords = [
      { x: 160, y: 66 },
      { x: 82, y: 44 },
      { x: 242, y: 48 },
      { x: 96, y: 102 },
      { x: 228, y: 100 }
    ];

    return list.map((node, idx) => {
      const pos = coords[idx] || coords[0];
      const radius = 15 + Math.round((node.total / maxTotal) * 14);
      return {
        ...node,
        x: pos.x,
        y: pos.y,
        r: radius,
        color: ORB_PALETTE[idx % ORB_PALETTE.length]
      };
    });
  }, [monthTxs, dashboardData?.top_categories]);

  const activeOrbit = orbitNodes[selectedOrbitIdx] || orbitNodes[0] || null;

  return (
    <section
      data-testid="spend-graph-card"
      className="relative overflow-hidden rounded-3xl bg-[#110C24] text-white p-4 sm:p-5 border border-white/10 shadow-xl shadow-purple-950/25 select-none"
    >
      {/* Ambient Living Aurora Glow */}
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

      <div className="relative z-10 space-y-3.5">
        {/* Top Bar + Mode Switcher (Wave | Radar | Orbit) */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-[11px] font-bold tracking-wide text-purple-100">
            <Sparkles size={12} className="text-emerald-300" />
            <span>Spend Pulse Graph</span>
          </span>

          <div className="flex items-center gap-1 bg-white/10 p-0.5 rounded-xl border border-white/10">
            {MODES.map((m) => {
              const Icon = m.icon;
              const active = mode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMode(m.id)}
                  data-testid={`graph-mode-${m.id}`}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition-all ${
                    active
                      ? 'bg-white text-[#110C24] shadow-xs'
                      : 'text-white/70 hover:text-white'
                  }`}
                >
                  <Icon size={11} />
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* VIEW 1: LIQUID PULSE WAVE GRAPH */}
        {mode === 'wave' && (
          <div data-testid="graph-view-wave" className="space-y-2.5 animate-fade-in">
            <div className="flex items-center justify-between text-[10.5px] text-white/65">
              <span>Slide or tap along wave</span>
              <div className="flex items-center gap-2.5">
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>Calm</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span>Peak</span>
                </span>
              </div>
            </div>

            <div className="rounded-2xl bg-white/[0.05] border border-white/10 p-2 backdrop-blur-md">
              <svg
                ref={waveSvgRef}
                viewBox={`0 0 ${waveData.W} ${waveData.H}`}
                className="w-full h-32 touch-none cursor-crosshair"
                onPointerDown={(e) => scrubWaveFromClientX(e.clientX)}
                onPointerMove={(e) => {
                  if (e.buttons === 1 || e.pointerType === 'touch') {
                    scrubWaveFromClientX(e.clientX);
                  }
                }}
              >
                <defs>
                  <linearGradient id="pulseWaveFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#A78BFA" stopOpacity="0.65" />
                    <stop offset="60%" stopColor="#10B981" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
                  </linearGradient>
                  <linearGradient id="pulseWaveStroke" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#34D399" />
                    <stop offset="55%" stopColor="#A78BFA" />
                    <stop offset="100%" stopColor="#F472B6" />
                  </linearGradient>
                </defs>

                {/* Calm Horizon Reference Line */}
                <line
                  x1="10"
                  y1={waveData.horizonY}
                  x2={waveData.W - 10}
                  y2={waveData.horizonY}
                  stroke="rgba(255,255,255,0.28)"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />

                {/* Smooth Glowing Area + Curve */}
                {waveData.areaPath && (
                  <path d={waveData.areaPath} fill="url(#pulseWaveFill)" />
                )}
                {waveData.linePath && (
                  <path
                    d={waveData.linePath}
                    fill="none"
                    stroke="url(#pulseWaveStroke)"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                  />
                )}

                {/* Active Scrubber Spotlight Marker */}
                {activePoint && (
                  <g>
                    <line
                      x1={activePoint.x}
                      y1={10}
                      x2={activePoint.x}
                      y2={waveData.H - waveData.padBottom}
                      stroke="rgba(255,255,255,0.35)"
                      strokeWidth="1"
                    />
                    <circle
                      cx={activePoint.x}
                      cy={activePoint.y}
                      r="7"
                      fill={activePoint.isCalm ? 'rgba(52,211,153,0.35)' : 'rgba(251,191,36,0.35)'}
                    />
                    <circle
                      cx={activePoint.x}
                      cy={activePoint.y}
                      r="3.8"
                      fill="#FFFFFF"
                      stroke={activePoint.isCalm ? '#10B981' : '#F59E0B'}
                      strokeWidth="2"
                    />
                  </g>
                )}
              </svg>
            </div>

            {/* Scrubber Readout Pill (Qualitative Only — Zero Numbers) */}
            <div className="px-3 py-2 rounded-2xl bg-white/[0.08] border border-white/10 flex items-center justify-between gap-2 text-xs">
              <div className="min-w-0">
                <span className="font-extrabold text-white block truncate">
                  {activePoint ? activePoint.phaseLabel : 'Monthly Pulse'}
                </span>
                <span className="text-[11px] text-white/75 block truncate">
                  {activePoint && activePoint.items.length > 0
                    ? activePoint.items.join(' · ')
                    : 'Calm pause — nothing spent here'}
                </span>
              </div>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold flex-shrink-0 ${
                  !activePoint || activePoint.isCalm
                    ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/30'
                    : 'bg-amber-500/20 text-amber-200 border border-amber-400/30'
                }`}
              >
                {!activePoint || activePoint.isCalm ? 'Calm Flow' : 'Peak Day'}
              </span>
            </div>
          </div>
        )}

        {/* VIEW 2: LIFESTYLE SPEND RADAR (6-AXIS SPIDER GRAPH) */}
        {mode === 'radar' && (
          <div data-testid="graph-view-radar" className="space-y-2.5 animate-fade-in">
            <div className="flex items-center justify-between text-[10.5px] text-white/65">
              <span>Tap any axis to spotlight items</span>
              <div className="flex items-center gap-2.5">
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-violet-400" />
                  <span>This Cycle</span>
                </span>
                {radarData.prev && (
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-white/40" />
                    <span>Last Cycle</span>
                  </span>
                )}
              </div>
            </div>

            <div className="rounded-2xl bg-white/[0.05] border border-white/10 py-1 backdrop-blur-md">
              <svg viewBox="0 0 300 148" className="w-full h-36">
                {/* Web Rings */}
                {[0.35, 0.68, 1].map((scale, rIdx) => {
                  const r = 54 * scale;
                  const ringPts = RADAR_AXES.map((_, i) => {
                    const ang = (-Math.PI / 2) + (i * 2 * Math.PI) / RADAR_AXES.length;
                    return `${(150 + r * Math.cos(ang)).toFixed(1)},${(74 + r * Math.sin(ang)).toFixed(1)}`;
                  }).join(' ');
                  return (
                    <polygon
                      key={rIdx}
                      points={ringPts}
                      fill="none"
                      stroke="rgba(255,255,255,0.12)"
                      strokeWidth="1"
                    />
                  );
                })}

                {/* Axis Spokes */}
                {radarData.cur.points.map((p) => (
                  <line
                    key={p.key}
                    x1="150"
                    y1="74"
                    x2={(150 + 54 * Math.cos(p.angle)).toFixed(1)}
                    y2={(74 + 54 * Math.sin(p.angle)).toFixed(1)}
                    stroke="rgba(255,255,255,0.12)"
                    strokeWidth="1"
                  />
                ))}

                {/* Prior Cycle Ghost Outline */}
                {radarData.prev && (
                  <path
                    d={radarData.prev.path}
                    fill="rgba(255,255,255,0.06)"
                    stroke="rgba(255,255,255,0.4)"
                    strokeWidth="1.3"
                    strokeDasharray="3 3"
                  />
                )}

                {/* Current Cycle Glowing Polygon */}
                <path
                  d={radarData.cur.path}
                  fill="rgba(139, 92, 246, 0.35)"
                  stroke="#C4B5FD"
                  strokeWidth="2.2"
                />

                {/* Clickable Axis Dots & Labels */}
                {radarData.cur.points.map((p) => {
                  const isSel = activeRadarAxis?.key === p.key;
                  return (
                    <g
                      key={p.key}
                      onClick={() => setSelectedAxisKey(p.key)}
                      className="cursor-pointer"
                    >
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={isSel ? '5' : '3.2'}
                        fill={isSel ? '#34D399' : '#FFFFFF'}
                      />
                      <text
                        x={p.labelX}
                        y={p.labelY}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill={isSel ? '#6EE7B7' : 'rgba(255,255,255,0.78)'}
                        fontSize="9.5"
                        fontWeight={isSel ? '800' : '600'}
                      >
                        {p.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            {activeRadarAxis && (
              <div className="px-3 py-2 rounded-2xl bg-white/[0.08] border border-white/10 text-xs">
                <span className="font-extrabold text-emerald-200">{activeRadarAxis.label} Axis: </span>
                <span className="text-white/80">
                  {activeRadarAxis.tags.length > 0
                    ? activeRadarAxis.tags.join(' · ')
                    : 'Quiet zone this cycle'}
                </span>
              </div>
            )}
          </div>
        )}

        {/* VIEW 3: CATEGORY CONSTELLATION ORBIT GRAPH */}
        {mode === 'orbit' && (
          <div data-testid="graph-view-orbit" className="space-y-2.5 animate-fade-in">
            <div className="flex items-center justify-between text-[10.5px] text-white/65">
              <span>Larger orbs show heavier focus · Tap any orb</span>
            </div>

            <div className="rounded-2xl bg-white/[0.05] border border-white/10 p-1 backdrop-blur-md">
              {orbitNodes.length > 0 ? (
                <svg viewBox="0 0 320 132" className="w-full h-32">
                  {/* Soft Constellation Connectors */}
                  {orbitNodes.map((n, i) => (
                    <line
                      key={`link_${n.name}`}
                      x1="160"
                      y1="66"
                      x2={n.x}
                      y2={n.y}
                      stroke={i === selectedOrbitIdx ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.14)'}
                      strokeWidth={i === selectedOrbitIdx ? '1.6' : '1'}
                    />
                  ))}

                  {/* Interactive Category Orbs */}
                  {orbitNodes.map((node, idx) => {
                    const isSel = idx === selectedOrbitIdx;
                    return (
                      <g
                        key={node.name}
                        onClick={() => setSelectedOrbitIdx(idx)}
                        className="cursor-pointer"
                      >
                        {isSel && (
                          <circle
                            cx={node.x}
                            cy={node.y}
                            r={node.r + 5}
                            fill="none"
                            stroke="#FFFFFF"
                            strokeOpacity="0.45"
                            strokeWidth="1.5"
                          />
                        )}
                        <circle
                          cx={node.x}
                          cy={node.y}
                          r={node.r}
                          fill={node.color}
                          fillOpacity={isSel ? '0.9' : '0.68'}
                          stroke="rgba(255,255,255,0.5)"
                          strokeWidth="1.2"
                        />
                        <text
                          x={node.x}
                          y={node.y}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fill="#FFFFFF"
                          fontSize="8.5"
                          fontWeight="700"
                        >
                          {node.name.length > 10 ? `${node.name.slice(0, 9)}…` : node.name}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              ) : (
                <div className="py-10 text-center text-xs text-white/60">
                  Log a few expenses to bloom your Category Constellation
                </div>
              )}
            </div>

            {activeOrbit && (
              <div className="px-3 py-2 rounded-2xl bg-white/[0.08] border border-white/10 text-xs">
                <span className="font-extrabold text-white">{activeOrbit.name}: </span>
                <span className="text-white/80">
                  {activeOrbit.tags.length > 0
                    ? activeOrbit.tags.join(' · ')
                    : 'Active category cluster this cycle'}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
