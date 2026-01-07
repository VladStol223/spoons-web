import React from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar.jsx";
import TopBar from "./TopBar.jsx";
import { useAuth } from "../auth/AuthProvider.jsx";

function normalizePath(p) { if (!p) return "/"; const x = p.split("?")[0].split("#")[0]; return x.endsWith("/") && x !== "/" ? x.slice(0, -1) : x; }
function routeIndex(pathname, routes) { const p = normalizePath(pathname); const i = routes.indexOf(p); return i >= 0 ? i : 0; }

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { spoons } = useAuth();
  const fatiguePct = 0.15;

  const HUB_ROUTES = React.useMemo(() => ["/calendar", "/spoons", "/tasks", "/manage", "/settings"], []);

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

  return (
    <div className="appShell" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <Sidebar activePath={location.pathname} />
      <div className="mainColumn">
        <TopBar spoons={spoons} fatiguePct={fatiguePct} />
        <main className="contentArea">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
