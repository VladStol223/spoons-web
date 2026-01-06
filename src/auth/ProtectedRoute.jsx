import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";

export default function ProtectedRoute() {
  const { booted, isAuthed, isDevBypass } = useAuth();
  const location = useLocation();
  if (!booted) return null;
  if (!isAuthed && !isDevBypass) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}
