import { useEffect, useState } from 'react';
import { crearInvitado, inscribirse, listarJugadoresActivos } from '../lib/partidos';
import type { Jugador } from '../types/database';

interface AnadirJugadorAdminProps {
  partidoId: string;
  yaInscritos: Set<string>;
  onAnadido: () => void;
}

export function AnadirJugadorAdmin({ partidoId, yaInscritos, onAnadido }: AnadirJugadorAdminProps) {
  const [abierto, setAbierto] = useState(false);
  const [jugadores, setJugadores] = useState<Jugador[]>([]);
  const [seleccionado, setSeleccionado] = useState('');
  const [nombreInvitado, setNombreInvitado] = useState('');
  const [telefonoInvitado, setTelefonoInvitado] = useState('');
  const [ratingInvitado, setRatingInvitado] = useState('50');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (abierto) listarJugadoresActivos().then(setJugadores);
  }, [abierto]);

  const disponibles = jugadores.filter((j) => !yaInscritos.has(j.id));

  async function añadirExistente() {
    if (!seleccionado) return;
    setError(null);
    setEnviando(true);
    const { error } = await inscribirse(partidoId, seleccionado, true);
    setEnviando(false);
    if (error) {
      setError(error);
      return;
    }
    setSeleccionado('');
    onAnadido();
  }

  async function añadirInvitadoNuevo() {
    if (!nombreInvitado.trim()) return;
    setError(null);
    setEnviando(true);
    try {
      const rating = Number(ratingInvitado);
      const invitado = await crearInvitado(
        nombreInvitado.trim(),
        Number.isNaN(rating) ? undefined : rating,
        undefined,
        telefonoInvitado.trim() || undefined
      );
      const { error } = await inscribirse(partidoId, invitado.id, true);
      if (error) {
        setError(error);
        return;
      }
      setNombreInvitado('');
      setTelefonoInvitado('');
      setRatingInvitado('50');
      onAnadido();
    } catch {
      setError('No se pudo crear el invitado.');
    } finally {
      setEnviando(false);
    }
  }

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="mt-3 font-body text-sm font-semibold text-floodlight hover:text-floodlight-dim"
      >
        + Añadir jugador
      </button>
    );
  }

  return (
    <div className="mt-3 space-y-3 rounded-md border border-pitch-line p-3">
      <div className="flex gap-2">
        <select
          value={seleccionado}
          onChange={(e) => setSeleccionado(e.target.value)}
          className="flex-1 rounded-md border border-pitch-line bg-pitch-deep px-2 py-1.5 font-body text-sm text-chalk"
        >
          <option value="">Elegir jugador existente…</option>
          {disponibles.map((j) => (
            <option key={j.id} value={j.id}>
              {j.nombre} {j.apellidos ?? ''}
            </option>
          ))}
        </select>
        <button
          onClick={() => void añadirExistente()}
          disabled={!seleccionado || enviando}
          className="rounded-md bg-floodlight px-3 py-1.5 font-body text-sm font-semibold text-pitch-deep disabled:opacity-50"
        >
          Añadir
        </button>
      </div>

      <div className="flex gap-2">
        <input
          value={nombreInvitado}
          onChange={(e) => setNombreInvitado(e.target.value)}
          placeholder="Nombre de un invitado nuevo"
          className="flex-1 rounded-md border border-pitch-line bg-pitch-deep px-2 py-1.5 font-body text-sm text-chalk placeholder:text-muted"
        />
        <input
          type="number"
          min="0"
          max="100"
          value={ratingInvitado}
          onChange={(e) => setRatingInvitado(e.target.value)}
          title="Nivel estimado (0-100)"
          className="w-16 rounded-md border border-pitch-line bg-pitch-deep px-2 py-1.5 font-body text-sm tabular-nums text-chalk"
        />
      </div>
      <div className="flex gap-2">
        <input
          type="tel"
          value={telefonoInvitado}
          onChange={(e) => setTelefonoInvitado(e.target.value)}
          placeholder="Teléfono (opcional, para su cuenta luego)"
          className="flex-1 rounded-md border border-pitch-line bg-pitch-deep px-2 py-1.5 font-body text-sm text-chalk placeholder:text-muted"
        />
        <button
          onClick={() => void añadirInvitadoNuevo()}
          disabled={!nombreInvitado.trim() || enviando}
          className="rounded-md border border-pitch-line px-3 py-1.5 font-body text-sm text-chalk disabled:opacity-50"
        >
          Crear y añadir
        </button>
      </div>
      <p className="font-body text-xs text-muted">
        El número junto al nombre es su nivel estimado (0-100, 50 = medio) — así el generador de
        equipos lo tiene en cuenta desde el primer partido. Si le pones el teléfono y luego le
        creas la cuenta con ese mismo número (Supabase → Authentication → Users), se vincula solo
        en cuanto entre y pasa a "jugador habitual" sin perder nada de este historial.
      </p>

      {error && <p className="font-body text-sm text-danger">{error}</p>}

      <button
        onClick={() => setAbierto(false)}
        className="font-body text-xs text-muted hover:text-chalk"
      >
        Cerrar
      </button>
    </div>
  );
}
