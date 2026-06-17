// =====================================================================
// SISTEMA DE RATING (estilo Elo, escala 0-100, ponderado por goles)
// =====================================================================
// Esta misma fórmula vive también en schema.sql (fn_finalizar_partido),
// que es la que realmente escribe en la base de datos de forma atómica.
// Este módulo se usa en el frontend para *previsualizar* el efecto de
// un resultado antes de que el admin lo confirme. Si tocas una
// constante aquí, tócala también allí.
// =====================================================================

// Elo clásico usa un denominador de 400 sobre una escala de ~0-3000.
// Aquí la escala es 0-100, así que el denominador y el factor K se
// reescalan para que el sistema "converja rápido" con pocos partidos,
// tal y como pide el encargo, sin saturar los extremos 0/100.
export const ELO_K_BASE = 4;
export const ELO_DENOMINADOR = 50;
export const ELO_MULTIPLICADOR_MAX = 2;

export interface ResultadoCambioElo {
  expectativaA: number; // probabilidad esperada de victoria del equipo A, 0-1
  resultadoA: number; // 1 victoria, 0.5 empate, 0 derrota (desde el punto de vista de A)
  multiplicadorGoles: number;
  cambioA: number; // puntos que suma/resta cada jugador del equipo A
  cambioB: number; // = -cambioA
}

export function calcularExpectativa(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / ELO_DENOMINADOR));
}

/** Cuanto mayor la diferencia de goles, mayor el impacto en el rating
 *  (5-4 apenas mueve la aguja; 10-2 mueve mucho más), con un tope para
 *  que una goleada puntual no descompense el sistema. */
export function calcularMultiplicadorGoles(diferenciaGoles: number): number {
  const diff = Math.abs(diferenciaGoles);
  const multiplicador = 1 + Math.log(1 + diff) * 0.5;
  return Math.min(multiplicador, ELO_MULTIPLICADOR_MAX);
}

export function clampRating(valor: number): number {
  return Math.max(0, Math.min(100, valor));
}

/**
 * Calcula el cambio de rating para ambos equipos a partir de su rating
 * total y el resultado del partido. El mismo `cambioA`/`cambioB` se
 * aplica a todos los jugadores de ese equipo (no se pondera por jugador
 * individual; ver README para la justificación de esta simplificación).
 */
export function calcularCambioElo(
  ratingTotalA: number,
  ratingTotalB: number,
  golesA: number,
  golesB: number
): ResultadoCambioElo {
  const expectativaA = calcularExpectativa(ratingTotalA, ratingTotalB);
  const resultadoA = golesA > golesB ? 1 : golesA < golesB ? 0 : 0.5;
  const multiplicadorGoles = calcularMultiplicadorGoles(golesA - golesB);

  const cambioA = ELO_K_BASE * multiplicadorGoles * (resultadoA - expectativaA);
  const cambioB = -cambioA;

  return { expectativaA, resultadoA, multiplicadorGoles, cambioA, cambioB };
}

/** Previsualiza el nuevo rating de un jugador dado su rating actual y el
 *  cambio calculado para su equipo (ya recortado a 0-100). */
export function aplicarCambio(ratingActual: number, cambio: number): number {
  return clampRating(ratingActual + cambio);
}
