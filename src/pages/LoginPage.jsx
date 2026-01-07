// src/pages/LoginPage.jsx
import React, { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

export default function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const res = await login(username, password);
    setBusy(false);
    if (!res.ok) return setError(res.error || "Invalid credentials");
    const go = loc.state?.from || "/spoons";
    nav(go, { replace: true });
  }

  return (
    <div className="authBackground">
      <form onSubmit={handleSubmit} className="authCard">
        <div className="authHeaderSmall">Spoons</div>
        <h1 className="authTitle">Login</h1>

        {error ? <div className="authError">{error}</div> : null}

        <input className="authInput" type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" autoComplete="username" />

        <input className="authInput" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" autoComplete="current-password" />

        <button type="submit" className="authButton" disabled={busy}>{busy ? "Signing in..." : "Sign In"}</button>

        <div className="authLinks">
          <Link className="authLink" to="/register">Create an account</Link>
        </div>
      </form>
    </div>
  );
}
