import type { ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';

/** Envuelve pantallas solo para el administrador. Asume que ya está
 *  dentro de un <RequireAuth>, así que aquí solo hace falta comprobar
 *  el rol una vez el jugador está cargado. */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { jugador, esAdmin } = useAuth();

  if (!jugador) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="font-body text-sm text-muted">Cargando tu perfil…</p>
      </div>
    );
  }

  if (!esAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 px-6 text-center">
        <p className="font-display text-lg text-chalk">Acceso restringido</p>
        <p className="font-body text-sm text-muted">
          Esta sección es solo para el administrador del grupo.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
