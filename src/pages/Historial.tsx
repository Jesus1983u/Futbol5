// =====================================================================
// Historial — con quién ha jugado más veces cada cual en el mismo
// equipo. Es la misma tabla que alimenta al generador de equipos
// (para evitar repetir siempre las mismas parejas); esta pantalla
// simplemente la hace visible.
// =====================================================================

import { useEffect, useState } from 'react';
import { listarHistorialCompaneros, type ParConNombres } from '../lib/partidos';
import { IconGrupo } from '../components/icons';

export function Historial() {
  const [pares, setPares] = useState<ParConNombres[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listarHistorialCompaneros()
      .then(setPares)
      .catch(() => setError('No se pudo cargar el historial.'));
  }, []);

  return (
    <div className="mx-auto min-h-screen max-w-sm px-6 py-10">
      <h1 className="flex items-center gap-2 font-display text-2xl uppercase tracking-wide text-chalk">
        <IconGrupo className="h-6 w-6 text-floodlight" />
        Historial de compañeros
      </h1>
      <p className="mt-1 font-body text-sm text-muted">
        Veces que cada pareja ha coincidido en el mismo equipo.
      </p>

      {error && <p className="mt-6 font-body text-sm text-danger">{error}</p>}
      {!error && pares === null && <p className="mt-6 font-body text-sm text-muted">Cargando…</p>}
      {!error && pares?.length === 0 && (
        <p className="mt-6 font-body text-sm text-muted">
          Todavía no hay suficientes partidos jugados para tener historial.
        </p>
      )}

      {pares && pares.length > 0 && (
        <div className="mt-6 space-y-2">
          {pares.map((p, indice) => (
            <div
              key={`${p.nombreA}-${p.nombreB}-${indice}`}
              className="flex items-center justify-between rounded-md border border-pitch-line bg-pitch-mid p-3"
            >
              <span className="font-body text-sm text-chalk">
                {p.nombreA} <span className="text-muted">+</span> {p.nombreB}
              </span>
              <span className="font-display text-sm tabular-nums text-floodlight">
                {p.veces}×
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
