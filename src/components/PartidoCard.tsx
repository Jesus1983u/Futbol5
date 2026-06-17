import { Link } from 'react-router-dom';
import type { PartidoConContador } from '../types/database';
import { formatearFechaCorta, formatearHora } from '../lib/fecha';
import { EstadoBadge } from './EstadoBadge';

export function PartidoCard({ partido }: { partido: PartidoConContador }) {
  const lleno = partido.confirmados >= partido.jugadores_max;

  return (
    <Link
      to={`/partidos/${partido.id}`}
      className="block rounded-lg border border-pitch-line bg-pitch-mid p-4 transition-colors hover:border-floodlight"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="font-display text-base uppercase tracking-wide text-chalk">
            {formatearFechaCorta(partido.fecha)} · {formatearHora(partido.hora)}
          </p>
          <p className="mt-1 font-body text-sm text-muted">{partido.campo}</p>
        </div>
        <EstadoBadge estado={partido.estado} />
      </div>

      <div className="mt-3 flex items-center justify-between">
        <p className="font-body text-sm tabular-nums text-chalk">
          {partido.confirmados} / {partido.jugadores_max} jugadores
          {lleno && partido.estado === 'abierto' && (
            <span className="ml-1 text-floodlight">· lista de espera</span>
          )}
        </p>
        {partido.estado === 'jugado' &&
          partido.resultado_goles_a !== null &&
          partido.resultado_goles_b !== null && (
            <p className="font-display text-lg tabular-nums text-floodlight">
              {partido.resultado_goles_a} - {partido.resultado_goles_b}
            </p>
          )}
      </div>
    </Link>
  );
}
