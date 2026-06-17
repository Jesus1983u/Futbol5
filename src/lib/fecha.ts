// =====================================================================
// Formato de fechas — en español, breve, pensado para tarjetas y
// cabeceras de pantalla.
// =====================================================================

const FORMATEADOR_CORTO = new Intl.DateTimeFormat('es-ES', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

const FORMATEADOR_LARGO = new Intl.DateTimeFormat('es-ES', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

/** `fecha` viene de Postgres como 'YYYY-MM-DD'; construimos la fecha en
 *  hora local explícitamente para evitar el desfase de un día que da
 *  `new Date('YYYY-MM-DD')` al interpretarlo como UTC. */
function aFechaLocal(fechaIso: string): Date {
  const [año, mes, dia] = fechaIso.split('-').map(Number);
  return new Date(año, mes - 1, dia);
}

export function formatearFechaCorta(fechaIso: string): string {
  return FORMATEADOR_CORTO.format(aFechaLocal(fechaIso));
}

export function formatearFechaLarga(fechaIso: string): string {
  const texto = FORMATEADOR_LARGO.format(aFechaLocal(fechaIso));
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** `hora` viene como 'HH:MM:SS' → '20:30'. */
export function formatearHora(hora: string): string {
  return hora.slice(0, 5);
}
