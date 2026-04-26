import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { AboutPage } from "./pages/AboutPage";
import { TermsPage } from "./pages/TermsPage";
import { AccountPage } from "./pages/AccountPage";
import { EmergencyContactPage } from "./pages/EmergencyContactPage";
import { AdminPage } from "./pages/AdminPage";
import { AlertsPage } from "./pages/AlertsPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { DrivePage } from "./pages/DrivePage";
import { HistoryPage } from "./pages/HistoryPage";
import { SessionDetailPage } from "./pages/SessionDetailPage";
import { LoginPage } from "./pages/LoginPage";
import { SimulationPage } from "./pages/SimulationPage";
import { IotDevicesPage } from "./pages/IotDevicesPage";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) {
    return <div className="flex min-h-dvh items-center justify-center text-zinc-400">Loading…</div>;
  }
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="drive" element={<DrivePage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="history/:sessionId" element={<SessionDetailPage />} />
        <Route path="safety-protocol" element={<AlertsPage />} />
        <Route path="admin" element={<AdminPage />} />
        <Route path="account" element={<AccountPage />} />
        <Route path="guardians" element={<EmergencyContactPage />} />
        <Route path="iot-devices" element={<IotDevicesPage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="terms" element={<TermsPage />} />
      </Route>
      <Route
        path="/simulation"
        element={
          <RequireAuth>
            <SimulationPage />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
