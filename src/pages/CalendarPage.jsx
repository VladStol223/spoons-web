import React, { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

function pad2(n) { return String(n).padStart(2, "0"); }
function isoYmd(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function isSameDay(a, b) { return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function addMonths(d, n) { const x = new Date(d.getFullYear(), d.getMonth() + n, 1); return x; }
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

function safeParseJson(s) { try { return JSON.parse(s); } catch { return null; } }
function parseDueYmd(due) { if (!due) return null; if (typeof due === "string") return due.slice(0, 10); if (due instanceof Date) return isoYmd(due); return null; }
function isCompleteTask(t) { const need = Number(t?.spoons_needed || 0); const done = Number(t?.done || 0); return need > 0 && done >= need; }
function taskName(t) { return String(t?.task_name || "").trim(); }

function loadLocalDataJson() {
  const keys = ["spoons_data_json", "data.json", "spoonsData", "spoons_data"];
  for (const k of keys) {
    const v = localStorage.getItem(k);
    if (!v) continue;
    const j = safeParseJson(v);
    if (j && typeof j === "object") return j;
  }
  return null;
}

function buildTasksByDate(data) {
  const out = {};
  if (!data || typeof data !== "object") return out;
  const folderKeys = ["folder_1_tasks","folder_2_tasks","folder_3_tasks","folder_4_tasks","folder_5_tasks","folder_6_tasks"];
  for (let i = 0; i < folderKeys.length; i++) {
    const k = folderKeys[i];
    const arr = Array.isArray(data[k]) ? data[k] : [];
    for (const t of arr) {
      const ymd = parseDueYmd(t?.due_date);
      const name = taskName(t);
      if (!ymd || !name) continue;
      if (!out[ymd]) out[ymd] = [];
      out[ymd].push({ name, complete: isCompleteTask(t), folderIndex: i + 1 });
    }
  }
  for (const ymd of Object.keys(out)) out[ymd].sort((a, b) => (a.complete === b.complete ? a.name.localeCompare(b.name) : (a.complete ? 1 : -1)));
  return out;
}

function TimeGrid({ view, selectedDate, onPickDate }) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const cols = useMemo(() => getColumnsForView(view, selectedDate), [view, selectedDate]);
  const showVertical = view !== "day";
  const [nowTs, setNowTs] = useState(() => Date.now());
  React.useEffect(() => { const t = setInterval(() => setNowTs(Date.now()), 30000); return () => clearInterval(t); }, []);
  const showNowLine = useMemo(() => cols.some((d) => isSameDay(d, today)), [cols, today]);
  const nowTopPx = useMemo(() => { const n = new Date(nowTs); const mins = (n.getHours() * 60) + n.getMinutes(); return (mins / 60) * 64; }, [nowTs]);

  return (
    <div className="calMonthView calTimeView">
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

      <div className="calTimeScroll">
        <div className="calTimeGutter calTimeGutterPos">
          {showNowLine ? (<div className="calNowPill" style={{ top: `${nowTopPx}px`, marginTop: "1px" }}>{new Date(nowTs).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}<div className="calNowPillConnector" /></div>) : null}
          {Array.from({ length: 24 }).map((_, h) => (<div key={h} className="calTimeTick"><div className="calTimeTickLabel">{hourLabel(h)}</div></div>))}
        </div>

        <div className="calTimeGridArea">
          <div className="calTimeGridSurface" style={{ gridTemplateColumns: `repeat(${cols.length}, 1fr)` }}>
            {showNowLine ? <div className="calNowLine" style={{ top: `${nowTopPx}px` }} /> : null}
            {Array.from({ length: 24 }).map((_, h) => (<div key={h} className="calTimeRow"><div className="calTimeHourLine" /><div className="calTimeHalfLine" /></div>))}
            {showVertical ? (<>{Array.from({ length: cols.length - 1 }).map((_, i) => (<div key={i} className="calTimeVLine" style={{ left: `${((i + 1) / cols.length) * 100}%` }} />))}</>) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function monthsDiff(aMonthDate, bMonthDate) { return ((bMonthDate.getFullYear() - aMonthDate.getFullYear()) * 12) + (bMonthDate.getMonth() - aMonthDate.getMonth()); }
function daysDiff(aDay, bDay) { const ms = startOfDay(bDay).getTime() - startOfDay(aDay).getTime(); return Math.round(ms / 86400000); }
function clampMs(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

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

  const localData = useMemo(() => loadLocalDataJson(), []);
  const tasksByDate = useMemo(() => buildTasksByDate(localData), [localData]);

  const animRef = useRef(null);
  const [anim, setAnim] = useState(null);

  const tapRef = useRef({ ymd: "", ts: 0 });

  const swipeRef = useRef({ active: false, id: null, sx: 0, sy: 0, st: 0, mx: 0, my: 0 });

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
    if (toView === "month") {
      const md = Math.abs(monthsDiff(fromMonth, toMonth));
      return clampMs(260 + (md * 140), minMs, maxMs);
    }
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
    const axis = "y";
    const dirSign = (dir === "down" ? 1 : -1);
    setAnim({ axis, dirSign, durationMs, fromSnap, toSnap, phase: "enter" });
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
    const next = today;
    const nextSnap = { view, selectedDate: next, anchorDate: (view === "month" ? startOfMonth(next) : startOfMonth(next)) };
    const dir = (view === "month" ? (monthsDiff(startOfMonth(anchorDate), startOfMonth(nextSnap.anchorDate)) >= 0 ? "down" : "up") : (daysDiff(selectedDate, next) >= 0 ? "down" : "up"));
    beginAnimatedTransition(nextSnap, dir);
  }

  function shiftRangeAnimated(dirKey) {
    const step = (dirKey === "up" ? -1 : 1);
    if (view === "day") {
      const nextSel = addDays(selectedDate, step);
      const nextSnap = { view, selectedDate: nextSel, anchorDate: startOfMonth(nextSel) };
      beginAnimatedTransition(nextSnap, dirKey);
      return;
    }
    if (view === "schoolWeek" || view === "week") {
      const nextSel = addDays(selectedDate, step * 7);
      const nextSnap = { view, selectedDate: nextSel, anchorDate: startOfMonth(nextSel) };
      beginAnimatedTransition(nextSnap, dirKey);
      return;
    }
    if (view === "month") {
      const nextMonth = addMonths(visibleMonth, step);
      const nextSel = clampDayToMonth(selectedDate, nextMonth);
      const nextSnap = { view, selectedDate: nextSel, anchorDate: startOfMonth(nextMonth) };
      beginAnimatedTransition(nextSnap, dirKey);
      return;
    }
  }

  function onPickView(nextView) {
    if (nextView === view) return;
    const nextSnap = { view: nextView, selectedDate: startOfDay(selectedDate), anchorDate: (nextView === "month" ? startOfMonth(selectedDate) : startOfMonth(selectedDate)) };
    beginAnimatedTransition(nextSnap, "down");
  }

  function onPickMonth(mIdx) {
    const nextMonth = new Date(visibleYear, mIdx, 1);
    const nextSel = clampDayToMonth(selectedDate, nextMonth);
    const nextSnap = { view, selectedDate: nextSel, anchorDate: startOfMonth(nextMonth) };
    beginAnimatedTransition(nextSnap, (mIdx >= visibleMonthIdx ? "down" : "up"));
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

  function renderBodyForSnap(snap) {
    const snapView = snap.view;
    const snapSelected = snap.selectedDate;
    const snapAnchor = snap.anchorDate;
    const snapVisibleMonth = startOfMonth(snapAnchor);
    const snapMonthIdx = snapVisibleMonth.getMonth();
    const snapMonthGrid = getMonthGrid(snapVisibleMonth);
    const snapMonthWeeks = Math.ceil(snapMonthGrid.length / 7);

    if (snapView !== "month") return (<TimeGrid view={snapView} selectedDate={snapSelected} onPickDate={() => {}} />);

    return (
      <div className="calMonthView" style={{ ["--calMonthRows"]: snapMonthWeeks }}>
        <div className="calDowRow">
          <div className="calDow">Mon</div><div className="calDow">Tue</div><div className="calDow">Wed</div><div className="calDow">Thu</div><div className="calDow">Fri</div><div className="calDow">Sat</div><div className="calDow">Sun</div>
        </div>
        <div className="calGrid">
          {snapMonthGrid.map((d) => {
            const inMonth = d.getMonth() === snapMonthIdx;
            const isToday0 = isSameDay(d, today);
            const isSelected0 = isSameDay(d, snapSelected);
            const ymd = isoYmd(d);
            const tasks = Array.isArray(tasksByDate[ymd]) ? tasksByDate[ymd] : [];
            const showLines = tasks.slice(0, 2);
            const moreCount = Math.max(0, tasks.length - showLines.length);

            return (
              <div key={ymd} className={`calCell calCellMonth ${inMonth ? "" : "calCellMuted"} ${isToday0 ? "calCellToday" : ""} ${isSelected0 ? "calCellSelected" : ""}`}>
                <div className="calCellNum">{d.getDate()}</div>
                {tasks.length ? (
                  <div className="calCellTasks">
                    {showLines.map((t, idx) => (<div key={`${ymd}_${idx}`} className={`calCellTaskLine ${t.complete ? "calCellTaskDone" : ""}`} title={t.name}>{t.name}</div>))}
                    {moreCount > 0 ? (<div className="calCellMore">{moreCount} more</div>) : null}
                  </div>
                ) : null}
              </div>
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
    if (last.ymd === ymd && (now - last.ts) <= 320) {
      const nextSnap = { view: "day", selectedDate: startOfDay(d), anchorDate: startOfMonth(d) };
      beginAnimatedTransition(nextSnap, "down");
    }
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

    if (ady < 60) return;
    if (ady < (adx * 1.2)) return;
    if (dt > 900) return;

    if (dy < 0) shiftRangeAnimated("down");
    if (dy > 0) shiftRangeAnimated("up");
  }

  function onAnimTransitionEnd(e) {
    if (!anim) return;
    if (!e || !e.target) return;
    if (!String(e.target.className || "").includes("calAnimPane")) return;
    finishAnim();
  }

  const activeSnap = useMemo(() => ({ view, selectedDate: startOfDay(selectedDate), anchorDate: startOfMonth(anchorDate) }), [view, selectedDate, anchorDate]);

  const fromPaneStyle = useMemo(() => {
    if (!anim) return {};
    const dur = `${anim.durationMs}ms`;
    const ease = "cubic-bezier(0.20, 0.80, 0.20, 1.00)";
    const ty = (anim.phase === "active" ? `${anim.dirSign * -100}%` : "0%");
    return { transition: `transform ${dur} ${ease}`, transform: `translate3d(0, ${ty}, 0)` };
  }, [anim]);

  const toPaneStyle = useMemo(() => {
    if (!anim) return {};
    const dur = `${anim.durationMs}ms`;
    const ease = "cubic-bezier(0.20, 0.80, 0.20, 1.00)";
    const startY = `${anim.dirSign * 100}%`;
    const ty = (anim.phase === "active" ? "0%" : startY);
    return { transition: `transform ${dur} ${ease}`, transform: `translate3d(0, ${ty}, 0)` };
  }, [anim]);

  const body = (
    <div className="calBody calGestureSurface" onPointerDown={onGesturePointerDown} onPointerMove={onGesturePointerMove} onPointerUp={onGesturePointerUp} onPointerCancel={onGesturePointerUp}>
      {anim ? (
        <div className="calAnimStage" ref={animRef}>
          <div className="calAnimPane" style={fromPaneStyle}>
            {anim.fromSnap.view === "month" ? (
              <div className="calMonthView" style={{ ["--calMonthRows"]: monthWeeks }}>
                <div className="calDowRow">
                  <div className="calDow">Mon</div><div className="calDow">Tue</div><div className="calDow">Wed</div><div className="calDow">Thu</div><div className="calDow">Fri</div><div className="calDow">Sat</div><div className="calDow">Sun</div>
                </div>
                <div className="calGrid">
                  {monthGrid.map((d) => {
                    const inMonth = d.getMonth() === visibleMonthIdx;
                    const isToday0 = isSameDay(d, today);
                    const isSelected0 = isSameDay(d, selectedDate);
                    const ymd = isoYmd(d);
                    const tasks = Array.isArray(tasksByDate[ymd]) ? tasksByDate[ymd] : [];
                    const showLines = tasks.slice(0, 2);
                    const moreCount = Math.max(0, tasks.length - showLines.length);
                    return (
                      <div key={ymd} className={`calCell calCellMonth ${inMonth ? "" : "calCellMuted"} ${isToday0 ? "calCellToday" : ""} ${isSelected0 ? "calCellSelected" : ""}`}>
                        <div className="calCellNum">{d.getDate()}</div>
                        {tasks.length ? (
                          <div className="calCellTasks">
                            {showLines.map((t, idx) => (<div key={`${ymd}_${idx}`} className={`calCellTaskLine ${t.complete ? "calCellTaskDone" : ""}`} title={t.name}>{t.name}</div>))}
                            {moreCount > 0 ? (<div className="calCellMore">{moreCount} more</div>) : null}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <TimeGrid view={anim.fromSnap.view} selectedDate={anim.fromSnap.selectedDate} onPickDate={() => {}} />
            )}
          </div>

          <div className="calAnimPane" style={toPaneStyle} onTransitionEnd={onAnimTransitionEnd}>
            {renderBodyForSnap(anim.toSnap)}
          </div>
        </div>
      ) : (
        (view === "month") ? (
          <div className="calMonthView" style={{ ["--calMonthRows"]: monthWeeks }}>
            <div className="calDowRow">
              <div className="calDow">Mon</div><div className="calDow">Tue</div><div className="calDow">Wed</div><div className="calDow">Thu</div><div className="calDow">Fri</div><div className="calDow">Sat</div><div className="calDow">Sun</div>
            </div>
            <div className="calGrid">
              {monthGrid.map((d) => {
                const inMonth = d.getMonth() === visibleMonthIdx;
                const isToday0 = isSameDay(d, today);
                const isSelected0 = isSameDay(d, selectedDate);
                const ymd = isoYmd(d);
                const tasks = Array.isArray(tasksByDate[ymd]) ? tasksByDate[ymd] : [];
                const showLines = tasks.slice(0, 2);
                const moreCount = Math.max(0, tasks.length - showLines.length);

                return (
                  <button key={ymd} className={`calCell calCellMonth ${inMonth ? "" : "calCellMuted"} ${isToday0 ? "calCellToday" : ""} ${isSelected0 ? "calCellSelected" : ""}`} onClick={() => setSelectedDate(startOfDay(d))} onDoubleClick={() => {}} onPointerUp={() => onDayCellTap(d)} type="button">
                    <div className="calCellNum">{d.getDate()}</div>
                    {tasks.length ? (
                      <div className="calCellTasks">
                        {showLines.map((t, idx) => (<div key={`${ymd}_${idx}`} className={`calCellTaskLine ${t.complete ? "calCellTaskDone" : ""}`} title={t.name}>{t.name}</div>))}
                        {moreCount > 0 ? (<div className="calCellMore">{moreCount} more</div>) : null}
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <TimeGrid view={view} selectedDate={selectedDate} onPickDate={(d) => setSelectedDate(startOfDay(d))} />
        )
      )}
    </div>
  );

  return (
    <div className="pageWrap calendarWrap">
      <div className="calTopRow">
        <button className="calBtn calBtnPrimary" onClick={() => nav("/tasks")} type="button">Add Task</button>
        <div className="calViewGroup">
          <button className={`calBtn ${view === "day" ? "calBtnActive" : ""}`} onClick={() => onPickView("day")} type="button">Day</button>
          <button className={`calBtn calHideMobile ${view === "schoolWeek" ? "calBtnActive" : ""}`} onClick={() => onPickView("schoolWeek")} type="button">School Week</button>
          <button className={`calBtn calHideMobile ${view === "week" ? "calBtnActive" : ""}`} onClick={() => onPickView("week")} type="button">Week</button>
          <button className={`calBtn ${view === "month" ? "calBtnActive" : ""}`} onClick={() => onPickView("month")} type="button">Month</button>
        </div>
      </div>

      <div className="calSecondRow">
        <button className="calBtn" onClick={goTodayAnimated} type="button">Today</button>
        <div className="calArrowGroup">
          <button className="calBtn calArrow" onClick={() => shiftRangeAnimated("up")} type="button" aria-label="Previous">↑</button>
          <button className="calBtn calArrow" onClick={() => shiftRangeAnimated("down")} type="button" aria-label="Next">↓</button>
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

      {body}
    </div>
  );
}
