import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

export default function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await login(username, password);
    setBusy(false);
    if (!res.ok) return setError(res.error || "Login failed.");
    const go = loc.state?.from || "/spoons";
    nav(go, { replace: true });
  }

  return (
    <div className="pageWrap">
      <h1>Login</h1>
      <div style={{ maxWidth: 420 }}>
        <form onSubmit={onSubmit}>
          <div style={{ display: "grid", gap: 10 }}>
            <label>
              <div style={{ marginBottom: 6 }}>Copyparty Username</div>
              <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "2px solid rgba(255,255,255,0.2)", background: "rgba(0,0,0,0.15)", color: "var(--text)" }} />
            </label>
            <label>
              <div style={{ marginBottom: 6 }}>Copyparty Password</div>
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "2px solid rgba(255,255,255,0.2)", background: "rgba(0,0,0,0.15)", color: "var(--text)" }} />
            </label>
            {error ? <div style={{ color: "#ffcf7a", fontWeight: 700 }}>{error}</div> : null}
            <button className="primaryBtn" disabled={busy} type="submit">{busy ? "Logging in..." : "Login"}</button>
            <button className="primaryBtn" disabled={busy} type="button" onClick={() => nav("/register")}>Create Account</button>
            <div style={{ opacity: 0.85, fontSize: 13 }}>This stores your credentials locally on this device so you stay logged in until you log out.</div>
          </div>
        </form>
      </div>
    </div>
  );
}
