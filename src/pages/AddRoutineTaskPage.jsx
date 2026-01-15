// src/pages/AddRoutineTaskPage.jsx
import React from "react";
import { loadCachedData, saveCachedData } from "../copypartySync";

function newId(prefix) { return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`; }
function startOfToday() { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }

function ensureRoutinesData(obj) {
  const o = (obj && typeof obj === "object") ? { ...obj } : {};
  if (!Array.isArray(o.routines)) o.routines = [];
  if (!o.routine_items || typeof o.routine_items !== "object") o.routine_items = {};
  if (!o.routine_completions || typeof o.routine_completions !== "object") o.routine_completions = {};
  if (!Array.isArray(o.classes)) o.classes = [];
  return o;
}

function parseHhMm(s) {
  const t = String(s || "").trim();
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hh = Number(m[1]); const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function parseMins(n, fallback) {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(0, Math.round(x));
}

function RecurrenceEditor({ value, onChange }) {
  const today = startOfToday();
  const [kind, setKind] = React.useState(() => String(value?.kind || "every_n_days"));
  const [nDays, setNDays] = React.useState(() => Number(value?.n ?? 1) || 1);
  const [startWeekday, setStartWeekday] = React.useState(() => Number(value?.start_weekday ?? today.getDay()));
  const [weekdays, setWeekdays] = React.useState(() => Array.isArray(value?.weekdays) ? value.weekdays.map((x) => Number(x)) : [today.getDay()]);

  React.useEffect(() => {
    if (kind === "daily") return onChange({ kind: "daily" });
    if (kind === "weekly") return onChange({ kind: "weekly", weekdays: (weekdays && weekdays.length ? weekdays : [today.getDay()]) });
    const n = Math.max(1, Number(nDays) || 1);
    const sw = Number.isFinite(Number(startWeekday)) ? Number(startWeekday) : today.getDay();
    return onChange({ kind: "every_n_days", n, start_weekday: sw });
  }, [kind, nDays, startWeekday, weekdays]);

  function toggleWeekday(d) {
    const cur = Array.isArray(weekdays) ? [...weekdays] : [];
    const has = cur.includes(d);
    const next = has ? cur.filter((x) => x !== d) : [...cur, d];
    next.sort((a, b) => a - b);
    setWeekdays(next.length ? next : [today.getDay()]);
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button type="button" className={`primaryBtn ${kind === "daily" ? "isActivePill" : ""}`} onClick={() => setKind("daily")}>Daily</button>
        <button type="button" className={`primaryBtn ${kind === "every_n_days" ? "isActivePill" : ""}`} onClick={() => setKind("every_n_days")}>Every N Days</button>
        <button type="button" className={`primaryBtn ${kind === "weekly" ? "isActivePill" : ""}`} onClick={() => setKind("weekly")}>Weekly</button>
      </div>

      {kind === "every_n_days" ? (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <label style={{ display: "grid", gap: 4, fontWeight: 900, fontSize: 12, opacity: 0.95 }}>
            Every N days
            <input value={String(nDays)} onChange={(e) => setNDays(parseMins(e.target.value, 1))} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.20)", background: "rgba(255,255,255,0.10)", color: "white", fontWeight: 900, width: 140 }} />
          </label>

          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontWeight: 900, fontSize: 12, opacity: 0.95 }}>Start weekday (this week)</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((lab, i) => (
                <button key={`sw_${i}`} type="button" className={`primaryBtn ${Number(startWeekday) === i ? "isActivePill" : ""}`} onClick={() => setStartWeekday(i)}>{lab}</button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {kind === "weekly" ? (
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ fontWeight: 900, fontSize: 12, opacity: 0.95 }}>Weekdays</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((lab, i) => (
              <button key={`wd_${i}`} type="button" className={`primaryBtn ${weekdays.includes(i) ? "isActivePill" : ""}`} onClick={() => toggleWeekday(i)}>{lab}</button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function AddRoutineTaskPage({ routine, routineId, onCancel, onSaved }) {
  const today = startOfToday();
  const rType = String(routine?.type || "custom");

  const [name, setName] = React.useState("");
  const [spoonCost, setSpoonCost] = React.useState(0);

  const [time, setTime] = React.useState("17:00");
  const [durationMins, setDurationMins] = React.useState(10);

const [weekdays, setWeekdays] = React.useState([today.getDay()]);
  const [classStart, setClassStart] = React.useState("09:00");
  const [classEnd, setClassEnd] = React.useState("10:00");

  const [recur, setRecur] = React.useState({ kind: "every_n_days", n: 1, start_weekday: today.getDay() });
  const [error, setError] = React.useState("");

  function toggleClassWeekday(i) {
    const cur = Array.isArray(weekdays) ? [...weekdays] : [];
    const has = cur.includes(i);
    const next = has ? cur.filter((x) => x !== i) : [...cur, i];
    next.sort((a, b) => a - b);
    setWeekdays(next.length ? next : [today.getDay()]);
  }

  function saveItem() {
    setError("");
    const nm = String(name || "").trim();
    if (!nm) return setError("Task name is required.");
    const sc = Math.max(0, Number(spoonCost) || 0);

    const d0 = ensureRoutinesData(loadCachedData());

    if (rType === "class") {
      const st = parseHhMm(classStart);
      const en = parseHhMm(classEnd);
      if (!st) return setError("Class start time must be HH:MM.");
      if (!en) return setError("Class end time must be HH:MM.");
      const wds = (Array.isArray(weekdays) ? weekdays : []).map((x) => Number(x)).filter((x) => Number.isFinite(x) && x >= 0 && x <= 6);
      const uniqWds = Array.from(new Set(wds)).sort((a, b) => a - b);
      if (!uniqWds.length) return setError("Pick at least one weekday.");

      const stM = parseHhMm(st) ? (Number(st.slice(0, 2)) * 60 + Number(st.slice(3, 5))) : null;
      const enM = parseHhMm(en) ? (Number(en.slice(0, 2)) * 60 + Number(en.slice(3, 5))) : null;
      if (stM == null || enM == null) return setError("Class times invalid.");
      const dur = enM - stM;
      if (dur <= 0) return setError("Class end time must be after start time.");

      if (!d0.routine_items[routineId]) d0.routine_items[routineId] = [];
      const arr = Array.isArray(d0.routine_items[routineId]) ? [...d0.routine_items[routineId]] : [];
      const nextOrder = (arr.reduce((m, x) => Math.max(m, Number(x?.order || 0)), 0) || 0) + 100;

      const item = {
        id: newId("ri"),
        name: nm,
        spoon_cost: sc,
        order: nextOrder,
        time: st,
        duration_mins: dur,
        recur: { kind: "weekly", weekdays: uniqWds },
        start_time: st,
        end_time: en,
        weekdays: uniqWds,
      };

      arr.push(item);
      d0.routine_items[routineId] = arr;

      d0._local_updated_at = Date.now();
      saveCachedData(d0);
      if (onSaved) onSaved(d0);
      return;
    }

    const item = { id: newId("ri"), name: nm, spoon_cost: sc, order: 0, recur: recur };

    if (rType === "custom") {
      const tm = parseHhMm(time);
      if (!tm) return setError("Time must be HH:MM.");
      item.time = tm;
      item.duration_mins = parseMins(durationMins, 10);
    }

    if (!d0.routine_items[routineId]) d0.routine_items[routineId] = [];
    const arr = Array.isArray(d0.routine_items[routineId]) ? [...d0.routine_items[routineId]] : [];
    const nextOrder = (arr.reduce((m, x) => Math.max(m, Number(x?.order || 0)), 0) || 0) + 100;
    item.order = nextOrder;
    arr.push(item);
    d0.routine_items[routineId] = arr;

    d0._local_updated_at = Date.now();
    saveCachedData(d0);
    if (onSaved) onSaved(d0);
  }

  return (
    <div className="pageWrap">
      <div style={{ display: "grid", gap: 14, width: "100%" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button type="button" onClick={onCancel} style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(0,0,0,0.12)", color: "rgba(255,255,255,0.95)", fontWeight: 950, cursor: "pointer" }}>← Back</button>
            <div style={{ fontWeight: 1000, fontSize: 20 }}>Add {rType === "class" ? "Class" : "Routine Task"}</div>
          </div>
        </div>

        {error ? <div className="authError">{error}</div> : null}

        <div style={{ borderRadius: 14, padding: 14, background: "rgba(0,0,0,0.10)", border: "1px solid rgba(255,255,255,0.14)", maxWidth: 980, display: "grid", gap: 12 }}>
          <label style={{ display: "grid", gap: 6, fontWeight: 900 }}>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.20)", background: "rgba(255,255,255,0.10)", color: "white", fontWeight: 900 }} />
          </label>

          <label style={{ display: "grid", gap: 6, fontWeight: 900 }}>
            Spoon cost (can be 0)
            <input value={String(spoonCost)} onChange={(e) => setSpoonCost(parseMins(e.target.value, 0))} style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.20)", background: "rgba(255,255,255,0.10)", color: "white", fontWeight: 900, width: 180 }} />
          </label>

          {rType === "custom" ? (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <label style={{ display: "grid", gap: 6, fontWeight: 900 }}>
                Time (HH:MM)
                <input value={time} onChange={(e) => setTime(e.target.value)} style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.20)", background: "rgba(255,255,255,0.10)", color: "white", fontWeight: 900, width: 160 }} />
              </label>

              <label style={{ display: "grid", gap: 6, fontWeight: 900 }}>
                Duration (mins)
                <input value={String(durationMins)} onChange={(e) => setDurationMins(parseMins(e.target.value, 10))} style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.20)", background: "rgba(255,255,255,0.10)", color: "white", fontWeight: 900, width: 160 }} />
              </label>
            </div>
          ) : null}

          {rType === "class" ? (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ fontWeight: 1000, opacity: 0.95 }}>Weekdays</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((lab, i) => (
                  <button key={`c_wd_${i}`} type="button" className={`primaryBtn ${weekdays.includes(i) ? "isActivePill" : ""}`} onClick={() => toggleClassWeekday(i)}>{lab}</button>
                ))}
              </div>

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                <label style={{ display: "grid", gap: 6, fontWeight: 900 }}>
                  Class start (HH:MM)
                  <input value={classStart} onChange={(e) => setClassStart(e.target.value)} style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.20)", background: "rgba(255,255,255,0.10)", color: "white", fontWeight: 900, width: 180 }} />
                </label>

                <label style={{ display: "grid", gap: 6, fontWeight: 900 }}>
                  Class end (HH:MM)
                  <input value={classEnd} onChange={(e) => setClassEnd(e.target.value)} style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.20)", background: "rgba(255,255,255,0.10)", color: "white", fontWeight: 900, width: 180 }} />
                </label>
              </div>
            </div>
          ) : null}

          {rType !== "class" ? (
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontWeight: 1000, opacity: 0.95 }}>Recurrence</div>
              <RecurrenceEditor value={recur} onChange={setRecur} />
            </div>
          ) : null}

          <button type="button" className="primaryBtn" onClick={saveItem} style={{ fontWeight: 1000, padding: "12px 14px", borderRadius: 12 }}>Add</button>
        </div>
      </div>
    </div>
  );
}
