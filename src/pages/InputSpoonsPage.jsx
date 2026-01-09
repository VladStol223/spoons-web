import React, { useMemo, useState } from "react";
import { loadCachedData, saveCachedData } from "../copypartySync";

function ensureDataShape(obj) {
  const o = (obj && typeof obj === "object") ? { ...obj } : {};
  if (!Number.isFinite(Number(o.spoons))) o.spoons = 0;
  if (!o.rest_spoons || typeof o.rest_spoons !== "object") o.rest_spoons = { short: 1, half: 2, full: 3 };
  return o;
}

function getRestGain(dataObj, kind) {
  const v = Number(dataObj?.rest_spoons?.[kind]);
  if (Number.isFinite(v) && v > 0) return v;
  if (kind === "short") return 1;
  if (kind === "half") return 2;
  return 3;
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
  const [localSpoons, setLocalSpoons] = useState(() => { const d = ensureDataShape(loadCachedData()); return Number(d.spoons) || 0; });

  const subtitleShort = useMemo(() => { const d = ensureDataShape(loadCachedData()); return `+${getRestGain(d, "short")} spoons`; }, []);
  const subtitleHalf = useMemo(() => { const d = ensureDataShape(loadCachedData()); return `+${getRestGain(d, "half")} spoons`; }, []);
  const subtitleFull = useMemo(() => { const d = ensureDataShape(loadCachedData()); return `+${getRestGain(d, "full")} spoons`; }, []);

  function applyRest(kind) {
    const d0 = ensureDataShape(loadCachedData());
    const gain = getRestGain(d0, kind);
    const next = Math.max(0, Number(d0.spoons || 0) + gain);
    const d1 = { ...d0, spoons: next };
    saveCachedData(d1);
    setLocalSpoons(next);
    broadcastCacheChange();
  }

  return (
    <div className="spoonsPage">
      <div className="restRow">
        <RestCard title="Short rest" subtitle={subtitleShort} emoji="🐈" onClick={() => applyRest("short")} />
        <RestCard title="Half rest" subtitle={subtitleHalf} emoji="🐈‍⬛" onClick={() => applyRest("half")} />
        <RestCard title="Full rest" subtitle={subtitleFull} emoji="😴" onClick={() => applyRest("full")} />
      </div>
    </div>
  );
}
