import React, { useMemo } from "react";
import { NavLink } from "react-router-dom";

function getTodayMMDD() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}`;
}

export default function Sidebar({ activePath }) {
  const today = useMemo(() => getTodayMMDD(), []);

  const items = [
    { to: "/calendar", label: "Calendar", icon: "📅" },
    { to: "/spoons", label: "Input Spoons", icon: "🥄" },
    { to: "/tasks", label: "Input Tasks", icon: "📝" },
    { to: "/manage", label: "Manage Tasks", icon: "📋" },
    { to: "/settings", label: "Settings", icon: "⚙️" },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebarInner">
        <NavLink to="/calendar" className={({ isActive }) => `hubItem hubCalendar ${isActive ? "hubActive" : ""}`}>
          <div className="hubIcon hubIconCalendar">📅</div>
          <div className="hubDate">{today}</div>
        </NavLink>

        <div className="hubSpacer" />

        <nav className="hubNav">
          {items.slice(1).map((it) => (
            <NavLink key={it.to} to={it.to} title={it.label} className={({ isActive }) => `hubItem ${isActive ? "hubActive" : ""}`}>
              <div className="hubIcon">{it.icon}</div>
            </NavLink>
          ))}
        </nav>
      </div>
    </aside>
  );
}
