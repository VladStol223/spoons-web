// src/pages/InputTasksPage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { loadCachedData, saveCachedData } from "../copypartySync";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function pad2(n) { return String(n).padStart(2, "0"); }
function isoYmd(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function daysInMonth(year, month1to12) { return new Date(year, month1to12, 0).getDate(); }
function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

function nowYear() { return new Date().getFullYear(); }
function nowHhMm() { const n = new Date(); return { hh: n.getHours(), mm: n.getMinutes() }; }

function computeDueInfo(month1to12, day) {
  const today = new Date();
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const oneMonthAgo = new Date(todayDate); oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);

  let proposed;
  try { proposed = new Date(todayDate.getFullYear(), month1to12 - 1, day); } catch { return { line1: "", line2: "" }; }

  let dueDt;
  if (proposed >= oneMonthAgo && proposed <= todayDate) dueDt = proposed;
  else if (proposed < oneMonthAgo) dueDt = new Date(todayDate.getFullYear() + 1, month1to12 - 1, day);
  else dueDt = (proposed >= todayDate) ? proposed : new Date(todayDate.getFullYear() + 1, month1to12 - 1, day);

  const deltaDays = Math.round((dueDt.getTime() - todayDate.getTime()) / 86400000);

  let line1 = "";
  if (deltaDays < 0) line1 = "Overdue";
  else if (deltaDays === 0) line1 = "Due today";
  else if (deltaDays === 1) line1 = "Due 1 day";
  else line1 = `Due ${deltaDays} days`;

  const line2 = dueDt.toLocaleDateString([], { weekday: "long" });
  return { line1, line2, dueYmd: isoYmd(dueDt) };
}

function ensureDataShape(obj) {
  const o = (obj && typeof obj === "object") ? { ...obj } : {};
  for (let i = 1; i <= 6; i++) { const k = `folder_${i}_tasks`; if (!Array.isArray(o[k])) o[k] = []; }
  if (!Number.isFinite(Number(o.spoons))) o.spoons = 0;
  if (!o.rest_spoons || typeof o.rest_spoons !== "object") o.rest_spoons = { short: 1, half: 2, full: 3 };
  return o;
}

function folderKeyToIndex(folderKey) {
  const map = { homework: 1, chores: 2, work: 3, misc: 4, exams: 5, projects: 6 };
  return map[folderKey] || 1;
}

function stepTime15(hh, mm, dir) {
  hh = clamp(Number(hh) || 0, 0, 23);
  mm = clamp(Number(mm) || 0, 0, 59);
  const total = (hh * 60) + mm;
  const next = clamp(total + (dir * 15), 0, (23 * 60) + 59);
  const nh = Math.floor(next / 60);
  const nm = next % 60;
  return { hh: nh, mm: nm };
}

function parseTimeText(text, fallbackHhMm) {
  const t = String(text || "").trim();
  if (!t) return fallbackHhMm;
  const m = t.match(/^(\d{1,2})\s*:?\s*(\d{2})?$/);
  if (!m) return fallbackHhMm;
  const hh = clamp(Number(m[1]), 0, 23);
  const mm = clamp(Number(m[2] ?? 0), 0, 59);
  return { hh, mm };
}

export default function InputTasksPage() {
  const [folder, setFolder] = useState("homework");

  const [taskName, setTaskName] = useState("");
  const [desc, setDesc] = useState("");
  const [spoons, setSpoons] = useState("");

  const today = useMemo(() => new Date(), []);
  const [monthIdx0, setMonthIdx0] = useState(today.getMonth());
  const [dayNum, setDayNum] = useState(today.getDate());

  const [descriptionToggle, setDescriptionToggle] = useState(false);
  const [timeToggle, setTimeToggle] = useState(false);
  const [recurringToggle, setRecurringToggle] = useState(false);

  const [timeText, setTimeText] = useState(() => {
    const { hh, mm } = nowHhMm();
    return `${pad2(hh)}:${pad2(mm)}`;
  });

  const [howOftenDays, setHowOftenDays] = useState(1);
  const [howLongWeeks, setHowLongWeeks] = useState(1);
  const [reps, setReps] = useState(1);

  const [flashTask, setFlashTask] = useState(false);
  const [flashSpoons, setFlashSpoons] = useState(false);

  const taskRef = useRef(null);
  const spoonsRef = useRef(null);
  const descRef = useRef(null);
  const monthRef = useRef(null);
  const dayRef = useRef(null);
  const timeRef = useRef(null);
  const oftenRef = useRef(null);
  const longRef = useRef(null);
  const repsRef = useRef(null);

  const maxDays = useMemo(() => daysInMonth(nowYear(), monthIdx0 + 1), [monthIdx0]);
  useEffect(() => { setDayNum((d) => clamp(d, 1, maxDays)); }, [maxDays]);

  const duePreview = useMemo(() => computeDueInfo(monthIdx0 + 1, dayNum), [monthIdx0, dayNum]);

  function syncRecurringFromOftenReps(nextOften, nextReps) {
    const totalDays = ((nextReps - 1) * nextOften) + 1;
    const nextWeeks = Math.max(1, Math.ceil(totalDays / 7));
    setHowLongWeeks(nextWeeks);
  }

  function syncRecurringFromWeeksOften(nextWeeks, nextOften) {
    const totalDays = nextWeeks * 7;
    const nextReps = Math.floor((totalDays - 1) / nextOften) + 1;
    setReps(clamp(nextReps, 1, 26));
  }

  function validate() {
    const nameOk = String(taskName || "").trim().length > 0;
    const spoonsOk = /^\d+$/.test(String(spoons || "").trim()) && Number(spoons) > 0;
    if (!nameOk) { setFlashTask(true); setTimeout(() => setFlashTask(false), 280); }
    if (!spoonsOk) { setFlashSpoons(true); setTimeout(() => setFlashSpoons(false), 280); }
    return nameOk && spoonsOk;
  }

  function clearAndFocus() {
    setTaskName("");
    setDesc("");
    setSpoons("");
    setTimeout(() => { if (taskRef.current) taskRef.current.focus(); }, 0);
  }

  function addTask() {
    if (!validate()) return;

    const data0 = ensureDataShape(loadCachedData());
    const folderIdx = folderKeyToIndex(folder);
    const listKey = `folder_${folderIdx}_tasks`;

    const { dueYmd } = duePreview;
    const spoonsNeeded = Number(String(spoons).trim());

    const t0 = { id: `t_${Date.now()}_${Math.random().toString(16).slice(2)}`, task_name: String(taskName).trim(), description: String(desc || "").trim(), spoons_needed: spoonsNeeded, done: 0, due_date: dueYmd };

    if (timeToggle) { const parsed = parseTimeText(timeText, nowHhMm()); t0.time = `${pad2(parsed.hh)}:${pad2(parsed.mm)}`; }

    const toPush = [];
    if (recurringToggle) {
      const base = new Date(dueYmd + "T00:00:00");
      for (let i = 0; i < reps; i++) { const dt = new Date(base); dt.setDate(dt.getDate() + (i * howOftenDays)); const ymd = isoYmd(dt); toPush.push({ ...t0, id: `${t0.id}_r${i+1}`, due_date: ymd }); }
    } else {
      toPush.push(t0);
    }

    data0[listKey] = [...data0[listKey], ...toPush];
    saveCachedData(data0);

    clearAndFocus();
  }

  function onKeyDownGlobal(e) {
    if (e.key === "Enter") {
      const tag = String(e.target?.tagName || "").toLowerCase();
      const isTextarea = tag === "textarea";
      if (isTextarea) return;
      e.preventDefault();
      addTask();
    }

    if (e.key === "Tab") {
      const order = [];
      order.push(taskRef);
      if (descriptionToggle) order.push(descRef);
      order.push(monthRef);
      order.push(dayRef);
      if (timeToggle) order.push(timeRef);
      order.push(spoonsRef);
      if (recurringToggle) { order.push(oftenRef, longRef, repsRef); }

      const els = order.map((r) => r.current).filter(Boolean);
      if (!els.length) return;

      const active = document.activeElement;
      const idx = els.findIndex((el) => el === active);
      const step = e.shiftKey ? -1 : 1;
      const nextIdx = idx >= 0 ? (idx + step + els.length) % els.length : 0;

      e.preventDefault();
      els[nextIdx].focus();
    }
  }

  useEffect(() => {
    if (taskRef.current) taskRef.current.focus();
    window.addEventListener("keydown", onKeyDownGlobal, true);
    return () => window.removeEventListener("keydown", onKeyDownGlobal, true);
  }, [descriptionToggle, timeToggle, recurringToggle, taskName, spoons, timeText, monthIdx0, dayNum, howOftenDays, howLongWeeks, reps]);

  const folders = [
    { key: "homework", label: "Homework" },
    { key: "chores", label: "Chores" },
    { key: "work", label: "Work" },
    { key: "misc", label: "Misc" },
    { key: "exams", label: "Exams" },
    { key: "projects", label: "Projects" },
  ];

  return (
    <div className="pageWrap">
      <div style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>
        <div style={{ width: 180 }}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Folders</div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {folders.map((f) => (
              <button key={f.key} type="button" onClick={() => setFolder(f.key)} style={{ textAlign: "left", padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.15)", background: (folder === f.key) ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)", fontWeight: 700 }}>
                {f.label}
              </button>
            ))}
          </div>

          <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 10 }}>
            <button type="button" onClick={() => setDescriptionToggle((v) => !v)} style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.15)", background: descriptionToggle ? "rgba(0,255,0,0.12)" : "rgba(255,255,255,0.06)", fontWeight: 800 }}>Description</button>
            <button type="button" onClick={() => setTimeToggle((v) => !v)} style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.15)", background: timeToggle ? "rgba(0,255,0,0.12)" : "rgba(255,255,255,0.06)", fontWeight: 800 }}>Start Time</button>
            <button type="button" onClick={() => setRecurringToggle((v) => !v)} style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.15)", background: recurringToggle ? "rgba(0,255,0,0.12)" : "rgba(255,255,255,0.06)", fontWeight: 800 }}>Recurring</button>
          </div>
        </div>

        <div style={{ flex: 1, maxWidth: 720 }}>
          <h1 style={{ marginTop: 0 }}>Input Tasks</h1>

          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
            <div>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>Task Name</div>
              <input ref={taskRef} value={taskName} onChange={(e) => setTaskName(e.target.value)} placeholder="Enter task name..." style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: flashTask ? "2px solid rgba(255,80,80,0.9)" : "1px solid rgba(255,255,255,0.18)", outline: "none", background: "rgba(255,255,255,0.06)", fontWeight: 700 }} />
            </div>

            {descriptionToggle ? (
              <div>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Description</div>
                <textarea ref={descRef} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Optional description..." rows={4} style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.18)", outline: "none", background: "rgba(255,255,255,0.06)", fontWeight: 600, resize: "vertical" }} />
              </div>
            ) : null}

            <div style={{ display: "grid", gridTemplateColumns: timeToggle ? "1fr 1fr 1fr" : "1fr 1fr", gap: 12, alignItems: "end" }}>
              <div>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Month</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" onClick={() => setMonthIdx0((m) => (m + 11) % 12)} style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.06)" }}>−</button>
                  <input ref={monthRef} value={MONTHS[monthIdx0]} readOnly style={{ flex: 1, padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.06)", fontWeight: 800 }} />
                  <button type="button" onClick={() => setMonthIdx0((m) => (m + 1) % 12)} style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.06)" }}>+</button>
                </div>
              </div>

              <div>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Day</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" onClick={() => setDayNum((d) => (d <= 1 ? maxDays : d - 1))} style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.06)" }}>−</button>
                  <input ref={dayRef} value={String(dayNum)} readOnly style={{ flex: 1, padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.06)", fontWeight: 800, textAlign: "center" }} />
                  <button type="button" onClick={() => setDayNum((d) => (d >= maxDays ? 1 : d + 1))} style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.06)" }}>+</button>
                </div>
              </div>

              {timeToggle ? (
                <div>
                  <div style={{ fontWeight: 800, marginBottom: 6 }}>Start Time</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" onClick={() => { const parsed = parseTimeText(timeText, nowHhMm()); const next = stepTime15(parsed.hh, parsed.mm, -1); setTimeText(`${pad2(next.hh)}:${pad2(next.mm)}`); }} style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.06)" }}>−15</button>
                    <input ref={timeRef} value={timeText} onChange={(e) => setTimeText(e.target.value)} placeholder="HH:MM" style={{ flex: 1, padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.06)", fontWeight: 800, textAlign: "center" }} />
                    <button type="button" onClick={() => { const parsed = parseTimeText(timeText, nowHhMm()); const next = stepTime15(parsed.hh, parsed.mm, 1); setTimeText(`${pad2(next.hh)}:${pad2(next.mm)}`); }} style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.06)" }}>+15</button>
                  </div>
                </div>
              ) : null}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: recurringToggle ? "160px 1fr" : "160px", gap: 12, alignItems: "end" }}>
              <div>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Spoons</div>
                <input ref={spoonsRef} value={spoons} onChange={(e) => setSpoons(e.target.value.replace(/[^\d]/g, ""))} placeholder="0" style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: flashSpoons ? "2px solid rgba(255,80,80,0.9)" : "1px solid rgba(255,255,255,0.18)", outline: "none", background: "rgba(255,255,255,0.06)", fontWeight: 800, textAlign: "center" }} />
              </div>

              {recurringToggle ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 800, marginBottom: 6 }}>How Often (days)</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button type="button" onClick={() => { const next = Math.max(1, howOftenDays - 1); setHowOftenDays(next); syncRecurringFromOftenReps(next, reps); }} style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.06)" }}>−</button>
                      <input ref={oftenRef} value={String(howOftenDays)} readOnly style={{ flex: 1, padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.06)", fontWeight: 800, textAlign: "center" }} />
                      <button type="button" onClick={() => { const next = howOftenDays + 1; setHowOftenDays(next); syncRecurringFromOftenReps(next, reps); }} style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.06)" }}>+</button>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontWeight: 800, marginBottom: 6 }}>How Long (weeks)</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button type="button" onClick={() => { const next = Math.max(1, howLongWeeks - 1); setHowLongWeeks(next); syncRecurringFromWeeksOften(next, howOftenDays); }} style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.06)" }}>−</button>
                      <input ref={longRef} value={String(howLongWeeks)} readOnly style={{ flex: 1, padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.06)", fontWeight: 800, textAlign: "center" }} />
                      <button type="button" onClick={() => { const next = howLongWeeks + 1; setHowLongWeeks(next); syncRecurringFromWeeksOften(next, howOftenDays); }} style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.06)" }}>+</button>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontWeight: 800, marginBottom: 6 }}>Repetitions</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button type="button" onClick={() => { const next = clamp(reps - 1, 1, 26); setReps(next); syncRecurringFromOftenReps(howOftenDays, next); }} style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.06)" }}>−</button>
                      <input ref={repsRef} value={String(reps)} readOnly style={{ flex: 1, padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.06)", fontWeight: 800, textAlign: "center" }} />
                      <button type="button" onClick={() => { const next = clamp(reps + 1, 1, 26); setReps(next); syncRecurringFromOftenReps(howOftenDays, next); }} style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.06)" }}>+</button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 4 }}>
              <div style={{ opacity: 0.9, fontWeight: 700 }}>
                <div>{duePreview.line1}</div>
                <div>{duePreview.line2}</div>
              </div>

              <button type="button" onClick={addTask} style={{ padding: "12px 16px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.14)", fontWeight: 900, minWidth: 140 }}>Add Task</button>
            </div>

            <div style={{ opacity: 0.7, fontSize: 13, marginTop: 6 }}>
              - Enter adds task (except inside Description)<br />
              - Tab cycles fields (Shift+Tab backwards)<br />
              - Saved to localStorage via <code>spoonsDataCache</code> (copypartySync)<br />
              - Marked dirty for Copyparty auto-sync
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
