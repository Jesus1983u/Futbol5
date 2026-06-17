import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

/** Envoltorio compartido por todas las pantallas autenticadas: el
 *  contenido de cada página + una barra de pestañas fija abajo, el
 *  patrón habitual en apps de móvil para 2-3 secciones principales.
 *  La pestaña "Pagos" solo aparece para el administrador. */
export function AppLayout() {
  const { esAdmin } = useAuth();

  return (
    <div className="min-h-screen pb-16">
      <Outlet />
      <nav className="fixed inset-x-0 bottom-0 flex border-t border-pitch-line bg-pitch-mid">
        <Pestaña to="/partidos" etiqueta="Partidos" />
        {esAdmin && <Pestaña to="/pagos" etiqueta="Pagos" />}
        {esAdmin && <Pestaña to="/admin" etiqueta="Admin" />}
        <Pestaña to="/perfil" etiqueta="Mi perfil" />
      </nav>
    </div>
  );
}

function Pestaña({ to, etiqueta }: { to: string; etiqueta: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex-1 py-3 text-center font-body text-sm transition-colors ${
          isActive ? 'text-floodlight' : 'text-muted hover:text-chalk'
        }`
      }
    >
      {etiqueta}
    </NavLink>
  );
}
