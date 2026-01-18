// src/pages/ManageTasksPage.jsx
import React from "react";
import { useLocation } from "react-router-dom";
import { loadCachedData, saveCachedData } from "../copypartySync";
import ManageFolderTasksPage from "./ManageFolderTasksPage";
import ManageRoutinePage from "./ManageRoutinePage";

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

function isoYmd(d) { const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, "0"); const da = String(d.getDate()).padStart(2, "0"); return `${y}-${m}-${da}`; }

function ensureRoutinesData(obj) {
  const o = (obj && typeof obj === "object") ? { ...obj } : {};
  if (!Array.isArray(o.routines)) o.routines = [];
  if (!o.routine_items || typeof o.routine_items !== "object") o.routine_items = {};
  if (!o.routine_completions || typeof o.routine_completions !== "object") o.routine_completions = {};
  if (!Array.isArray(o.classes)) o.classes = [];

  return o;
}

function newId(prefix) { return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`; }

export default function ManageFoldersPage() {
  const loc = useLocation();

  const [dataObj, setDataObj] = React.useState(() => ensureRoutinesData(ensureFoldersData(loadCachedData())));
  const folders = Array.isArray(dataObj?.folders) ? dataObj.folders : [];

  const [selectedFolderId, setSelectedFolderId] = React.useState(null);
  const selectedFolder = selectedFolderId ? folders.find((f) => String(f.id) === String(selectedFolderId)) : null;

  const [selectedRoutineId, setSelectedRoutineId] = React.useState(null);
  const routines = Array.isArray(dataObj?.routines) ? dataObj.routines : [];
  const selectedRoutine = selectedRoutineId ? routines.find((r) => String(r.id) === String(selectedRoutineId)) : null;

  function refreshData() { setDataObj(ensureRoutinesData(ensureFoldersData(loadCachedData()))); }

  React.useEffect(() => { setSelectedFolderId(null); setSelectedRoutineId(null); refreshData(); }, [loc.key, loc.search]);

  function addRoutine() {
    const name = String(window.prompt("Routine name? (e.g., Gym Routine)") || "").trim();
    if (!name) return;
    const type = String(window.prompt("Type? morning / evening / class / custom", "custom") || "custom").trim().toLowerCase();
    const id = newId("r");
    const start_time = (type === "class") ? "" : String(window.prompt("Start time? (HH:MM)", "17:00") || "17:00").trim();
    const duration_mins = (type === "class") ? 0 : Number(window.prompt("Duration (mins)", "30") || 30) || 30;

    const d0 = ensureRoutinesData(ensureFoldersData(loadCachedData()));
    d0.routines = Array.isArray(d0.routines) ? [...d0.routines] : [];
    d0.routines.push({ id, name, type: (type || "custom"), start_time, duration_mins });
    if (!d0.routine_items) d0.routine_items = {};
    d0.routine_items[id] = [];
    d0._local_updated_at = Date.now();
    saveCachedData(d0);
    setDataObj(d0);
    setSelectedRoutineId(id);
  }

  function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function isoYmdLocal(d) { const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, "0"); const da = String(d.getDate()).padStart(2, "0"); return `${y}-${m}-${da}`; }

  function folderStatsNext7Days(folderId) {
    const base = (dataObj && typeof dataObj === "object") ? dataObj : {};
    const k = `folder_${String(folderId)}_tasks`;
    const arr = Array.isArray(base[k]) ? base[k] : [];

    const today = startOfDay(new Date());
    const end = new Date(today);
    end.setDate(end.getDate() + 6);

    let any = 0;
    let tasksLeft = 0;
    let spoonsLeft = 0;

    for (const t of arr) {
      if (!t || typeof t !== "object") continue;
      const dueRaw = String(t.due_date || "").slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dueRaw)) continue;

      const due = startOfDay(new Date(dueRaw + "T00:00:00"));
      if (Number.isNaN(due.getTime())) continue;
      if (due > end) continue;

      any += 1;

      const need = Math.max(0, Number(t.spoons_needed || 0) || 0);
      const done = Math.max(0, Number(t.done || 0) || 0);
      const remain = Math.max(0, need - done);

      if (need > 0 && remain > 0) {
        tasksLeft += 1;
        spoonsLeft += remain;
      }
    }

    return { any, tasksLeft, spoonsLeft };
  }

  function folderSubtitle(folderId) {
    const s = folderStatsNext7Days(folderId);
    if (!s.any) return "No Tasks yet!";
    if (!s.tasksLeft) return "All Tasks Completed!";
    const spoonWord = (s.spoonsLeft === 1) ? "Spoon" : "Spoons";
    const taskWord = (s.tasksLeft === 1) ? "Task Left" : "Tasks Left";
    return `${s.spoonsLeft} ${spoonWord} for ${s.tasksLeft} ${taskWord}`;
  }

  if (selectedRoutine) {
    return <ManageRoutinePage routineId={selectedRoutineId} onBack={() => { setSelectedRoutineId(null); refreshData(); }} />;
  }

  return (
    <div className="pageWrap">
      <div style={{ display: "grid", gap: 14, width: "100%" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
          <div style={{ fontWeight: 1000, fontSize: 20 }}>Manage Routines + Folders</div>
        </div>

        {/* Routines row (horizontal scroll) */}
        <div className="routinesRow">
          {(routines || []).map((r) => (
            <button key={r.id} type="button" className="routinePill" onClick={() => setSelectedRoutineId(r.id)}>
              <span className="routinePillEmoji">{r.type === "morning" ? "🌅" : r.type === "evening" ? "🌙" : r.type === "class" ? "🎓" : "✨"}</span>
              <span className="routinePillText">{String(r.name || "Routine")}</span>
            </button>
          ))}
          <button type="button" className="routinePill routinePillPlus" onClick={addRoutine}>
            <span className="routinePillEmoji">＋</span>
            <span className="routinePillText">New</span>
          </button>
        </div>

        {/* Divider */}
        <div style={{ height: 2, width: "100%", maxWidth: 720, background: "rgba(255,255,255,0.14)", borderRadius: 999 }} />

        {/* Folders grid (2 columns) */}
        {selectedFolderId ? (
          <ManageFolderTasksPage folder={selectedFolder} folderId={selectedFolderId} onBack={() => { setSelectedFolderId(null); refreshData(); }} />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, maxWidth: 760 }}>
            {folders.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setSelectedFolderId(f.id)}
                style={{ padding: "18px 16px 14px 16px", borderRadius: 16, border: "1px solid rgba(0,0,0,0.25)", background: "linear-gradient(180deg, rgba(250,206,115,0.95) 0%, rgba(243,176,66,0.98) 100%)", boxShadow: "0 10px 18px rgba(0,0,0,0.18)", minHeight: 92, position: "relative", overflow: "hidden" }}
              >
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.00) 55%)", pointerEvents: "none" }} />
                <div style={{ position: "absolute", top: 10, left: 14, right: 14, height: 2, background: "rgba(0,0,0,0.18)", borderRadius: 999, pointerEvents: "none" }} />
                <div style={{ display: "grid", gap: 6, alignContent: "center", justifyItems: "center", height: "100%", textAlign: "center" }}>
                  <div style={{ fontWeight: 1000, fontSize: 18, color: "rgba(0,0,0,0.92)", textShadow: "0 1px 0 rgba(255,255,255,0.25)" }}>{String(f.name || "").trim() || "Folder"}</div>
                  <div style={{ fontWeight: 900, fontSize: 12.5, color: "rgba(0,0,0,0.78)", lineHeight: 1.15 }}>{folderSubtitle(f.id)}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
