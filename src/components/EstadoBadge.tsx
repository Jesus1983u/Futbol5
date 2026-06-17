import type { EstadoPartido } from '../types/database';

const ESTILOS: Record<EstadoPartido, { etiqueta: string; clase: string }> = {
  abierto: { etiqueta: 'Abierto', clase: 'bg-confirmed/15 text-confirmed' },
  cerrado: { etiqueta: 'Cerrado', clase: 'bg-muted/15 text-muted' },
  cancelado: { etiqueta: 'Cancelado', clase: 'bg-danger/15 text-danger' },
  jugado: { etiqueta: 'Jugado', clase: 'bg-floodlight/15 text-floodlight' },
};

export function EstadoBadge({ estado }: { estado: EstadoPartido }) {
  const { etiqueta, clase } = ESTILOS[estado];
  return (
    <span
      className={`rounded-full px-2 py-0.5 font-body text-xs font-medium uppercase tracking-wide ${clase}`}
    >
      {etiqueta}
    </span>
  );
}
