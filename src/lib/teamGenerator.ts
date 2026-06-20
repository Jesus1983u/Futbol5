// =====================================================================
// GENERADOR DE EQUIPOS EQUILIBRADOS
// =====================================================================
// Evalúa combinaciones de reparto en dos equipos y elige la que
// minimiza un coste combinado de cuatro señales:
//
//   70% — diferencia de rating (Elo) total entre equipos
//   10% — diferencia de "impacto en victoria" total entre equipos
//   10% — sinergias de pareja (penaliza sinergia negativa, premia
//         sinergia positiva entre compañeros de equipo)
//   10% — desequilibrio entre atacantes y defensores (los jugadores
//         "mixto" cuentan como lo que más equilibre cada reparto)
//
// El rating sigue siendo, con diferencia, la señal dominante — las
// otras tres son ajustes finos sobre reparticiones que ya son
// parejas en rating, nunca al revés.
//
// Para grupos pequeños/medianos (hasta LIMITE_EXHAUSTIVO jugadores)
// se evalúan TODAS las combinaciones posibles. Por encima de ese
// límite se usa una búsqueda local (random-restart hill-climbing)
// que en la práctica converge a soluciones igual de buenas en
// milisegundos.
// =====================================================================

import type { JugadorParaGenerador, Posicion } from '../types/database';

const PESO_RATING = 0.7;
const PESO_IMPACTO = 0.1;
const PESO_SINERGIA = 0.1;
const PESO_POSICION = 0.1;

// Por debajo de este número de partidos jugados juntos, la sinergia
// de una pareja se trata como neutra (0) en vez de usar el valor
// calculado — con 1-2 partidos, una racha de suerte pesaría tanto
// como una tendencia real, y el objetivo es una señal estable, no
// ruidosa. Con el grupo creciendo, las parejas con datos suficientes
// van ganando peso de forma natural.
export const MIN_PARTIDOS_PARA_SINERGIA = 3;

// Por encima de este tamaño de grupo, C(n, n/2)/2 crece demasiado para
// fuerza bruta razonable en el navegador (a partir de ~24 ya son
// millones de combinaciones). 24 cubre con margen cualquier convocatoria
// real de fútbol 5 (normalmente 10-16 jugadores con algún invitado).
const LIMITE_EXHAUSTIVO = 24;

export interface MapaHistorial {
  // clave: "idMenor|idMayor" (orden alfabético) -> veces jugados juntos
  [parKey: string]: number;
}

export interface ParHistorialCompleto {
  jugadorA: string;
  jugadorB: string;
  partidos: number;
  victorias: number;
  derrotas: number;
  empates: number;
}

export interface MapaSinergia {
  // clave: "idMenor|idMayor" -> sinergia ya calculada y con el
  // umbral de MIN_PARTIDOS_PARA_SINERGIA aplicado (0 si no hay datos
  // suficientes todavía).
  [parKey: string]: number;
}

export interface EquipoGenerado {
  jugadores: JugadorParaGenerador[];
  ratingTotal: number;
  impactoTotal: number;
  atacantes: number;
  defensores: number;
  mixtos: number;
}

export interface ResultadoGeneracion {
  equipoA: EquipoGenerado;
  equipoB: EquipoGenerado;
  diferenciaRating: number;
  combinacionesEvaluadas: number;
  metodo: 'exhaustivo' | 'heuristico';
}

export function claveHistorial(idA: string, idB: string): string {
  return idA < idB ? `${idA}|${idB}` : `${idB}|${idA}`;
}

/** Construye el mapa de historial simple (solo frecuencia) a partir
 *  de filas (idA, idB, veces). Se mantiene por compatibilidad con
 *  cualquier otro consumidor que solo necesite "cuántas veces
 *  juntos" sin entrar en sinergia. */
export function construirMapaHistorial(
  filas: { jugadorA: string; jugadorB: string; veces: number }[]
): MapaHistorial {
  const mapa: MapaHistorial = {};
  for (const f of filas) {
    mapa[claveHistorial(f.jugadorA, f.jugadorB)] = f.veces;
  }
  return mapa;
}

/** Sinergia de una pareja a partir de su historial: cuánto más ganan
 *  que pierden cuando juegan juntos, en relación a los partidos
 *  jugados. Rango -1..1 por construcción (|victorias - derrotas|
 *  nunca puede superar el total de partidos). 0 = neutro, ya sea
 *  porque ganan y pierden por igual o porque no hay datos.
 *
 *  Por debajo de MIN_PARTIDOS_PARA_SINERGIA partidos juntos, se
 *  devuelve 0 (neutro) en vez del valor calculado — con muy pocos
 *  partidos, el resultado es más ruido que señal. */
export function calcularSinergia(
  victorias: number,
  derrotas: number,
  partidos: number
): number {
  if (partidos < MIN_PARTIDOS_PARA_SINERGIA) return 0;
  const sinergia = (victorias - derrotas) / partidos;
  return Math.max(-1, Math.min(1, sinergia));
}

/** Construye el mapa de sinergia (ya con el umbral aplicado) a partir
 *  del historial completo por pareja. */
export function construirMapaSinergia(filas: ParHistorialCompleto[]): MapaSinergia {
  const mapa: MapaSinergia = {};
  for (const f of filas) {
    mapa[claveHistorial(f.jugadorA, f.jugadorB)] = calcularSinergia(
      f.victorias,
      f.derrotas,
      f.partidos
    );
  }
  return mapa;
}

interface CostesBrutos {
  diffRating: number;
  diffImpacto: number;
  costeSinergia: number;
  costePosicion: number;
}

/** Cuenta atacantes/defensores/mixtos de un equipo y devuelve el
 *  desequilibrio de posiciones más bajo posible frente al otro
 *  equipo, dejando que cada jugador "mixto" cuente como atacante o
 *  defensor, lo que más ayude a equilibrar. El número de mixtos por
 *  equipo es siempre pequeño (típicamente 0-3 en un fútbol 5), así
 *  que probar todas las asignaciones posibles es trivial en coste. */
function costePosicionConMixtos(
  equipoA: JugadorParaGenerador[],
  equipoB: JugadorParaGenerador[]
): number {
  const contar = (equipo: JugadorParaGenerador[]) => {
    let atacantes = 0, defensores = 0, mixtos = 0;
    for (const j of equipo) {
      if (j.posicion === 'atacante') atacantes++;
      else if (j.posicion === 'defensor') defensores++;
      else mixtos++;
    }
    return { atacantes, defensores, mixtos };
  };
  const a = contar(equipoA);
  const b = contar(equipoB);

  let mejorCoste = Infinity;
  for (let mixtosAComoAtacanteA = 0; mixtosAComoAtacanteA <= a.mixtos; mixtosAComoAtacanteA++) {
    for (let mixtosAComoAtacanteB = 0; mixtosAComoAtacanteB <= b.mixtos; mixtosAComoAtacanteB++) {
      const atacantesA = a.atacantes + mixtosAComoAtacanteA;
      const defensoresA = a.defensores + (a.mixtos - mixtosAComoAtacanteA);
      const atacantesB = b.atacantes + mixtosAComoAtacanteB;
      const defensoresB = b.defensores + (b.mixtos - mixtosAComoAtacanteB);
      const coste = Math.abs(atacantesA - atacantesB) + Math.abs(defensoresA - defensoresB);
      if (coste < mejorCoste) mejorCoste = coste;
    }
  }
  return mejorCoste;
}

function calcularCostesBrutos(
  equipoA: JugadorParaGenerador[],
  equipoB: JugadorParaGenerador[],
  sinergia: MapaSinergia
): CostesBrutos {
  const ratingA = equipoA.reduce((s, j) => s + j.rating, 0);
  const ratingB = equipoB.reduce((s, j) => s + j.rating, 0);
  const diffRating = Math.abs(ratingA - ratingB);

  const impactoA = equipoA.reduce((s, j) => s + j.impactoVictoria, 0);
  const impactoB = equipoB.reduce((s, j) => s + j.impactoVictoria, 0);
  const diffImpacto = Math.abs(impactoA - impactoB);

  // Coste de sinergia de un equipo: suma, para cada pareja interna,
  // el negativo de su sinergia. Una pareja con sinergia muy positiva
  // mantenida junta BAJA el coste (se premia); una con sinergia muy
  // negativa mantenida junta lo SUBE (se penaliza).
  const costeSinergiaEquipo = (equipo: JugadorParaGenerador[]): number => {
    let coste = 0;
    for (let i = 0; i < equipo.length; i++) {
      for (let j = i + 1; j < equipo.length; j++) {
        coste += -(sinergia[claveHistorial(equipo[i].id, equipo[j].id)] ?? 0);
      }
    }
    return coste;
  };
  const costeSinergia = costeSinergiaEquipo(equipoA) + costeSinergiaEquipo(equipoB);

  const costePosicion = costePosicionConMixtos(equipoA, equipoB);

  return { diffRating, diffImpacto, costeSinergia, costePosicion };
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
    impactoTotal: Math.round(jugadores.reduce((s, j) => s + j.impactoVictoria, 0) * 100) / 100,
    atacantes: jugadores.filter((j) => j.posicion === 'atacante').length,
    defensores: jugadores.filter((j) => j.posicion === 'defensor').length,
    mixtos: jugadores.filter((j) => j.posicion === 'mixto').length,
  });

  return {
    equipoA: construirEquipo(equipoA),
    equipoB: construirEquipo(equipoB),
    diferenciaRating: Math.round(costes.diffRating * 10) / 10,
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
  sinergia: MapaSinergia
): ResultadoGeneracion {
  const n = jugadores.length;
  if (n < 2) {
    throw new Error('Se necesitan al menos 2 jugadores confirmados para generar equipos.');
  }

  const tamA = Math.ceil(n / 2); // si n es impar, el equipo A se queda con uno más

  if (n <= LIMITE_EXHAUSTIVO) {
    return generarEquiposExhaustivo(jugadores, sinergia, tamA);
  }
  return generarEquiposHeuristico(jugadores, sinergia, tamA);
}

function generarEquiposExhaustivo(
  jugadores: JugadorParaGenerador[],
  sinergia: MapaSinergia,
  tamA: number
): ResultadoGeneracion {
  const n = jugadores.length;
  const candidatos: { indicesA: number[]; costes: CostesBrutos }[] = [];

  let minDiff = Infinity, maxDiff = -Infinity;
  let minImpacto = Infinity, maxImpacto = -Infinity;
  let minSinergia = Infinity, maxSinergia = -Infinity;
  let minPos = Infinity, maxPos = -Infinity;

  for (const indicesA of combinacionesEquipoA(n, tamA)) {
    const setA = new Set(indicesA);
    const equipoA = jugadores.filter((_, i) => setA.has(i));
    const equipoB = jugadores.filter((_, i) => !setA.has(i));
    const costes = calcularCostesBrutos(equipoA, equipoB, sinergia);

    candidatos.push({ indicesA, costes });
    minDiff = Math.min(minDiff, costes.diffRating); maxDiff = Math.max(maxDiff, costes.diffRating);
    minImpacto = Math.min(minImpacto, costes.diffImpacto); maxImpacto = Math.max(maxImpacto, costes.diffImpacto);
    minSinergia = Math.min(minSinergia, costes.costeSinergia); maxSinergia = Math.max(maxSinergia, costes.costeSinergia);
    minPos = Math.min(minPos, costes.costePosicion); maxPos = Math.max(maxPos, costes.costePosicion);
  }

  let mejor = candidatos[0];
  let mejorPuntuacion = Infinity;

  for (const c of candidatos) {
    const puntuacion =
      PESO_RATING * normalizar(c.costes.diffRating, minDiff, maxDiff) +
      PESO_IMPACTO * normalizar(c.costes.diffImpacto, minImpacto, maxImpacto) +
      PESO_SINERGIA * normalizar(c.costes.costeSinergia, minSinergia, maxSinergia) +
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
  sinergia: MapaSinergia,
  tamA: number
): ResultadoGeneracion {
  const REINICIOS = 40;
  const n = jugadores.length;

  const puntuarSimple = (equipoA: JugadorParaGenerador[], equipoB: JugadorParaGenerador[]) => {
    const c = calcularCostesBrutos(equipoA, equipoB, sinergia);
    // Sin min/max global disponible (no enumeramos todo), usamos
    // denominadores de escala razonables: rating máximo teórico de
    // diferencia (~100*n/2), impacto máximo teórico (~2*n/2, ya que
    // cada jugador está en -1..1), y sinergia/posición ya son
    // pequeños por naturaleza (escalan con el número de parejas).
    const escalaRating = Math.max(1, (100 * tamA) / 2);
    const escalaImpacto = Math.max(1, tamA);
    return (
      PESO_RATING * (c.diffRating / escalaRating) +
      PESO_IMPACTO * (c.diffImpacto / escalaImpacto) +
      PESO_SINERGIA * (c.costeSinergia / Math.max(1, n)) +
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

  const costesFinal = calcularCostesBrutos(mejorGlobal!.equipoA, mejorGlobal!.equipoB, sinergia);
  return empaquetarResultado(mejorGlobal!.equipoA, mejorGlobal!.equipoB, costesFinal, REINICIOS, 'heuristico');
}

// Reexportado por conveniencia para quien quiera tipar la posición
// explícitamente sin importar de types/database.
export type { Posicion };
