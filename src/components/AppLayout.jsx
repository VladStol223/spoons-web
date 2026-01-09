import React from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar.jsx";
import TopBar from "./TopBar.jsx";
import { useAuth } from "../auth/AuthProvider.jsx";
import { loadCachedData, saveCachedData } from "../copypartySync";

function normalizePath(p) { if (!p) return "/"; const x = p.split("?")[0].split("#")[0]; return x.endsWith("/") && x !== "/" ? x.slice(0, -1) : x; }
function routeIndex(pathname, routes) { const p = normalizePath(pathname); const i = routes.indexOf(p); return i >= 0 ? i : 0; }

function ensureDataShape(obj) {
  const o = (obj && typeof obj === "object") ? { ...obj } : {};
  if (!Number.isFinite(Number(o.spoons))) o.spoons = 0;
  if (!o.rest_spoons || typeof o.rest_spoons !== "object") o.rest_spoons = { short: 1, half: 2, full: 3 };
  return o;
}

function getRestGain(dataObj, kind) {
  const v = Number(dataObj?.rest_spoons?.[kind]);
  if (Number.isFinite(v) && v > 0) return v;
  if (kind === "short") return 1;
  if (kind === "half") return 2;
  return 3;
}

function computeTopbarSpoonsDisplay(rawSpoons) {
  const s = Math.max(0, Math.floor(Number(rawSpoons) || 0));
  if (s <= 10) return { displayCount: s, groupUnits: 0, remainderUnits: s, bundle: 1 };
  const groups = Math.floor(s / 5);
  const rem = s % 5;
  return { displayCount: s, groupUnits: groups, remainderUnits: rem, bundle: 5 };
}

function readSpoonsFromCache(fallback) {
  const d = ensureDataShape(loadCachedData());
  const s = Math.max(0, Math.floor(Number(d.spoons) || 0));
  if (Number.isFinite(s)) return s;
  return Math.max(0, Math.floor(Number(fallback) || 0));
}

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { spoons: authSpoons } = useAuth();
  const fatiguePct = 0.15;

  const [spoonsLocal, setSpoonsLocal] = React.useState(() => readSpoonsFromCache(authSpoons));

  React.useEffect(() => { setSpoonsLocal(readSpoonsFromCache(authSpoons)); }, [authSpoons]);

  React.useEffect(() => {
    function onAnySpoonsChange() { setSpoonsLocal(readSpoonsFromCache(authSpoons)); }
    window.addEventListener("storage", onAnySpoonsChange);
    window.addEventListener("spoons_cache_changed", onAnySpoonsChange);
    return () => { window.removeEventListener("storage", onAnySpoonsChange); window.removeEventListener("spoons_cache_changed", onAnySpoonsChange); };
  }, [authSpoons]);

  const HUB_ROUTES = React.useMemo(() => ["/calendar", "/tasks", "/manage", "/settings"], []);

  const swipeRef = React.useRef({ x0: 0, y0: 0, t0: 0, tracking: false });

  function onTouchStart(e) {
    if (!e.touches || e.touches.length !== 1) return;
    const t = e.touches[0];
    const w = window.innerWidth || 0;
    const edgeGuard = 28;
    if (t.clientX <= edgeGuard || t.clientX >= (w - edgeGuard)) { swipeRef.current.tracking = false; return; }
    swipeRef.current.x0 = t.clientX;
    swipeRef.current.y0 = t.clientY;
    swipeRef.current.t0 = Date.now();
    swipeRef.current.tracking = true;
  }

  function onTouchEnd(e) {
    if (!swipeRef.current.tracking) return;
    swipeRef.current.tracking = false;
    if (!e.changedTouches || e.changedTouches.length !== 1) return;

    const t = e.changedTouches[0];
    const dx = t.clientX - swipeRef.current.x0;
    const dy = t.clientY - swipeRef.current.y0;
    const dt = Date.now() - swipeRef.current.t0;

    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (dt > 650) return;
    if (absX < 60) return;
    if (absX < (absY * 1.2)) return;

    const idx = routeIndex(location.pathname, HUB_ROUTES);
    if (dx < 0) { const next = HUB_ROUTES[Math.min(idx + 1, HUB_ROUTES.length - 1)]; if (next !== normalizePath(location.pathname)) navigate(next, { replace: true }); return; }
    if (dx > 0) { const prev = HUB_ROUTES[Math.max(idx - 1, 0)]; if (prev !== normalizePath(location.pathname)) navigate(prev, { replace: true }); return; }
  }

  function broadcastCacheChange() { try { window.dispatchEvent(new Event("spoons_cache_changed")); } catch {} }

  function onRest(kind) {
    const d0 = ensureDataShape(loadCachedData());
    const gain = getRestGain(d0, kind);
    const next = Math.max(0, Math.floor(Number(d0.spoons || 0) + gain));
    saveCachedData({ ...d0, spoons: next });
    setSpoonsLocal(next);
    broadcastCacheChange();
  }

  function onSetSpoons(nextSpoons) {
    const n = Math.max(0, Math.floor(Number(nextSpoons) || 0));
    const d0 = ensureDataShape(loadCachedData());
    saveCachedData({ ...d0, spoons: n });
    setSpoonsLocal(n);
    broadcastCacheChange();
  }

  const topbarSpoons = React.useMemo(() => computeTopbarSpoonsDisplay(spoonsLocal), [spoonsLocal]);

  return (
    <div className="appShell" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <Sidebar activePath={location.pathname} />
      <div className="mainColumn">
        <TopBar spoons={spoonsLocal} onSetSpoons={onSetSpoons} onOpenSpoons={() => navigate("/spoons", { replace: false })} />
        <main className="contentArea">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
