// =====================================================================
// Pagos — vista de admin con toda la deuda pendiente de un vistazo,
// agrupada por jugador. Solo cuenta partidos ya jugados (ver la nota
// en vista_pagos_pendientes, en schema.sql, sobre por qué).
// =====================================================================

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listarPagosPendientes, marcarPago } from '../lib/pagos';
import type { PagoPendiente } from '../types/database';
import { formatearFechaCorta } from '../lib/fecha';
import { Avatar } from '../components/Avatar';

interface GrupoDeudor {
  jugadorId: string;
  nombre: string;
  apellidos: string | null;
  pendientes: PagoPendiente[];
}

export function Pagos() {
  const [pendientes, setPendientes] = useState<PagoPendiente[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [procesando, setProcesando] = useState<string | null>(null);

  function cargar() {
    listarPagosPendientes()
      .then(setPendientes)
      .catch(() => setError('No se pudo cargar la lista de pagos pendientes.'));
  }

  useEffect(cargar, []);

  async function marcarComoPagado(inscripcionId: string) {
    setProcesando(inscripcionId);
    const { error } = await marcarPago(inscripcionId, 'pagado');
    setProcesando(null);
    if (error) {
      setError('No se pudo marcar el pago.');
      return;
    }
    cargar();
  }

  const grupos: GrupoDeudor[] = [];
  for (const fila of pendientes ?? []) {
    let grupo = grupos.find((g) => g.jugadorId === fila.jugador_id);
    if (!grupo) {
      grupo = { jugadorId: fila.jugador_id, nombre: fila.nombre, apellidos: fila.apellidos, pendientes: [] };
      grupos.push(grupo);
    }
    grupo.pendientes.push(fila);
  }
  grupos.sort((a, b) => b.pendientes.length - a.pendientes.length);

  return (
    <div className="mx-auto min-h-screen max-w-sm px-6 py-10">
      <h1 className="font-display text-2xl uppercase tracking-wide text-chalk">Pagos</h1>
      <p className="mt-1 font-body text-sm text-muted">
        Solo se cuentan partidos ya jugados y todavía sin marcar como pagados.
      </p>

      <div className="mt-5 space-y-3">
        {error && <p className="font-body text-sm text-danger">{error}</p>}

        {!error && pendientes === null && (
          <p className="font-body text-sm text-muted">Cargando…</p>
        )}

        {!error && pendientes !== null && grupos.length === 0 && (
          <p className="rounded-md border border-pitch-line bg-pitch-mid p-4 font-body text-sm text-confirmed">
            Todo el mundo está al día. No hay pagos pendientes.
          </p>
        )}

        {grupos.map((grupo) => (
          <div key={grupo.jugadorId} className="rounded-lg border border-pitch-line bg-pitch-mid p-4">
            <div className="flex items-center gap-3">
              <Avatar nombre={grupo.nombre} apellidos={grupo.apellidos} />
              <div>
                <p className="font-body text-sm text-chalk">
                  {grupo.nombre} {grupo.apellidos}
                </p>
                <p className="font-body text-xs text-floodlight">
                  {grupo.pendientes.length} partido{grupo.pendientes.length === 1 ? '' : 's'} sin pagar
                </p>
              </div>
            </div>

            <ul className="mt-3 space-y-2">
              {grupo.pendientes.map((p) => (
                <li key={p.inscripcion_id} className="flex items-center justify-between">
                  <Link
                    to={`/partidos/${p.partido_id}`}
                    className="font-body text-sm text-muted hover:text-chalk"
                  >
                    {formatearFechaCorta(p.fecha)} · {p.campo}
                  </Link>
                  <button
                    onClick={() => void marcarComoPagado(p.inscripcion_id)}
                    disabled={procesando === p.inscripcion_id}
                    className="font-body text-xs font-semibold text-confirmed hover:underline disabled:opacity-60"
                  >
                    Marcar pagado
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
