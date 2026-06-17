import { Avatar } from './Avatar';
import type { InscripcionConJugador } from '../types/database';

interface RosterItemProps {
  inscripcion: InscripcionConJugador;
  esPropia: boolean;
  esAdmin: boolean;
  onQuitar: (inscripcionId: string) => void;
  procesando: boolean;
  soloLectura?: boolean;
  onTogglePago?: (inscripcionId: string) => void;
}

export function RosterItem({
  inscripcion,
  esPropia,
  esAdmin,
  onQuitar,
  procesando,
  soloLectura = false,
  onTogglePago,
}: RosterItemProps) {
  const { jugador } = inscripcion;
  const puedeQuitar = (esPropia || esAdmin) && !soloLectura;
  const pagado = inscripcion.pago_estado === 'pagado';

  return (
    <div className="flex items-center gap-3 py-2">
      <Avatar nombre={jugador.nombre} apellidos={jugador.apellidos} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-body text-sm text-chalk">
          {jugador.nombre} {jugador.apellidos}
          {jugador.tipo === 'invitado' && (
            <span className="ml-1.5 font-body text-xs text-muted">(invitado)</span>
          )}
        </p>
        <p className="font-body text-xs capitalize text-muted">{jugador.posicion_preferida}</p>
      </div>
      {esAdmin && onTogglePago && (
        <button
          onClick={() => onTogglePago(inscripcion.id)}
          disabled={procesando}
          className={`font-body text-xs font-medium underline-offset-2 hover:underline disabled:opacity-60 ${
            pagado ? 'text-confirmed' : 'text-floodlight'
          }`}
          title="Tocar para cambiar el estado de pago"
        >
          {pagado ? 'Pagado' : 'Pendiente'}
        </button>
      )}
      {esAdmin && !onTogglePago && (
        <span
          className={`font-body text-xs font-medium ${pagado ? 'text-confirmed' : 'text-floodlight'}`}
        >
          {pagado ? 'Pagado' : 'Pendiente'}
        </span>
      )}
      {puedeQuitar && (
        <button
          onClick={() => onQuitar(inscripcion.id)}
          disabled={procesando}
          className="font-body text-xs text-muted hover:text-danger disabled:opacity-60"
        >
          Quitar
        </button>
      )}
    </div>
  );
}
