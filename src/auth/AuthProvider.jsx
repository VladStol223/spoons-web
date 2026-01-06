import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { copypartyVerifyLogin } from "../copypartyApi";
import { fetchAndDecryptDataJson } from "../copypartyData";

const AuthContext = createContext(null);

function loadSavedAuth() { try { const raw = localStorage.getItem("spoonsAuth"); if (!raw) return null; const obj = JSON.parse(raw); if (!obj || !obj.username || !obj.password) return null; return obj; } catch { return null; } }
function saveAuth(obj) { localStorage.setItem("spoonsAuth", JSON.stringify(obj)); }
function clearAuth() { localStorage.removeItem("spoonsAuth"); }

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => loadSavedAuth());
  const [booted, setBooted] = useState(false);

  const [spoons, setSpoons] = useState(0);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [dataError, setDataError] = useState(null);

  useEffect(() => { setBooted(true); }, []);

  const username = auth?.username || null;
  const password = auth?.password || null;
  const isAuthed = !!(username && password);

  const authHeader = useMemo(() => { if (!isAuthed) return null; const token = btoa(`${username}:${password}`); return `Basic ${token}`; }, [isAuthed, username, password]);

  async function loadUserData(u, p) {
    setDataError(null);
    setDataLoaded(false);
    try {
      const base = import.meta.env.VITE_COPYPARTY_BASE || "/cp";
      const data = await fetchAndDecryptDataJson(base, u, p);
      const nextSpoons = Number.isFinite(Number(data?.spoons)) ? Number(data.spoons) : 0;
      setSpoons(nextSpoons);
      setDataLoaded(true);
      return { ok: true, data, spoons: nextSpoons };
    } catch (e) {
      setSpoons(0);
      setDataLoaded(false);
      setDataError(e?.message || "Failed to load/decrypt data.json.");
      return { ok: false, error: e?.message || "Failed to load/decrypt data.json." };
    }
  }

  async function login(nextUsername, nextPassword) {
    const u = (nextUsername || "").trim();
    const p = (nextPassword || "").trim();
    if (!u || !p) return { ok: false, error: "Enter username and password." };
    const verify = await copypartyVerifyLogin(u, p);
    if (!verify.ok) return verify;
    const obj = { username: u, password: p, ts: Date.now() };
    saveAuth(obj);
    setAuth(obj);
    const loaded = await loadUserData(u, p);
    if (!loaded.ok) return loaded;
    return { ok: true };
  }

  function logout() {
    clearAuth();
    setAuth(null);
    setSpoons(0);
    setDataLoaded(false);
    setDataError(null);
  }

  useEffect(() => {
    let cancelled = false;
    async function bootLoad() {
      if (!isAuthed) { setDataLoaded(false); setDataError(null); setSpoons(0); return; }
      const u = username;
      const p = password;
      const res = await loadUserData(u, p);
      if (cancelled) return;
      if (!res.ok) {
        clearAuth();
        setAuth(null);
      }
    }
    bootLoad();
    return () => { cancelled = true; };
  }, [isAuthed, username, password]);

  const value = useMemo(() => ({ booted, isAuthed, username, authHeader, spoons, dataLoaded, dataError, login, logout }), [booted, isAuthed, username, authHeader, spoons, dataLoaded, dataError]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>.");
  return ctx;
}
