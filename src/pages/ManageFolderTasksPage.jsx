// src/pages/ManageFolderTasksPage.jsx
import React, { useMemo } from "react";
import EditTaskPage from "./EditTaskPage";
import { loadCachedData, saveCachedData } from "../copypartySync";

function isoYmd(d) { const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, "0"); const da = String(d.getDate()).padStart(2, "0"); return `${y}-${m}-${da}`; }
function startOfToday() { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }
function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

function ensureFoldersData(obj) {
  const o = (obj && typeof obj === "object") ? { ...obj } : {};
  if (!Array.isArray(o.folders) || o.folders.length === 0) {
    const names = [String(o.folder_one || "Folder One"), String(o.folder_two || "Folder Two"), String(o.folder_three || "Folder Three"), String(o.folder_four || "Folder Four"), String(o.folder_five || "Folder Five"), String(o.folder_six || "Folder Six")].map((s) => String(s || "").trim() || "Folder");
    o.folders = names.map((name, idx) => ({ id: `f${idx + 1}`, name }));
  } else {
    o.folders = o.folders.map((f, idx) => ({ id: String(f?.id || `f${idx + 1}`), name: String(f?.name || `Folder ${idx + 1}`) }));
  }
  for (const f of o.folders) { const k = `folder_${f.id}_tasks`; if (!Array.isArray(o[k])) o[k] = []; }
  const legacyNames = ["folder_one","folder_two","folder_three","folder_four","folder_five","folder_six"];
  for (let i = 0; i < legacyNames.length; i++) { o[legacyNames[i]] = String(o.folders[i]?.name || `Folder ${i + 1}`); }
  return o;
}

function computeDeltaDays(taskDueYmd) {
  const t = String(taskDueYmd || "").trim();
  if (!t) return null;
  const due = new Date(t + "T00:00:00");
  if (Number.isNaN(due.getTime())) return null;
  const today = startOfToday();
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

function headerForDays(d) {
  if (d < 0) return "Overdue";
  if (d === 0) return "Due Today";
  if (d === 1) return "Due in 1 Day";
  return `Due in ${d} Days`;
}

function normalizeTask(raw) {
  const t = raw && typeof raw === "object" ? raw : {};
  const id = String(t.id || "");
  const task_name = String(t.task_name || t.name || "").trim();
  const description = String(t.description || "").trim();
  const spoons_needed = Number(t.spoons_needed ?? t.cost ?? 0) || 0;
  const done = Number(t.done ?? t.spoons_done ?? 0) || 0;
  const due_date = String(t.due_date || "").trim();
  return { id, task_name, description, spoons_needed, done, due_date };
}

export default function ManageFolderTasksPage({ folder, folderId, onBack }) {
  const folderName = String(folder?.name || "").trim() || "Folder";
  const listKey = `folder_${String(folderId || "f1")}_tasks`;

  const [dataObj, setDataObj] = React.useState(() => ensureFoldersData(loadCachedData()));
  React.useEffect(() => { setDataObj(ensureFoldersData(loadCachedData())); }, [folderId]);
  const tasksRaw = Array.isArray(dataObj?.[listKey]) ? dataObj[listKey] : [];
  const tasks = useMemo(() => tasksRaw.map(normalizeTask), [tasksRaw]);
  const [editTaskId, setEditTaskId] = React.useState(null);

  const grouped = useMemo(() => {
    const overdue = [];
    const upcoming = {};
    const completed = [];
    for (const t of tasks) {
      const cost = Math.max(0, Number(t.spoons_needed) || 0);
      const done = clamp(Number(t.done) || 0, 0, cost);
      const delta = computeDeltaDays(t.due_date);
      const item = { ...t, spoons_needed: cost, done, deltaDays: (delta === null ? 9999 : delta) };
      if (cost > 0 && done >= cost) { completed.push(item); continue; }
      if (delta !== null && delta < 0) { overdue.push(item); continue; }
      const key = (delta === null ? 9999 : delta);
      if (!upcoming[key]) upcoming[key] = [];
      upcoming[key].push(item);
    }
    overdue.sort((a, b) => (a.deltaDays - b.deltaDays));
    const keys = Object.keys(upcoming).map((k) => Number(k)).sort((a, b) => a - b);
    for (const k of keys) { upcoming[k].sort((a, b) => a.task_name.localeCompare(b.task_name)); }
    completed.sort((a, b) => a.task_name.localeCompare(b.task_name));
    return { overdue, upcoming, upcomingKeys: keys, completed };
  }, [tasks]);

  function toggleSpoon(taskId, spoonIndex) {
    const data0 = ensureFoldersData(loadCachedData());
    const arr = Array.isArray(data0[listKey]) ? [...data0[listKey]] : [];
    const idx = arr.findIndex((x) => String(x?.id || "") === String(taskId));
    if (idx < 0) return;
    const t0 = normalizeTask(arr[idx]);
    const cost = Math.max(0, Number(t0.spoons_needed) || 0);
    const done = clamp(Number(t0.done) || 0, 0, cost);
    const nextDone = (spoonIndex < done) ? spoonIndex : spoonIndex + 1;
    const next = { ...arr[idx], done: clamp(nextDone, 0, cost) };
    arr[idx] = next;
    data0[listKey] = arr;
    data0._local_updated_at = Date.now();
    saveCachedData(data0);
    setDataObj(data0);
  }

  function deleteTask(taskId) {
    const data0 = ensureFoldersData(loadCachedData());
    const arr = Array.isArray(data0[listKey]) ? [...data0[listKey]] : [];
    const nextArr = arr.filter((x) => String(x?.id || "") !== String(taskId));
    data0[listKey] = nextArr;
    data0._local_updated_at = Date.now();
    saveCachedData(data0);
    setDataObj(data0);
  }

  function TaskRow({ t }) {
    const cost = Math.max(0, Number(t.spoons_needed) || 0);
    const done = clamp(Number(t.done) || 0, 0, cost);
    const showCost = Math.min(cost, 10);
    const extra = Math.max(0, cost - showCost);
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px 92px", gap: 12, alignItems: "center" }}>
        <div style={{ padding: "12px 14px", borderRadius: 12, border: "2px solid rgba(255,165,0,0.95)", background: "rgba(245,228,178,0.95)", color: "rgba(20,12,8,0.95)", fontWeight: 1000, textTransform: "lowercase", lineHeight: 1.15, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", wordBreak: "break-word" }}>
          {t.task_name || "task"}
        </div>

        <div style={{ position: "relative", padding: "10px 12px", borderRadius: 12, border: "2px solid rgba(255,165,0,0.95)", background: "rgba(20,12,8,0.60)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, justifyItems: "center", alignItems: "center" }}>
            {Array.from({ length: showCost }).map((_, i) => {
              const isDone = i < done;
              return (
                <button key={`${t.id}_s${i}`} type="button" onClick={() => toggleSpoon(t.id, i)} title={isDone ? "Undo to here" : "Complete to here"} style={{ width: 36, height: 32, borderRadius: 8, border: "2px solid rgba(255,165,0,0.95)", background: isDone ? "rgba(240,220,150,0.95)" : "rgba(0,0,0,0.55)", color: "rgba(20,12,8,0.95)", fontWeight: 1000, cursor: "pointer" }}>
                  {isDone ? "🥄" : ""}
                </button>
              );
            })}
          </div>
          {extra > 0 ? <div style={{ position: "absolute", right: 10, bottom: 8, fontSize: 12, fontWeight: 1000, color: "rgba(245,228,178,0.95)", opacity: 0.9 }}>+{extra}</div> : null}
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <button type="button" onClick={() => setEditTaskId(t.id)} style={{ padding: "10px 10px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.10)", fontWeight: 1000, color: "rgba(255,255,255,0.95)" }}>Edit</button>
          <button type="button" onClick={() => deleteTask(t.id)} style={{ padding: "10px 10px", borderRadius: 12, border: "1px solid rgba(255,120,120,0.35)", background: "rgba(255,120,120,0.18)", fontWeight: 1100, color: "rgba(255,255,255,0.95)" }}>Del</button>
        </div>
      </div>
    );
  }

  function Section({ title, items }) {
    if (!items || !items.length) return null;
    return (
      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 1000, fontSize: 18, color: "rgba(20,12,8,0.95)" }}>{title}</div>
        <div style={{ display: "grid", gap: 12 }}>
          {items.map((t) => <TaskRow key={t.id} t={t} />)}
        </div>
      </div>
    );
  }

  if (editTaskId) return <EditTaskPage folderId={folderId} taskId={editTaskId} onCancel={() => setEditTaskId(null)} onSaved={(d0) => { setDataObj(d0); setEditTaskId(null); }} />;

  return (
    <div className="pageWrap">
      <div style={{ display: "grid", gap: 14, width: "100%" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button type="button" onClick={onBack} style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(0,0,0,0.12)", color: "rgba(255,255,255,0.95)", fontWeight: 950, cursor: "pointer" }}>← Back</button>
            <div style={{ fontWeight: 1000, fontSize: 20 }}>{folderName}</div>
          </div>
          <div style={{ opacity: 0.9, fontWeight: 900, fontSize: 12 }}>Today: {isoYmd(startOfToday())}</div>
        </div>

        <div style={{ borderRadius: 14, padding: 16, background: "rgba(0,0,0,0.10)", border: "1px solid rgba(255,255,255,0.14)", maxWidth: 980 }}>
          <Section title="Overdue" items={grouped.overdue} />
          {grouped.upcomingKeys.map((k) => <Section key={`u_${k}`} title={headerForDays(k)} items={grouped.upcoming[k]} />)}
          <Section title="Completed" items={grouped.completed} />
        </div>
      </div>
    </div>
  );
}
