import React from "react";
import { loadCachedData, saveCachedData } from "../copypartySync";

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
function nowYmd() { const d = new Date(); const mm = String(d.getMonth() + 1).padStart(2, "0"); const dd = String(d.getDate()).padStart(2, "0"); return `${d.getFullYear()}-${mm}-${dd}`; }

function ensureWaterShape(obj) {
  const o = (obj && typeof obj === "object") ? { ...obj } : {};
  if (!o.water || typeof o.water !== "object") o.water = {};
  if (!o.water.log || typeof o.water.log !== "object") o.water.log = {};
  if (!Number.isFinite(Number(o.water.daily_goal_oz))) o.water.daily_goal_oz = 80;
  return o;
}

function WaterCupSvg({ fillPct, pendingOz, goalLinePct, active }) {
  const p = clamp(Number(fillPct) || 0, 0, 120) / 100;
  const viewW = 200;
  const viewH = 300;

  const topY = 0;
  const botY = 276;
  const topLeftX = 8;
  const topRightX = 192;
  const botLeftX = 48;
  const botRightX = 152;

  const innerPad = 7;

  const cupPath = `M ${topLeftX} ${topY} L ${topRightX} ${topY} L ${botRightX} ${botY} L ${botLeftX} ${botY} Z`;
  const innerPath = `M ${topLeftX + innerPad} ${topY + innerPad} L ${topRightX - innerPad} ${topY + innerPad} L ${botRightX - innerPad} ${botY - innerPad} L ${botLeftX + innerPad} ${botY - innerPad} Z`;

  const waterTopY = botY - (botY - topY) * p;

  return (
    <svg className="waterCupSvg" viewBox={`0 0 ${viewW} ${viewH}`} width="240" height="360" role="img" aria-label="Water cup">
      <defs>
        <clipPath id="cupClip"><path d={innerPath} /></clipPath>

        <filter id="cupInnerShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feOffset dx="0" dy="7" />
          <feGaussianBlur stdDeviation="10" result="blur" />
          <feComposite in="blur" in2="SourceAlpha" operator="out" result="shadow" />
          <feColorMatrix in="shadow" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.38 0" />
          <feComposite in2="SourceGraphic" operator="over" />
        </filter>

        <linearGradient id="waterGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(130, 220, 255, 0.78)" />
          <stop offset="100%" stopColor="rgba(40, 160, 230, 0.74)" />
        </linearGradient>
      </defs>

      {/* cup shell (sharp edges) */}
      <path d={cupPath} fill="rgba(0,0,0,0.12)" stroke="rgba(255,255,255,0.22)" strokeWidth="4" shapeRendering="crispEdges" />

      {/* content clipped to inner cup */}
      <g clipPath="url(#cupClip)">
        {/* water body */}
        <rect x="0" y={waterTopY} width={viewW} height={viewH - waterTopY} fill="url(#waterGrad)" className={active ? "" : "waterFillEase"} />

        {/* animated water top highlight (no shadow) */}
        <path className={active ? "waterSurface active" : "waterSurface"} d={`M 0 ${waterTopY} C 40 ${waterTopY - 4} 80 ${waterTopY + 4} 120 ${waterTopY} C 150 ${waterTopY - 3} 175 ${waterTopY + 3} 200 ${waterTopY} L 200 ${waterTopY + 18} L 0 ${waterTopY + 18} Z`} fill="rgba(255,255,255,0.14)" />

        {/* subtle glass shine (no rounded corners needed) */}
        <path d={`M ${topLeftX + 10} ${topY + 14} L ${topLeftX + 24} ${topY + 14} L ${botLeftX + 8} ${botY - 30} L ${botLeftX - 6} ${botY - 30} Z`} fill="rgba(255,255,255,0.08)" />
      </g>

      {/* inner shadow overlay */}
      <path d={innerPath} fill="transparent" filter="url(#cupInnerShadow)" />

      {/* goal line */}
      {(() => {
        const gy = botY - (botY - topY) * clamp(goalLinePct, 0, 100) / 100;
        return <line x1="35" x2="165" y1={gy} y2={gy} stroke="rgba(255,255,255,0.28)" strokeWidth="2" shapeRendering="crispEdges" />;
      })()}

      {/* pending oz badge */}
      <foreignObject x="112" y="10" width="65" height="36">
        <div xmlns="http://www.w3.org/1999/xhtml" className="waterPendingBadge">+{pendingOz} oz</div>
      </foreignObject>
    </svg>
  );
}

export default function WaterPage() {
  const [dataObj, setDataObj] = React.useState(() => ensureWaterShape(loadCachedData()));
  const goalOz = Number(dataObj?.water?.daily_goal_oz) || 80;

  const maxDailyOz = Math.max(goalOz * 3, 200);

  const [todayKey, setTodayKey] = React.useState(() => nowYmd());

  React.useEffect(() => {
    const t = setInterval(() => {
      const k = nowYmd();
      setTodayKey(prev => (prev === k ? prev : k));
    }, 30_000); // check every 30s
    return () => clearInterval(t);
  }, []);
  const todayTotalOz = Number(dataObj?.water?.log?.[todayKey]) || 0;


  const cupRef = React.useRef(null);
  const dragRef = React.useRef({ active: false, y0: 0, startOz: 0, pending: 0, remaining: 0 });

  const [pendingOz, setPendingOz] = React.useState(0);
  const [isDragging, setIsDragging] = React.useState(false);

  function persist(next) {
    const shaped = ensureWaterShape(next);
    setDataObj(shaped);
    saveCachedData(shaped);
  }

  function onPointerDown(e) {
    const el = cupRef.current;
    if (!el) return;

    const y = ("touches" in e && e.touches?.[0]) ? e.touches[0].clientY : e.clientY;

    // Allow going beyond goal; cap at a reasonable daily maximum
    const remaining = clamp(maxDailyOz - todayTotalOz, 0, maxDailyOz);

    dragRef.current.active = true;
    dragRef.current.y0 = y;
    dragRef.current.remaining = remaining;

    // Start from the current pending amount so a re-touch continues adjusting (no reset)
    const start = clamp(Math.round(Number(pendingOz) || 0), 0, remaining);
    dragRef.current.startOz = start;
    dragRef.current.pending = start;
    if (start !== pendingOz) setPendingOz(start);

    setIsDragging(true);
    try { el.setPointerCapture?.(e.pointerId); } catch {}
    e.preventDefault?.();
  }

  function computeFromY(yNow) {
    const el = cupRef.current;
    if (!el) return pendingOz;

    const r = el.getBoundingClientRect();
    const dy = dragRef.current.y0 - yNow;

    const remaining = Number.isFinite(Number(dragRef.current.remaining)) ? Number(dragRef.current.remaining) : clamp(maxDailyOz - todayTotalOz, 0, maxDailyOz);

    // Scale drag to remaining capacity, not full goal
    const ozPerPx = remaining / Math.max(180, r.height);
    const deltaOz = dy * ozPerPx;

    // dy positive (drag up) increases; dy negative (drag down) decreases
    return clamp(Math.round(dragRef.current.startOz + deltaOz), 0, remaining);
  }

  function onPointerMove(e) {
    if (!dragRef.current.active) return;
    const y = ("touches" in e && e.touches?.[0]) ? e.touches[0].clientY : e.clientY;
    const next = computeFromY(y);
    dragRef.current.pending = next;
    setPendingOz(next);
    e.preventDefault?.();
  }

  function onPointerUp(e) {
    if (!dragRef.current.active) return;
    dragRef.current.active = false;
    setIsDragging(false);
    try { cupRef.current?.releasePointerCapture?.(e.pointerId); } catch {}
    e.preventDefault?.();
  }

  function onDrank() {
    const remaining = clamp(maxDailyOz - todayTotalOz, 0, maxDailyOz);
    const add = clamp(Math.max(0, Math.floor(Number(pendingOz) || 0)), 0, remaining);
    if (add <= 0) return;

    const nextTotal = todayTotalOz + add;
    const next = ensureWaterShape({ ...dataObj });
    next.water.log = { ...(next.water.log || {}) };
    next.water.log[todayKey] = nextTotal;

    persist(next);
    setPendingOz(0);
  }

  const progress = clamp((todayTotalOz / Math.max(1, goalOz)) * 100, 0, 150);
  const fillPct = clamp(((todayTotalOz + pendingOz) / Math.max(1, goalOz)) * 100, 0, 120);

  const shownTotal = todayTotalOz + pendingOz;
  const overflowOz = Math.max(0, shownTotal - goalOz);
  const overflowRatio = overflowOz / Math.max(1, goalOz);
  const dripStrength = clamp(overflowRatio, 0, 2); // 0..2
  const dripCount = clamp(Math.floor(dripStrength * 10), 0, 20);

  function rand01(i) { const x = Math.sin((i + 1) * 999.123) * 10000; return x - Math.floor(x); }

  const goalMet = todayTotalOz >= goalOz;
  const headerLine = goalMet ? "Nice. You hit your goal." : "Drag up to pour. Tap drank to commit.";

  return (
    <div className="pageWrap">
      <div style={{ display: "grid", gap: 14, justifyItems: "center", textAlign: "center" }}>
        <div style={{ fontWeight: 900, opacity: 0.95 }}>{headerLine}</div>
        <div style={{ fontWeight: 900, opacity: 0.9 }}>
          Today: {todayTotalOz} oz / {goalOz} oz {goalMet ? "✅" : "💧"}
        </div>

        <div
          ref={cupRef}
          className="waterCupHit"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onTouchStart={onPointerDown}
          onTouchMove={onPointerMove}
          onTouchEnd={onPointerUp}
          aria-label="Water cup"
          title="Drag up to fill"
        >
          <WaterCupSvg fillPct={fillPct} pendingOz={pendingOz} goalLinePct={clamp(progress, 0, 100)} active={isDragging} />

          <div className={`waterDrips ${dripCount > 0 ? "on" : ""}`} style={{ ["--drip"]: String(dripStrength), ["--dripCount"]: String(dripCount) }}>
            {Array.from({ length: dripCount }).map((_, i) => {
              const side = (i % 2 === 0) ? "L" : "R";
              const edgeJitter = rand01(i) * 10; // 0..10
              const leftPct = side === "L" ? (2 + edgeJitter) : (88 + edgeJitter);
              const dur = 0.85 + (1 - Math.min(1, dripStrength)) * 0.45 + rand01(i + 7) * 0.25;
              const delay = -(rand01(i + 33) * 1.2);
              const size = 6 + rand01(i + 101) * (10 + dripStrength * 8);
              return <span key={i} className="waterDrop" style={{ left: `${leftPct}%`, ["--dur"]: `${dur}s`, ["--delay"]: `${delay}s`, ["--sz"]: `${size}px` }} />;
            })}
          </div>
        </div>

        <button className="primaryBtn" onClick={onDrank} disabled={pendingOz <= 0} style={{ width: 240, height: 54, borderRadius: 16, fontWeight: 1000, fontSize: 16, opacity: pendingOz <= 0 ? 0.6 : 1 }}>
          Drank {pendingOz > 0 ? `${pendingOz} oz` : ""}
        </button>
      </div>
    </div>
  );
}
