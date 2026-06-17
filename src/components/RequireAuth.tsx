import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';

/** Envuelve rutas que necesitan una sesión iniciada. Mientras se resuelve
 *  el estado de autenticación muestra un loader; si no hay sesión, manda
 *  a /login conservando a dónde quería ir la persona. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { estado } = useAuth();
  const location = useLocation();

  if (estado === 'cargando') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="font-body text-sm text-muted">Comprobando tu sesión…</p>
      </div>
    );
  }

  if (estado === 'sin_sesion') {
    return <Navigate to="/login" state={{ desde: location.pathname }} replace />;
  }

  return <>{children}</>;
}
