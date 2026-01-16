// src/components/ColorPicker.jsx
import React from "react";

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

export default function ColorPicker({ label, value, onChange, presets }) {
  const presetList = Array.isArray(presets) && presets.length ? presets : [
    "#303C1F", "#2E86FF","#00C2A8","#27AE60","#F2C94C","#F2994A","#EB5757","#9B51E0","#56CCF2","#FFFFFF","#111111"
  ];

  const v = String(value || "").trim() || "#2E86FF";

  return (
    <div style={{ display: "grid", gap: 6 }}>
      {label ? (<div style={{ fontWeight: 900, fontSize: 12, opacity: 0.9 }}>{label}</div>) : null}

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input type="color" value={v} onChange={(e) => onChange && onChange(String(e.target.value || "").trim())} style={{ width: 46, height: 40, padding: 0, border: "1px solid rgba(255,255,255,0.20)", borderRadius: 10, background: "rgba(255,255,255,0.06)", cursor: "pointer" }} />

        <input value={v} onChange={(e) => onChange && onChange(String(e.target.value || "").trim())} spellCheck={false} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.20)", background: "rgba(255,255,255,0.10)", color: "white", fontWeight: 900, width: 120 }} />

        <div style={{ width: 34, height: 34, borderRadius: 10, border: "1px solid rgba(255,255,255,0.20)", background: v }} title={v} />
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {presetList.slice(0, clamp(presetList.length, 0, 24)).map((c) => (
          <button key={c} type="button" onClick={() => onChange && onChange(c)} style={{ width: 24, height: 24, borderRadius: 8, border: "1px solid rgba(255,255,255,0.18)", background: c, cursor: "pointer" }} title={c} aria-label={`Pick ${c}`} />
        ))}
      </div>
    </div>
  );
}
