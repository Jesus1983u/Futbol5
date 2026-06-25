// =====================================================================
// Historial — con quién ha jugado cada usuario en el mismo equipo,
// con el desglose de victorias, empates y derrotas juntos.
// Cada jugador solo ve sus propias parejas, no las del resto.
// =====================================================================

import { useEffect, useMemo, useState } from 'react';
import { listarMisCompaneros, type CompaneroConHistorial } from '../lib/partidos';
import { useAuth } from '../hooks/useAuth';
import { IconGrupo } from '../components/icons';

export function Historial() {
  const { jugador } = useAuth();
  const [companeros, setCompaneros] = useState<CompaneroConHistorial[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    if (!jugador) return;
    listarMisCompaneros(jugador.id)
      .then(setCompaneros)
      .catch(() => setError('No se pudo cargar el historial.'));
  }, [jugador]);

  const filtrados = useMemo(() => {
    if (!companeros) return [];
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return companeros;
    return companeros.filter((c) => c.nombre.toLowerCase().includes(termino));
  }, [companeros, busqueda]);

  return (
    <div className="mx-auto min-h-screen max-w-sm px-6 py-10">
      <h1 className="flex items-center gap-2 font-display text-2xl uppercase tracking-wide text-chalk">
        <IconGrupo className="h-6 w-6 text-floodlight" />
        Mis compañeros
      </h1>
      <p className="mt-1 font-body text-sm text-muted">
        Con quién has jugado en el mismo equipo y cómo os fue.
      </p>

      {error && <p className="mt-6 font-body text-sm text-danger">{error}</p>}
      {!error && companeros === null && (
        <p className="mt-6 font-body text-sm text-muted">Cargando…</p>
      )}
      {!error && companeros?.length === 0 && (
        <p className="mt-6 font-body text-sm text-muted">
          Todavía no has jugado ningún partido registrado.
        </p>
      )}

      {companeros && companeros.length > 0 && (
        <>
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar compañero…"
            className="mt-4 w-full rounded-md border border-pitch-line bg-pitch-mid px-3 py-2 font-body text-sm text-chalk placeholder:text-muted focus:border-floodlight"
          />

          {busqueda && filtrados.length === 0 && (
            <p className="mt-4 font-body text-sm text-muted">
              Ningún compañero con ese nombre.
            </p>
          )}

          {/* Cabecera de columnas */}
          {filtrados.length > 0 && (
            <div className="mt-4 grid grid-cols-[1fr_2rem_2rem_2rem_2rem] items-center gap-1 px-3 font-body text-[11px] uppercase tracking-wide text-muted">
              <span>Compañero</span>
              <span className="text-center">PJ</span>
              <span className="text-center text-confirmed">G</span>
              <span className="text-center">E</span>
              <span className="text-center text-danger">P</span>
            </div>
          )}

          <div className="mt-1 space-y-1">
            {filtrados.map((c) => (
              <div
                key={c.nombre}
                className="grid grid-cols-[1fr_2rem_2rem_2rem_2rem] items-center gap-1 rounded-md border border-pitch-line bg-pitch-mid px-3 py-2"
              >
                <span className="truncate font-body text-sm text-chalk">{c.nombre}</span>
                <span className="text-center font-display text-sm tabular-nums text-floodlight">
                  {c.veces}
                </span>
                <span className="text-center font-body text-sm tabular-nums text-confirmed">
                  {c.victorias}
                </span>
                <span className="text-center font-body text-sm tabular-nums text-muted">
                  {c.empates}
                </span>
                <span className="text-center font-body text-sm tabular-nums text-danger">
                  {c.derrotas}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
