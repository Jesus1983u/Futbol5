// =====================================================================
// GENERADOR DE EQUIPOS EQUILIBRADOS
// =====================================================================
// La función más importante de toda la app. Evalúa combinaciones de
// reparto en dos equipos y elige la que minimiza un coste combinado:
//
//   70% — diferencia de rating total entre equipos
//   15% — "coste de historial" (penaliza juntar parejas que ya han
//          jugado muchas veces en el mismo equipo)
//   15% — desequilibrio entre atacantes y defensores
//
// Para grupos pequeños/medianos (hasta LIMITE_EXHAUSTIVO jugadores)
// se evalúan TODAS las combinaciones posibles, tal y como pide el
// encargo. Por encima de ese límite el espacio de combinaciones crece
// demasiado para fuerza bruta en el navegador, así que se usa una
// búsqueda local (random-restart hill-climbing) que en la práctica
// converge a soluciones igual de buenas en milisegundos.
// =====================================================================

import type { JugadorParaGenerador } from '../types/database';

const PESO_RATING = 0.7;
const PESO_HISTORIAL = 0.15;
const PESO_POSICION = 0.15;

// Por encima de este tamaño de grupo, C(n, n/2)/2 crece demasiado para
// fuerza bruta razonable en el navegador (a partir de ~24 ya son
// millones de combinaciones). 24 cubre con margen cualquier convocatoria
// real de fútbol 5 (normalmente 10-16 jugadores con algún invitado).
const LIMITE_EXHAUSTIVO = 24;

export interface MapaHistorial {
  // clave: "idMenor|idMayor" (orden alfabético) -> veces jugados juntos
  [parKey: string]: number;
}

export interface EquipoGenerado {
  jugadores: JugadorParaGenerador[];
  ratingTotal: number;
  atacantes: number;
  defensores: number;
}

export interface ResultadoGeneracion {
  equipoA: EquipoGenerado;
  equipoB: EquipoGenerado;
  diferenciaRating: number;
  costeHistorialTotal: number;
  combinacionesEvaluadas: number;
  metodo: 'exhaustivo' | 'heuristico';
}

export function claveHistorial(idA: string, idB: string): string {
  return idA < idB ? `${idA}|${idB}` : `${idB}|${idA}`;
}

/** Construye el mapa de historial a partir de filas (idA, idB, veces). */
export function construirMapaHistorial(
  filas: { jugadorA: string; jugadorB: string; veces: number }[]
): MapaHistorial {
  const mapa: MapaHistorial = {};
  for (const f of filas) {
    mapa[claveHistorial(f.jugadorA, f.jugadorB)] = f.veces;
  }
  return mapa;
}

interface CostesBrutos {
  diffRating: number;
  costeHistorial: number;
  costePosicion: number;
}

function calcularCostesBrutos(
  equipoA: JugadorParaGenerador[],
  equipoB: JugadorParaGenerador[],
  historial: MapaHistorial
): CostesBrutos {
  const ratingA = equipoA.reduce((s, j) => s + j.rating, 0);
  const ratingB = equipoB.reduce((s, j) => s + j.rating, 0);
  const diffRating = Math.abs(ratingA - ratingB);

  const costeHistorialEquipo = (equipo: JugadorParaGenerador[]): number => {
    let coste = 0;
    for (let i = 0; i < equipo.length; i++) {
      for (let j = i + 1; j < equipo.length; j++) {
        coste += historial[claveHistorial(equipo[i].id, equipo[j].id)] ?? 0;
      }
    }
    return coste;
  };
  const costeHistorial = costeHistorialEquipo(equipoA) + costeHistorialEquipo(equipoB);

  const atacantesA = equipoA.filter((j) => j.posicion === 'atacante').length;
  const defensoresA = equipoA.filter((j) => j.posicion === 'defensor').length;
  const atacantesB = equipoB.filter((j) => j.posicion === 'atacante').length;
  const defensoresB = equipoB.filter((j) => j.posicion === 'defensor').length;
  const costePosicion = Math.abs(atacantesA - atacantesB) + Math.abs(defensoresA - defensoresB);

  return { diffRating, costeHistorial, costePosicion };
}

function empaquetarResultado(
  equipoA: JugadorParaGenerador[],
  equipoB: JugadorParaGenerador[],
  costes: CostesBrutos,
  combinacionesEvaluadas: number,
  metodo: 'exhaustivo' | 'heuristico'
): ResultadoGeneracion {
  const construirEquipo = (jugadores: JugadorParaGenerador[]): EquipoGenerado => ({
    jugadores,
    ratingTotal: Math.round(jugadores.reduce((s, j) => s + j.rating, 0) * 10) / 10,
    atacantes: jugadores.filter((j) => j.posicion === 'atacante').length,
    defensores: jugadores.filter((j) => j.posicion === 'defensor').length,
  });

  return {
    equipoA: construirEquipo(equipoA),
    equipoB: construirEquipo(equipoB),
    diferenciaRating: Math.round(costes.diffRating * 10) / 10,
    costeHistorialTotal: costes.costeHistorial,
    combinacionesEvaluadas,
    metodo,
  };
}

/** Genera todas las formas de elegir un subconjunto de tamaño `tam` de `indices`,
 *  fijando siempre el primer jugador (índice 0) en el equipo A. Esto evita
 *  generar cada partición dos veces (una vez como A/B y otra como B/A). */
function* combinacionesEquipoA(n: number, tamA: number): Generator<number[]> {
  // Siempre incluye el índice 0. Elegimos los (tamA - 1) restantes entre 1..n-1.
  const resto = Array.from({ length: n - 1 }, (_, i) => i + 1);
  yield* combinacionesDe(resto, tamA - 1, [0]);
}

function* combinacionesDe(pool: number[], k: number, acumulado: number[]): Generator<number[]> {
  if (k === 0) {
    yield acumulado;
    return;
  }
  for (let i = 0; i <= pool.length - k; i++) {
    yield* combinacionesDe(pool.slice(i + 1), k - 1, [...acumulado, pool[i]]);
  }
}

/** Normaliza un valor al rango [0,1] dado un mínimo y máximo observados. */
function normalizar(valor: number, min: number, max: number): number {
  if (max === min) return 0;
  return (valor - min) / (max - min);
}

/**
 * Genera los dos equipos más equilibrados a partir de los jugadores
 * confirmados de un partido y su historial de compañeros.
 */
export function generarEquipos(
  jugadores: JugadorParaGenerador[],
  historial: MapaHistorial
): ResultadoGeneracion {
  const n = jugadores.length;
  if (n < 2) {
    throw new Error('Se necesitan al menos 2 jugadores confirmados para generar equipos.');
  }

  const tamA = Math.ceil(n / 2); // si n es impar, el equipo A se queda con uno más

  if (n <= LIMITE_EXHAUSTIVO) {
    return generarEquiposExhaustivo(jugadores, historial, tamA);
  }
  return generarEquiposHeuristico(jugadores, historial, tamA);
}

function generarEquiposExhaustivo(
  jugadores: JugadorParaGenerador[],
  historial: MapaHistorial,
  tamA: number
): ResultadoGeneracion {
  const n = jugadores.length;
  const candidatos: { indicesA: number[]; costes: CostesBrutos }[] = [];

  let minDiff = Infinity, maxDiff = -Infinity;
  let minHist = Infinity, maxHist = -Infinity;
  let minPos = Infinity, maxPos = -Infinity;

  for (const indicesA of combinacionesEquipoA(n, tamA)) {
    const setA = new Set(indicesA);
    const equipoA = jugadores.filter((_, i) => setA.has(i));
    const equipoB = jugadores.filter((_, i) => !setA.has(i));
    const costes = calcularCostesBrutos(equipoA, equipoB, historial);

    candidatos.push({ indicesA, costes });
    minDiff = Math.min(minDiff, costes.diffRating); maxDiff = Math.max(maxDiff, costes.diffRating);
    minHist = Math.min(minHist, costes.costeHistorial); maxHist = Math.max(maxHist, costes.costeHistorial);
    minPos = Math.min(minPos, costes.costePosicion); maxPos = Math.max(maxPos, costes.costePosicion);
  }

  let mejor = candidatos[0];
  let mejorPuntuacion = Infinity;

  for (const c of candidatos) {
    const puntuacion =
      PESO_RATING * normalizar(c.costes.diffRating, minDiff, maxDiff) +
      PESO_HISTORIAL * normalizar(c.costes.costeHistorial, minHist, maxHist) +
      PESO_POSICION * normalizar(c.costes.costePosicion, minPos, maxPos);

    if (puntuacion < mejorPuntuacion) {
      mejorPuntuacion = puntuacion;
      mejor = c;
    }
  }

  const setA = new Set(mejor.indicesA);
  const equipoA = jugadores.filter((_, i) => setA.has(i));
  const equipoB = jugadores.filter((_, i) => !setA.has(i));

  return empaquetarResultado(equipoA, equipoB, mejor.costes, candidatos.length, 'exhaustivo');
}

/**
 * Heurística para grupos grandes (> LIMITE_EXHAUSTIVO): parte de varios
 * repartos aleatorios y mejora cada uno intercambiando pares de jugadores
 * entre equipos mientras el coste combinado siga bajando. Se queda con el
 * mejor resultado de varios reinicios.
 */
function generarEquiposHeuristico(
  jugadores: JugadorParaGenerador[],
  historial: MapaHistorial,
  tamA: number
): ResultadoGeneracion {
  const REINICIOS = 40;
  const n = jugadores.length;

  const puntuarSimple = (equipoA: JugadorParaGenerador[], equipoB: JugadorParaGenerador[]) => {
    const c = calcularCostesBrutos(equipoA, equipoB, historial);
    // Sin min/max global disponible (no enumeramos todo), usamos
    // denominadores de escala razonables: rating máximo teórico de
    // diferencia (~100*n/2) y conteos de historial/posición ya son
    // pequeños por naturaleza.
    const escalaRating = Math.max(1, (100 * tamA) / 2);
    return (
      PESO_RATING * (c.diffRating / escalaRating) +
      PESO_HISTORIAL * (c.costeHistorial / Math.max(1, n)) +
      PESO_POSICION * (c.costePosicion / Math.max(1, n))
    );
  };

  let mejorGlobal: { equipoA: JugadorParaGenerador[]; equipoB: JugadorParaGenerador[]; puntuacion: number } | null = null;

  for (let r = 0; r < REINICIOS; r++) {
    const mezclados = [...jugadores].sort(() => Math.random() - 0.5);
    let equipoA = mezclados.slice(0, tamA);
    let equipoB = mezclados.slice(tamA);
    let puntuacion = puntuarSimple(equipoA, equipoB);

    let mejorando = true;
    while (mejorando) {
      mejorando = false;
      for (let i = 0; i < equipoA.length; i++) {
        for (let j = 0; j < equipoB.length; j++) {
          const nuevaA = [...equipoA]; const nuevaB = [...equipoB];
          [nuevaA[i], nuevaB[j]] = [nuevaB[j], nuevaA[i]];
          const nuevaPuntuacion = puntuarSimple(nuevaA, nuevaB);
          if (nuevaPuntuacion < puntuacion) {
            equipoA = nuevaA; equipoB = nuevaB; puntuacion = nuevaPuntuacion;
            mejorando = true;
          }
        }
      }
    }

    if (!mejorGlobal || puntuacion < mejorGlobal.puntuacion) {
      mejorGlobal = { equipoA, equipoB, puntuacion };
    }
  }

  const costesFinal = calcularCostesBrutos(mejorGlobal!.equipoA, mejorGlobal!.equipoB, historial);
  return empaquetarResultado(mejorGlobal!.equipoA, mejorGlobal!.equipoB, costesFinal, REINICIOS, 'heuristico');
}
