// =====================================================================
// GenerarEquiposPanel — la pieza que conecta teamGenerator.ts (ya
// construido y probado en la Fase 1) con una pantalla real.
// =====================================================================
// Muestra los equipos ya guardados si existen; si es admin, permite
// (re)generar una propuesta nueva y, tras revisarla, confirmarla para
// guardarla en las inscripciones correspondientes.
// =====================================================================

import { useState } from 'react';
import { construirMapaHistorial, generarEquipos, type ResultadoGeneracion } from '../lib/teamGenerator';
import { guardarEquipos, obtenerHistorialPares } from '../lib/partidos';
import type { InscripcionConJugador } from '../types/database';

interface GenerarEquiposPanelProps {
  confirmados: InscripcionConJugador[];
  esAdmin: boolean;
  onEquiposGuardados: () => void;
}

export function GenerarEquiposPanel({
  confirmados,
  esAdmin,
  onEquiposGuardados,
}: GenerarEquiposPanelProps) {
  const [propuesta, setPropuesta] = useState<ResultadoGeneracion | null>(null);
  const [generando, setGenerando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const yaAsignados = confirmados.length > 0 && confirmados.every((i) => i.equipo !== null);
  const suficientesJugadores = confirmados.length >= 2;

  async function generar() {
    setError(null);
    setGenerando(true);
    try {
      const pares = await obtenerHistorialPares();
      const historial = construirMapaHistorial(pares);
      const jugadoresParaGenerador = confirmados.map((i) => ({
        id: i.jugador.id,
        nombre: i.jugador.nombre,
        rating: i.jugador.rating_actual,
        posicion: i.jugador.posicion_preferida,
      }));
      setPropuesta(generarEquipos(jugadoresParaGenerador, historial));
    } catch {
      setError('No se pudo generar los equipos. Inténtalo de nuevo.');
    } finally {
      setGenerando(false);
    }
  }

  async function confirmar() {
    if (!propuesta) return;
    setError(null);
    setGuardando(true);
    const idsPorJugador = new Map(confirmados.map((i) => [i.jugador.id, i.id]));
    const asignaciones = [
      ...propuesta.equipoA.jugadores.map((j) => ({
        inscripcionId: idsPorJugador.get(j.id)!,
        equipo: 'A' as const,
      })),
      ...propuesta.equipoB.jugadores.map((j) => ({
        inscripcionId: idsPorJugador.get(j.id)!,
        equipo: 'B' as const,
      })),
    ];
    const { error } = await guardarEquipos(asignaciones);
    setGuardando(false);
    if (error) {
      setError('No se pudieron guardar los equipos.');
      return;
    }
    setPropuesta(null);
    onEquiposGuardados();
  }

  if (!suficientesJugadores) {
    return (
      <section className="mt-4 rounded-lg border border-pitch-line bg-pitch-mid p-4">
        <p className="font-body text-xs uppercase tracking-wide text-muted">Equipos</p>
        <p className="mt-1 font-body text-sm text-muted">
          Hacen falta al menos 2 jugadores confirmados para generar equipos.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-4 rounded-lg border border-pitch-line bg-pitch-mid p-4">
      <div className="flex items-center justify-between">
        <p className="font-body text-xs uppercase tracking-wide text-muted">Equipos</p>
        {esAdmin && !propuesta && (
          <button
            onClick={() => void generar()}
            disabled={generando}
            className="font-body text-xs font-semibold uppercase tracking-wide text-floodlight hover:text-floodlight-dim disabled:opacity-60"
          >
            {generando ? 'Generando…' : yaAsignados ? 'Regenerar' : 'Generar equipos'}
          </button>
        )}
      </div>

      {error && <p className="mt-2 font-body text-sm text-danger">{error}</p>}

      {!propuesta && yaAsignados && (
        <DosEquipos
          equipoA={confirmados.filter((i) => i.equipo === 'A')}
          equipoB={confirmados.filter((i) => i.equipo === 'B')}
        />
      )}

      {!propuesta && !yaAsignados && (
        <p className="mt-2 font-body text-sm text-muted">
          {esAdmin
            ? 'Todavía no se han generado los equipos para este partido.'
            : 'El administrador todavía no ha publicado los equipos.'}
        </p>
      )}

      {propuesta && (
        <div className="mt-2">
          <PreviewEquipos propuesta={propuesta} />
          <p className="mt-2 font-body text-xs text-muted">
            Diferencia de rating: {propuesta.diferenciaRating} pts · método {propuesta.metodo} ·{' '}
            {propuesta.combinacionesEvaluadas} combinaciones evaluadas
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={confirmar}
              disabled={guardando}
              className="flex-1 rounded-md bg-floodlight px-3 py-2 font-display text-sm font-semibold uppercase tracking-wide text-pitch-deep hover:bg-floodlight-dim disabled:opacity-60"
            >
              {guardando ? 'Guardando…' : 'Confirmar equipos'}
            </button>
            <button
              onClick={() => setPropuesta(null)}
              disabled={guardando}
              className="rounded-md border border-pitch-line px-3 py-2 font-body text-sm text-muted hover:text-chalk"
            >
              Descartar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function PreviewEquipos({ propuesta }: { propuesta: ResultadoGeneracion }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <ColumnaEquipo
        titulo="Equipo A"
        nombres={propuesta.equipoA.jugadores.map((j) => j.nombre)}
        rating={propuesta.equipoA.ratingTotal}
      />
      <ColumnaEquipo
        titulo="Equipo B"
        nombres={propuesta.equipoB.jugadores.map((j) => j.nombre)}
        rating={propuesta.equipoB.ratingTotal}
      />
    </div>
  );
}

function DosEquipos({
  equipoA,
  equipoB,
}: {
  equipoA: InscripcionConJugador[];
  equipoB: InscripcionConJugador[];
}) {
  const rating = (lista: InscripcionConJugador[]) =>
    Math.round(lista.reduce((s, i) => s + i.jugador.rating_actual, 0) * 10) / 10;

  return (
    <div className="mt-2 grid grid-cols-2 gap-3">
      <ColumnaEquipo
        titulo="Equipo A"
        nombres={equipoA.map((i) => i.jugador.nombre)}
        rating={rating(equipoA)}
      />
      <ColumnaEquipo
        titulo="Equipo B"
        nombres={equipoB.map((i) => i.jugador.nombre)}
        rating={rating(equipoB)}
      />
    </div>
  );
}

function ColumnaEquipo({
  titulo,
  nombres,
  rating,
}: {
  titulo: string;
  nombres: string[];
  rating: number;
}) {
  return (
    <div className="rounded-md border border-pitch-line bg-pitch-deep p-3">
      <div className="flex items-baseline justify-between">
        <p className="font-display text-sm uppercase tracking-wide text-chalk">{titulo}</p>
        <p className="font-display text-sm tabular-nums text-floodlight">{rating}</p>
      </div>
      <ul className="mt-2 space-y-1">
        {nombres.map((nombre, indice) => (
          <li key={`${nombre}-${indice}`} className="font-body text-sm text-chalk">
            {nombre}
          </li>
        ))}
      </ul>
    </div>
  );
}
