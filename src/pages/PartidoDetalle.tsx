// =====================================================================
// PartidoDetalle — ficha completa de un partido: convocatoria,
// apuntarse/bajarse, controles de admin y generación de equipos.
// =====================================================================

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  actualizarEstadoPartido,
  cancelarInscripcion,
  inscribirse,
  listarInscripciones,
  obtenerPartido,
} from '../lib/partidos';
import { marcarPago } from '../lib/pagos';
import type { InscripcionConJugador, PartidoConReservador } from '../types/database';
import { formatearFechaLarga, formatearHora } from '../lib/fecha';
import { EstadoBadge } from '../components/EstadoBadge';
import { RosterItem } from '../components/RosterItem';
import { AnadirJugadorAdmin } from '../components/AnadirJugadorAdmin';
import { GenerarEquiposPanel } from '../components/GenerarEquiposPanel';
import { RegistrarResultado } from '../components/RegistrarResultado';

export function PartidoDetalle() {
  const { id } = useParams<{ id: string }>();
  const { jugador, esAdmin } = useAuth();

  const [partido, setPartido] = useState<PartidoConReservador | null>(null);
  const [inscripciones, setInscripciones] = useState<InscripcionConJugador[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);

  const cargar = useCallback(() => {
    if (!id) return;
    obtenerPartido(id).then(setPartido);
    listarInscripciones(id).then(setInscripciones);
  }, [id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (!partido || !inscripciones) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="font-body text-sm text-muted">Cargando partido…</p>
      </div>
    );
  }

  const confirmados = inscripciones.filter((i) => i.estado_inscripcion === 'confirmado');
  const listaEspera = inscripciones.filter((i) => i.estado_inscripcion === 'lista_espera');
  const propia = inscripciones.find(
    (i) => i.jugador.id === jugador?.id && i.estado_inscripcion !== 'cancelado'
  );
  const precioPorJugador =
    confirmados.length > 0 ? (partido.precio_total / confirmados.length).toFixed(2) : null;

  async function manejarInscribirse() {
    if (!jugador || !partido) return;
    setError(null);
    setProcesando(true);
    const { error } = await inscribirse(partido.id, jugador.id);
    setProcesando(false);
    if (error) {
      setError(error);
      return;
    }
    cargar();
  }

  async function manejarQuitar(inscripcionId: string) {
    setError(null);
    setProcesando(true);
    const { error } = await cancelarInscripcion(inscripcionId);
    setProcesando(false);
    if (error) {
      setError(error);
      return;
    }
    cargar();
  }

  async function manejarCancelarPartido() {
    if (!partido) return;
    if (!confirm('¿Seguro que quieres cancelar este partido?')) return;
    await actualizarEstadoPartido(partido.id, 'cancelado');
    cargar();
  }

  async function manejarTogglePago(inscripcionId: string) {
    const actual = inscripciones?.find((i) => i.id === inscripcionId);
    if (!actual) return;
    setError(null);
    const { error } = await marcarPago(
      inscripcionId,
      actual.pago_estado === 'pagado' ? 'pendiente' : 'pagado'
    );
    if (error) {
      setError('No se pudo actualizar el pago.');
      return;
    }
    cargar();
  }

  return (
    <div className="mx-auto min-h-screen max-w-sm px-6 py-10">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-display text-xl uppercase tracking-wide text-chalk">
            {formatearFechaLarga(partido.fecha)}
          </p>
          <p className="mt-0.5 font-body text-sm text-muted">
            {formatearHora(partido.hora)} · {partido.campo}
          </p>
        </div>
        <EstadoBadge estado={partido.estado} />
      </div>

      {partido.notas && (
        <p className="mt-3 rounded-md bg-pitch-mid p-3 font-body text-sm text-muted">
          {partido.notas}
        </p>
      )}

      <div className="mt-3 flex items-center justify-between font-body text-sm text-muted">
        <span>
          {confirmados.length} / {partido.jugadores_max} jugadores
        </span>
        {precioPorJugador && <span>≈ {precioPorJugador} € por jugador</span>}
      </div>

      {partido.reservador && (
        <p className="mt-1 font-body text-sm text-muted">
          Pista reservada por:{' '}
          <span className="text-chalk">
            {partido.reservador.nombre} {partido.reservador.apellidos}
          </span>
        </p>
      )}

      {partido.estado === 'jugado' &&
        partido.resultado_goles_a !== null &&
        partido.resultado_goles_b !== null && (
          <p className="mt-3 text-center font-display text-3xl tabular-nums text-floodlight">
            {partido.resultado_goles_a} - {partido.resultado_goles_b}
          </p>
        )}

      {error && <p className="mt-3 font-body text-sm text-danger">{error}</p>}

      {partido.estado === 'abierto' && jugador && (
        <div className="mt-4">
          {!propia && (
            <button
              onClick={() => void manejarInscribirse()}
              disabled={procesando}
              className="w-full rounded-md bg-floodlight px-4 py-2 font-display text-sm font-semibold uppercase tracking-wide text-pitch-deep transition-colors hover:bg-floodlight-dim disabled:opacity-60"
            >
              {procesando ? 'Apuntando…' : 'Me apunto'}
            </button>
          )}
          {propia && (
            <div className="flex items-center justify-between rounded-md border border-pitch-line bg-pitch-mid px-4 py-2">
              <span className="font-body text-sm text-chalk">
                {propia.estado_inscripcion === 'confirmado'
                  ? 'Estás dentro'
                  : 'Estás en lista de espera'}
              </span>
              <button
                onClick={() => void manejarQuitar(propia.id)}
                disabled={procesando}
                className="font-body text-sm text-muted hover:text-danger disabled:opacity-60"
              >
                Me bajo
              </button>
            </div>
          )}
        </div>
      )}

      <section className="mt-6">
        <p className="font-body text-xs uppercase tracking-wide text-muted">
          Confirmados ({confirmados.length})
        </p>
        <div className="mt-1 divide-y divide-pitch-line">
          {confirmados.map((i) => (
            <RosterItem
              key={i.id}
              inscripcion={i}
              esPropia={i.jugador.id === jugador?.id}
              esAdmin={esAdmin}
              onQuitar={(insId) => void manejarQuitar(insId)}
              procesando={procesando}
              soloLectura={partido.estado !== 'abierto'}
              onTogglePago={(insId) => void manejarTogglePago(insId)}
            />
          ))}
          {confirmados.length === 0 && (
            <p className="py-2 font-body text-sm text-muted">Nadie confirmado todavía.</p>
          )}
        </div>
      </section>

      {listaEspera.length > 0 && (
        <section className="mt-4">
          <p className="font-body text-xs uppercase tracking-wide text-muted">
            Lista de espera ({listaEspera.length})
          </p>
          <div className="mt-1 divide-y divide-pitch-line">
            {listaEspera.map((i) => (
              <RosterItem
                key={i.id}
                inscripcion={i}
                esPropia={i.jugador.id === jugador?.id}
                esAdmin={esAdmin}
                onQuitar={(insId) => void manejarQuitar(insId)}
                procesando={procesando}
                soloLectura={partido.estado !== 'abierto'}
                onTogglePago={(insId) => void manejarTogglePago(insId)}
              />
            ))}
          </div>
        </section>
      )}

      {esAdmin && partido.estado === 'abierto' && (
        <AnadirJugadorAdmin
          partidoId={partido.id}
          yaInscritos={
            new Set(
              inscripciones
                .filter((i) => i.estado_inscripcion !== 'cancelado')
                .map((i) => i.jugador.id)
            )
          }
          onAnadido={cargar}
        />
      )}

      <GenerarEquiposPanel
        confirmados={confirmados}
        esAdmin={esAdmin && (partido.estado === 'abierto' || partido.estado === 'cerrado')}
        onEquiposGuardados={cargar}
      />

      {esAdmin && partido.estado !== 'jugado' && partido.estado !== 'cancelado' && (
        <RegistrarResultado
          partidoId={partido.id}
          confirmados={confirmados}
          onRegistrado={cargar}
        />
      )}

      {esAdmin && partido.estado !== 'cancelado' && partido.estado !== 'jugado' && (
        <button
          onClick={() => void manejarCancelarPartido()}
          className="mt-6 font-body text-sm text-danger hover:underline"
        >
          Cancelar partido
        </button>
      )}
    </div>
  );
}
