import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchAndDecryptWebDataJson } from "../copypartyData";
import { loadCachedData, saveCachedData } from "../copypartySync";

function pad2(n) { return String(n).padStart(2, "0"); }
function isoYmd(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function isSameDay(a, b) { return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function addMonths(d, n) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }
function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d) { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
function startOfWeekMonday(d) { const x = startOfDay(d); const dow = x.getDay(); const delta = (dow + 6) % 7; return addDays(x, -delta); }
function endOfWeekMonday(d) { return addDays(startOfWeekMonday(d), 6); }
function monthName(m) { return ["January","February","March","April","May","June","July","August","September","October","November","December"][m]; }
function clampDayToMonth(day, monthDate) { const m0 = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1); const m1 = endOfMonth(monthDate); const d0 = startOfDay(day); if (d0 < m0) return m0; if (d0 > m1) return m1; return d0; }
function dowShort(d) { return ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.getDay()]; }
function hourLabel(h) { if (h === 0) return "12 AM"; if (h < 12) return `${h} AM`; if (h === 12) return "12 PM"; return `${h - 12} PM`; }

function getColumnsForView(view, selectedDate) {
  if (view === "day") return [startOfDay(selectedDate)];
  if (view === "schoolWeek") { const mon = startOfWeekMonday(selectedDate); return [mon, addDays(mon, 1), addDays(mon, 2), addDays(mon, 3), addDays(mon, 4)]; }
  const mon = startOfWeekMonday(selectedDate);
  const sun = addDays(mon, -1);
  return [sun, addDays(sun, 1), addDays(sun, 2), addDays(sun, 3), addDays(sun, 4), addDays(sun, 5), addDays(sun, 6)];
}

function parseHHMMToMins(s) { const m = String(s || "").trim().match(/^(\d{1,2}):(\d{2})$/); if (!m) return null; const hh = Number(m[1]), mm = Number(m[2]); if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null; if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null; return (hh * 60) + mm; }

function ensureRoutinesDataForCalendar(obj) {
  const o = (obj && typeof obj === "object") ? obj : {};
  const routines = Array.isArray(o.routines) ? o.routines : [];
  const routine_items = (o.routine_items && typeof o.routine_items === "object") ? o.routine_items : {};
  return { routines, routine_items };
}

function isDueOnDate(item, dayDate) {
  const recur = item?.recur || { kind: "every_n_days", n: 1, start_weekday: dayDate.getDay() };
  const kind = String(recur.kind || "every_n_days");
  if (kind === "daily") return true;
  if (kind === "weekly") {
    const days = Array.isArray(recur.weekdays) ? recur.weekdays.map((x) => Number(x)) : [];
    return days.includes(dayDate.getDay());
  }
  const n = Math.max(1, Number(recur.n) || 1);
  const startW = Number.isFinite(Number(recur.start_weekday)) ? Number(recur.start_weekday) : dayDate.getDay();
  const t0 = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate());
  const dow = t0.getDay();
  const diffToStart = (dow - startW + 7) % 7;
  const startDate = new Date(t0.getTime() - diffToStart * 86400000);
  const deltaDays = Math.round((t0.getTime() - startDate.getTime()) / 86400000);
  return (deltaDays % n) === 0;
}

function ensureTaskIds(dataObj) {
  const base = (dataObj && typeof dataObj === "object") ? { ...dataObj } : {};
  let changed = false;

  function makeId() {
    try { return crypto.randomUUID(); } catch {}
    return `t_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
  }

  const folderKeys = [];
  if (Array.isArray(base.folders) && base.folders.length) {
    for (const f of base.folders) {
      const id = String(f?.id || "").trim();
      if (!id) continue;
      folderKeys.push(`folder_${id}_tasks`);
    }
  } else {
    folderKeys.push("folder_1_tasks","folder_2_tasks","folder_3_tasks","folder_4_tasks","folder_5_tasks","folder_6_tasks");
  }

  for (const k of folderKeys) {
    const arr0 = Array.isArray(base[k]) ? base[k] : [];
    let localChanged = false;

    const arr1 = arr0.map((t) => {
      if (!t || typeof t !== "object") return t;
      if (String(t.id || "").trim()) return t;
      localChanged = true;
      changed = true;
      return { ...t, id: makeId() };
    });

    if (localChanged) base[k] = arr1;
  }

  if (changed) { try { saveCachedData(base); } catch {} }
  return base;
}

function safeParseJson(s) { try { return JSON.parse(s); } catch { return null; } }
function parseDueYmd(due) { if (!due) return null; if (typeof due === "string") return due.slice(0, 10); if (due instanceof Date) return isoYmd(due); return null; }
function isCompleteTask(t) { const need = Number(t?.spoons_needed || 0); const done = Number(t?.done || 0); return need > 0 && done >= need; }
function taskName(t) { return String(t?.task_name || "").trim(); }
function parseTaskTimeMinutes(raw) { const s = String(raw?.time || raw?.due_time || raw?.start_time || raw?.scheduled_time || "").trim(); if (!s) return null; const m = s.match(/^(\d{1,2}):(\d{2})/); if (!m) return null; const hh = Number(m[1]); const mm = Number(m[2]); if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null; if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null; return (hh * 60) + mm; }
function parseTaskDurationMinutes(raw) { const n = Number(raw?.duration_mins ?? raw?.duration ?? ""); if (Number.isFinite(n) && n > 0) return Math.max(15, Math.min(24 * 60, Math.round(n))); const end = String(raw?.end_time || raw?.due_end || "").trim(); const start = String(raw?.time || raw?.start_time || "").trim(); const em = end.match(/^(\d{1,2}):(\d{2})/); const sm = start.match(/^(\d{1,2}):(\d{2})/); if (em && sm) { const eh = Number(em[1]), eM = Number(em[2]), sh = Number(sm[1]), sM = Number(sm[2]); const a = (sh * 60) + sM; const b = (eh * 60) + eM; const d = b - a; if (Number.isFinite(d) && d > 0) return Math.max(15, Math.min(24 * 60, Math.round(d))); } return 60; }

function loadLocalDataJson() { return loadCachedData(); }

function mergeDataPreferLocal(localObj, remoteObj) {
  const local = (localObj && typeof localObj === "object") ? { ...localObj } : {};
  const remote = (remoteObj && typeof remoteObj === "object") ? { ...remoteObj } : {};
  const out = { ...remote, ...local };
  const folderIds = [];
  if (Array.isArray(out.folders) && out.folders.length) {
    for (const f of out.folders) { const id = String(f?.id || "").trim(); if (id) folderIds.push(id); }
  }
  const keys = folderIds.length ? folderIds.map((id) => `folder_${id}_tasks`) : ["folder_1_tasks","folder_2_tasks","folder_3_tasks","folder_4_tasks","folder_5_tasks","folder_6_tasks"];
  for (const k of keys) {
    const a0 = Array.isArray(remote[k]) ? remote[k] : [];
    const b0 = Array.isArray(local[k]) ? local[k] : [];
    const map = new Map();
    for (const t of a0) { const id = String(t?.id || "").trim(); if (id) map.set(id, t); }
    for (const t of b0) { const id = String(t?.id || "").trim(); if (id) map.set(id, t); }
    out[k] = Array.from(map.values());
  }
  return out;
}

function getStoredCopypartyCreds() {
  try {
    const legacy = localStorage.getItem("spoonsAuth");
    if (legacy) localStorage.removeItem("spoonsAuth");
  } catch {}
  const raw = sessionStorage.getItem("spoonsAuth");
  const j = raw ? safeParseJson(raw) : null;
  const u = String(j?.username || j?.user || "").trim();
  const p = String(j?.password || j?.pass || "").trim();
  if (u && p) return { username: u, password: p };
  return null;
}

function buildTasksByDate(dataObj) {
  const map = {};
  if (!dataObj || typeof dataObj !== "object") return map;

  const lists = [];
  if (Array.isArray(dataObj.folders) && dataObj.folders.length) {
    for (const f of dataObj.folders) {
      const id = String(f?.id || "").trim();
      if (!id) continue;
      const k = `folder_${id}_tasks`;
      if (Array.isArray(dataObj[k])) lists.push(dataObj[k]);
    }
  } else {
    lists.push(dataObj.folder_1_tasks, dataObj.folder_2_tasks, dataObj.folder_3_tasks, dataObj.folder_4_tasks, dataObj.folder_5_tasks, dataObj.folder_6_tasks);
  }

  for (const lst of lists) {
    if (!Array.isArray(lst)) continue;
    for (const t of lst) {
      if (!t || typeof t !== "object") continue;
      const dueRaw = t.due_date;
      if (!dueRaw || typeof dueRaw !== "string") continue;
      const ymd = dueRaw.slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) continue;
      const name = String(t.task_name || "").trim();
      if (!name) continue;
      const spoonsNeeded = Number(t.spoons_needed || 0);
      const done = Number(t.done || 0);
      const isComplete = spoonsNeeded > 0 && done >= spoonsNeeded;
      const timeMins = parseTaskTimeMinutes(t);
      if (!map[ymd]) map[ymd] = [];
      const durationMins = parseTaskDurationMinutes(t);
      map[ymd].push({ id: String(t.id || `${ymd}:${name}`), name, isComplete, spoonsNeeded, done, timeMins, durationMins, raw: t });
    }
  }

  for (const k of Object.keys(map)) {
    map[k].sort((a, b) => {
      const aHas = Number(a.timeMins != null);
      const bHas = Number(b.timeMins != null);
      if (aHas !== bHas) return aHas - bHas;
      const at = a.timeMins ?? 999999;
      const bt = b.timeMins ?? 999999;
      if (at !== bt) return at - bt;
      return Number(a.isComplete) - Number(b.isComplete);
    });
  }

  return map;
}

function monthsDiff(aMonthDate, bMonthDate) { return ((bMonthDate.getFullYear() - aMonthDate.getFullYear()) * 12) + (bMonthDate.getMonth() - aMonthDate.getMonth()); }
function daysDiff(aDay, bDay) { const ms = startOfDay(bDay).getTime() - startOfDay(aDay).getTime(); return Math.round(ms / 86400000); }
function clampMs(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

function TimeGridInner({ view, selectedDate, onPickDate, tasksByDate, routineBlocksByDate, onScheduleTask, onUnscheduleTask, onUpdateTaskTimeAndDuration }) {
  const gridRef = useRef(null);
  const scrollWrapRef = useRef(null);
  const gridAreaRef = useRef(null);
  const lastAutoScrollKeyRef = useRef("");
  const touchDragRef = useRef({ active: false, payload: null });
  const today = useMemo(() => startOfDay(new Date()), []);
  const cols = useMemo(() => getColumnsForView(view, selectedDate), [view, selectedDate]);
  const showVertical = view !== "day";
  const [nowTs, setNowTs] = useState(() => Date.now());
  React.useEffect(() => { const t = setInterval(() => setNowTs(Date.now()), 30000); return () => clearInterval(t); }, []);
  const showNowLine = useMemo(() => cols.some((d) => isSameDay(d, today)), [cols, today]);
  const nowTopPx = useMemo(() => { const n = new Date(nowTs); const mins = (n.getHours() * 60) + n.getMinutes(); return (mins / 60) * 64; }, [nowTs]);

  React.useEffect(() => {
    if (view === "month") return;
    const key = `${view}:${cols.length}:${isoYmd(selectedDate)}`;
    if (lastAutoScrollKeyRef.current === key) return;
    lastAutoScrollKeyRef.current = key;
    const n = new Date();
    const minsNow = (n.getHours() * 60) + n.getMinutes();
    const targetMins = Math.max(0, Math.min(1439, minsNow - 60));
    const targetPx = (targetMins / 60) * 64;
    const a = scrollWrapRef.current;
    const b = gridAreaRef.current;
    if (a) a.scrollTop = targetPx;
    if (b) b.scrollTop = targetPx;
  }, [view, selectedDate, cols.length]);


  const [selectedTask, setSelectedTask] = useState(null);
  const [hoverTask, setHoverTask] = useState(null);
  const [dragGhost, setDragGhost] = useState(null);
  const [dragPayloadCache, setDragPayloadCache] = useState(null);

  const ghostRafRef = useRef(0);
  const resizeRef = useRef({ active: false, kind: "", taskId: "", ymd: "", start0: 0, dur0: 60, y0: 0 });

    function computeGhostFromClientXY(clientX, clientY, payload) {
    const surface = gridRef.current;
    if (!surface) return null;
    const rect = surface.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null;

    const colW = rect.width / Math.max(1, cols.length);
    const colIdx = Math.max(0, Math.min(cols.length - 1, Math.floor(x / Math.max(1, colW))));
    const targetDay = cols[colIdx];
    const targetYmd = isoYmd(targetDay);

    const startMins = snapTo15((y / 64) * 60);
    const dur = clampDur(Number(payload?.durationMins || 60));

    const leftPct = (colIdx / Math.max(1, cols.length)) * 100;
    const widthPct = (1 / Math.max(1, cols.length)) * 100;
    const topPx = (startMins / 60) * 64;
    const heightPx = (dur / 60) * 64;

    return { taskId: String(payload.taskId), ymd: targetYmd, startMins, durationMins: dur, leftPct, widthPct, topPx, heightPx };
  }

  function beginTouchDrag(e, taskId, ymd, durationMins) {
    if (e.pointerType !== "touch" && e.pointerType !== "pen") return;
    e.preventDefault();
    e.stopPropagation();

    const payload = { taskId: String(taskId), ymd: String(ymd), durationMins: Number(durationMins || 60) };
    setDragPayloadCache(payload);
    touchDragRef.current.active = true;
    touchDragRef.current.payload = payload;

    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}

    const g0 = computeGhostFromClientXY(e.clientX, e.clientY, payload);
    if (g0) setDragGhost(g0);
  }

  function moveTouchDrag(e) {
    if (!touchDragRef.current.active) return;
    const payload = touchDragRef.current.payload;
    const g = computeGhostFromClientXY(e.clientX, e.clientY, payload);
    if (!g) { setDragGhost(null); return; }
    setDragGhost(g);
  }

  function endTouchDrag(e) {
    if (!touchDragRef.current.active) return;
    touchDragRef.current.active = false;

    const payload = touchDragRef.current.payload;
    touchDragRef.current.payload = null;

    function findAllDayDropYmd(clientX, clientY) {
      try {
        const el = document.elementFromPoint(clientX, clientY);
        if (!el) return "";
        const cell = el.closest ? el.closest(".calAllDayCell") : null;
        if (!cell) return "";
        return String(cell.getAttribute("data-ymd") || "").slice(0, 10);
      } catch {
        return "";
      }
    }

    const dropYmd = findAllDayDropYmd(e.clientX, e.clientY);
    setDragGhost(null);
    setDragPayloadCache(null);

    if (dropYmd && typeof onUnscheduleTask === "function") { onUnscheduleTask(String(payload?.taskId || ""), dropYmd); return; }

    const g = computeGhostFromClientXY(e.clientX, e.clientY, payload);
    if (!g) return;
    if (typeof onScheduleTask !== "function") return;
    onScheduleTask(g.taskId, g.ymd, g.startMins);
  }

  function routineForDay(d) { const ymd = isoYmd(d); const arr = Array.isArray(routineBlocksByDate?.[ymd]) ? routineBlocksByDate[ymd] : []; return arr; }
  function splitAllDayAndTimedRoutines(arr) { const allDay = []; const timed = []; for (const t of arr) { if (t?.timeMins == null) allDay.push(t); else timed.push(t); } return { allDay, timed }; }

  function tasksForDay(d) { const ymd = isoYmd(d); const arr = Array.isArray(tasksByDate?.[ymd]) ? tasksByDate[ymd] : []; return arr; }
  function splitAllDayAndTimed(arr) { const allDay = []; const timed = []; for (const t of arr) { if (t?.timeMins == null) allDay.push(t); else timed.push(t); } return { allDay, timed }; }

  function onDragStartTask(e, taskId, ymd, durationMins) {
    const payload = { taskId: String(taskId), ymd: String(ymd), durationMins: Number(durationMins || 60) };
    const raw = JSON.stringify(payload);
    setDragPayloadCache(payload);
    try { e.dataTransfer.effectAllowed = "move"; } catch {}
    try { e.dataTransfer.setData("text/plain", raw); } catch {}
    try { e.dataTransfer.setData("application/json", raw); } catch {}
  }

  function onDragEndTask() { setDragPayloadCache(null); setDragGhost(null); }

  function readDragPayload(dt) {
    if (!dt) return null;
    let raw = "";
    try { raw = dt.getData("application/json") || ""; } catch {}
    if (!raw) { try { raw = dt.getData("text/plain") || ""; } catch {} }
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  function snapTo15(mins) { const m = Math.max(0, Math.min(1439, Math.floor(Number(mins) || 0))); return Math.round(m / 15) * 15; }
  function snapDelta15(mins) { const m = Math.round(Number(mins) || 0); return Math.round(m / 15) * 15; }

  function clampDur(mins) { return Math.max(15, Math.min(24 * 60, Math.round(Number(mins) || 0))); }

  function beginResize(e, kind, b) {
    e.preventDefault();
    e.stopPropagation();
    if (typeof onUpdateTaskTimeAndDuration !== "function") return;
    resizeRef.current = { active: true, kind, taskId: b.taskId, ymd: b.ymd, start0: b.startMins, dur0: b.durationMins, y0: e.clientY };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
  }

  function moveResize(e) {
    if (!resizeRef.current.active) return;
    const r = resizeRef.current;
    const dy = e.clientY - r.y0;
    const deltaMins = snapDelta15((dy / 64) * 60);
    const dayEnd = 24 * 60;

    function getNeighborBounds(taskId, ymd, start0, end0) {
      const arr = Array.isArray(tasksByDate?.[ymd]) ? tasksByDate[ymd] : [];
      const timed = arr.filter((t) => t && String(t.id) !== String(taskId) && t.timeMins != null).map((t) => {
        const s = snapTo15(t.timeMins);
        const d = Math.max(15, snapTo15(t.durationMins || 60));
        return { start: Math.max(0, Math.min(dayEnd, s)), end: Math.max(0, Math.min(dayEnd, s + d)) };
      }).sort((a, b) => a.start - b.start);

      let prevEnd = 0;
      let nextStart = dayEnd;
      for (const b of timed) {
        if (b.end <= start0) prevEnd = Math.max(prevEnd, b.end);
        if (b.start >= end0) { nextStart = Math.min(nextStart, b.start); break; }
      }
      return { prevEnd, nextStart };
    }

    const start0 = r.start0;
    const end0 = r.start0 + r.dur0;
    const bounds = getNeighborBounds(r.taskId, r.ymd, start0, end0);

    if (r.kind === "top") {
      const proposedStart = snapTo15(start0 + deltaMins);
      const minStart = bounds.prevEnd;
      const maxStart = Math.max(minStart, end0 - 15);
      const newStart = Math.max(minStart, Math.min(maxStart, proposedStart));
      const newDur = Math.max(15, end0 - newStart);
      if (typeof onUpdateTaskTimeAndDuration === "function") onUpdateTaskTimeAndDuration(r.taskId, r.ymd, newStart, newDur);
      return;
    }

    if (r.kind === "bottom") {
      const proposedEnd = snapTo15(end0 + deltaMins);
      const minEnd = start0 + 15;
      const maxEnd = bounds.nextStart;
      const newEnd = Math.max(minEnd, Math.min(maxEnd, proposedEnd));
      const newDur = Math.max(15, newEnd - start0);
      if (typeof onUpdateTaskTimeAndDuration === "function") onUpdateTaskTimeAndDuration(r.taskId, r.ymd, start0, newDur);
      return;
    }
  }

  function endResize(e) {
    if (!resizeRef.current.active) return;
    resizeRef.current.active = false;
    resizeRef.current.kind = "";
    resizeRef.current.taskId = "";
    resizeRef.current.ymd = "";
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
  }

  React.useEffect(() => {
    function onMove(e) { try { e.preventDefault(); } catch {} moveTouchDrag(e); }
    function onUp(e) { endTouchDrag(e); }
    if (!touchDragRef.current.active) return;
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  });

  React.useEffect(() => {
    function onMove(e) { try { e.preventDefault(); } catch {} moveResize(e); }
    function onUp(e) { endResize(e); }
    if (!resizeRef.current.active) return;
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [onUpdateTaskTimeAndDuration]);

  function onDropOnGrid(e) {
    e.preventDefault();
    if (typeof onScheduleTask !== "function") return;
    const payload = readDragPayload(e.dataTransfer) || dragPayloadCache;
    const taskId = String(payload?.taskId || "");
    if (!taskId) return;

    const surface = e.currentTarget;
    const rect = surface.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const colW = rect.width / Math.max(1, cols.length);
    const colIdx = Math.max(0, Math.min(cols.length - 1, Math.floor(x / Math.max(1, colW))));
    const targetDay = cols[colIdx];
    const targetYmd = isoYmd(targetDay);

    const mins = snapTo15((y / 64) * 60);
    onScheduleTask(taskId, targetYmd, mins);
    setDragGhost(null);
  }

  function onDragLeaveGrid(e) { setDragGhost(null); }

  function onDragOverGrid(e) {
    e.preventDefault();
    try { e.dataTransfer.dropEffect = "move"; } catch {}
    const payload = readDragPayload(e.dataTransfer) || dragPayloadCache;
    const taskId = String(payload?.taskId || "");
    if (!taskId) { if (dragGhost) setDragGhost(null); return; }
    const surface = e.currentTarget;
    const rect = surface.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const colW = rect.width / Math.max(1, cols.length);
    const colIdx = Math.max(0, Math.min(cols.length - 1, Math.floor(x / Math.max(1, colW))));
    const targetDay = cols[colIdx];
    const targetYmd = isoYmd(targetDay);
    const startMins = snapTo15((y / 64) * 60);
    const dur = clampDur(Number(payload?.durationMins || 60));
    const leftPct = (colIdx / Math.max(1, cols.length)) * 100;
    const widthPct = (1 / Math.max(1, cols.length)) * 100;
    const topPx = (startMins / 60) * 64;
    const heightPx = (dur / 60) * 64;
    if (ghostRafRef.current) cancelAnimationFrame(ghostRafRef.current);
    ghostRafRef.current = requestAnimationFrame(() => { setDragGhost({ taskId, ymd: targetYmd, startMins, durationMins: dur, leftPct, widthPct, topPx, heightPx }); });
  }

  const timedBlocks = useMemo(() => {
    const out = [];
    const colCount = Math.max(1, cols.length);
    for (let c = 0; c < cols.length; c++) {
      const d = cols[c];
      const arr = tasksForDay(d);
      const { timed } = splitAllDayAndTimed(arr);
      const rArr = (view === "day") ? routineForDay(d) : [];
      const { timed: rTimed } = splitAllDayAndTimedRoutines(rArr);
      const leftPct = (c / colCount) * 100;
      const widthPct = (1 / colCount) * 100;

      for (let i = 0; i < timed.length; i++) {
        const t = timed[i];
        const topPx = ((Number(t.timeMins || 0) / 60) * 64);
        const dur = Math.max(15, Math.min(24 * 60, Number(t.durationMins || 60)));
        const heightPx = ((dur / 60) * 64);
        out.push({ key: `${isoYmd(d)}_${t.id}_${i}`, taskId: String(t.id), ymd: isoYmd(d), name: t.name, isComplete: t.isComplete, leftPct, widthPct, topPx, heightPx, startMins: Number(t.timeMins || 0), durationMins: dur });
      }

      for (let j = 0; j < rTimed.length; j++) {
        const rt = rTimed[j];
        const topPx = ((Number(rt.timeMins || 0) / 60) * 64);
        const dur = Math.max(15, Math.min(24 * 60, Number(rt.durationMins || 60)));
        const heightPx = ((dur / 60) * 64);
        out.push({ key: `${isoYmd(d)}_${rt.id}_r_${j}`, taskId: String(rt.id), ymd: isoYmd(d), name: rt.name, isComplete: false, leftPct, widthPct, topPx, heightPx, startMins: Number(rt.timeMins || 0), durationMins: dur, isRoutine: true });
      }
    }
    return out;
  }, [cols, tasksByDate, view, routineBlocksByDate]);

  return (
    <div className={`calTimeInner ${view === "day" ? "calTimeInnerDay" : ""}`}>
      <div className="calTimeHeader">
        <div className="calTimeHeaderGutter" />
        <div className="calTimeHeaderCols" style={{ gridTemplateColumns: `repeat(${cols.length}, 1fr)` }}>
          {cols.map((d) => {
            const isToday = isSameDay(d, today);
            const isSelected = isSameDay(d, selectedDate);
            return (
              <button key={isoYmd(d)} type="button" className={`calTimeHeaderCell ${isToday ? "calCellToday" : ""} ${isSelected ? "calCellSelected" : ""}`} onClick={() => onPickDate(d)}>
                <div className="calTimeHeaderDow">{dowShort(d)}</div>
                <div className="calTimeHeaderDom">{monthName(d.getMonth()).slice(0, 3)} {d.getDate()}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="calAllDayRow">
        <div className="calAllDayGutter">All-day</div>
        <div className="calAllDayCols" style={{ gridTemplateColumns: `repeat(${cols.length}, 1fr)` }}>
          {cols.map((d) => {
            const all = tasksForDay(d);
            const { allDay } = splitAllDayAndTimed(all);
            const key = isoYmd(d);
            return (
              <div
                key={key}
                className="calAllDayCell"
                data-ymd={key}
                onDragOverCapture={(e) => { e.preventDefault(); try { e.dataTransfer.dropEffect = "move"; } catch {} }}
                onDropCapture={(e) => { e.preventDefault(); e.stopPropagation(); if (typeof onUnscheduleTask !== "function") return; const payload = readDragPayload(e.dataTransfer) || dragPayloadCache; const taskId = String(payload?.taskId || ""); if (!taskId) return; onUnscheduleTask(taskId, key); setDragPayloadCache(null); setDragGhost(null); }}
              >
                {allDay.slice(0, 12).map((t, idx) => (
                  <div key={`${key}_ad_${idx}`} className={`calAllDayTask ${t.isComplete ? "calAllDayTaskDone" : ""} ${selectedTask === `${key}:${t.id}` ? "calTaskSelected" : ""}`} title="Click to select. Drag the handle to schedule." onClick={(e) => { e.stopPropagation(); setSelectedTask(`${key}:${t.id}`); }} onMouseEnter={() => setHoverTask(`${key}:${t.id}`)} onMouseLeave={() => setHoverTask((v) => (v === `${key}:${t.id}` ? null : v))}>
                    {(view === "day") ? (() => {
                      const rAll = routineForDay(d);
                      const { allDay: rAllDay } = splitAllDayAndTimedRoutines(rAll);
                      return rAllDay.slice(0, 8).map((rt, ridx) => (
                        <div key={`${key}_rtad_${ridx}`} className="calAllDayTask calAllDayRoutine" title={rt.name}>{rt.name}</div>
                      ));
                    })() : null}
                    <div className="calTaskRow">
                      <div className="calTaskName">{t.name}</div>
                      {((view === "day") ? (selectedTask === `${key}:${t.id}`) : true) ? (
                        <div className="calTaskDragHandle" draggable onDragStart={(e) => onDragStartTask(e, t.id, key, t.durationMins)} onDragEnd={onDragEndTask} onPointerDown={(e) => beginTouchDrag(e, t.id, key, t.durationMins)} aria-label="Drag to move">≡</div>
                      ) : null}
                    </div>
                  </div>
                ))}
                {allDay.length > 12 ? (<div className="calAllDayMore">+{allDay.length - 12} more</div>) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="calTimeScroll" ref={scrollWrapRef}>
        <div className="calTimeGutter calTimeGutterPos">
          {showNowLine ? (<div className="calNowPill" style={{ top: `${nowTopPx}px`, marginTop: "1px" }}>{new Date(nowTs).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}<div className="calNowPillConnector" /></div>) : null}
          {Array.from({ length: 24 }).map((_, h) => (<div key={h} className="calTimeTick"><div className="calTimeTickLabel">{hourLabel(h)}</div></div>))}
        </div>

        <div className="calTimeGridArea" ref={gridAreaRef}>
          <div ref={gridRef} className="calTimeGridSurface" style={{ gridTemplateColumns: `repeat(${cols.length}, 1fr)` }} onDragOver={onDragOverGrid} onDragLeave={onDragLeaveGrid} onDrop={onDropOnGrid}>
            {showNowLine ? <div className="calNowLine" style={{ top: `${nowTopPx}px` }} /> : null}
            {Array.from({ length: 24 }).map((_, h) => (<div key={h} className="calTimeRow"><div className="calTimeHourLine" /><div className="calTimeHalfLine" /></div>))}
            {showVertical ? (<>{Array.from({ length: cols.length - 1 }).map((_, i) => (<div key={i} className="calTimeVLine" style={{ left: `${((i + 1) / cols.length) * 100}%` }} />))}</>) : null}
            {dragGhost ? (<div className="calTimedGhost" style={{ position: "absolute", left: `${dragGhost.leftPct}%`, width: `${dragGhost.widthPct}%`, top: `${dragGhost.topPx}px`, height: `${dragGhost.heightPx}px`, pointerEvents: "none" }} />) : null}
            {timedBlocks.map((b) => {
              const selKey = `${b.ymd}:${b.taskId}`;
              const isSel = selectedTask === selKey;
              const isHover = hoverTask === selKey;

              const isDayView = (view === "day");
              const isTiny = Number(b.durationMins || 60) <= 30;

              // Resize handles: keep your existing behavior (hover/selected), but never for routines.
              const showResizeHandles = (isSel || isHover) && !b.isRoutine;

              // Drag handle rules:
              // - never show for routines
              // - in DAY view: only show when selected
              // - in other views: keep it available (but not required to hover/select)
              const showDragHandle = !b.isRoutine && (isDayView ? isSel : true);

              return (
                <div key={b.key} className={`calTimedTaskWrap ${isSel ? "calTimedTaskWrapSelected" : ""}`} style={{ position: "absolute", left: `${b.leftPct}%`, width: `${b.widthPct}%`, top: `${b.topPx}px`, height: `${b.heightPx}px`, padding: "0px", boxSizing: "border-box", pointerEvents: "auto" }} onClick={(e) => { e.stopPropagation(); setSelectedTask(selKey); }} onMouseEnter={() => setHoverTask(selKey)} onMouseLeave={() => setHoverTask((v) => (v === selKey ? null : v))}>
                  <div className={`calTimedTask ${b.isComplete ? "calTimedTaskDone" : ""} ${b.isRoutine ? "calTimedRoutine" : ""} ${isTiny ? "calTimedTaskTiny" : ""}`} style={{ height: "100%", padding: "6px 8px", boxSizing: "border-box" }}>
                    {showResizeHandles ? (<div className="calResizeHandle calResizeHandleTop" onPointerDown={(e) => beginResize(e, "top", b)} onPointerMove={moveResize} onPointerUp={endResize} onPointerCancel={endResize} title="Drag up to extend earlier">▲</div>) : null}

                    <div className="calTimedTaskRow">
                      <div className="calTimedTaskName">{b.name}</div>
                      {showDragHandle ? (<div className="calTaskDragHandle calTaskDragHandleTimed" draggable onDragStart={(e) => onDragStartTask(e, b.taskId, b.ymd, b.durationMins)} onDragEnd={onDragEndTask} onPointerDown={(e) => beginTouchDrag(e, b.taskId, b.ymd, b.durationMins)} aria-label="Drag to move">≡</div>) : null}
                    </div>

                    {showResizeHandles ? (<div className="calResizeHandle calResizeHandleBottom" onPointerDown={(e) => beginResize(e, "bottom", b)} onPointerMove={moveResize} onPointerUp={endResize} onPointerCancel={endResize} title="Drag down to extend later">▼</div>) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CalendarPage() {
  const nav = useNavigate();
  const today = useMemo(() => startOfDay(new Date()), []);
  const [view, setView] = useState("month");
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
  const [anchorDate, setAnchorDate] = useState(() => startOfMonth(new Date()));
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);

  const visibleMonth = useMemo(() => startOfMonth(anchorDate), [anchorDate]);
  const visibleYear = visibleMonth.getFullYear();
  const visibleMonthIdx = visibleMonth.getMonth();
  const headerLabel = useMemo(() => `${monthName(visibleMonthIdx)} ${visibleYear}`, [visibleMonthIdx, visibleYear]);

  const [dataObj, setDataObj] = useState(() => loadLocalDataJson());
  const tasksByDate = useMemo(() => buildTasksByDate(dataObj), [dataObj]);

  const routineBlocksByDate = useMemo(() => {
    if (view !== "day") return {};
    const { routines, routine_items } = ensureRoutinesDataForCalendar(dataObj);
    const ymd = isoYmd(selectedDate);
    const day = startOfDay(selectedDate);
    const out = {};
    out[ymd] = [];
    for (const r of routines) {
      const rid = String(r?.id || "").trim();
      if (!rid) continue;
      const rtype = String(r?.type || "").trim();
      if (rtype === "class") {
        const items = Array.isArray(routine_items[rid]) ? routine_items[rid] : [];
        for (const it of items) {
          if (!it) continue;
          const id = String(it?.id || "").trim();
          if (!id) continue;
          if (!isDueOnDate(it, day)) continue;
          const name = String(it?.name || "").trim();
          if (!name) continue;
          const tmins = parseHHMMToMins(it?.time);
          const dur = Math.max(15, Math.min(24 * 60, Number(it?.duration_mins ?? 60) || 60));
          out[ymd].push({ id: `class:${rid}:${id}`, name: `Class: ${name}`, timeMins: tmins, durationMins: dur, kind: "class", raw: it, routineId: rid });
        }
      } else {
        const name = String(r?.name || "").trim();
        if (!name) continue;
        const tmins = parseHHMMToMins(r?.start_time);
        const dur = Math.max(15, Math.min(24 * 60, Number(r?.duration_mins ?? 60) || 60));
        out[ymd].push({ id: `routine:${rid}`, name: ` ${name}`, timeMins: tmins, durationMins: dur, kind: "routine", raw: r, routineId: rid });
      }
    }
    out[ymd].sort((a, b) => {
      const aHas = Number(a.timeMins != null);
      const bHas = Number(b.timeMins != null);
      if (aHas !== bHas) return aHas - bHas;
      const at = a.timeMins ?? 999999;
      const bt = b.timeMins ?? 999999;
      return at - bt;
    });
    return out;
  }, [dataObj, view, selectedDate]);

  useEffect(() => { console.log("Calendar dataObj keys:", dataObj ? Object.keys(dataObj) : null); console.log("Calendar tasksByDate sample:", tasksByDate); }, [dataObj, tasksByDate]);

  function resolveTimedPlacement(taskId, ymd, desiredStartMins, desiredDurMins) {
    const dayEnd = 24 * 60;
    function snap15(n) { const m = Math.round(Number(n) || 0); return Math.round(m / 15) * 15; }
    function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
    function overlapLen(a0, a1, b0, b1) { const s = Math.max(a0, b0); const e = Math.min(a1, b1); return Math.max(0, e - s); }
    function intervalDist(g, x) { if (x < g.start) return g.start - x; if (x > g.end) return x - g.end; return 0; }

    let durWanted = clamp(snap15(desiredDurMins || 60), 15, dayEnd);
    let desiredStart = clamp(snap15(desiredStartMins), 0, dayEnd - 15);
    let desiredEnd = clamp(desiredStart + durWanted, 0, dayEnd);

    const others0 = Array.isArray(tasksByDate?.[ymd]) ? tasksByDate[ymd] : [];
    const others = others0.filter((t) => t && String(t.id) !== String(taskId) && t.timeMins != null).map((t) => {
      const s = clamp(snap15(t.timeMins), 0, dayEnd - 15);
      const d = clamp(snap15(t.durationMins || 60), 15, dayEnd);
      return { start: s, end: clamp(s + d, 0, dayEnd) };
    }).sort((a, b) => a.start - b.start);

    const free = [];
    let cursor = 0;
    for (const b of others) {
      const a = clamp(b.start, 0, dayEnd);
      const z = clamp(b.end, 0, dayEnd);
      if (a > cursor) free.push({ start: cursor, end: a });
      cursor = Math.max(cursor, z);
    }
    if (cursor < dayEnd) free.push({ start: cursor, end: dayEnd });

    function fitStartIntoInterval(g, wantStart, durMins) {
      const latest = g.end - durMins;
      if (latest < g.start) return null;
      let s = clamp(wantStart, g.start, latest);
      s = snap15(s);
      s = clamp(s, g.start, latest);
      if ((s + durMins) > g.end) s = snap15(latest);
      s = clamp(s, g.start, latest);
      return s;
    }

    // 1) If full duration fits in any gap, do that (closest to desiredStart).
    const exactCandidates = [];
    for (const g of free) {
      if ((g.end - g.start) < durWanted) continue;
      const s = fitStartIntoInterval(g, desiredStart, durWanted);
      if (s == null) continue;
      exactCandidates.push({ start: s, dist: Math.abs(s - desiredStart) });
    }
    if (exactCandidates.length) {
      exactCandidates.sort((a, b) => a.dist - b.dist);
      const start = clamp(snap15(exactCandidates[0].start), 0, dayEnd - 15);
      const end = clamp(start + durWanted, 0, dayEnd);
      const dur = clamp(snap15(end - start), 15, dayEnd - start);
      return { startMins: start, durationMins: dur };
    }

    // 2) Critical fix: pick the gap that the DRAGGED INTERVAL overlaps the most (even if it can't fit).
    // This is what makes "task -> empty space -> task" snap INTO that middle gap instead of outside.
    const overlapCandidates = [];
    for (const g of free) {
      const glen = g.end - g.start;
      if (glen < 15) continue;
      const ov = overlapLen(desiredStart, desiredEnd, g.start, g.end);
      if (ov < 1) continue;
      overlapCandidates.push({ g, ov, dist: intervalDist(g, desiredStart) });
    }
    if (overlapCandidates.length) {
      overlapCandidates.sort((a, b) => (b.ov - a.ov) || (a.dist - b.dist));
      const g = overlapCandidates[0].g;
      let start = desiredStart;
      if (start < g.start) start = g.start;
      if (start > (g.end - 15)) start = g.end - 15;
      start = clamp(snap15(start), g.start, g.end - 15);
      let dur = Math.min(durWanted, g.end - start);
      dur = clamp(snap15(dur), 15, g.end - start);
      if ((start + dur) > g.end) { start = clamp(snap15(g.end - dur), g.start, g.end - 15); }
      dur = clamp(snap15(Math.min(dur, g.end - start)), 15, g.end - start);
      return { startMins: clamp(start, 0, dayEnd - 15), durationMins: clamp(dur, 15, dayEnd - start) };
    }

    // 3) If no overlap (rare), choose nearest gap anyway and shrink to it.
    const nearestCandidates = [];
    for (const g of free) {
      const glen = g.end - g.start;
      if (glen < 15) continue;
      nearestCandidates.push({ g, dist: intervalDist(g, desiredStart) });
    }
    if (nearestCandidates.length) {
      nearestCandidates.sort((a, b) => a.dist - b.dist);
      const g = nearestCandidates[0].g;
      let start = clamp(desiredStart, g.start, g.end - 15);
      start = clamp(snap15(start), g.start, g.end - 15);
      let dur = Math.min(durWanted, g.end - start);
      dur = clamp(snap15(dur), 15, g.end - start);
      if ((start + dur) > g.end) { start = clamp(snap15(g.end - dur), g.start, g.end - 15); }
      dur = clamp(snap15(Math.min(dur, g.end - start)), 15, g.end - start);
      return { startMins: clamp(start, 0, dayEnd - 15), durationMins: clamp(dur, 15, dayEnd - start) };
    }

    // 4) Last resort: nothing free at all (day is completely full).
    const fallbackStart = clamp(snap15(desiredStart), 0, dayEnd - 15);
    return { startMins: fallbackStart, durationMins: 15 };
  }

  function updateTaskTimeAndDuration(taskId, targetYmd, startMins, durationMins) {
    const ymd0 = String(targetYmd || "").slice(0, 10);
    const placed = resolveTimedPlacement(taskId, ymd0, startMins, durationMins);
    const start = Math.max(0, Math.min(1439, Math.floor(Number(placed.startMins) || 0)));
    const dur = Math.max(15, Math.min(24 * 60, Math.floor(Number(placed.durationMins) || 60)));
    const hh = Math.floor(start / 60);
    const mm = start % 60;
    const hhmm = `${pad2(hh)}:${pad2(mm)}`;
    setDataObj((prev) => {
      const base = (prev && typeof prev === "object") ? { ...prev } : {};
      const keys = (Array.isArray(base.folders) && base.folders.length)
        ? base.folders.map((f) => `folder_${String(f?.id || "").trim()}_tasks`).filter(Boolean)
        : ["folder_1_tasks","folder_2_tasks","folder_3_tasks","folder_4_tasks","folder_5_tasks","folder_6_tasks"];
      let changed = false;
      for (const k of keys) {
        const arr0 = Array.isArray(base[k]) ? base[k] : [];
        let localChanged = false;
        const arr1 = arr0.map((t) => {
          if (!t || typeof t !== "object") return t;
          if (String(t.id || "") !== String(taskId)) return t;
          localChanged = true;
          const t1 = { ...t };
          t1.due_date = ymd0 || String(t1.due_date || "").slice(0, 10);
          t1.time = hhmm;
          t1.duration_mins = dur;
          return t1;
        });
        if (localChanged) { base[k] = arr1; changed = true; }
      }
      if (changed) { try { saveCachedData(base); } catch {} }
      return base;
    });
  }

  function scheduleTaskAtMinutes(taskId, targetYmd, startMins) {
    const ymd = String(targetYmd || "").slice(0, 10);
    const start = Math.max(0, Math.min(1439, Math.floor(Number(startMins) || 0)));
    const existing = (tasksByDate?.[ymd] || []).find((x) => String(x.id) === String(taskId));
    const dur0 = Number(existing?.durationMins || 60);
    const placed = resolveTimedPlacement(taskId, ymd, start, dur0);
    updateTaskTimeAndDuration(taskId, ymd, placed.startMins, placed.durationMins);
  }

  function unscheduleTaskToAllDay(taskId, targetYmd) {
    const ymd = String(targetYmd || "").slice(0, 10);
    setDataObj((prev) => {
      const base = (prev && typeof prev === "object") ? { ...prev } : {};
      const keys = (Array.isArray(base.folders) && base.folders.length)
        ? base.folders.map((f) => `folder_${String(f?.id || "").trim()}_tasks`).filter(Boolean)
        : ["folder_1_tasks","folder_2_tasks","folder_3_tasks","folder_4_tasks","folder_5_tasks","folder_6_tasks"];
      let changed = false;
      for (const k of keys) {
        const arr0 = Array.isArray(base[k]) ? base[k] : [];
        let localChanged = false;
        const arr1 = arr0.map((t) => {
          if (!t || typeof t !== "object") return t;
          if (String(t.id || "") !== String(taskId)) return t;
          localChanged = true;
          const t1 = { ...t };
          t1.due_date = ymd || String(t1.due_date || "").slice(0, 10);
          t1.time = "";
          t1.due_time = "";
          t1.start_time = "";
          t1.scheduled_time = "";
          return t1;
        });
        if (localChanged) { base[k] = arr1; changed = true; }
      }
      if (changed) { try { saveCachedData(base); } catch {} }
      return base;
    });
  }

  useEffect(() => {
    let alive = true;

    async function hydrate() {
      const cached = loadLocalDataJson();
      if (cached && alive) setDataObj(ensureTaskIds(cached));

      const creds = getStoredCopypartyCreds();
      const base = (import.meta.env.VITE_COPYPARTY_BASE || "/cp").trim();

      console.log("hydrate copyparty", { base, creds: !!creds });

      if (!creds) return;
      if (!base) return;

      try {
        const fresh0 = await fetchAndDecryptWebDataJson(base, creds.username, creds.password);
        if (!alive) return;
        const fresh = ensureTaskIds(fresh0);
        const cachedNow = loadLocalDataJson();
        const merged0 = mergeDataPreferLocal(cachedNow, fresh);
        const merged = ensureTaskIds(merged0);
        setDataObj(merged);
        try { saveCachedData(merged); } catch {}
      } catch (e) {
        console.warn("hydrate failed", e);
      }
    }

    hydrate();

    // Refresh when returning to the tab (common when you add/edit tasks then come back)
    function onFocus() { hydrate(); }
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);

    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const [anim, setAnim] = useState(null);
  const tapRef = useRef({ ymd: "", ts: 0 });
  const swipeRef = useRef({ active: false, id: null, sx: 0, sy: 0, st: 0, mx: 0, my: 0 });
  const monthCellProbeRef = useRef(null);
  const monthMaxLines = 3;

  function computeDurationMs(fromSnap, toSnap) {
    const maxMs = 2000;
    const minMs = 240;
    if (!fromSnap || !toSnap) return 420;
    const fromView = fromSnap.view;
    const toView = toSnap.view;
    const fromMonth = startOfMonth(fromSnap.anchorDate);
    const toMonth = startOfMonth(toSnap.anchorDate);
    const fromDay = startOfDay(fromSnap.selectedDate);
    const toDay = startOfDay(toSnap.selectedDate);
    const sameFamily = ((fromView === "month" && toView === "month") || (fromView !== "month" && toView !== "month"));
    if (!sameFamily) return 520;
    if (toView === "month") { const md = Math.abs(monthsDiff(fromMonth, toMonth)); return clampMs(260 + (md * 140), minMs, maxMs); }
    const dd = Math.abs(daysDiff(fromDay, toDay));
    return clampMs(220 + (dd * 45), minMs, maxMs);
  }

  function applySnap(snap) {
    setView(snap.view);
    setSelectedDate(snap.selectedDate);
    setAnchorDate(snap.anchorDate);
  }

  function beginAnimatedTransition(nextSnap, dir) {
    const fromSnap = { view, selectedDate: startOfDay(selectedDate), anchorDate: startOfMonth(anchorDate) };
    const toSnap = { view: nextSnap.view, selectedDate: startOfDay(nextSnap.selectedDate), anchorDate: startOfMonth(nextSnap.anchorDate) };
    const durationMs = computeDurationMs(fromSnap, toSnap);
    const dirSign = (dir === "right" ? -1 : 1);
    setAnim({ dirSign, durationMs, fromSnap, toSnap, phase: "enter" });
    requestAnimationFrame(() => { requestAnimationFrame(() => { setAnim((a) => a ? { ...a, phase: "active" } : a); }); });
  }

  function finishAnim() {
    setAnim((a) => {
      if (!a) return null;
      applySnap(a.toSnap);
      return null;
    });
  }

  function goTodayAnimated() {
    if (view === "month") {
      const vm = startOfMonth(visibleMonth);
      const tm = startOfMonth(today);
      if (vm.getFullYear() === tm.getFullYear() && vm.getMonth() === tm.getMonth()) { setSelectedDate(today); return; }
      const nextSnap = { view, selectedDate: today, anchorDate: startOfMonth(today) };
      const dir = (monthsDiff(vm, tm) >= 0 ? "right" : "left");
      beginAnimatedTransition(nextSnap, dir);
      return;
    }
    if (isSameDay(selectedDate, today)) return;
    const nextSnap = { view, selectedDate: today, anchorDate: startOfMonth(today) };
    const dir = (daysDiff(selectedDate, today) >= 0 ? "right" : "left");
    beginAnimatedTransition(nextSnap, dir);
  }

  function shiftRangeAnimated(dirKey) {
    const step = (dirKey === "left" ? -1 : 1);
    if (view === "day") { const nextSel = addDays(selectedDate, step); beginAnimatedTransition({ view, selectedDate: nextSel, anchorDate: startOfMonth(nextSel) }, dirKey); return; }
    if (view === "schoolWeek" || view === "week") { const nextSel = addDays(selectedDate, step * 7); beginAnimatedTransition({ view, selectedDate: nextSel, anchorDate: startOfMonth(nextSel) }, dirKey); return; }
    if (view === "month") { const nextMonth = addMonths(visibleMonth, step); const nextSel = clampDayToMonth(selectedDate, nextMonth); beginAnimatedTransition({ view, selectedDate: nextSel, anchorDate: startOfMonth(nextMonth) }, dirKey); return; }
  }

  function onPickView(nextView) {
    if (nextView === view) return;
    beginAnimatedTransition({ view: nextView, selectedDate: startOfDay(selectedDate), anchorDate: startOfMonth(selectedDate) }, "right");
  }

  function onPickMonth(mIdx) {
    const nextMonth = new Date(visibleYear, mIdx, 1);
    const nextSel = clampDayToMonth(selectedDate, nextMonth);
    beginAnimatedTransition({ view, selectedDate: nextSel, anchorDate: startOfMonth(nextMonth) }, (mIdx >= visibleMonthIdx ? "right" : "left"));
    setMonthPickerOpen(false);
  }

  const rangeLabel = useMemo(() => {
    if (view === "day") return `${monthName(selectedDate.getMonth())} ${selectedDate.getDate()}, ${selectedDate.getFullYear()}`;
    if (view === "schoolWeek") { const s = startOfWeekMonday(selectedDate); const e = addDays(s, 4); return `School Week: ${monthName(s.getMonth())} ${s.getDate()} - ${monthName(e.getMonth())} ${e.getDate()}, ${e.getFullYear()}`; }
    if (view === "week") { const s = startOfWeekMonday(selectedDate); const e = endOfWeekMonday(selectedDate); return `Week: ${monthName(s.getMonth())} ${s.getDate()} - ${monthName(e.getMonth())} ${e.getDate()}, ${e.getFullYear()}`; }
    return headerLabel;
  }, [view, selectedDate, headerLabel]);

  function getMonthGrid(monthAnchor) {
    const first = startOfMonth(monthAnchor);
    const last = endOfMonth(monthAnchor);
    const gridStart = startOfWeekMonday(first);
    const gridEnd = endOfWeekMonday(last);
    const days = [];
    for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(startOfDay(d));
    return days;
  }

  const monthGrid = useMemo(() => getMonthGrid(visibleMonth), [visibleMonth]);
  const monthWeeks = useMemo(() => Math.ceil(monthGrid.length / 7), [monthGrid]);

  function MonthInner({ snapSelected, snapVisibleMonth }) {
    const snapMonthIdx = snapVisibleMonth.getMonth();
    const snapMonthGrid = getMonthGrid(snapVisibleMonth);
    const snapMonthWeeks = Math.ceil(snapMonthGrid.length / 7);

    return (
      <div className="calMonthInner" style={{ ["--calMonthRows"]: snapMonthWeeks }}>
        <div className="calDowRow">
          <div className="calDow">Mon</div><div className="calDow">Tue</div><div className="calDow">Wed</div><div className="calDow">Thu</div><div className="calDow">Fri</div><div className="calDow">Sat</div><div className="calDow">Sun</div>
        </div>
        <div className="calGrid">
          {snapMonthGrid.map((d, i) => {
            const inMonth = d.getMonth() === snapMonthIdx;
            const isToday0 = isSameDay(d, today);
            const isSelected0 = isSameDay(d, snapSelected);
            const ymd = isoYmd(d);
            const tasks = Array.isArray(tasksByDate[ymd]) ? tasksByDate[ymd] : [];
            const lines = tasks.slice(0, Math.max(1, Number(monthMaxLines || 3)));

            return (
              <button key={ymd} ref={(i === 0) ? monthCellProbeRef : null} className={`calCell calCellMonth ${inMonth ? "" : "calCellMuted"} ${isToday0 ? "calCellToday" : ""} ${isSelected0 ? "calCellSelected" : ""}`} type="button" onClick={() => setSelectedDate(startOfDay(d))} onPointerUp={() => onDayCellTap(d)}>
                <div className="calCellNum">{d.getDate()}</div>
                {lines.length ? (
                  <div className="calCellTasks">
                    {lines.map((t, idx) => (<div key={`${ymd}_l_${idx}`} className={`calCellTaskLine ${t.isComplete ? "calCellTaskDone" : ""}`} title={t.name}>{t.name}</div>))}
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  function onDayCellTap(d) {
    const ymd = isoYmd(d);
    const now = Date.now();
    const last = tapRef.current;
    tapRef.current = { ymd, ts: now };
    setSelectedDate(startOfDay(d));
    if (last.ymd === ymd && (now - last.ts) <= 320) beginAnimatedTransition({ view: "day", selectedDate: startOfDay(d), anchorDate: startOfMonth(d) }, "down");
  }

  function onGesturePointerDown(e) {
    if (anim) return;
    if (e.pointerType !== "touch" && e.pointerType !== "pen") return;
    swipeRef.current.active = true;
    swipeRef.current.id = e.pointerId;
    swipeRef.current.sx = e.clientX;
    swipeRef.current.sy = e.clientY;
    swipeRef.current.mx = e.clientX;
    swipeRef.current.my = e.clientY;
    swipeRef.current.st = Date.now();
  }

  function onGesturePointerMove(e) {
    if (!swipeRef.current.active) return;
    if (swipeRef.current.id !== e.pointerId) return;
    swipeRef.current.mx = e.clientX;
    swipeRef.current.my = e.clientY;
  }

  function onGesturePointerUp(e) {
    if (!swipeRef.current.active) return;
    if (swipeRef.current.id !== e.pointerId) return;
    const sx = swipeRef.current.sx;
    const sy = swipeRef.current.sy;
    const mx = swipeRef.current.mx;
    const my = swipeRef.current.my;
    const dt = Math.max(1, Date.now() - swipeRef.current.st);
    swipeRef.current.active = false;
    swipeRef.current.id = null;

    const dx = mx - sx;
    const dy = my - sy;
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);

    if (adx < 60) return;
    if (adx < (ady * 1.2)) return;
    if (dt > 900) return;

    if (dx < 0) shiftRangeAnimated("right");
    if (dx > 0) shiftRangeAnimated("left");
  }

  function onAnimTransitionEnd(e) {
    if (!anim) return;
    if (!e || !e.target) return;
    if (!String(e.target.className || "").includes("calAnimPane")) return;
    finishAnim();
  }

  const fromPaneStyle = useMemo(() => {
    if (!anim) return {};
    const dur = `${anim.durationMs}ms`;
    const ease = "cubic-bezier(0.20, 0.80, 0.20, 1.00)";
    const tx = (anim.phase === "active" ? `${anim.dirSign * 100}%` : "0%");
    return { transition: `transform ${dur} ${ease}`, transform: `translate3d(${tx}, 0, 0)` };
  }, [anim]);

  const toPaneStyle = useMemo(() => {
    if (!anim) return {};
    const dur = `${anim.durationMs}ms`;
    const ease = "cubic-bezier(0.20, 0.80, 0.20, 1.00)";
    const startX = `${anim.dirSign * -100}%`;
    const tx = (anim.phase === "active" ? "0%" : startX);
    return { transition: `transform ${dur} ${ease}`, transform: `translate3d(${tx}, 0, 0)` };
  }, [anim]);

  const panelIsMonth = (view === "month");
  const panelShellClass = panelIsMonth ? "calMonthView" : "calMonthView calTimeView";

  return (
    <div className="pageWrap calendarWrap">
      <div className="calTopRow">
        <button className="calBtn calBtnPrimary" onClick={() => nav("/tasks")} type="button">Add Task</button>
        <div className="calViewGroup">
          <button className={`calBtn ${view === "day" ? "calBtnActive" : ""}`} onClick={() => onPickView("day")} type="button">Day</button>
          <button className={`calBtn calHideMobile ${view === "schoolWeek" ? "calBtnActive" : ""}`} onClick={() => onPickView("schoolWeek")} type="button">Work Week</button>
          <button className={`calBtn calHideMobile ${view === "week" ? "calBtnActive" : ""}`} onClick={() => onPickView("week")} type="button">Week</button>
          <button className={`calBtn ${view === "month" ? "calBtnActive" : ""}`} onClick={() => onPickView("month")} type="button">Month</button>
        </div>
      </div>

      <div className="calSecondRow">
        <button className="calBtn" onClick={goTodayAnimated} type="button">Today</button>
        <div className="calArrowGroup">
          <button className="calBtn calArrow" onClick={() => shiftRangeAnimated("left")} type="button" aria-label="Previous">←</button>
          <button className="calBtn calArrow" onClick={() => shiftRangeAnimated("right")} type="button" aria-label="Next">→</button>
        </div>
        <div className="calMonthPickerWrap">
          <button className="calBtn calMonthBtn" onClick={() => setMonthPickerOpen((v) => !v)} type="button">{rangeLabel}</button>
          {monthPickerOpen ? (
            <div className="calMonthPopover" role="dialog" aria-label="Pick a month">
              <div className="calMonthPopoverHeader">{visibleYear}</div>
              <div className="calMonthGrid">
                {Array.from({ length: 12 }).map((_, i) => (<button key={i} className={`calMonthCell ${i === visibleMonthIdx ? "calMonthCellActive" : ""}`} onClick={() => onPickMonth(i)} type="button">{monthName(i).slice(0, 3)}</button>))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="calBody calGestureSurface" onPointerDown={onGesturePointerDown} onPointerMove={onGesturePointerMove} onPointerUp={onGesturePointerUp} onPointerCancel={onGesturePointerUp}>
        <div className={panelShellClass} style={panelIsMonth ? { ["--calMonthRows"]: monthWeeks } : undefined}>
          {anim ? (
            <div className="calAnimStage">
              <div className="calAnimPane" style={fromPaneStyle}>
                {anim.fromSnap.view === "month" ? (
                  <MonthInner snapSelected={anim.fromSnap.selectedDate} snapVisibleMonth={startOfMonth(anim.fromSnap.anchorDate)} />
                ) : (
                  <TimeGridInner view={anim.fromSnap.view} selectedDate={anim.fromSnap.selectedDate} onPickDate={(d) => setSelectedDate(startOfDay(d))} tasksByDate={tasksByDate} routineBlocksByDate={(anim.fromSnap.view === "day") ? routineBlocksByDate : {}} onScheduleTask={scheduleTaskAtMinutes} onUnscheduleTask={unscheduleTaskToAllDay} onUpdateTaskTimeAndDuration={updateTaskTimeAndDuration} />
                )}
              </div>
              <div className="calAnimPane" style={toPaneStyle} onTransitionEnd={onAnimTransitionEnd}>
                {anim.toSnap.view === "month" ? (
                  <MonthInner snapSelected={anim.toSnap.selectedDate} snapVisibleMonth={startOfMonth(anim.toSnap.anchorDate)} />
                ) : (
                  <TimeGridInner view={anim.toSnap.view} selectedDate={anim.toSnap.selectedDate} onPickDate={(d) => setSelectedDate(startOfDay(d))} tasksByDate={tasksByDate} routineBlocksByDate={(anim.toSnap.view === "day") ? routineBlocksByDate : {}} onScheduleTask={scheduleTaskAtMinutes} onUnscheduleTask={unscheduleTaskToAllDay} onUpdateTaskTimeAndDuration={updateTaskTimeAndDuration} />
                )}
              </div>
            </div>
          ) : (
            (view === "month") ? (
              <MonthInner snapSelected={selectedDate} snapVisibleMonth={visibleMonth} />
            ) : (
              <TimeGridInner view={view} selectedDate={selectedDate} onPickDate={(d) => setSelectedDate(startOfDay(d))} tasksByDate={tasksByDate} routineBlocksByDate={(view === "day") ? routineBlocksByDate : {}} onScheduleTask={scheduleTaskAtMinutes} onUnscheduleTask={unscheduleTaskToAllDay} onUpdateTaskTimeAndDuration={updateTaskTimeAndDuration} />
            )
          )}
        </div>
      </div>
    </div>
  );
}
