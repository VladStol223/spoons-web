// src/pages/EditTaskPage.jsx
import React from "react";
import { loadCachedData, saveCachedData } from "../copypartySync";

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

function normalizeTask(raw) {
  const t = raw && typeof raw === "object" ? raw : {};
  const id = String(t.id || "");
  const task_name = String(t.task_name || t.name || "").trim();
  const description = String(t.description || "").trim();
  const spoons_needed = Number(t.spoons_needed ?? t.cost ?? 0) || 0;
  const done = Number(t.done ?? t.spoons_done ?? 0) || 0;
  const due_date = String(t.due_date || "").trim();
  const time = String(t.time || "").trim();
  return { id, task_name, description, spoons_needed, done, due_date, time };
}

export default function EditTaskPage({ folderId, taskId, onCancel, onSaved }) {
  const listKey = `folder_${String(folderId || "f1")}_tasks`;

  const [folders, setFolders] = React.useState([]);
  const [showFolderPicker, setShowFolderPicker] = React.useState(false);
  const [moveToFolderId, setMoveToFolderId] = React.useState(String(folderId || "f1"));

  const [name, setName] = React.useState("");
  const [desc, setDesc] = React.useState("");
  const [spoons, setSpoons] = React.useState("");
  const [due, setDue] = React.useState("");
  const [time, setTime] = React.useState("");

  React.useEffect(() => {
    const data0 = ensureFoldersData(loadCachedData());
    setFolders(Array.isArray(data0.folders) ? data0.folders : []);
    setMoveToFolderId(String(folderId || "f1"));
    setShowFolderPicker(false);

    const arr = Array.isArray(data0[listKey]) ? data0[listKey] : [];
    const idx = arr.findIndex((x) => String(x?.id || "") === String(taskId));
    if (idx < 0) return;
    const t0 = normalizeTask(arr[idx]);
    setName(t0.task_name || "");
    setDesc(t0.description || "");
    setSpoons(String(Math.max(0, Number(t0.spoons_needed) || 0)));
    setDue(String(t0.due_date || ""));
    setTime(String(t0.time || ""));
  }, [folderId, taskId]);

  function moveTaskToFolder(targetFolderId) {
    const fromFolderId = String(folderId || "f1");
    const toFolderId = String(targetFolderId || fromFolderId);
    if (!toFolderId) return;
    if (toFolderId === fromFolderId) { setShowFolderPicker(false); return; }

    const data0 = ensureFoldersData(loadCachedData());
    const fromKey = `folder_${fromFolderId}_tasks`;
    const toKey = `folder_${toFolderId}_tasks`;

    const fromArr = Array.isArray(data0[fromKey]) ? [...data0[fromKey]] : [];
    const idx = fromArr.findIndex((x) => String(x?.id || "") === String(taskId));
    if (idx < 0) return;

    const taskObj = { ...fromArr[idx] };
    const nextFrom = fromArr.filter((x) => String(x?.id || "") !== String(taskId));
    const toArr = Array.isArray(data0[toKey]) ? [...data0[toKey]] : [];
    toArr.push(taskObj);

    data0[fromKey] = nextFrom;
    data0[toKey] = toArr;
    data0._local_updated_at = Date.now();
    saveCachedData(data0);

    if (typeof onSaved === "function") onSaved(data0);
  }

  function save() {
    const data0 = ensureFoldersData(loadCachedData());
    const arr = Array.isArray(data0[listKey]) ? [...data0[listKey]] : [];
    const idx = arr.findIndex((x) => String(x?.id || "") === String(taskId));
    if (idx < 0) return;
    const t0 = normalizeTask(arr[idx]);
    const nextCost = clamp(Number(String(spoons || "").trim()) || 0, 0, 999);
    const nextDone = clamp(Number(t0.done) || 0, 0, nextCost);
    const next = { ...arr[idx], task_name: String(name || "").trim(), description: String(desc || "").trim(), spoons_needed: nextCost, done: nextDone, due_date: String(due || "").trim(), time: String(time || "").trim() };
    arr[idx] = next;
    data0[listKey] = arr;
    data0._local_updated_at = Date.now();
    saveCachedData(data0);
    if (typeof onSaved === "function") onSaved(data0);
  }

  return (
    <div className="pageWrap">
      <div style={{ display: "grid", gap: 12, width: "100%", maxWidth: 720 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ fontWeight: 1000, fontSize: 20 }}>Edit Task</div>

          <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              onClick={() => setShowFolderPicker((v) => !v)}
              style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(0,0,0,0.12)", color: "rgba(255,255,255,0.95)", fontWeight: 950, cursor: "pointer" }}
              title="Move task to a different folder"
            >
              {(() => {
                const curId = String(moveToFolderId || folderId || "f1");
                const f = (folders || []).find((x) => String(x?.id) === curId);
                return `Folder: ${String(f?.name || curId)}`;
              })()} ▾
            </button>

            {showFolderPicker ? (
              <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, width: 260, borderRadius: 14, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(20,20,20,0.98)", boxShadow: "0 18px 40px rgba(0,0,0,0.45)", padding: 10, zIndex: 50 }}>
                <div style={{ fontWeight: 1000, fontSize: 12, opacity: 0.9, marginBottom: 8 }}>Move to folder</div>
                <div style={{ display: "grid", gap: 8 }}>
                  {(folders || []).map((f) => {
                    const isCur = String(f?.id) === String(folderId || "f1");
                    return (
                      <button
                        key={String(f?.id)}
                        type="button"
                        onClick={() => { setMoveToFolderId(String(f?.id)); moveTaskToFolder(String(f?.id)); setShowFolderPicker(false); }}
                        style={{ width: "100%", textAlign: "left", padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.14)", background: isCur ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.95)", fontWeight: 950, cursor: "pointer" }}
                      >
                        {String(f?.name || f?.id || "Folder")}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <button type="button" onClick={onCancel} style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(0,0,0,0.12)", color: "rgba(255,255,255,0.95)", fontWeight: 950 }}>← Back</button>
          </div>
        </div>

        <div style={{ display: "grid", gap: 10, padding: 14, borderRadius: 14, background: "rgba(0,0,0,0.10)", border: "1px solid rgba(255,255,255,0.14)" }}>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontWeight: 900 }}>Task Name</div>
            <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.06)", fontWeight: 800 }} />
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontWeight: 900 }}>Description</div>
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={4} style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.06)", fontWeight: 650, resize: "vertical" }} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontWeight: 900 }}>Spoons</div>
              <input value={spoons} onChange={(e) => setSpoons(e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" pattern="[0-9]*" style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.06)", fontWeight: 900, textAlign: "center" }} />
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontWeight: 900 }}>Due Date (YYYY-MM-DD)</div>
              <input value={due} onChange={(e) => setDue(e.target.value)} placeholder="YYYY-MM-DD" style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.06)", fontWeight: 850, textAlign: "center" }} />
            </div>
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontWeight: 900 }}>Time (optional HH:MM)</div>
            <input value={time} onChange={(e) => setTime(e.target.value)} placeholder="HH:MM" style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.06)", fontWeight: 850, textAlign: "center" }} />
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 6 }}>
            <button type="button" onClick={onCancel} style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(0,0,0,0.12)", fontWeight: 950, color: "rgba(255,255,255,0.95)" }}>Cancel</button>
            <button type="button" onClick={save} style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid rgba(80,150,255,0.22)", background: "rgba(80,150,255,0.55)", fontWeight: 1100 }}>Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}
