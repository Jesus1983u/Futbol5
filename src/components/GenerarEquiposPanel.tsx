// =====================================================================
// GenerarEquiposPanel — la pieza que conecta teamGenerator.ts (ya
// construido y probado en la Fase 1) con una pantalla real.
// =====================================================================
// Muestra los equipos ya guardados si existen; si es admin, permite
// elegir entre generación automática (el algoritmo de siempre) o
// armar los equipos a mano, jugador a jugador. En ambos casos, al
// confirmar se guarda exactamente igual (`guardarEquipos`), así que
// una vez guardados no hay ninguna diferencia entre un equipo
// generado y uno armado a mano.
// =====================================================================

import { useState } from 'react';
import { construirMapaSinergia, generarEquipos, type ResultadoGeneracion } from '../lib/teamGenerator';
import { guardarEquipos, obtenerHistorialPares } from '../lib/partidos';
import type { InscripcionConJugador } from '../types/database';

interface GenerarEquiposPanelProps {
  confirmados: InscripcionConJugador[];
  esAdmin: boolean;
  onEquiposGuardados: () => void;
}

type ModoCreacion = 'elegir' | 'automatico' | 'manual';

export function GenerarEquiposPanel({
  confirmados,
  esAdmin,
  onEquiposGuardados,
}: GenerarEquiposPanelProps) {
  const [modo, setModo] = useState<ModoCreacion>('elegir');
  const [forzandoRehacer, setForzandoRehacer] = useState(false);
  const [propuesta, setPropuesta] = useState<ResultadoGeneracion | null>(null);
  const [generando, setGenerando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const yaAsignados = confirmados.length > 0 && confirmados.every((i) => i.equipo !== null);
  const suficientesJugadores = confirmados.length >= 2;
  const mostrarSelector = modo === 'elegir' && (!yaAsignados || forzandoRehacer);

  async function generar() {
    setError(null);
    setGenerando(true);
    try {
      const pares = await obtenerHistorialPares();
      const sinergia = construirMapaSinergia(
        pares.map((p) => ({
          jugadorA: p.jugadorA,
          jugadorB: p.jugadorB,
          partidos: p.veces,
          victorias: p.victorias,
          derrotas: p.derrotas,
          empates: p.empates,
        }))
      );
      const jugadoresParaGenerador = confirmados.map((i) => ({
        id: i.jugador.id,
        nombre: i.jugador.nombre,
        apellidos: i.jugador.apellidos,
        rating: i.jugador.rating_actual,
        posicion: i.jugador.posicion_preferida,
        impactoVictoria: i.jugador.impacto_victoria,
      }));
      setPropuesta(generarEquipos(jugadoresParaGenerador, sinergia));
    } catch {
      setError('No se pudo generar los equipos. Inténtalo de nuevo.');
    } finally {
      setGenerando(false);
    }
  }

  async function confirmarAutomatico() {
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
    setModo('elegir');
    setForzandoRehacer(false);
    onEquiposGuardados();
  }

  function reiniciar() {
    setPropuesta(null);
    setModo('elegir');
    setForzandoRehacer(false);
    setError(null);
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
        {esAdmin && modo === 'elegir' && yaAsignados && !forzandoRehacer && (
          <button
            onClick={() => setForzandoRehacer(true)}
            className="font-body text-xs font-semibold uppercase tracking-wide text-floodlight hover:text-floodlight-dim"
          >
            Rehacer
          </button>
        )}
      </div>

      {error && <p className="mt-2 font-body text-sm text-danger">{error}</p>}

      {mostrarSelector && esAdmin && (
        <SelectorModo
          onAutomatico={() => {
            setModo('automatico');
            void generar();
          }}
          onManual={() => setModo('manual')}
        />
      )}

      {modo === 'elegir' && !mostrarSelector && yaAsignados && (
        <DosEquipos
          equipoA={confirmados.filter((i) => i.equipo === 'A')}
          equipoB={confirmados.filter((i) => i.equipo === 'B')}
        />
      )}

      {mostrarSelector && !esAdmin && (
        <p className="mt-2 font-body text-sm text-muted">
          El administrador todavía no ha publicado los equipos.
        </p>
      )}

      {modo === 'automatico' && (
        <div className="mt-2">
          {generando && <p className="font-body text-sm text-muted">Generando…</p>}
          {propuesta && (
            <>
              <PreviewEquipos propuesta={propuesta} />
              <p className="mt-2 font-body text-xs text-muted">
                Diferencia de rating: {propuesta.diferenciaRating} pts · método {propuesta.metodo}{' '}
                · {propuesta.combinacionesEvaluadas} combinaciones evaluadas
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => void confirmarAutomatico()}
                  disabled={guardando}
                  className="flex-1 rounded-md bg-floodlight px-3 py-2 font-display text-sm font-semibold uppercase tracking-wide text-pitch-deep hover:bg-floodlight-dim disabled:opacity-60"
                >
                  {guardando ? 'Guardando…' : 'Confirmar equipos'}
                </button>
                <button
                  onClick={() => void generar()}
                  disabled={guardando || generando}
                  className="rounded-md border border-pitch-line px-3 py-2 font-body text-sm text-muted hover:text-chalk"
                >
                  Regenerar
                </button>
                <button
                  onClick={reiniciar}
                  disabled={guardando}
                  className="rounded-md border border-pitch-line px-3 py-2 font-body text-sm text-muted hover:text-chalk"
                >
                  Cancelar
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {modo === 'manual' && (
        <EquiposManual
          confirmados={confirmados}
          onCancelar={reiniciar}
          onGuardado={() => {
            setModo('elegir');
            setForzandoRehacer(false);
            onEquiposGuardados();
          }}
        />
      )}
    </section>
  );
}

function SelectorModo({
  onAutomatico,
  onManual,
}: {
  onAutomatico: () => void;
  onManual: () => void;
}) {
  return (
    <div className="mt-2 grid grid-cols-2 gap-2">
      <button
        onClick={onAutomatico}
        className="rounded-md border border-pitch-line bg-pitch-deep px-3 py-3 text-center hover:border-floodlight"
      >
        <span className="block text-xl">🤖</span>
        <span className="mt-1 block font-body text-xs text-chalk">Generación automática</span>
      </button>
      <button
        onClick={onManual}
        className="rounded-md border border-pitch-line bg-pitch-deep px-3 py-3 text-center hover:border-floodlight"
      >
        <span className="block text-xl">✋</span>
        <span className="mt-1 block font-body text-xs text-chalk">Equipos manuales</span>
      </button>
    </div>
  );
}

/** Armar equipos a mano, jugador a jugador. En vez de arrastrar de
 *  verdad (el drag-and-drop nativo del navegador no funciona bien con
 *  el dedo en móvil sin añadir una librería aparte, y esta app se usa
 *  sobre todo desde el móvil), aquí se toca a un jugador y pasa al
 *  otro equipo — mismo resultado, más fiable en pantalla táctil. */
function EquiposManual({
  confirmados,
  onCancelar,
  onGuardado,
}: {
  confirmados: InscripcionConJugador[];
  onCancelar: () => void;
  onGuardado: () => void;
}) {
  // Arranque: reparto inicial simple alternando por rating, solo para
  // no empezar con todo el mundo amontonado en un lado — el admin
  // puede mover a quien quiera desde ahí.
  const [asignacion, setAsignacion] = useState<Map<string, 'A' | 'B'>>(() => {
    const ordenados = [...confirmados].sort((a, b) => b.jugador.rating_actual - a.jugador.rating_actual);
    const mapa = new Map<string, 'A' | 'B'>();
    ordenados.forEach((i, indice) => {
      mapa.set(i.jugador.id, indice % 2 === 0 ? 'A' : 'B');
    });
    return mapa;
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function mover(jugadorId: string) {
    setAsignacion((previo) => {
      const copia = new Map(previo);
      copia.set(jugadorId, previo.get(jugadorId) === 'A' ? 'B' : 'A');
      return copia;
    });
  }

  const equipoA = confirmados.filter((i) => asignacion.get(i.jugador.id) === 'A');
  const equipoB = confirmados.filter((i) => asignacion.get(i.jugador.id) === 'B');
  const ratingDe = (lista: InscripcionConJugador[]) =>
    Math.round(lista.reduce((s, i) => s + i.jugador.rating_actual, 0) * 10) / 10;

  async function guardar() {
    setError(null);
    if (equipoA.length === 0 || equipoB.length === 0) {
      setError('Cada equipo necesita al menos un jugador.');
      return;
    }
    setGuardando(true);
    const asignaciones = confirmados.map((i) => ({
      inscripcionId: i.id,
      equipo: asignacion.get(i.jugador.id) ?? 'A',
    }));
    const { error } = await guardarEquipos(asignaciones);
    setGuardando(false);
    if (error) {
      setError('No se pudieron guardar los equipos.');
      return;
    }
    onGuardado();
  }

  return (
    <div className="mt-2">
      <p className="font-body text-xs text-muted">
        Toca a un jugador para pasarlo al otro equipo.
      </p>

      <div className="mt-2 grid grid-cols-2 gap-3">
        <ColumnaManual
          titulo="Equipo A"
          inscripciones={equipoA}
          rating={ratingDe(equipoA)}
          onTocar={mover}
        />
        <ColumnaManual
          titulo="Equipo B"
          inscripciones={equipoB}
          rating={ratingDe(equipoB)}
          onTocar={mover}
        />
      </div>

      {error && <p className="mt-2 font-body text-sm text-danger">{error}</p>}

      <div className="mt-3 flex gap-2">
        <button
          onClick={() => void guardar()}
          disabled={guardando}
          className="flex-1 rounded-md bg-floodlight px-3 py-2 font-display text-sm font-semibold uppercase tracking-wide text-pitch-deep hover:bg-floodlight-dim disabled:opacity-60"
        >
          {guardando ? 'Guardando…' : 'Guardar equipos'}
        </button>
        <button
          onClick={onCancelar}
          disabled={guardando}
          className="rounded-md border border-pitch-line px-3 py-2 font-body text-sm text-muted hover:text-chalk"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

function ColumnaManual({
  titulo,
  inscripciones,
  rating,
  onTocar,
}: {
  titulo: string;
  inscripciones: InscripcionConJugador[];
  rating: number;
  onTocar: (jugadorId: string) => void;
}) {
  return (
    <div className="rounded-md border border-pitch-line bg-pitch-deep p-3">
      <div className="flex items-baseline justify-between">
        <p className="font-display text-sm uppercase tracking-wide text-chalk">{titulo}</p>
        <p className="font-display text-sm tabular-nums text-floodlight">{rating}</p>
      </div>
      <ul className="mt-2 space-y-1">
        {inscripciones.map((i) => (
          <li key={i.id}>
            <button
              onClick={() => onTocar(i.jugador.id)}
              className="w-full rounded px-1.5 py-1 text-left font-body text-sm text-chalk transition-colors hover:bg-pitch-line"
            >
              {nombreCompleto(i.jugador.nombre, i.jugador.apellidos)}
            </button>
          </li>
        ))}
        {inscripciones.length === 0 && (
          <li className="font-body text-xs text-muted">Sin jugadores</li>
        )}
      </ul>
    </div>
  );
}

function nombreCompleto(nombre: string, apellidos: string | null | undefined): string {
  return apellidos ? `${nombre} ${apellidos}` : nombre;
}

function PreviewEquipos({ propuesta }: { propuesta: ResultadoGeneracion }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <ColumnaEquipo
        titulo="Equipo A"
        nombres={propuesta.equipoA.jugadores.map((j) => nombreCompleto(j.nombre, j.apellidos))}
        rating={propuesta.equipoA.ratingTotal}
      />
      <ColumnaEquipo
        titulo="Equipo B"
        nombres={propuesta.equipoB.jugadores.map((j) => nombreCompleto(j.nombre, j.apellidos))}
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
        nombres={equipoA.map((i) => nombreCompleto(i.jugador.nombre, i.jugador.apellidos))}
        rating={rating(equipoA)}
      />
      <ColumnaEquipo
        titulo="Equipo B"
        nombres={equipoB.map((i) => nombreCompleto(i.jugador.nombre, i.jugador.apellidos))}
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
