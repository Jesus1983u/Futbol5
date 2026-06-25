// =====================================================================
// VotarMvp — cada jugador registrado vota al MVP del equipo contrario.
// Se accede desde la ficha del partido una vez que está en estado
// 'jugado'. Los invitados ven la pantalla pero no pueden votar.
// =====================================================================

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  listarCandidatosMvp,
  miVotoMvp,
  votarMvp,
  type CandidatoMvp,
} from '../lib/mvp';

export function VotarMvp() {
  const { id: partidoId } = useParams<{ id: string }>();
  const { jugador } = useAuth();
  const navigate = useNavigate();

  const [candidatos, setCandidatos] = useState<CandidatoMvp[] | null>(null);
  const [votoActual, setVotoActual] = useState<string | null>(null);
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);

  const esInvitado = jugador?.tipo === 'invitado';

  useEffect(() => {
    if (!jugador || !partidoId) return;
    Promise.all([
      listarCandidatosMvp(partidoId, jugador.id),
      miVotoMvp(partidoId, jugador.id),
    ]).then(([lista, voto]) => {
      setCandidatos(lista);
      setVotoActual(voto);
      setSeleccionado(voto);
    }).catch(() => setError('No se pudo cargar la votación.'));
  }, [jugador, partidoId]);

  async function enviar() {
    if (!seleccionado || !partidoId) return;
    setError(null);
    setEnviando(true);
    const { error } = await votarMvp(partidoId, seleccionado);
    setEnviando(false);
    if (error) {
      setError(error);
      return;
    }
    setVotoActual(seleccionado);
    setExito(true);
  }

  const titulo = esInvitado
    ? 'MVP del partido'
    : votoActual
    ? 'Tu voto MVP'
    : 'Vota el MVP';

  return (
    <div className="mx-auto min-h-screen max-w-sm px-6 py-10">
      <button
        onClick={() => navigate(-1)}
        className="mb-4 font-body text-sm text-muted hover:text-chalk"
      >
        ← Volver al partido
      </button>

      <h1 className="font-display text-2xl uppercase tracking-wide text-chalk">
        🏆 {titulo}
      </h1>
      <p className="mt-1 font-body text-sm text-muted">
        {esInvitado
          ? 'Los invitados no participan en la votación del MVP.'
          : votoActual
          ? 'Ya has votado. Puedes cambiar tu voto hasta que el administrador cierre la votación.'
          : 'Elige al mejor jugador del equipo contrario.'}
      </p>

      {error && <p className="mt-4 font-body text-sm text-danger">{error}</p>}

      {!esInvitado && candidatos !== null && candidatos.length === 0 && (
        <p className="mt-6 font-body text-sm text-muted">
          No hay candidatos disponibles para votar.
        </p>
      )}

      {!esInvitado && candidatos && candidatos.length > 0 && (
        <>
          <ul className="mt-6 space-y-2">
            {candidatos.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => { setSeleccionado(c.id); setExito(false); }}
                  className={`w-full rounded-md border px-4 py-3 text-left font-body text-sm transition-colors ${
                    seleccionado === c.id
                      ? 'border-floodlight bg-floodlight/10 text-chalk'
                      : 'border-pitch-line bg-pitch-mid text-chalk hover:border-floodlight/50'
                  }`}
                >
                  <span className="flex items-center justify-between">
                    <span>
                      {c.nombre} {c.apellidos}
                    </span>
                    {seleccionado === c.id && (
                      <span className="font-display text-floodlight">✓</span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {exito && (
            <p className="mt-4 font-body text-sm text-confirmed">
              ✓ Voto guardado. ¡Gracias!
            </p>
          )}

          <button
            onClick={() => void enviar()}
            disabled={!seleccionado || enviando}
            className="mt-4 w-full rounded-md bg-floodlight px-4 py-2 font-display text-sm font-semibold uppercase tracking-wide text-pitch-deep transition-colors hover:bg-floodlight-dim disabled:opacity-60"
          >
            {enviando ? 'Guardando…' : votoActual ? 'Cambiar voto' : 'Votar'}
          </button>
        </>
      )}
    </div>
  );
}
