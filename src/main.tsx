import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./index.css";
import { AuthProvider } from "./lib/auth";
import RequireAuth from "./components/RequireAuth";
import { ThemeProvider } from "./lib/ThemeProvider";
import { AppConfigProvider } from "./lib/appConfig";


import Login from "./pages/Login";
import Matches from "./pages/Matches";
import Ranking from "./pages/Ranking";
import Profile from "./pages/Profile";
import Extrato from "./pages/Extrato";


function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* pública */}
        <Route path="/login" element={<Login />} />

        {/* default */}
        <Route path="/" element={<Navigate to="/confrontos" replace />} />

        {/* protegidas */}
        <Route
          path="/confrontos"
          element={
            <RequireAuth>
              <Matches />
            </RequireAuth>
          }
        />
        <Route
          path="/ranking"
          element={
            <RequireAuth>
              <Ranking />
            </RequireAuth>
          }
        />
        <Route
          path="/perfil"
          element={
            <RequireAuth>
              <Profile />
            </RequireAuth>
          }
        />
<Route
  path="/extrato"
  element={
    <RequireAuth>
      <Extrato />
    </RequireAuth>
  }
/>

        {/* fallback */}
        <Route path="*" element={<Navigate to="/confrontos" replace />} />
      </Routes>
    </BrowserRouter>
  );
}


ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
  <ThemeProvider>
    <AppConfigProvider>
      <App />
    </AppConfigProvider>
  </ThemeProvider>
</AuthProvider>

  </React.StrictMode>
);

