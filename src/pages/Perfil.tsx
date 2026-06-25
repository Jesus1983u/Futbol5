// =====================================================================
// Perfil — ver y editar los datos del jugador, su rating y sus
// estadísticas. Es la pantalla a la que llega cualquiera justo después
// de iniciar sesión.
// =====================================================================

import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { obtenerEstadisticas, obtenerMejorPeorCompanero, type CompaneroDestacado } from '../lib/partidos';
import { listarPagosPendientesDe } from '../lib/pagos';
import { Avatar } from '../components/Avatar';
import { formatearFechaCorta } from '../lib/fecha';
import { IconGrupo, IconTrofeo, IconUrna } from '../components/icons';
import type { EstadisticasJugador, Jugador, PagoPendiente, Posicion } from '../types/database';

export function Perfil() {
  const { jugador, esAdmin, cerrarSesion, actualizarJugador } = useAuth();
  const [nombre, setNombre] = useState(jugador?.nombre ?? '');
  const [apellidos, setApellidos] = useState(jugador?.apellidos ?? '');
  const [posicion, setPosicion] = useState<Posicion>(jugador?.posicion_preferida ?? 'defensor');
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [stats, setStats] = useState<EstadisticasJugador | null>(null);
  const [pagosPendientes, setPagosPendientes] = useState<PagoPendiente[]>([]);
  const [companeros, setCompaneros] = useState<{
    mejor: CompaneroDestacado | null;
    peor: CompaneroDestacado | null;
  } | null>(null);

  useEffect(() => {
    if (!jugador) return;
    setNombre(jugador.nombre);
    setApellidos(jugador.apellidos ?? '');
    setPosicion(jugador.posicion_preferida);

    obtenerEstadisticas(jugador.id).then(setStats);
    listarPagosPendientesDe(jugador.id).then(setPagosPendientes);
    obtenerMejorPeorCompanero(jugador.id).then(setCompaneros);
  }, [jugador]);

  if (!jugador) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="font-body text-sm text-muted">Cargando tu perfil…</p>
      </div>
    );
  }

  const guardar = async (evento: FormEvent) => {
    evento.preventDefault();
    setMensaje(null);
    setGuardando(true);
    const cambios: Partial<Jugador> = {
      nombre: nombre.trim(),
      apellidos: apellidos.trim() || null,
    };
    if (!jugador.posicion_confirmada) {
      cambios.posicion_preferida = posicion;
      cambios.posicion_confirmada = true;
    }
    const { error } = await actualizarJugador(cambios);
    setGuardando(false);
    setMensaje(
      error
        ? { tipo: 'error', texto: 'No se pudieron guardar los cambios. Inténtalo de nuevo.' }
        : { tipo: 'ok', texto: 'Cambios guardados.' }
    );
  };

  return (
    <div className="mx-auto min-h-screen max-w-sm px-6 py-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar nombre={nombre} apellidos={apellidos} tamaño="md" />
          <div>
            <p className="font-display text-lg leading-tight text-chalk">
              {nombre} {apellidos}
            </p>
            {esAdmin && (
              <span className="font-body text-xs uppercase tracking-wide text-confirmed">
                Administrador
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => void cerrarSesion()}
          className="font-body text-sm text-muted hover:text-chalk"
        >
          Cerrar sesión
        </button>
      </div>

      <section className="mt-8 rounded-lg border border-pitch-line bg-pitch-mid p-4">
        <p className="font-body text-xs uppercase tracking-wide text-muted">Rating actual</p>
        <p className="font-display text-4xl tabular-nums text-floodlight">
          {jugador.rating_actual.toFixed(1)}
        </p>
      </section>

      {pagosPendientes.length > 0 && (
        <section className="mt-4 rounded-lg border border-danger/40 bg-danger/10 p-4">
          <p className="font-body text-sm font-semibold text-danger">
            Tienes {pagosPendientes.length} partido{pagosPendientes.length === 1 ? '' : 's'} sin
            pagar
          </p>
          <p className="mt-1 font-body text-xs text-muted">
            Hasta que se regularicen, no podrás apuntarte a partidos nuevos.
          </p>
          <ul className="mt-2 space-y-1">
            {pagosPendientes.map((p) => (
              <li key={p.inscripcion_id} className="font-body text-sm text-chalk">
                {formatearFechaCorta(p.fecha)} · {p.campo}
              </li>
            ))}
          </ul>
        </section>
      )}

      {stats && (
        <section className="mt-4 rounded-lg border border-pitch-line bg-pitch-mid p-4">
          <p className="font-body text-xs uppercase tracking-wide text-muted">Estadísticas</p>
          <dl className="mt-2 grid grid-cols-5 gap-2 text-center">
            <Estadistica etiqueta="PJ" valor={stats.partidos_jugados} />
            <Estadistica etiqueta="V" valor={stats.victorias} />
            <Estadistica etiqueta="E" valor={stats.empates} />
            <Estadistica etiqueta="D" valor={stats.derrotas} />
            <Estadistica etiqueta="%" valor={stats.porcentaje_victorias} />
          </dl>

          <div className="mt-4 space-y-2 border-t border-pitch-line pt-3">
            <FilaDato
              etiqueta="MVPs recibidos"
              valor={stats.mvps_recibidos > 0 ? `🏆 ${stats.mvps_recibidos}` : '0'}
            />
            <FilaDato
              etiqueta="Posición preferida"
              valor={
                stats.posicion_preferida === 'mixto'
                  ? 'Mixto (atacante o defensor)'
                  : stats.posicion_preferida
              }
              capitalizar
            />
            <FilaDato
              etiqueta="Impacto en victoria"
              valor={formatearImpacto(stats.impacto_victoria)}
              ayuda="Cuánto mejor (o peor) rinden tus equipos de lo que el rating previo predecía. 0 = neutro."
            />
            {companeros?.mejor && (
              <FilaDato
                etiqueta="Mejor compañero histórico"
                valor={`${companeros.mejor.nombre} (${companeros.mejor.partidos} partidos juntos)`}
              />
            )}
            {companeros?.peor && (
              <FilaDato
                etiqueta="Peor compañero histórico"
                valor={`${companeros.peor.nombre} (${companeros.peor.partidos} partidos juntos)`}
              />
            )}
            {companeros && !companeros.mejor && (
              <p className="font-body text-xs text-muted">
                Todavía no hay suficientes partidos junto a un mismo compañero para calcular
                afinidades.
              </p>
            )}
          </div>
        </section>
      )}

      <form onSubmit={guardar} className="mt-6 space-y-4">
        <div>
          <label htmlFor="nombre" className="block font-body text-sm text-muted">
            Nombre
          </label>
          <input
            id="nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            className="mt-1 w-full rounded-md border border-pitch-line bg-pitch-mid px-3 py-2 font-body text-chalk focus:border-floodlight"
          />
        </div>
        <div>
          <label htmlFor="apellidos" className="block font-body text-sm text-muted">
            Apellidos
          </label>
          <input
            id="apellidos"
            value={apellidos}
            onChange={(e) => setApellidos(e.target.value)}
            className="mt-1 w-full rounded-md border border-pitch-line bg-pitch-mid px-3 py-2 font-body text-chalk focus:border-floodlight"
          />
        </div>

        <div>
          <p className="block font-body text-sm text-muted">Posición preferida</p>
          {jugador.posicion_confirmada ? (
            <>
              <p className="mt-1 rounded-md border border-pitch-line bg-pitch-deep px-3 py-2 font-body text-sm capitalize text-chalk">
                {posicion}
              </p>
              <p className="mt-1 font-body text-xs text-muted">
                Ya está fijada. Si necesitas cambiarla, pídeselo al administrador.
              </p>
            </>
          ) : (
            <>
              <div className="mt-1 grid grid-cols-3 gap-2">
                {(['atacante', 'defensor', 'mixto'] as const).map((opcion) => (
                  <button
                    key={opcion}
                    type="button"
                    onClick={() => setPosicion(opcion)}
                    className={`rounded-md border px-3 py-2 font-body text-sm capitalize transition-colors ${
                      posicion === opcion
                        ? 'border-floodlight bg-floodlight/10 text-floodlight'
                        : 'border-pitch-line text-muted hover:text-chalk'
                    }`}
                  >
                    {opcion}
                  </button>
                ))}
              </div>
              <p className="mt-1 font-body text-xs text-muted">
                "Mixto" significa que puedes jugar de atacante o de defensor — el generador de
                equipos te colocará donde más ayude a equilibrar cada partido. Elígela con
                cuidado: en cuanto guardes, queda fijada y no podrás cambiarla tú mismo más
                adelante.
              </p>
            </>
          )}
        </div>

        {mensaje && (
          <p
            className={`font-body text-sm ${mensaje.tipo === 'ok' ? 'text-confirmed' : 'text-danger'}`}
          >
            {mensaje.texto}
          </p>
        )}

        <button
          type="submit"
          disabled={guardando}
          className="w-full rounded-md bg-floodlight px-4 py-2 font-display text-sm font-semibold uppercase tracking-wide text-pitch-deep transition-colors hover:bg-floodlight-dim disabled:opacity-60"
        >
          {guardando ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </form>

      <div className="mt-6 space-y-2 text-center">
        <Link
          to="/clasificacion"
          className="flex items-center justify-center gap-1.5 font-body text-sm text-muted hover:text-chalk"
        >
          <IconTrofeo className="h-4 w-4" />
          Ver la clasificación general
        </Link>
        <Link
          to="/historial"
          className="flex items-center justify-center gap-1.5 font-body text-sm text-muted hover:text-chalk"
        >
          <IconGrupo className="h-4 w-4" />
          Ver el historial de compañeros
        </Link>
        <Link
          to="/votacion"
          className="flex items-center justify-center gap-1.5 font-body text-sm text-muted hover:text-chalk"
        >
          <IconUrna className="h-4 w-4" />
          Votar el ranking inicial del grupo
        </Link>
      </div>
    </div>
  );
}

/** "+0.42" / "-0.18" / "0.00" — siempre con signo explícito en los
 *  positivos, para que se note de un vistazo si es buena o mala
 *  noticia sin tener que leer el número con atención. */
function formatearImpacto(valor: number): string {
  const redondeado = Math.round(valor * 100) / 100;
  return redondeado > 0 ? `+${redondeado.toFixed(2)}` : redondeado.toFixed(2);
}

function FilaDato({
  etiqueta,
  valor,
  ayuda,
  capitalizar,
}: {
  etiqueta: string;
  valor: string;
  ayuda?: string;
  capitalizar?: boolean;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-body text-xs text-muted">{etiqueta}</span>
        <span
          className={`text-right font-body text-sm text-chalk ${capitalizar ? 'capitalize' : ''}`}
        >
          {valor}
        </span>
      </div>
      {ayuda && <p className="mt-0.5 font-body text-[11px] text-muted">{ayuda}</p>}
    </div>
  );
}

function Estadistica({ etiqueta, valor }: { etiqueta: string; valor: number }) {
  return (
    <div>
      <p className="font-display text-lg tabular-nums text-chalk">{valor}</p>
      <p className="font-body text-[11px] uppercase tracking-wide text-muted">{etiqueta}</p>
    </div>
  );
}
