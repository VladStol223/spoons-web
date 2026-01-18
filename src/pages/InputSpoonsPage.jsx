import React, { useEffect, useMemo, useState } from "react";
import { loadCachedData, saveCachedData } from "../copypartySync";

const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

function isoYmdLocal(d) { const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, "0"); const dd = String(d.getDate()).padStart(2, "0"); return `${y}-${m}-${dd}`; }
function todayKey() { return isoYmdLocal(new Date()); }
function dayLabelToday() { const idx = new Date().getDay(); return idx === 0 ? "Sun" : DAYS[idx - 1]; }

function ensureDataShape(obj) {
  const o = (obj && typeof obj === "object") ? { ...obj } : {};
  if (!Number.isFinite(Number(o.spoons))) o.spoons = 0;
  if (!o.daily_spoons || typeof o.daily_spoons !== "object") o.daily_spoons = {};
  for (const d of DAYS) { if (!Number.isFinite(Number(o.daily_spoons[d]))) o.daily_spoons[d] = 0; o.daily_spoons[d] = Math.max(0, Math.floor(Number(o.daily_spoons[d]) || 0)); }
  if (!o.rest_spoons || typeof o.rest_spoons !== "object") o.rest_spoons = { short: 1, half: 2, full: 3 };
  for (const k of ["short","half","full"]) { if (!Number.isFinite(Number(o.rest_spoons[k]))) o.rest_spoons[k] = (k === "short" ? 1 : (k === "half" ? 2 : 3)); o.rest_spoons[k] = Math.max(0, Math.floor(Number(o.rest_spoons[k]) || 0)); }
  const tps = Number(o.time_per_spoon);
  if (!Number.isFinite(tps) || tps <= 0) o.time_per_spoon = 10;
  o.time_per_spoon = Math.max(1, Math.floor(Number(o.time_per_spoon) || 10));
  if (typeof o.spoons_debt_toggle !== "boolean") o.spoons_debt_toggle = false;
  if (typeof o.spoons_debt_consequences_toggle !== "boolean") o.spoons_debt_consequences_toggle = false;
  if (typeof o.last_spoons_reset_ymd !== "string") o.last_spoons_reset_ymd = "";
  return o;
}

function getRestGain(dataObj, kind) {
  const v = Number(dataObj?.rest_spoons?.[kind]);
  if (Number.isFinite(v) && v >= 0) return v;
  if (kind === "short") return 1;
  if (kind === "half") return 2;
  return 3;
}

function getDailyWakeSpoons(dataObj) {
  const d = dayLabelToday();
  const v = Number(dataObj?.daily_spoons?.[d]);
  if (Number.isFinite(v) && v >= 0) return Math.floor(v);
  return 0;
}

function applyDailyResetIfNeeded(dataObj) {
  const d0 = ensureDataShape(dataObj);
  const today = todayKey();
  if (String(d0.last_spoons_reset_ymd || "") === today) return d0;

  const daily = getDailyWakeSpoons(d0);
  const debtOn = Boolean(d0.spoons_debt_toggle);
  const consOn = Boolean(d0.spoons_debt_consequences_toggle);
  const cur = Number(d0.spoons || 0);
  let next = daily;

  if (debtOn && consOn && Number.isFinite(cur) && cur < 0) next = daily + cur;
  if (!debtOn) next = Math.max(0, next);

  const d1 = { ...d0, spoons: next, last_spoons_reset_ymd: today };
  saveCachedData(d1);
  return d1;
}

function RestCard({ title, subtitle, emoji, onClick }) {
  return (
    <button className="restCard" type="button" onClick={onClick}>
      <div className="restEmoji" aria-hidden="true">{emoji}</div>
      <div className="restTitle">{title}</div>
      <div className="restSubtitle">{subtitle}</div>
    </button>
  );
}

function broadcastCacheChange() { try { window.dispatchEvent(new Event("spoons_cache_changed")); } catch {} }

export default function InputSpoonsPage() {
  const [localSpoons, setLocalSpoons] = useState(() => { const d = applyDailyResetIfNeeded(loadCachedData()); return Number(d.spoons) || 0; });

  useEffect(() => { const d = applyDailyResetIfNeeded(loadCachedData()); setLocalSpoons(Number(d.spoons) || 0); }, []);

  const subtitleShort = useMemo(() => { const d = ensureDataShape(loadCachedData()); return `+${getRestGain(d, "short")} spoons`; }, []);
  const subtitleHalf = useMemo(() => { const d = ensureDataShape(loadCachedData()); return `+${getRestGain(d, "half")} spoons`; }, []);
  const subtitleFull = useMemo(() => { const d = ensureDataShape(loadCachedData()); return `+${getRestGain(d, "full")} spoons`; }, []);

  function applyRest(kind) {
    const d0 = applyDailyResetIfNeeded(loadCachedData());
    const gain = getRestGain(d0, kind);
    const debtOn = Boolean(d0.spoons_debt_toggle);
    const next = Number(d0.spoons || 0) + gain;
    const finalNext = debtOn ? next : Math.max(0, next);
    const d1 = { ...d0, spoons: finalNext };
    saveCachedData(d1);
    setLocalSpoons(finalNext);
    broadcastCacheChange();
  }

  return (
    <div className="spoonsPage">
      <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 10 }}>Spoons: {localSpoons}</div>
      <div className="restRow">
        <RestCard title="Short rest" subtitle={subtitleShort} emoji="🐈" onClick={() => applyRest("short")} />
        <RestCard title="Half rest" subtitle={subtitleHalf} emoji="🐈‍⬛" onClick={() => applyRest("half")} />
        <RestCard title="Full rest" subtitle={subtitleFull} emoji="😴" onClick={() => applyRest("full")} />
      </div>
    </div>
  );
}
