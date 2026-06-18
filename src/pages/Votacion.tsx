// =====================================================================
// Votacion — cada jugador ordena a los demás de mejor a peor. Una vez
// enviada, la votación queda bloqueada: no se puede reordenar a nadie
// que ya estuviera en la lista. La única excepción es cuando el
// administrador da de alta a alguien nuevo después de que ya hubiera
// gente votado — esas personas nuevas aparecen sueltas, con flechas
// propias, para que cada votante las encaje donde corresponda sin
// poder tocar el resto de su clasificación ya enviada.
// =====================================================================

import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { guardarVotacion, listarJugadoresParaVotar, obtenerMiVotoActual } from '../lib/votacion';
import type { Jugador } from '../types/database';
import { Avatar } from '../components/Avatar';
import { IconUrna } from '../components/icons';

export function Votacion() {
  const { jugador } = useAuth();
  const [orden, setOrden] = useState<Jugador[] | null>(null);
  const [idsYaEnviados, setIdsYaEnviados] = useState<Set<string>>(new Set());
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  useEffect(() => {
    if (!jugador) return;
    Promise.all([listarJugadoresParaVotar(jugador.id), obtenerMiVotoActual(jugador.id)]).then(
      ([jugadores, votoPrevio]) => {
        setIdsYaEnviados(new Set(votoPrevio));
        if (votoPrevio.length === 0) {
          setOrden(jugadores);
          return;
        }
        const porId = new Map(jugadores.map((j) => [j.id, j]));
        const yaVotados = votoPrevio.map((id) => porId.get(id)).filter((j): j is Jugador => !!j);
        const nuevos = jugadores.filter((j) => !votoPrevio.includes(j.id));
        setOrden([...yaVotados, ...nuevos]);
      }
    );
  }, [jugador]);

  const hayNuevosPorEncajar = orden?.some((j) => !idsYaEnviados.has(j.id)) ?? false;
  const yaVotoAntes = idsYaEnviados.size > 0;
  // Bloqueado de verdad (sin nada que hacer) solo si ya votó antes y no
  // hay nadie nuevo que encajar.
  const bloqueado = yaVotoAntes && !hayNuevosPorEncajar;

  function mover(indice: number, direccion: -1 | 1) {
    if (!orden) return;
    const destino = indice + direccion;
    if (destino < 0 || destino >= orden.length) return;
    const copia = [...orden];
    [copia[indice], copia[destino]] = [copia[destino], copia[indice]];
    setOrden(copia);
  }

  async function guardar() {
    if (!orden) return;
    setMensaje(null);
    setGuardando(true);
    const { error } = await guardarVotacion(orden.map((j) => j.id));
    setGuardando(false);
    setMensaje(
      error
        ? { tipo: 'error', texto: 'No se pudo guardar la votación. Inténtalo de nuevo.' }
        : { tipo: 'ok', texto: 'Votación guardada.' }
    );
    if (!error) setIdsYaEnviados(new Set(orden.map((j) => j.id)));
  }

  return (
    <div className="mx-auto min-h-screen max-w-sm px-6 py-10">
      <h1 className="flex items-center gap-2 font-display text-2xl uppercase tracking-wide text-chalk">
        <IconUrna className="h-6 w-6 text-floodlight" />
        Ranking inicial
      </h1>

      {!bloqueado && !yaVotoAntes && (
        <p className="mt-2 font-body text-sm text-muted">
          Ordena al resto del grupo de mejor a peor jugando al fútbol. Esto solo se usa una vez,
          para arrancar los ratings antes de que el sistema empiece a calcularlos solo a partir de
          los resultados. Una vez la envíes, no podrás reordenarla.
        </p>
      )}

      {!bloqueado && yaVotoAntes && hayNuevosPorEncajar && (
        <p className="mt-2 font-body text-sm text-muted">
          Tu votación ya está enviada y el resto del orden está bloqueado. Se ha añadido alguien
          nuevo al grupo desde entonces — muévelo con las flechas hasta el lugar que le
          corresponda y guarda otra vez. No puedes tocar a nadie más.
        </p>
      )}

      {bloqueado && (
        <p className="mt-2 font-body text-sm text-confirmed">
          Ya has enviado tu votación. Gracias — aquí tienes tu clasificación, ya bloqueada.
        </p>
      )}

      {!orden && <p className="mt-6 font-body text-sm text-muted">Cargando…</p>}

      {orden && orden.length === 0 && (
        <p className="mt-6 font-body text-sm text-muted">
          Todavía no hay otros jugadores activos a quienes ordenar.
        </p>
      )}

      {orden && orden.length > 0 && (
        <>
          <ol className="mt-6 space-y-2">
            {orden.map((j, indice) => {
              const esNuevo = !idsYaEnviados.has(j.id);
              const puedeMover = !yaVotoAntes || esNuevo;
              return (
                <li
                  key={j.id}
                  className={`flex items-center gap-3 rounded-md border p-2 ${
                    esNuevo && yaVotoAntes
                      ? 'border-floodlight bg-floodlight/10'
                      : 'border-pitch-line bg-pitch-mid'
                  }`}
                >
                  <span className="w-5 text-center font-display text-sm tabular-nums text-floodlight">
                    {indice + 1}
                  </span>
                  <Avatar nombre={j.nombre} apellidos={j.apellidos} />
                  <span className="flex-1 truncate font-body text-sm text-chalk">
                    {j.nombre} {j.apellidos}
                    {esNuevo && yaVotoAntes && (
                      <span className="ml-1.5 font-body text-xs text-floodlight">(nuevo)</span>
                    )}
                  </span>
                  {puedeMover && (
                    <div className="flex flex-col">
                      <button
                        onClick={() => mover(indice, -1)}
                        disabled={indice === 0}
                        aria-label="Subir"
                        className="px-1 font-body text-muted hover:text-floodlight disabled:opacity-30"
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => mover(indice, 1)}
                        disabled={indice === orden.length - 1}
                        aria-label="Bajar"
                        className="px-1 font-body text-muted hover:text-floodlight disabled:opacity-30"
                      >
                        ▼
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>

          {mensaje && (
            <p
              className={`mt-4 font-body text-sm ${
                mensaje.tipo === 'ok' ? 'text-confirmed' : 'text-danger'
              }`}
            >
              {mensaje.texto}
            </p>
          )}

          {!bloqueado && (
            <button
              onClick={() => void guardar()}
              disabled={guardando}
              className="mt-4 w-full rounded-md bg-floodlight px-4 py-2 font-display text-sm font-semibold uppercase tracking-wide text-pitch-deep transition-colors hover:bg-floodlight-dim disabled:opacity-60"
            >
              {guardando ? 'Guardando…' : 'Guardar votación'}
            </button>
          )}
        </>
      )}
    </div>
  );
}
