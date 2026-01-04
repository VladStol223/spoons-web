import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { copypartyVerifyLogin } from "../copypartyApi";

const AuthContext = createContext(null);

function loadSavedAuth() { try { const raw = localStorage.getItem("spoonsAuth"); if (!raw) return null; const obj = JSON.parse(raw); if (!obj || !obj.username || !obj.password) return null; return obj; } catch { return null; } }
function saveAuth(obj) { localStorage.setItem("spoonsAuth", JSON.stringify(obj)); }
function clearAuth() { localStorage.removeItem("spoonsAuth"); }

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => loadSavedAuth());
  const [booted, setBooted] = useState(false);

  useEffect(() => { setBooted(true); }, []);

  const username = auth?.username || null;
  const password = auth?.password || null;
  const isAuthed = !!(username && password);

  const authHeader = useMemo(() => { if (!isAuthed) return null; const token = btoa(`${username}:${password}`); return `Basic ${token}`; }, [isAuthed, username, password]);

  async function login(nextUsername, nextPassword) {
    const u = (nextUsername || "").trim();
    const p = (nextPassword || "").trim();
    if (!u || !p) return { ok: false, error: "Enter username and password." };
    const verify = await copypartyVerifyLogin(u, p);
    if (!verify.ok) return verify;
    const obj = { username: u, password: p, ts: Date.now() };
    saveAuth(obj);
    setAuth(obj);
    return { ok: true };
  }

  function logout() { clearAuth(); setAuth(null); }

  const value = useMemo(() => ({ booted, isAuthed, username, authHeader, login, logout }), [booted, isAuthed, username, authHeader]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>.");
  return ctx;
}
