import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import ProtectedRoute from "./auth/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import CalendarPage from "./pages/CalendarPage";
import SocialPage from "./pages/SocialPage";
import InputSpoonsPage from "./pages/InputSpoonsPage";
import InputTasksPage from "./pages/InputTasksPage";
import ManageTasksPage from "./pages/ManageTasksPage";
import SettingsPage from "./pages/SettingsPage";
import RegisterPage from "./pages/RegisterPage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/calendar" replace />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/social" element={<SocialPage />} />
          <Route path="/spoons" element={<InputSpoonsPage />} />
          <Route path="/tasks" element={<InputTasksPage />} />
          <Route path="/manage" element={<ManageTasksPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
