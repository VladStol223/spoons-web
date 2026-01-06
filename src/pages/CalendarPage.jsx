import React, { useMemo, useState } from "react";
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

function getColumnsForView(view, selectedDate) {
  if (view === "day") return [startOfDay(selectedDate)];
  if (view === "schoolWeek") {
    const mon = startOfWeekMonday(selectedDate);
    return [mon, addDays(mon, 1), addDays(mon, 2), addDays(mon, 3), addDays(mon, 4)];
  }
  // week view: Sunday -> Saturday
  const mon = startOfWeekMonday(selectedDate);
  const sun = addDays(mon, -1);
  return [sun, addDays(sun, 1), addDays(sun, 2), addDays(sun, 3), addDays(sun, 4), addDays(sun, 5), addDays(sun, 6)];
}

function hourLabel(h) {
  if (h === 0) return "12 AM";
  if (h < 12) return `${h} AM`;
  if (h === 12) return "12 PM";
  return `${h - 12} PM`;
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
              <button
                key={isoYmd(d)}
                type="button"
                className={`calTimeHeaderCell ${isToday ? "calCellToday" : ""} ${isSelected ? "calCellSelected" : ""}`}
                onClick={() => onPickDate(d)}
              >
                <div className="calTimeHeaderDow">{dowShort(d)}</div>
                <div className="calTimeHeaderDom">{monthName(d.getMonth()).slice(0, 3)} {d.getDate()}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="calTimeScroll">
        <div className="calTimeGutter calTimeGutterPos">
          {showNowLine ? (
            <div className="calNowPill" style={{ top: `${nowTopPx}px`, marginTop: '1px' }}>
              {new Date(nowTs).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              <div className="calNowPillConnector" />
            </div>
          ) : null}
          {Array.from({ length: 24 }).map((_, h) => (
            <div key={h} className="calTimeTick">
              <div className="calTimeTickLabel">{hourLabel(h)}</div>
            </div>
          ))}
        </div>

        <div className="calTimeGridArea">
          <div className="calTimeGridSurface" style={{ gridTemplateColumns: `repeat(${cols.length}, 1fr)` }}>
            {showNowLine ? <div className="calNowLine" style={{ top: `${nowTopPx}px` }} /> : null}
            {/* horizontal hour + half-hour lines (spans ALL columns) */}
            {Array.from({ length: 24 }).map((_, h) => (
              <div key={h} className="calTimeRow">
                <div className="calTimeHourLine" />
                <div className="calTimeHalfLine" />
              </div>
            ))}

            {/* vertical column lines (hidden in Day view) */}
            {showVertical ? (
              <>
                {Array.from({ length: cols.length - 1 }).map((_, i) => (
                  <div key={i} className="calTimeVLine" style={{ left: `${((i + 1) / cols.length) * 100}%` }} />
                ))}
              </>
            ) : null}
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

  function goToday() { setSelectedDate(today); if (view === "month") setAnchorDate(startOfMonth(today)); }

  function shiftRange(dir) {
    const step = dir === "up" ? -1 : 1;
    if (view === "day") { const next = addDays(selectedDate, step); setSelectedDate(next); setAnchorDate(startOfMonth(next)); return; }
    if (view === "schoolWeek" || view === "week") { const next = addDays(selectedDate, step * 7); setSelectedDate(next); setAnchorDate(startOfMonth(next)); return; }
    if (view === "month") { const nextMonth = addMonths(visibleMonth, step); setAnchorDate(nextMonth); setSelectedDate((d) => clampDayToMonth(d, nextMonth)); return; }
  }

  function onPickView(nextView) { setView(nextView); if (nextView === "month") setAnchorDate(startOfMonth(selectedDate)); }

  function onPickMonth(mIdx) { const nextMonth = new Date(visibleYear, mIdx, 1); setAnchorDate(nextMonth); setSelectedDate((d) => clampDayToMonth(d, nextMonth)); setMonthPickerOpen(false); }

  const rangeLabel = useMemo(() => {
    if (view === "day") return `${monthName(selectedDate.getMonth())} ${selectedDate.getDate()}, ${selectedDate.getFullYear()}`;
    if (view === "schoolWeek") { const s = startOfWeekMonday(selectedDate); const e = addDays(s, 4); return `School Week: ${monthName(s.getMonth())} ${s.getDate()} - ${monthName(e.getMonth())} ${e.getDate()}, ${e.getFullYear()}`; }
    if (view === "week") { const s = startOfWeekMonday(selectedDate); const e = endOfWeekMonday(selectedDate); return `Week: ${monthName(s.getMonth())} ${s.getDate()} - ${monthName(e.getMonth())} ${e.getDate()}, ${e.getFullYear()}`; }
    return headerLabel;
  }, [view, selectedDate, headerLabel]);

  const monthGrid = useMemo(() => {
    const first = startOfMonth(visibleMonth);
    const last = endOfMonth(visibleMonth);
    const gridStart = startOfWeekMonday(first);
    const gridEnd = endOfWeekMonday(last);
    const days = [];
    for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(startOfDay(d));
    return days;
  }, [visibleMonth]);

  const monthWeeks = useMemo(() => Math.ceil(monthGrid.length / 7), [monthGrid]);


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
        <button className="calBtn" onClick={goToday} type="button">Today</button>
        <div className="calArrowGroup">
          <button className="calBtn calArrow" onClick={() => shiftRange("up")} type="button" aria-label="Previous">↑</button>
          <button className="calBtn calArrow" onClick={() => shiftRange("down")} type="button" aria-label="Next">↓</button>
        </div>
        <div className="calMonthPickerWrap">
          <button className="calBtn calMonthBtn" onClick={() => setMonthPickerOpen((v) => !v)} type="button">{rangeLabel}</button>
          {monthPickerOpen ? (
            <div className="calMonthPopover" role="dialog" aria-label="Pick a month">
              <div className="calMonthPopoverHeader">{visibleYear}</div>
              <div className="calMonthGrid">
                {Array.from({ length: 12 }).map((_, i) => (
                  <button key={i} className={`calMonthCell ${i === visibleMonthIdx ? "calMonthCellActive" : ""}`} onClick={() => onPickMonth(i)} type="button">{monthName(i).slice(0, 3)}</button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="calBody">
        {view === "month" ? (
          <div className="calMonthView" style={{ ["--calMonthRows"]: monthWeeks }}>
            <div className="calDowRow">
              <div className="calDow">Mon</div><div className="calDow">Tue</div><div className="calDow">Wed</div><div className="calDow">Thu</div><div className="calDow">Fri</div><div className="calDow">Sat</div><div className="calDow">Sun</div>
            </div>
            <div className="calGrid">
              {monthGrid.map((d) => {
                const inMonth = d.getMonth() === visibleMonthIdx;
                const isToday = isSameDay(d, today);
                const isSelected = isSameDay(d, selectedDate);
                return (
                  <button key={isoYmd(d)} className={`calCell ${inMonth ? "" : "calCellMuted"} ${isToday ? "calCellToday" : ""} ${isSelected ? "calCellSelected" : ""}`} onClick={() => setSelectedDate(d)} type="button">
                    <div className="calCellNum">{d.getDate()}</div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <TimeGrid view={view} selectedDate={selectedDate} onPickDate={setSelectedDate} />
        )}
      </div>
    </div>
  );
}
