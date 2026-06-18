// =====================================================================
// CrearPartido — formulario de admin para programar un nuevo partido.
// =====================================================================

import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { crearPartido } from '../lib/partidos';
import { IconMas } from '../components/icons';

export function CrearPartido() {
  const { jugador } = useAuth();
  const navigate = useNavigate();

  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('20:30');
  const [campo, setCampo] = useState('');
  const [precioTotal, setPrecioTotal] = useState('');
  const [jugadoresMax, setJugadoresMax] = useState('10');
  const [notas, setNotas] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function manejarEnvio(evento: FormEvent) {
    evento.preventDefault();
    if (!jugador) return;
    setError(null);
    setEnviando(true);
    try {
      const partido = await crearPartido(
        {
          fecha,
          hora,
          campo: campo.trim(),
          precio_total: Number(precioTotal) || 0,
          jugadores_max: Number(jugadoresMax) || 10,
          notas: notas.trim() || null,
        },
        jugador.id
      );
      navigate(`/partidos/${partido.id}`);
    } catch {
      setError('No se pudo crear el partido. Revisa los datos e inténtalo de nuevo.');
      setEnviando(false);
    }
  }

  return (
    <div className="mx-auto min-h-screen max-w-sm px-6 py-10">
      <h1 className="flex items-center gap-2 font-display text-2xl uppercase tracking-wide text-chalk">
        <IconMas className="h-6 w-6 text-floodlight" />
        Nuevo partido
      </h1>

      <form onSubmit={manejarEnvio} className="mt-6 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Fecha">
            <input
              type="date"
              required
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="mt-1 w-full rounded-md border border-pitch-line bg-pitch-mid px-3 py-2 font-body text-chalk focus:border-floodlight"
            />
          </Campo>
          <Campo etiqueta="Hora">
            <input
              type="time"
              required
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              className="mt-1 w-full rounded-md border border-pitch-line bg-pitch-mid px-3 py-2 font-body text-chalk focus:border-floodlight"
            />
          </Campo>
        </div>

        <Campo etiqueta="Campo / pista">
          <input
            required
            value={campo}
            onChange={(e) => setCampo(e.target.value)}
            placeholder="Polideportivo Municipal"
            className="mt-1 w-full rounded-md border border-pitch-line bg-pitch-mid px-3 py-2 font-body text-chalk placeholder:text-muted focus:border-floodlight"
          />
        </Campo>

        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Precio total (€)">
            <input
              type="number"
              min="0"
              step="0.5"
              value={precioTotal}
              onChange={(e) => setPrecioTotal(e.target.value)}
              className="mt-1 w-full rounded-md border border-pitch-line bg-pitch-mid px-3 py-2 font-body tabular-nums text-chalk focus:border-floodlight"
            />
          </Campo>
          <Campo etiqueta="Jugadores máx.">
            <input
              type="number"
              min="2"
              value={jugadoresMax}
              onChange={(e) => setJugadoresMax(e.target.value)}
              className="mt-1 w-full rounded-md border border-pitch-line bg-pitch-mid px-3 py-2 font-body tabular-nums text-chalk focus:border-floodlight"
            />
          </Campo>
        </div>

        <Campo etiqueta="Notas (opcional)">
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={3}
            placeholder="Llevar petos, el campo está algo lejos del parking…"
            className="mt-1 w-full rounded-md border border-pitch-line bg-pitch-mid px-3 py-2 font-body text-chalk placeholder:text-muted focus:border-floodlight"
          />
        </Campo>

        {error && <p className="font-body text-sm text-danger">{error}</p>}

        <button
          type="submit"
          disabled={enviando}
          className="w-full rounded-md bg-floodlight px-4 py-2 font-display text-sm font-semibold uppercase tracking-wide text-pitch-deep transition-colors hover:bg-floodlight-dim disabled:opacity-60"
        >
          {enviando ? 'Creando…' : 'Crear partido'}
        </button>
      </form>
    </div>
  );
}

function Campo({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="font-body text-sm text-muted">{etiqueta}</span>
      {children}
    </label>
  );
}
