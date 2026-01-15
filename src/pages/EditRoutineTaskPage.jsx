// src/pages/EditRoutineTaskPage.jsx
import React, { useMemo, useState } from "react";
import { loadCachedData, saveCachedData } from "../copypartySync";

function ensureRoutinesData(obj) {
  const o = (obj && typeof obj === "object") ? { ...obj } : {};
  if (!Array.isArray(o.routines)) o.routines = [];
  if (!o.routine_items || typeof o.routine_items !== "object") o.routine_items = {};
  if (!o.routine_completions || typeof o.routine_completions !== "object") o.routine_completions = {};
  if (!Array.isArray(o.classes)) o.classes = [];
  return o;
}

function clampHHMM(s) {
  const v = String(s || "").trim();
  if (!v) return "";
  const m = v.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return v;
  const hh = Math.max(0, Math.min(23, Number(m[1])));
  const mm = Math.max(0, Math.min(59, Number(m[2])));
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export default function EditRoutineTaskPage({ routine, routineId, taskId, onCancel, onSaved, onDeleted }) {
  const d0 = useMemo(() => ensureRoutinesData(loadCachedData()), []);
  const isClass = String(routine?.type || "") === "class";
  const items = useMemo(() => (d0?.routine_items && Array.isArray(d0.routine_items[routineId])) ? d0.routine_items[routineId] : [], [d0, routineId]);
  const item0 = useMemo(() => items.find((x) => String(x?.id) === String(taskId)) || null, [items, taskId]);

  const [name, setName] = useState(() => String(item0?.name || "").trim());
  const [spoonCost, setSpoonCost] = useState(() => Math.max(0, Number(item0?.spoon_cost ?? 0) || 0));
  const [time, setTime] = useState(() => String(item0?.time || "").trim());
  const [duration, setDuration] = useState(() => Math.max(0, Number(item0?.duration_mins ?? 0) || 0));

  const classes = useMemo(() => Array.isArray(d0?.classes) ? d0.classes.map((x) => String(x || "").trim()).filter(Boolean) : [], [d0]);

  function save() {
    const d1 = ensureRoutinesData(loadCachedData());
    const cur = (d1?.routine_items && Array.isArray(d1.routine_items[routineId])) ? d1.routine_items[routineId].slice() : [];
    const idx = cur.findIndex((x) => String(x?.id) === String(taskId));
    if (idx < 0) return;

    const nextName = String(name || "").trim();
    const next = { ...cur[idx] };
    next.name = nextName;
    next.spoon_cost = Math.max(0, Number(spoonCost) || 0);

    if (isClass) {
      next.time = clampHHMM(time);
      next.duration_mins = Math.max(0, Number(duration) || 0);
      if (nextName) {
        const set = new Set((Array.isArray(d1.classes) ? d1.classes : []).map((x) => String(x || "").trim()).filter(Boolean));
        set.add(nextName);
        d1.classes = Array.from(set.values()).sort((a, b) => a.localeCompare(b));
      }
    } else {
      next.time = String(time || "").trim();
      next.duration_mins = Math.max(0, Number(duration) || 0);
    }

    cur[idx] = next;
    d1.routine_items[routineId] = cur;
    d1._local_updated_at = Date.now();
    saveCachedData(d1);
    if (typeof onSaved === "function") onSaved(d1);
  }

  function del() {
    const d1 = ensureRoutinesData(loadCachedData());
    const cur = (d1?.routine_items && Array.isArray(d1.routine_items[routineId])) ? d1.routine_items[routineId].slice() : [];
    const next = cur.filter((x) => String(x?.id) !== String(taskId));
    d1.routine_items[routineId] = next;
    d1._local_updated_at = Date.now();
    saveCachedData(d1);
    if (typeof onDeleted === "function") onDeleted(d1);
  }

  if (!item0) {
    return (
      <div className="pageWrap">
        <div style={{ display: "grid", gap: 12 }}>
          <button type="button" className="primaryBtn" onClick={onCancel}>← Back</button>
          <div style={{ fontWeight: 1000 }}>Task not found.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="pageWrap">
      <div style={{ display: "grid", gap: 14, width: "100%", maxWidth: 720 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
          <button type="button" className="primaryBtn" onClick={onCancel}>← Back</button>
          <div style={{ fontWeight: 1000, fontSize: 18 }}>Edit {isClass ? "Class" : "Routine"} Task</div>
        </div>

        <div style={{ borderRadius: 14, padding: 14, background: "rgba(0,0,0,0.10)", border: "1px solid rgba(255,255,255,0.14)", display: "grid", gap: 12 }}>
          <label style={{ display: "grid", gap: 6, fontWeight: 900, fontSize: 12, opacity: 0.9 }}>
            {isClass ? "Class Name" : "Task Name"}
            <input value={name} onChange={(e) => setName(String(e.target.value || ""))} list={isClass ? "classNameDatalist" : undefined} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.20)", background: "rgba(255,255,255,0.10)", color: "white", fontWeight: 900 }} />
            {isClass ? (
              <datalist id="classNameDatalist">
                {classes.map((c) => (<option key={c} value={c} />))}
              </datalist>
            ) : null}
          </label>

          <label style={{ display: "grid", gap: 6, fontWeight: 900, fontSize: 12, opacity: 0.9 }}>
            Spoon Cost (0 allowed)
            <input value={String(spoonCost)} inputMode="numeric" onChange={(e) => setSpoonCost(Math.max(0, Number(e.target.value || 0) || 0))} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.20)", background: "rgba(255,255,255,0.10)", color: "white", fontWeight: 900, width: 180 }} />
          </label>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <label style={{ display: "grid", gap: 6, fontWeight: 900, fontSize: 12, opacity: 0.9 }}>
              {isClass ? "Start Time (HH:MM)" : "Time (optional)"}
              <input value={time} onChange={(e) => setTime(String(e.target.value || ""))} placeholder={isClass ? "09:30" : ""} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.20)", background: "rgba(255,255,255,0.10)", color: "white", fontWeight: 900, width: 160 }} />
            </label>

            <label style={{ display: "grid", gap: 6, fontWeight: 900, fontSize: 12, opacity: 0.9 }}>
              Duration (mins)
              <input value={String(duration)} inputMode="numeric" onChange={(e) => setDuration(Math.max(0, Number(e.target.value || 0) || 0))} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.20)", background: "rgba(255,255,255,0.10)", color: "white", fontWeight: 900, width: 160 }} />
            </label>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" className="primaryBtn" onClick={save} style={{ fontWeight: 1000 }}>Save</button>
            <button type="button" className="primaryBtn" onClick={del} style={{ fontWeight: 1100, borderColor: "rgba(255,120,120,0.35)", background: "rgba(255,120,120,0.18)" }}>Delete</button>
          </div>
        </div>
      </div>
    </div>
  );
}
