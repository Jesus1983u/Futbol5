// =====================================================================
// EJEMPLO DE USO — generador de equipos
// =====================================================================
// No forma parte de la app; sirve como documentación ejecutable.
// Pruébalo con: npx tsx examples/demo-generador-equipos.ts
// (una vez tengas el proyecto con sus dependencias instaladas)
// =====================================================================

import { generarEquipos, construirMapaSinergia } from '../src/lib/teamGenerator';
import { calcularCambioElo } from '../src/lib/elo';
import type { JugadorParaGenerador } from '../src/types/database';

const jugadores: JugadorParaGenerador[] = [
  { id: '1', nombre: 'Jesús', rating: 85, posicion: 'atacante', impactoVictoria: 0.3 },
  { id: '2', nombre: 'Juan', rating: 80, posicion: 'defensor', impactoVictoria: 0.1 },
  { id: '3', nombre: 'Rafa', rating: 78, posicion: 'atacante', impactoVictoria: -0.1 },
  { id: '4', nombre: 'Pepe', rating: 75, posicion: 'defensor', impactoVictoria: 0 },
  { id: '5', nombre: 'Luis', rating: 70, posicion: 'mixto', impactoVictoria: 0.05 },
  { id: '6', nombre: 'Manolo', rating: 68, posicion: 'defensor', impactoVictoria: 0 },
  { id: '7', nombre: 'Antonio', rating: 60, posicion: 'atacante', impactoVictoria: -0.2 },
  { id: '8', nombre: 'Curro', rating: 55, posicion: 'defensor', impactoVictoria: 0 },
  { id: '9', nombre: 'Sergio', rating: 50, posicion: 'atacante', impactoVictoria: 0.15 },
  { id: '10', nombre: 'Pablo', rating: 40, posicion: 'atacante', impactoVictoria: 0 },
];

// Jesús y Juan han jugado juntos 25 veces y han ganado 20 de ellas ->
// sinergia muy positiva, el algoritmo debería premiar ligeramente que
// sigan en el mismo equipo si el resto de factores lo permite.
// Jesús y Antonio han jugado pocas veces (3) -> por debajo del umbral
// MIN_PARTIDOS_PARA_SINERGIA, se trata como neutro pase lo que pase.
const sinergia = construirMapaSinergia([
  { jugadorA: '1', jugadorB: '2', partidos: 25, victorias: 20, derrotas: 3, empates: 2 },
  { jugadorA: '1', jugadorB: '7', partidos: 3, victorias: 0, derrotas: 3, empates: 0 },
]);

const resultado = generarEquipos(jugadores, sinergia);

console.log(`Equipo A (${resultado.equipoA.ratingTotal} pts, impacto ${resultado.equipoA.impactoTotal}, ${resultado.equipoA.atacantes} atk / ${resultado.equipoA.defensores} def / ${resultado.equipoA.mixtos} mixto):`);
resultado.equipoA.jugadores.forEach((j) => console.log(`  - ${j.nombre} (${j.rating})`));

console.log(`\nEquipo B (${resultado.equipoB.ratingTotal} pts, impacto ${resultado.equipoB.impactoTotal}, ${resultado.equipoB.atacantes} atk / ${resultado.equipoB.defensores} def / ${resultado.equipoB.mixtos} mixto):`);
resultado.equipoB.jugadores.forEach((j) => console.log(`  - ${j.nombre} (${j.rating})`));

console.log(`\nDiferencia de rating: ${resultado.diferenciaRating} (de ${resultado.combinacionesEvaluadas} combinaciones evaluadas, método ${resultado.metodo})`);

// Tras jugar, por ejemplo 5-4 a favor del equipo A:
const cambio = calcularCambioElo(resultado.equipoA.ratingTotal, resultado.equipoB.ratingTotal, 5, 4);
console.log(`\nSi gana el equipo A 5-4: cada jugador de A ${cambio.cambioA >= 0 ? 'gana' : 'pierde'} ${Math.abs(cambio.cambioA).toFixed(2)} puntos, cada uno de B lo contrario.`);
