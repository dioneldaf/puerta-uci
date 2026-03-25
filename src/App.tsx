import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import AccessControlPage from './pages/AccessControlPage';
import RecordsPage from './pages/RecordsPage';
import VehicleAccessPage from './pages/VehicleAccessPage';
import VehiclesPage from './pages/VehiclesPage';
import GatesPage from './pages/GatesPage';
import UserManagementPage from './pages/UserManagementPage';
import ExportPage from './pages/ExportPage';
import LogsPage from './pages/LogsPage';
import { Loader2 } from 'lucide-react';

function ProtectedRoute({ children, requireAdmin = false }: { children: React.ReactNode; requireAdmin?: boolean }) {
  const { user, usuario, loading, profileError } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-uci-gray-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="animate-spin text-uci-primary" />
          <p className="text-sm text-uci-gray-500">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user || !usuario) {
    return <Navigate to="/login" replace />;
  }

  if (!usuario.activo) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && usuario.rol !== 'admin') {
    return <Navigate to="/control-acceso" replace />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, usuario, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-uci-gray-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="animate-spin text-uci-primary" />
          <p className="text-sm text-uci-gray-500">Cargando...</p>
        </div>
      </div>
    );
  }

  if (user && usuario) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Ruta pública */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />

      {/* Rutas protegidas */}
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/control-acceso" element={<AccessControlPage />} />
        <Route path="/registros" element={<RecordsPage />} />
        <Route path="/control-vehiculos" element={<VehicleAccessPage />} />

        {/* Solo admin */}
        <Route
          path="/vehiculos"
          element={
            <ProtectedRoute requireAdmin>
              <VehiclesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/puertas"
          element={
            <ProtectedRoute requireAdmin>
              <GatesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/guardias"
          element={
            <ProtectedRoute requireAdmin>
              <UserManagementPage rol="guardia" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admins"
          element={
            <ProtectedRoute requireAdmin>
              <UserManagementPage rol="admin" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/exportar"
          element={
            <ProtectedRoute requireAdmin>
              <ExportPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/logs"
          element={
            <ProtectedRoute requireAdmin>
              <LogsPage />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* Redirect */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#fff',
              color: '#212529',
              border: '1px solid #e9ecef',
              borderRadius: '12px',
              fontSize: '14px',
              fontFamily: 'Inter, system-ui, sans-serif',
            },
            success: {
              iconTheme: {
                primary: '#10b981',
                secondary: '#fff',
              },
            },
            error: {
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  );
}
