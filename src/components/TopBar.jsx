import React from "react";

export default function TopBar({ spoons, fatiguePct }) {
  const pct = Math.max(0, Math.min(1, fatiguePct || 0));

  return (
    <header className="topBar">
      <div className="topStatus">
        <div className="spoonsBlock">
            <div className="spoonsCount">{spoons}</div>
            <div className="spoonsIcons" aria-hidden="true">
            <span className="spoon">🥄</span>
            <span className="spoon">🥄</span>
            <span className="spoon">🥄</span>
            <span className="spoon">🥄</span>
            <span className="spoon">🥄</span>
            <span className="spoon">🥄</span>
            </div>
        </div>

        <div className="fatigueOuter">
            <div className="fatigueInner" style={{ width: `${Math.round(pct * 100)}%` }} />
        </div>
      </div>


      <div className="topRight">
        <button className="infoButton" type="button" title="Info">i</button>
      </div>
    </header>
  );
}
