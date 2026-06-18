import { Navigate, Route, BrowserRouter, Routes } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { RequireAuth } from './components/RequireAuth';
import { RequireAdmin } from './components/RequireAdmin';
import { AppLayout } from './components/AppLayout';
import { Login } from './pages/Login';
import { Perfil } from './pages/Perfil';
import { Partidos } from './pages/Partidos';
import { PartidoDetalle } from './pages/PartidoDetalle';
import { CrearPartido } from './pages/CrearPartido';
import { Pagos } from './pages/Pagos';
import { AdminPanel } from './pages/AdminPanel';
import { Votacion } from './pages/Votacion';
import { Clasificacion } from './pages/Clasificacion';
import { Historial } from './pages/Historial';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            element={
              <RequireAuth>
                <AppLayout />
              </RequireAuth>
            }
          >
            <Route path="/partidos" element={<Partidos />} />
            <Route
              path="/partidos/nuevo"
              element={
                <RequireAdmin>
                  <CrearPartido />
                </RequireAdmin>
              }
            />
            <Route path="/partidos/:id" element={<PartidoDetalle />} />
            <Route
              path="/pagos"
              element={
                <RequireAdmin>
                  <Pagos />
                </RequireAdmin>
              }
            />
            <Route
              path="/admin"
              element={
                <RequireAdmin>
                  <AdminPanel />
                </RequireAdmin>
              }
            />
            <Route path="/votacion" element={<Votacion />} />
            <Route path="/clasificacion" element={<Clasificacion />} />
            <Route path="/historial" element={<Historial />} />
            <Route path="/perfil" element={<Perfil />} />
          </Route>

          {/* Pagos y panel de administrador llegan en las siguientes fases. */}
          <Route path="*" element={<Navigate to="/partidos" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
