import React, { useMemo } from "react";
import { NavLink } from "react-router-dom";

function getTodayMMDD() { const d = new Date(); const mm = String(d.getMonth() + 1).padStart(2, "0"); const dd = String(d.getDate()).padStart(2, "0"); return `${mm}/${dd}`; }

export default function Sidebar() {
  const today = useMemo(() => getTodayMMDD(), []);
  const items = [
    { to: "/calendar", label: "Calendar", icon: "📅", sub: today },
    { to: "/water", label: "Water", icon: "💧" },
    { to: "/tasks", label: "Input Tasks", icon: "📝" },
    { to: "/manage", label: "Manage Tasks", icon: "📋" },
    { to: "/settings", label: "Settings", icon: "⚙️" }
  ];

  return (
    <aside className="sidebar">
      <div className="sidebarInner">
        <nav className="hubNav">
          {items.map((it) => (
            <NavLink key={it.to} to={it.to} replace title={it.label} className={({ isActive }) => `hubItem ${isActive ? "hubActive" : ""}`}>
              <div className="hubIcon">{it.icon}</div>
              {it.sub ? <div className="hubSub">{it.sub}</div> : null}
            </NavLink>
          ))}
        </nav>
      </div>
    </aside>
  );
}
