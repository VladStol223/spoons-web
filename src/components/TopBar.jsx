import React from "react";

export default function TopBar({ spoons, onSetSpoons, onOpenSpoons }) {
  const canSet = typeof onSetSpoons === "function";
  const canOpen = typeof onOpenSpoons === "function";

  const s = Math.max(0, Math.floor(Number(spoons) || 0));
  const [editText, setEditText] = React.useState(String(s));
  React.useEffect(() => { setEditText(String(s)); }, [s]);

  function commitEdit() {
    if (!canSet) return;
    const n = Math.max(0, Math.floor(Number(String(editText).replace(/[^\d]/g, "")) || 0));
    setEditText(String(n));
    onSetSpoons(n);
  }

  function SpoonPlusIcon() {
    return (
      <span aria-hidden="true" style={{ position: "relative", display: "inline-flex", width: 28, height: 28, alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 20, lineHeight: "20px" }}>🥄</span>
        <span style={{
          position: "absolute",
          right: -2,
          top: -2,
          width: 16,
          height: 16,
          borderRadius: 999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          fontWeight: 900,
          border: "1px solid rgba(255,255,255,0.25)",
          background: "rgba(0,0,0,0.35)"
        }}>+</span>
      </span>
    );
  }

  const totalSlots = 20;
  const filled = Math.min(s, totalSlots);
  const row1Count = Math.min(filled, 10);
  const row2Count = Math.max(0, filled - 10);

  const row1 = Array.from({ length: 10 }).map((_, i) => (<span key={`r1_${i}`} className="spoon" style={{ opacity: i < row1Count ? 1 : 0.18 }}>🥄</span>));
  const row2 = Array.from({ length: 10 }).map((_, i) => (<span key={`r2_${i}`} className="spoon" style={{ opacity: i < row2Count ? 1 : 0.18 }}>🥄</span>));

  return (
    <header className="topBar" style={{ padding: "12px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
          <input
            value={editText}
            onChange={(e) => setEditText(e.target.value.replace(/[^\d]/g, ""))}
            onBlur={commitEdit}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitEdit(); } }}
            inputMode="numeric"
            aria-label="Spoons count"
            style={{
              width: 20,
              padding: 0,
              margin: 0,
              border: "none",
              outline: "none",
              background: "transparent",
              color: "inherit",
              font: "inherit",
              fontWeight: 900,
              fontSize: 22,
              textAlign: "left",
              cursor: canSet ? "text" : "default"
            }}
          />

          <div className="spoonsIcons" aria-hidden="true" style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "nowrap" }}>{row1}</div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "nowrap" }}>{row2}</div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => { if (canOpen) onOpenSpoons(); }}
          title="Open spoons"
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.18)",
            background: "rgba(255,255,255,0.10)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flex: "0 0 auto"
          }}
        >
          <SpoonPlusIcon />
        </button>
      </div>
    </header>
  );
}
