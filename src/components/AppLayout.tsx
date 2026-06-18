import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { IconBalon, IconEngranaje, IconMoneda, IconPersona } from './icons';

/** Envoltorio compartido por todas las pantallas autenticadas: el
 *  contenido de cada página + una barra de pestañas fija abajo, el
 *  patrón habitual en apps de móvil para 2-4 secciones principales.
 *  Las pestañas "Pagos" y "Admin" solo aparecen para el administrador. */
export function AppLayout() {
  const { esAdmin } = useAuth();

  return (
    <div className="min-h-screen pb-16">
      <Outlet />
      <nav className="fixed inset-x-0 bottom-0 flex border-t border-pitch-line bg-pitch-mid">
        <Pestaña to="/partidos" etiqueta="Partidos" Icono={IconBalon} />
        {esAdmin && <Pestaña to="/pagos" etiqueta="Pagos" Icono={IconMoneda} />}
        {esAdmin && <Pestaña to="/admin" etiqueta="Admin" Icono={IconEngranaje} />}
        <Pestaña to="/perfil" etiqueta="Mi perfil" Icono={IconPersona} />
      </nav>
    </div>
  );
}

function Pestaña({
  to,
  etiqueta,
  Icono,
}: {
  to: string;
  etiqueta: string;
  Icono: (props: { className?: string }) => JSX.Element;
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex flex-1 flex-col items-center gap-0.5 py-2.5 font-body text-xs transition-colors ${
          isActive ? 'text-floodlight' : 'text-muted hover:text-chalk'
        }`
      }
    >
      <Icono className="h-5 w-5" />
      {etiqueta}
    </NavLink>
  );
}
