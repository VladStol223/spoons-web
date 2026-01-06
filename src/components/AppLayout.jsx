import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar.jsx";
import TopBar from "./TopBar.jsx";
import { useAuth } from "../auth/AuthProvider.jsx";

export default function AppLayout() {
  const location = useLocation();
  const { spoons } = useAuth();
  const fatiguePct = 0.15;

  return (
    <div className="appShell">
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
