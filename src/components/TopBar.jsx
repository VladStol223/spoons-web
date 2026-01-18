// src/components/TopBar.jsx
import React from "react";
import { loadCachedData } from "../copypartySync";

export default function TopBar({ spoons, onSetSpoons, onOpenSpoons }) {
  const canSet = typeof onSetSpoons === "function";
  const canOpen = typeof onOpenSpoons === "function";

  let debtOn = false;
  try { debtOn = Boolean(loadCachedData()?.spoons_debt_toggle); } catch {}

  const sRaw = Math.floor(Number(spoons) || 0);
  const s = debtOn ? sRaw : Math.max(0, sRaw);
  const [editText, setEditText] = React.useState(String(s));
  React.useEffect(() => { setEditText(String(s)); }, [s]);

  function commitEdit() {
    if (!canSet) return;
    const txt = String(editText || "").trim();
    const n0 = Number(txt === "-" || txt === "" ? "0" : txt);
    const n1 = Math.floor(Number.isFinite(n0) ? n0 : 0);
    const n = debtOn ? n1 : Math.max(0, n1);
    setEditText(String(n));
    onSetSpoons(n);
  }

  function SpoonPlusIcon() {
    return (
      <span aria-hidden="true" style={{ position: "relative", display: "inline-flex", width: 28, height: 28, alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 20, lineHeight: "20px" }}>🥄</span>
        <span style={{ position: "absolute", right: -2, top: -2, width: 16, height: 16, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900, border: "1px solid rgba(255,255,255,0.25)", background: "rgba(0,0,0,0.35)" }}>+</span>
      </span>
    );
  }

  const totalSlots = 20;
  const pos = Math.max(0, s);
  const filled = Math.min(pos, totalSlots);
  const row1Count = Math.min(filled, 10);
  const row2Count = Math.max(0, filled - 10);

  const row1 = Array.from({ length: 10 }).map((_, i) => (<span key={`r1_${i}`} className="spoon" style={{ opacity: i < row1Count ? 1 : 0.18 }}>🥄</span>));
  const row2 = Array.from({ length: 10 }).map((_, i) => (<span key={`r2_${i}`} className="spoon" style={{ opacity: i < row2Count ? 1 : 0.18 }}>🥄</span>));

  function readSyncState() {
    let dirty = false;
    let err = "";
    try { dirty = localStorage.getItem("spoonsDataDirty") === "1"; } catch {}
    try { err = localStorage.getItem("spoonsDataLastSyncError") || ""; } catch {}
    return { dirty, err };
  }

  const [syncState, setSyncState] = React.useState(() => readSyncState());

  React.useEffect(() => {
    function tick() { setSyncState(readSyncState()); }
    tick();
    const id = setInterval(tick, 500);
    window.addEventListener("storage", tick);
    window.addEventListener("spoons_cache_changed", tick);
    return () => { clearInterval(id); window.removeEventListener("storage", tick); window.removeEventListener("spoons_cache_changed", tick); };
  }, []);

  const syncEmoji = syncState.err ? "⚠️" : (syncState.dirty ? "…" : "☁️");
  const syncTitle = syncState.err ? `Sync error: ${syncState.err}` : (syncState.dirty ? "Changes not uploaded yet" : "Synced");

  return (
    <header className="topBar" style={{ padding: "12px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, width: "100%", gridColumn: "1 / -1" }}>
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
          <span aria-hidden="true" title={syncTitle} style={{ position: "absolute", top: -10, left: 0, fontSize: 12, lineHeight: "12px", opacity: 0.85, pointerEvents: "none" }}>{syncEmoji}</span>

          <input
            value={editText}
            onChange={(e) => { const v = String(e.target.value || ""); if (/^-?\d*$/.test(v)) setEditText(v); }}
            onBlur={commitEdit}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitEdit(); } }}
            inputMode="numeric"
            aria-label="Spoons count"
            style={{ width: 42, padding: 0, margin: 0, border: "none", outline: "none", background: "transparent", color: "inherit", font: "inherit", fontWeight: 900, fontSize: 22, textAlign: "left", cursor: canSet ? "text" : "default" }}
          />

          <div className="spoonsIcons" aria-hidden="true" style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0, flex: 1, width: "100%" }}>
            <div style={{ display: "flex", width: "100%", justifyContent: "space-between", alignItems: "center", flexWrap: "nowrap" }}>{row1}</div>
            <div style={{ display: "flex", width: "100%", justifyContent: "space-between", alignItems: "center", flexWrap: "nowrap" }}>{row2}</div>
          </div>
        </div>

        <button type="button" onClick={() => { if (canOpen) onOpenSpoons(); }} title="Open spoons" style={{ width: 44, height: 44, borderRadius: 14, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.10)", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
          <SpoonPlusIcon />
        </button>
      </div>
    </header>
  );
}
