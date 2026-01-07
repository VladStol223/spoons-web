import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import ThemeToggleButton from "../theme/ThemeToggleButton";

export default function SettingsPage() {
  const { username, logout } = useAuth();
  const nav = useNavigate();

  function onLogout() { logout(); nav("/login", { replace: true }); }

  return (
    <div className="pageWrap">
      <h1>Settings</h1>
      <div style={{ display: "grid", gap: 12, maxWidth: 520 }}>
        <div style={{ fontWeight: 800 }}>Currently logged in as: {username}</div>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <ThemeToggleButton />
          <button className="primaryBtn" onClick={onLogout}>Logout</button>
        </div>
      </div>
    </div>
  );
}
