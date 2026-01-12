import React from "react";
import { loadCachedData } from "../copypartySync";

function ensureFoldersData(obj) {
  const o = (obj && typeof obj === "object") ? { ...obj } : {};
  if (!Array.isArray(o.folders) || o.folders.length === 0) {
    const names = [
      String(o.folder_one || "Folder One"),
      String(o.folder_two || "Folder Two"),
      String(o.folder_three || "Folder Three"),
      String(o.folder_four || "Folder Four"),
      String(o.folder_five || "Folder Five"),
      String(o.folder_six || "Folder Six"),
    ].map((s) => String(s || "").trim() || "Folder");

    o.folders = names.map((name, idx) => ({ id: `f${idx + 1}`, name }));
  } else {
    o.folders = o.folders.map((f, idx) => ({ id: String(f?.id || `f${idx + 1}`), name: String(f?.name || `Folder ${idx + 1}`) }));
  }

  for (const f of o.folders) {
    const k = `folder_${f.id}_tasks`;
    if (!Array.isArray(o[k])) o[k] = [];
  }

  const legacyNames = ["folder_one","folder_two","folder_three","folder_four","folder_five","folder_six"];
  for (let i = 0; i < legacyNames.length; i++) {
    o[legacyNames[i]] = String(o.folders[i]?.name || `Folder ${i + 1}`);
  }

  return o;
}

export default function ManageTasksPage() {
  const [dataObj] = React.useState(() => ensureFoldersData(loadCachedData()));
  const folders = Array.isArray(dataObj?.folders) ? dataObj.folders : [];

  const routines = [
    { id: "morning", label: "Morning", emoji: "🌅" },
    { id: "night", label: "Night", emoji: "🌙" },
    { id: "class", label: "Class", emoji: "🎓" },
  ];

  return (
    <div className="pageWrap">
      <div style={{ display: "grid", gap: 14, width: "100%" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
          <div style={{ fontWeight: 1000, fontSize: 20 }}>Manage Tasks</div>
        </div>

        {/* Routines row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, maxWidth: 720 }}>
          {routines.map((r) => (
            <button
              key={r.id}
              type="button"
              style={{ padding: "12px 14px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(0,0,0,0.10)", fontWeight: 950, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}
            >
              <span style={{ fontSize: 22, lineHeight: 1 }}>{r.emoji}</span>
              <span>{r.label} Routine</span>
            </button>
          ))}
        </div>

        {/* Divider */}
        <div style={{ height: 2, width: "100%", maxWidth: 720, background: "rgba(255,255,255,0.14)", borderRadius: 999 }} />

        {/* Folders grid (2 columns) */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, maxWidth: 720 }}>
          {folders.map((f) => (
            <button
              key={f.id}
              type="button"
              style={{ textAlign: "left", padding: "14px 14px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.08)", fontWeight: 950, minHeight: 54 }}
            >
              {String(f.name || "").trim() || "Folder"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
