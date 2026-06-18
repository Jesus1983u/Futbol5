// =====================================================================
// Historial — con quién ha jugado más veces cada cual en el mismo
// equipo. Es la misma tabla que alimenta al generador de equipos
// (para evitar repetir siempre las mismas parejas); esta pantalla
// simplemente la hace visible.
//
// Con un grupo grande, el número de parejas crece muy rápido (combina-
// torio: 20 jugadores ya dan 190 parejas posibles), así que por defecto
// solo se ven las que más se repiten, con un buscador para encontrar a
// alguien concreto sin tener que bajar a pulso por toda la lista.
// =====================================================================

import { useEffect, useMemo, useState } from 'react';
import { listarHistorialCompaneros, type ParConNombres } from '../lib/partidos';
import { IconGrupo } from '../components/icons';

const TOPE_INICIAL = 15;

export function Historial() {
  const [pares, setPares] = useState<ParConNombres[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [verTodas, setVerTodas] = useState(false);

  useEffect(() => {
    listarHistorialCompaneros()
      .then(setPares)
      .catch(() => setError('No se pudo cargar el historial.'));
  }, []);

  const filtradas = useMemo(() => {
    if (!pares) return [];
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return pares;
    return pares.filter(
      (p) => p.nombreA.toLowerCase().includes(termino) || p.nombreB.toLowerCase().includes(termino)
    );
  }, [pares, busqueda]);

  const hayMasDeLasMostradas = !busqueda && filtradas.length > TOPE_INICIAL;
  const visibles = !busqueda && !verTodas ? filtradas.slice(0, TOPE_INICIAL) : filtradas;

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
        <>
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre…"
            className="mt-4 w-full rounded-md border border-pitch-line bg-pitch-mid px-3 py-2 font-body text-sm text-chalk placeholder:text-muted focus:border-floodlight"
          />

          {busqueda && filtradas.length === 0 && (
            <p className="mt-4 font-body text-sm text-muted">Nadie con ese nombre en el historial.</p>
          )}

          <div className="mt-4 space-y-2">
            {visibles.map((p, indice) => (
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

          {hayMasDeLasMostradas && (
            <button
              onClick={() => setVerTodas(true)}
              className="mt-3 w-full rounded-md border border-pitch-line py-2 font-body text-sm text-muted hover:text-chalk"
            >
              Ver todas ({filtradas.length})
            </button>
          )}
        </>
      )}
    </div>
  );
}
