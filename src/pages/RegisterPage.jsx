import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { copypartyCreateAccount, copypartyVerifyLogin } from "../copypartyApi";
import { uploadEncryptedDataJson } from "../copypartyData";

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

export default function RegisterPage() {
  const nav = useNavigate();
  const { login } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [note, setNote] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setNote(null);

    const u = (username || "").trim();
    const p = (password || "").trim();
    const p2 = (password2 || "").trim();
    if (!u || !p) return setError("Enter a username and password.");
    if (p.length < 4) return setError("Password is too short.");
    if (p !== p2) return setError("Passwords do not match.");

    setBusy(true);

    const created = await copypartyCreateAccount(u, p);
    if (!created.ok) { setBusy(false); return setError(created.error || "Register failed."); }

    setNote("Account request sent. Waiting for Copyparty to create your account...");

    const base = import.meta.env.VITE_COPYPARTY_BASE || "/cp";
    let ready = false;

    for (let i = 0; i < 8; i++) {
      await sleep(750);
      const v = await copypartyVerifyLogin(u, p);
      if (v.ok) { ready = true; break; }
      if (v.error && v.error.toLowerCase().includes("wrong password")) { setBusy(false); return setError("Copyparty says the password is wrong (unexpected)."); }
    }

    if (!ready) {
      setBusy(false);
      setNote(null);
      return setError("Account creation is taking longer than expected. Please wait a moment and try logging in.");
    }

    setNote("Account is live. Creating your starter data.json...");

    try {
      await uploadEncryptedDataJson(base, u, p, { spoons: 0, created_at: new Date().toISOString(), v: 1 });
    } catch (e) {
      setBusy(false);
      setNote(null);
      return setError(e?.message || "Could not create starter data.json. Try logging in again in a moment.");
    }

    setNote("All set. Logging you in...");
    const res = await login(u, p);
    setBusy(false);
    if (!res.ok) return setError(res.error || "Login failed.");
    nav("/spoons", { replace: true });
  }

  return (
    <div className="pageWrap">
      <h1>Register</h1>
      <div style={{ maxWidth: 420 }}>
        <form onSubmit={onSubmit}>
          <div style={{ display: "grid", gap: 10 }}>
            <label>
              <div style={{ marginBottom: 6 }}>Choose a Username</div>
              <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "2px solid rgba(255,255,255,0.2)", background: "rgba(0,0,0,0.15)", color: "var(--text)" }} />
            </label>
            <label>
              <div style={{ marginBottom: 6 }}>Choose a Password</div>
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="new-password" style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "2px solid rgba(255,255,255,0.2)", background: "rgba(0,0,0,0.15)", color: "var(--text)" }} />
            </label>
            <label>
              <div style={{ marginBottom: 6 }}>Confirm Password</div>
              <input value={password2} onChange={(e) => setPassword2(e.target.value)} type="password" autoComplete="new-password" style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "2px solid rgba(255,255,255,0.2)", background: "rgba(0,0,0,0.15)", color: "var(--text)" }} />
            </label>

            {note ? <div style={{ color: "#d7b45a", fontWeight: 800 }}>{note}</div> : null}
            {error ? <div style={{ color: "#ffcf7a", fontWeight: 800 }}>{error}</div> : null}

            <button className="primaryBtn" disabled={busy} type="submit">{busy ? "Creating..." : "Create Account"}</button>
            <button className="primaryBtn" disabled={busy} type="button" onClick={() => nav("/login")}>Back to Login</button>
            <div style={{ opacity: 0.85, fontSize: 13 }}>Registration uploads a <code>.txt</code> file to Copyparty which triggers account creation.</div>
          </div>
        </form>
      </div>
    </div>
  );
}
