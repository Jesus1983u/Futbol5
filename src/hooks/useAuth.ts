// =====================================================================
// useAuth — hook de conveniencia sobre AuthContext.
// =====================================================================

import { useAuthContext } from '../contexts/AuthContext';

export function useAuth() {
  const ctx = useAuthContext();
  return {
    ...ctx,
    esAdmin: ctx.jugador?.rol === 'admin',
  };
}
