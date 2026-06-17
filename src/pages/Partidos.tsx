// =====================================================================
// Partidos — lista de partidos, separados en próximos y pasados.
// Es la pantalla de inicio de la app.
// =====================================================================

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { listarPartidos } from '../lib/partidos';
import type { PartidoConContador } from '../types/database';
import { PartidoCard } from '../components/PartidoCard';

type Pestaña = 'proximos' | 'pasados';

export function Partidos() {
  const { esAdmin } = useAuth();
  const [partidos, setPartidos] = useState<PartidoConContador[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pestaña, setPestaña] = useState<Pestaña>('proximos');

  useEffect(() => {
    listarPartidos()
      .then(setPartidos)
      .catch(() => setError('No se pudo cargar la lista de partidos.'));
  }, []);

  const proximos = partidos?.filter((p) => p.estado === 'abierto' || p.estado === 'cerrado') ?? [];
  const pasados =
    partidos
      ?.filter((p) => p.estado === 'jugado' || p.estado === 'cancelado')
      .sort((a, b) => (a.fecha < b.fecha ? 1 : -1)) ?? [];
  const visibles = pestaña === 'proximos' ? proximos : pasados;

  return (
    <div className="mx-auto min-h-screen max-w-sm px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl uppercase tracking-wide text-chalk">Partidos</h1>
        {esAdmin && (
          <Link
            to="/partidos/nuevo"
            className="rounded-md bg-floodlight px-3 py-1.5 font-display text-xs font-semibold uppercase tracking-wide text-pitch-deep hover:bg-floodlight-dim"
          >
            + Nuevo
          </Link>
        )}
      </div>

      <div className="mt-5 flex gap-1 rounded-md bg-pitch-mid p-1">
        <PestañaBoton activa={pestaña === 'proximos'} onClick={() => setPestaña('proximos')}>
          Próximos
        </PestañaBoton>
        <PestañaBoton activa={pestaña === 'pasados'} onClick={() => setPestaña('pasados')}>
          Pasados
        </PestañaBoton>
      </div>

      <div className="mt-4 space-y-3">
        {error && <p className="font-body text-sm text-danger">{error}</p>}

        {!error && partidos === null && (
          <p className="font-body text-sm text-muted">Cargando partidos…</p>
        )}

        {!error && partidos !== null && visibles.length === 0 && (
          <p className="font-body text-sm text-muted">
            {pestaña === 'proximos'
              ? 'No hay partidos programados todavía.'
              : 'Todavía no hay partidos pasados.'}
          </p>
        )}

        {visibles.map((p) => (
          <PartidoCard key={p.id} partido={p} />
        ))}
      </div>
    </div>
  );
}

function PestañaBoton({
  activa,
  onClick,
  children,
}: {
  activa: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-md py-1.5 font-body text-sm transition-colors ${
        activa ? 'bg-pitch-deep text-floodlight' : 'text-muted hover:text-chalk'
      }`}
    >
      {children}
    </button>
  );
}
