// =====================================================================
// Clasificacion — la general del grupo, como una tabla de liga: puntos
// por victoria/empate/derrota, no el rating Elo (eso vive en el
// perfil de cada uno). Son dos cosas distintas a propósito: el rating
// mide nivel para repartir equipos parejos, la clasificación es solo
// "quién ha sumado más puntos jugando", como cualquier liga de barrio.
// =====================================================================

import { useEffect, useState } from 'react';
import { listarEstadisticas } from '../lib/partidos';
import type { EstadisticasJugador } from '../types/database';
import { Avatar } from '../components/Avatar';
import { IconTrofeo } from '../components/icons';

// Convenio de puntos. 3-1-0 es el estándar del fútbol moderno desde
// 1981; si el grupo prefiere el clásico 2-1-0, solo hay que cambiar
// PUNTOS_VICTORIA aquí.
const PUNTOS_VICTORIA = 3;
const PUNTOS_EMPATE = 1;

interface FilaClasificacion extends EstadisticasJugador {
  puntos: number;
}

export function Clasificacion() {
  const [filas, setFilas] = useState<FilaClasificacion[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listarEstadisticas()
      .then((datos) => {
        const conPuntos = datos
          .filter((d) => d.partidos_jugados > 0)
          .map((d) => ({
            ...d,
            puntos: d.victorias * PUNTOS_VICTORIA + d.empates * PUNTOS_EMPATE,
          }))
          .sort((a, b) => b.puntos - a.puntos || b.victorias - a.victorias);
        setFilas(conPuntos);
      })
      .catch(() => setError('No se pudo cargar la clasificación.'));
  }, []);

  return (
    <div className="mx-auto min-h-screen max-w-sm px-6 py-10">
      <h1 className="flex items-center gap-2 font-display text-2xl uppercase tracking-wide text-chalk">
        <IconTrofeo className="h-6 w-6 text-floodlight" />
        Clasificación
      </h1>
      <p className="mt-1 font-body text-sm text-muted">
        {PUNTOS_VICTORIA} puntos por victoria, {PUNTOS_EMPATE} por empate.
      </p>

      {error && <p className="mt-6 font-body text-sm text-danger">{error}</p>}
      {!error && filas === null && <p className="mt-6 font-body text-sm text-muted">Cargando…</p>}
      {!error && filas?.length === 0 && (
        <p className="mt-6 font-body text-sm text-muted">
          Todavía no se ha jugado ningún partido con resultado.
        </p>
      )}

      {filas && filas.length > 0 && (
        <div className="mt-6 overflow-hidden rounded-lg border border-pitch-line">
          <div className="grid grid-cols-[1.5rem_1fr_2.25rem_2.25rem_2.25rem_2.25rem_3rem] items-center gap-1 bg-pitch-mid px-2 py-2 font-body text-[11px] uppercase tracking-wide text-muted">
            <span>#</span>
            <span>Jugador</span>
            <span className="text-center">PJ</span>
            <span className="text-center">V</span>
            <span className="text-center">E</span>
            <span className="text-center">D</span>
            <span className="text-right">Pts</span>
          </div>
          {filas.map((f, indice) => (
            <div
              key={f.id}
              className="grid grid-cols-[1.5rem_1fr_2.25rem_2.25rem_2.25rem_2.25rem_3rem] items-center gap-1 border-t border-pitch-line px-2 py-2"
            >
              <span className="font-display text-sm tabular-nums text-muted">{indice + 1}</span>
              <span className="flex min-w-0 items-center gap-2">
                <Avatar nombre={f.nombre} apellidos={f.apellidos} />
                <span className="min-w-0 flex-1 truncate font-body text-sm text-chalk">
                  {f.nombre} {f.apellidos}
                </span>
              </span>
              <span className="text-center font-body text-sm tabular-nums text-muted">
                {f.partidos_jugados}
              </span>
              <span className="text-center font-body text-sm tabular-nums text-confirmed">
                {f.victorias}
              </span>
              <span className="text-center font-body text-sm tabular-nums text-muted">
                {f.empates}
              </span>
              <span className="text-center font-body text-sm tabular-nums text-danger">
                {f.derrotas}
              </span>
              <span className="text-right font-display text-sm tabular-nums text-floodlight">
                {f.puntos}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
