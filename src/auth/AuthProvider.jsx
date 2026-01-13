import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { copypartyVerifyLogin } from "../copypartyApi";
import { fetchAndDecryptWebDataJson } from "../copypartyData";
import { flushUploadIfDirty, hydrateCachedDataFromServer } from "../copypartySync";

const AuthContext = createContext(null);

const DEV_BYPASS = import.meta.env.VITE_DEV_AUTH_BYPASS === "true";
const DEV_USERNAME = (import.meta.env.VITE_DEV_USERNAME || "dev").trim();

function loadSavedAuth() {
  try {
    const legacy = localStorage.getItem("spoonsAuth");
    if (legacy) localStorage.removeItem("spoonsAuth");
  } catch {}
  try {
    const raw = sessionStorage.getItem("spoonsAuth");
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || !obj.username || !obj.password) return null;
    return obj;
  } catch {
    return null;
  }
}
function saveAuth(obj) {
  try { sessionStorage.setItem("spoonsAuth", JSON.stringify(obj)); } catch {}
  try { localStorage.setItem("spoonsAuth", JSON.stringify(obj)); } catch {}
}

function clearAuth() {
  try { sessionStorage.removeItem("spoonsAuth"); } catch {}
  try { localStorage.removeItem("spoonsAuth"); } catch {}
}

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => {
    if (DEV_BYPASS) return { username: DEV_USERNAME || "dev", password: "__dev__", ts: Date.now(), dev: true };
    return loadSavedAuth();
  });
  const [booted, setBooted] = useState(false);

  const [spoons, setSpoons] = useState(0);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [dataError, setDataError] = useState(null);

  useEffect(() => { setBooted(true); }, []);

  const username = auth?.username || null;
  const password = auth?.password || null;
  const isAuthed = !!(username && password);

  useEffect(() => {
    if (!isAuthed) return;

    function flush() { flushUploadIfDirty(); }
    function onVis() { if (document.visibilityState === "hidden") flush(); }

    window.addEventListener("focus", flush);
    window.addEventListener("online", flush);
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVis);

    return () => {
      window.removeEventListener("focus", flush);
      window.removeEventListener("online", flush);
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [isAuthed]);

  const authHeader = useMemo(() => {
    if (!isAuthed) return null;
    if (DEV_BYPASS) return null;
    const token = btoa(`${username}:${password}`);
    return `Basic ${token}`;
  }, [isAuthed, username, password]);

  async function loadUserData(u, p) {
    setDataError(null);
    setDataLoaded(false);

    if (DEV_BYPASS) {
      const nextSpoons = 12;
      setSpoons(nextSpoons);
      setDataLoaded(true);
      return { ok: true, data: { spoons: nextSpoons }, spoons: nextSpoons, dev: true };
    }

    try {
      const base = (import.meta.env.VITE_COPYPARTY_BASE || "/cp").trim();
      const data = await fetchAndDecryptWebDataJson(base, u, p);

      // Cache canonical so Calendar + Tasks can immediately render from local
      // IMPORTANT: go through saveCachedData so it can schedule uploads when needed
      try { hydrateCachedDataFromServer(data ?? {}); } catch {
        try { localStorage.setItem("spoons_data_cache", JSON.stringify(data ?? {})); } catch {}
        try { localStorage.setItem("spoons_data_cache_ts", String(Date.now())); } catch {}
      }



      const nextSpoons = Number.isFinite(Number(data?.spoons)) ? Number(data.spoons) : 0;
      setSpoons(nextSpoons);
      setDataLoaded(true);
      return { ok: true, data, spoons: nextSpoons };
    } catch (e) {
      setSpoons(0);
      setDataLoaded(false);
      setDataError(e?.message || "Failed to load/decrypt web-data.json.");
      return { ok: false, error: e?.message || "Failed to load/decrypt web-data.json." };
    }
  }

  async function login(nextUsername, nextPassword) {
    if (DEV_BYPASS) {
      const obj = { username: DEV_USERNAME || "dev", password: "__dev__", ts: Date.now(), dev: true };
      setAuth(obj);
      const loaded = await loadUserData(obj.username, obj.password);
      if (!loaded.ok) return loaded;
      return { ok: true };
    }

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
    if (DEV_BYPASS) return;
    clearAuth();
    try { localStorage.removeItem("spoons_data_cache"); } catch {}
    try { localStorage.removeItem("spoons_data_cache_ts"); } catch {}
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
        if (!DEV_BYPASS) {
          clearAuth();
          setAuth(null);
        }
      }
    }

    bootLoad();
    return () => { cancelled = true; };
  }, [isAuthed, username, password]);

  const value = useMemo(() => ({
    booted,
    isAuthed,
    username,
    authHeader,
    spoons,
    dataLoaded,
    dataError,
    login,
    logout,
    isDevBypass: DEV_BYPASS
  }), [booted, isAuthed, username, authHeader, spoons, dataLoaded, dataError]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>.");
  return ctx;
}
