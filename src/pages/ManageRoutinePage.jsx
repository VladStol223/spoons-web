// src/pages/ManageRoutinePage.jsx
import React, { useMemo, useState, useEffect, useRef } from "react";
import { loadCachedData, saveCachedData } from "../copypartySync";
import AddRoutineTaskPage from "./AddRoutineTaskPage";
import EditRoutineTaskPage from "./EditRoutineTaskPage";

function isoYmd(d) { const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, "0"); const da = String(d.getDate()).padStart(2, "0"); return `${y}-${m}-${da}`; }
function startOfToday() { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }
function newId(prefix) { return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`; }

function ensureRoutinesData(obj) {
  const o = (obj && typeof obj === "object") ? { ...obj } : {};
  if (!Array.isArray(o.routines)) o.routines = [];
  if (!o.routine_items || typeof o.routine_items !== "object") o.routine_items = {};
  if (!o.routine_completions || typeof o.routine_completions !== "object") o.routine_completions = {};
  if (!Array.isArray(o.classes)) o.classes = [];
  if (!Array.isArray(o.routine_items.morning)) o.routine_items.morning = [];
  if (!Array.isArray(o.routine_items.evening)) o.routine_items.evening = [];
  if (!Array.isArray(o.routine_items.class)) o.routine_items.class = [];
  return o;
}

function weekdayName(i) { return ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][i] || ""; }

function isDueToday(item, today) {
  const recur = item?.recur || { kind: "every_n_days", n: 1, start_weekday: today.getDay() };
  const kind = String(recur.kind || "every_n_days");
  if (kind === "daily") return true;

  if (kind === "weekly") {
    const days = Array.isArray(recur.weekdays) ? recur.weekdays.map((x) => Number(x)) : [];
    return days.includes(today.getDay());
  }

  // every_n_days anchored to a chosen start weekday in the current week
  const n = Math.max(1, Number(recur.n) || 1);
  const startW = Number.isFinite(Number(recur.start_weekday)) ? Number(recur.start_weekday) : today.getDay();
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dow = t0.getDay();
  const diffToStart = (dow - startW + 7) % 7;
  const startDate = new Date(t0.getTime() - diffToStart * 86400000);
  const deltaDays = Math.round((t0.getTime() - startDate.getTime()) / 86400000);
  return (deltaDays % n) === 0;
}

export default function ManageRoutinePage({ routineId, onBack }) {
  const [dataObj, setDataObj] = useState(() => ensureRoutinesData(loadCachedData()));
  const [showAddTask, setShowAddTask] = useState(false);
  const [editTaskId, setEditTaskId] = useState("");
  const dragRef = useRef({ active: false, dragId: "", overId: "", pointerId: 0 });
  useEffect(() => { setDataObj(ensureRoutinesData(loadCachedData())); setShowAddTask(false); setEditTaskId(""); }, [routineId]);

  const today = startOfToday();
  const ymd = isoYmd(today);

  const routine = useMemo(() => {
    const rs = Array.isArray(dataObj?.routines) ? dataObj.routines : [];
    return rs.find((r) => String(r?.id) === String(routineId)) || null;
  }, [dataObj, routineId]);

  const itemsRaw = useMemo(() => {
    const m = dataObj?.routine_items;
    const arr = (m && Array.isArray(m[routineId])) ? m[routineId] : [];
    return arr.map((x, idx) => ({
        id: String(x?.id || newId("ri")),
        name: String(x?.name || "").trim(),
        spoon_cost: Number(x?.spoon_cost ?? 0) || 0,
        order: Number(x?.order ?? (idx + 1) * 100) || (idx + 1) * 100,
        recur: x?.recur || { kind: "every_n_days", n: 1, start_weekday: today.getDay() },
        time: String(x?.time || "").trim(),
        duration_mins: Number(x?.duration_mins ?? 0) || 0,
    }));
  }, [dataObj, routineId]);

  const completionMap = useMemo(() => {
    const c0 = dataObj?.routine_completions?.[ymd]?.[routineId];
    return (c0 && typeof c0 === "object") ? c0 : {};
  }, [dataObj, ymd, routineId]);

  const dueItems = useMemo(() => {
    return itemsRaw
      .slice()
      .sort((a, b) => (a.order - b.order))
      .filter((it) => isDueToday(it, today))
      .filter((it) => !completionMap[String(it.id)]);
  }, [itemsRaw, completionMap, today]);

  const allDone = dueItems.length === 0;

  function saveData(next) {
    next._local_updated_at = Date.now();
    saveCachedData(next);
    setDataObj(next);
  }

    function saveRoutineItems(nextItems) {
    const d0 = ensureRoutinesData(loadCachedData());
    if (!d0.routine_items || typeof d0.routine_items !== "object") d0.routine_items = {};
    d0.routine_items[routineId] = Array.isArray(nextItems) ? nextItems : [];
    saveData(d0);
  }

  function normalizeOrders(items) {
    const out = (Array.isArray(items) ? items.slice() : []).map((x, idx) => {
      const order = (idx + 1) * 100;
      return { ...x, order };
    });
    return out;
  }

  function moveItemById(items, dragId, overId) {
    const arr = Array.isArray(items) ? items.slice() : [];
    const a = arr.findIndex((x) => String(x?.id) === String(dragId));
    const b = arr.findIndex((x) => String(x?.id) === String(overId));
    if (a < 0 || b < 0 || a === b) return arr;
    const [moved] = arr.splice(a, 1);
    arr.splice(b, 0, moved);
    return arr;
  }

  function commitReorder(dragId, overId) {
    if (!dragId || !overId || String(dragId) === String(overId)) return;
    const cur = (dataObj?.routine_items && Array.isArray(dataObj.routine_items[routineId])) ? dataObj.routine_items[routineId] : [];
    const next = normalizeOrders(moveItemById(cur, dragId, overId));
    saveRoutineItems(next);
    setDataObj(ensureRoutinesData(loadCachedData()));
  }

  function beginPointerReorder(e, taskId) {
    if (e.pointerType !== "touch" && e.pointerType !== "pen") return;
    e.preventDefault();
    e.stopPropagation();
    dragRef.current.active = true;
    dragRef.current.dragId = String(taskId);
    dragRef.current.overId = String(taskId);
    dragRef.current.pointerId = e.pointerId;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
  }

  function movePointerReorder(e) {
    if (!dragRef.current.active) return;
    if (dragRef.current.pointerId !== e.pointerId) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const row = el && el.closest ? el.closest("[data-routine-task-row]") : null;
    const overId = row ? String(row.getAttribute("data-taskid") || "") : "";
    if (!overId) return;
    if (overId === dragRef.current.overId) return;
    dragRef.current.overId = overId;
    commitReorder(dragRef.current.dragId, overId);
  }

  function endPointerReorder(e) {
    if (!dragRef.current.active) return;
    if (dragRef.current.pointerId !== e.pointerId) return;
    dragRef.current.active = false;
    dragRef.current.dragId = "";
    dragRef.current.overId = "";
    dragRef.current.pointerId = 0;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
  }


  function setRoutineField(key, value) {
    const d0 = ensureRoutinesData(loadCachedData());
    const rs = Array.isArray(d0.routines) ? [...d0.routines] : [];
    const idx = rs.findIndex((r) => String(r?.id) === String(routineId));
    if (idx < 0) return;
    rs[idx] = { ...rs[idx], [key]: value };
    d0.routines = rs;
    saveData(d0);
  }

  function completeItem(itemId) {
    const d0 = ensureRoutinesData(loadCachedData());
    if (!d0.routine_completions[ymd]) d0.routine_completions[ymd] = {};
    if (!d0.routine_completions[ymd][routineId]) d0.routine_completions[ymd][routineId] = {};
    d0.routine_completions[ymd][routineId][String(itemId)] = true;

    // apply spoon effect once
    const items = (d0.routine_items && Array.isArray(d0.routine_items[routineId])) ? d0.routine_items[routineId] : [];
    const it = items.find((x) => String(x?.id) === String(itemId));
    const cost = Math.max(0, Number(it?.spoon_cost ?? 0) || 0);
    const cur = Number(d0.spoons ?? 0) || 0;
    d0.spoons = Math.max(0, cur - cost);

    saveData(d0);
  }

  function completeAll() {
    const d0 = ensureRoutinesData(loadCachedData());
    if (!d0.routine_completions[ymd]) d0.routine_completions[ymd] = {};
    if (!d0.routine_completions[ymd][routineId]) d0.routine_completions[ymd][routineId] = {};
    const cmap = d0.routine_completions[ymd][routineId];

    const items = (d0.routine_items && Array.isArray(d0.routine_items[routineId])) ? d0.routine_items[routineId] : [];
    const dueNow = items
      .map((x, idx) => ({ ...x, id: String(x?.id || ""), order: Number(x?.order ?? (idx + 1) * 100) }))
      .filter((x) => x.id && isDueToday(x, today))
      .filter((x) => !cmap[String(x.id)]);

    let totalCost = 0;
    for (const it of dueNow) {
        cmap[String(it.id)] = true;
        const cost = Math.max(0, Number(it?.spoon_cost ?? 0) || 0);
        totalCost += cost;
    }
    const cur = Number(d0.spoons ?? 0) || 0;
    d0.spoons = Math.max(0, cur - totalCost);

    saveData(d0);
  }

  function addRoutineTask() { setShowAddTask(true); setEditTaskId(""); }

  if (!routine) {
    return (
      <div className="pageWrap">
        <div style={{ display: "grid", gap: 12 }}>
          <button type="button" className="primaryBtn" onClick={onBack}>← Back</button>
          <div style={{ fontWeight: 1000 }}>Routine not found.</div>
        </div>
      </div>
    );
  }

  const isClass = String(routine.type) === "class";
  if (showAddTask) return <AddRoutineTaskPage routine={routine} routineId={routineId} onCancel={() => setShowAddTask(false)} onSaved={(d0) => { setDataObj(ensureRoutinesData(d0)); setShowAddTask(false); }} />;
  if (editTaskId) return <EditRoutineTaskPage routine={routine} routineId={routineId} taskId={editTaskId} onCancel={() => setEditTaskId("")} onSaved={(d0) => { setDataObj(ensureRoutinesData(d0)); setEditTaskId(""); }} onDeleted={(d0) => { setDataObj(ensureRoutinesData(d0)); setEditTaskId(""); }} />;

  return (
    <div className="pageWrap">
      <div style={{ display: "grid", gap: 14, width: "100%" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button type="button" onClick={onBack} style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(0,0,0,0.12)", color: "rgba(255,255,255,0.95)", fontWeight: 950, cursor: "pointer" }}>← Back</button>
            <div style={{ fontWeight: 1000, fontSize: 20 }}>{String(routine.name || "Routine")}</div>
          </div>
          <div style={{ opacity: 0.9, fontWeight: 900, fontSize: 12 }}>Today: {ymd}</div>
        </div>

        {/* Routine settings */}
        <div style={{ borderRadius: 14, padding: 14, background: "rgba(0,0,0,0.10)", border: "1px solid rgba(255,255,255,0.14)", maxWidth: 980, display: "grid", gap: 10 }}>
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontWeight: 1000, opacity: 0.95 }}>Routine Settings</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              {!isClass ? (
                <>
                  <label style={{ display: "grid", gap: 4, fontWeight: 900, fontSize: 12, opacity: 0.9 }}>
                    Start Time (HH:MM)
                    <input value={String(routine.start_time || "")} onChange={(e) => setRoutineField("start_time", String(e.target.value || "").trim())} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.20)", background: "rgba(255,255,255,0.10)", color: "white", fontWeight: 900, width: 140 }} />
                  </label>
                  <label style={{ display: "grid", gap: 4, fontWeight: 900, fontSize: 12, opacity: 0.9 }}>
                    Duration (mins)
                    <input value={String(routine.duration_mins ?? "")} onChange={(e) => setRoutineField("duration_mins", Number(e.target.value || 0) || 0)} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.20)", background: "rgba(255,255,255,0.10)", color: "white", fontWeight: 900, width: 140 }} />
                  </label>
                </>
              ) : (
                <div style={{ fontWeight: 900, opacity: 0.9 }}>Class routine: tasks are classes with weekday + start/end.</div>
              )}
            </div>
          </div>

          <button type="button" className="primaryBtn" onClick={completeAll} disabled={allDone} style={{ fontWeight: 1000, opacity: allDone ? 0.7 : 1 }}>
            {allDone ? "All Done!" : "Complete all tasks"}
          </button>
        </div>

        {/* Routine tasks (manage + reorder) */}
        <div style={{ display: "grid", gap: 10, maxWidth: 980 }}>
          <div style={{ fontWeight: 1000, opacity: 0.95 }}>Routine Tasks</div>

          <div className="routineTasksScroll" style={{ overflowY: "auto", WebkitOverflowScrolling: "touch", scrollbarWidth: "none", msOverflowStyle: "none", maxHeight: "calc(100vh - var(--hubBarH) - 360px)", paddingRight: 2 }}>
            {itemsRaw.length === 0 ? (
              <div style={{ opacity: 0.9, fontWeight: 900 }}>No routine tasks yet.</div>
            ) : (
              itemsRaw.slice().sort((a, b) => (a.order - b.order)).map((t) => {
                const isDoneToday = !!completionMap[String(t.id)];
                return (
                  <div
                    key={t.id}
                    className={`routineTaskRow ${isDoneToday ? "routineTaskRowDone" : ""}`}
                    data-routine-task-row
                    data-taskid={String(t.id)}
                    onDragOver={(e) => { e.preventDefault(); }}
                    onDrop={(e) => { e.preventDefault(); const dragId = String(e.dataTransfer.getData("text/plain") || ""); const overId = String(t.id); if (dragId) commitReorder(dragId, overId); }}
                    onClick={(e) => { if (isDoneToday) return; setEditTaskId(String(t.id)); }}
                  >
                    <div
                      className="routineTaskDots routineTaskDotsDrag"
                      draggable
                      onDragStart={(e) => { e.dataTransfer.setData("text/plain", String(t.id)); try { e.dataTransfer.effectAllowed = "move"; } catch {} }}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      onPointerDown={(e) => beginPointerReorder(e, t.id)}
                      onPointerMove={movePointerReorder}
                      onPointerUp={endPointerReorder}
                      onPointerCancel={endPointerReorder}
                      aria-label="Drag to reorder"
                      title="Drag to reorder"
                    >⋮⋮</div>
                    <div className="routineTaskName">{t.name || "task"}</div>
                    <div className="routineTaskCost">{Math.max(0, Number(t.spoon_cost || 0))}</div>
                    <button type="button" className="routineTaskCheck" onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (!isDoneToday) completeItem(t.id); }} aria-label="Complete">{isDoneToday ? "✓" : "✅"}</button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <style>{`.routineTasksScroll::-webkit-scrollbar{width:0;height:0;}`}</style>

        {/* bottom spacer so the fixed button doesn't cover content */}
        <div style={{ height: 70 }} />
      </div>

      {/* fixed add button above hub bar */}
      <div className="routineAddBar">
        <button type="button" className="routineAddBtn" onClick={addRoutineTask}>＋ Add Routine Task</button>
      </div>
    </div>
  );
}
