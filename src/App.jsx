import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./components/AppLayout.jsx";

import LoginPage from "./pages/LoginPage.jsx";
import CalendarPage from "./pages/CalendarPage.jsx";
import InputSpoonsPage from "./pages/InputSpoonsPage.jsx";
import InputTasksPage from "./pages/InputTasksPage.jsx";
import ManageTasksPage from "./pages/ManageTasksPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";

export default function App() {
  return (
    <Routes>
      - <Route path="/login" element={<LoginPage />} />
      - <Route element={<AppLayout />}>
          - <Route path="/" element={<Navigate to="/spoons" replace />} />
          - <Route path="/calendar" element={<CalendarPage />} />
          - <Route path="/spoons" element={<InputSpoonsPage />} />
          - <Route path="/tasks" element={<InputTasksPage />} />
          - <Route path="/manage" element={<ManageTasksPage />} />
          - <Route path="/settings" element={<SettingsPage />} />
        </Route>
      - <Route path="*" element={<Navigate to="/spoons" replace />} />
    </Routes>
  );
}
