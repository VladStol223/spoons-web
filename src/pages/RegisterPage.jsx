// src/pages/RegisterPage.jsx
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { copypartyCreateAccount } from "../copypartyApi";

export default function RegisterPage() {
  const nav = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const u = (username || "").trim();
    const p = (password || "").trim();
    const c = (confirm || "").trim();

    if (!u || !p) return setError("Enter a username and password.");
    if (p !== c) return setError("Passwords do not match.");

    setBusy(true);
    const res = await copypartyCreateAccount(u, p);
    setBusy(false);

    if (!res.ok) return setError(res.error || "Registration failed.");
    nav("/login", { replace: true });
  }

  return (
    <div className="authBackground">
      <form onSubmit={handleSubmit} className="authCard">
        <h1 className="authTitle">Create Account</h1>

        {error ? <div className="authError">{error}</div> : null}

        <input className="authInput" type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" autoComplete="username" />

        <input className="authInput" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" autoComplete="new-password" />

        <input className="authInput" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm Password" autoComplete="new-password" />

        <button type="submit" className="authButton" disabled={busy}>{busy ? "Creating..." : "Register"}</button>

        <div className="authLinks">
          <span style={{ color: "rgba(255,255,255,0.92)", fontWeight: 800 }}>Have an account? </span>
          <Link className="authLink" to="/login">Log in</Link>
        </div>
      </form>
    </div>
  );
}
