// =====================================================================
// RegistrarResultado — formulario de admin para cerrar un partido con
// su resultado. Dispara fn_finalizar_partido, que aplica el cambio de
// Elo y actualiza estadísticas/historial — por eso solo se permite una
// vez (la propia función rechaza un segundo intento) y solo cuando los
// equipos ya están asignados (si no, nadie recibiría cambio de rating).
// =====================================================================

import { useState } from 'react';
import { finalizarPartido } from '../lib/admin';
import type { InscripcionConJugador } from '../types/database';

interface RegistrarResultadoProps {
  partidoId: string;
  confirmados: InscripcionConJugador[];
  onRegistrado: () => void;
}

export function RegistrarResultado({
  partidoId,
  confirmados,
  onRegistrado,
}: RegistrarResultadoProps) {
  const [golesA, setGolesA] = useState('');
  const [golesB, setGolesB] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const equiposListos = confirmados.length > 0 && confirmados.every((i) => i.equipo !== null);

  async function enviar() {
    if (golesA === '' || golesB === '') return;
    setError(null);
    setEnviando(true);
    const { error } = await finalizarPartido(partidoId, Number(golesA), Number(golesB));
    setEnviando(false);
    if (error) {
      setError(error);
      return;
    }
    onRegistrado();
  }

  return (
    <section className="mt-4 rounded-lg border border-pitch-line bg-pitch-mid p-4">
      <p className="font-body text-xs uppercase tracking-wide text-muted">Registrar resultado</p>

      {!equiposListos && (
        <p className="mt-2 font-body text-sm text-muted">
          Genera y confirma los equipos antes de poder registrar el resultado — el cambio de
          rating se reparte por equipo.
        </p>
      )}

      {equiposListos && (
        <>
          <div className="mt-2 flex items-center justify-center gap-3">
            <input
              type="number"
              min="0"
              value={golesA}
              onChange={(e) => setGolesA(e.target.value)}
              placeholder="A"
              className="w-16 rounded-md border border-pitch-line bg-pitch-deep px-2 py-2 text-center font-display text-lg tabular-nums text-chalk"
            />
            <span className="font-display text-lg text-muted">—</span>
            <input
              type="number"
              min="0"
              value={golesB}
              onChange={(e) => setGolesB(e.target.value)}
              placeholder="B"
              className="w-16 rounded-md border border-pitch-line bg-pitch-deep px-2 py-2 text-center font-display text-lg tabular-nums text-chalk"
            />
          </div>

          {error && <p className="mt-2 font-body text-sm text-danger">{error}</p>}

          <button
            onClick={() => void enviar()}
            disabled={enviando || golesA === '' || golesB === ''}
            className="mt-3 w-full rounded-md bg-floodlight px-4 py-2 font-display text-sm font-semibold uppercase tracking-wide text-pitch-deep transition-colors hover:bg-floodlight-dim disabled:opacity-60"
          >
            {enviando ? 'Guardando…' : 'Cerrar partido con este resultado'}
          </button>
        </>
      )}
    </section>
  );
}
