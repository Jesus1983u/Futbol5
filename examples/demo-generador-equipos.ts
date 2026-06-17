// =====================================================================
// EJEMPLO DE USO — generador de equipos
// =====================================================================
// No forma parte de la app; sirve como documentación ejecutable.
// Pruébalo con: npx tsx examples/demo-generador-equipos.ts
// (una vez tengas el proyecto con sus dependencias instaladas)
// =====================================================================

import { generarEquipos, construirMapaHistorial } from '../src/lib/teamGenerator';
import { calcularCambioElo } from '../src/lib/elo';
import type { JugadorParaGenerador } from '../src/types/database';

const jugadores: JugadorParaGenerador[] = [
  { id: '1', nombre: 'Jesús', rating: 85, posicion: 'atacante' },
  { id: '2', nombre: 'Juan', rating: 80, posicion: 'defensor' },
  { id: '3', nombre: 'Rafa', rating: 78, posicion: 'atacante' },
  { id: '4', nombre: 'Pepe', rating: 75, posicion: 'defensor' },
  { id: '5', nombre: 'Luis', rating: 70, posicion: 'atacante' },
  { id: '6', nombre: 'Manolo', rating: 68, posicion: 'defensor' },
  { id: '7', nombre: 'Antonio', rating: 60, posicion: 'atacante' },
  { id: '8', nombre: 'Curro', rating: 55, posicion: 'defensor' },
  { id: '9', nombre: 'Sergio', rating: 50, posicion: 'atacante' },
  { id: '10', nombre: 'Pablo', rating: 40, posicion: 'atacante' },
];

// Jesús y Juan han jugado juntos 25 veces -> el algoritmo debería evitar
// repetir la pareja si hay alternativas igual de equilibradas en rating.
const historial = construirMapaHistorial([
  { jugadorA: '1', jugadorB: '2', veces: 25 },
  { jugadorA: '1', jugadorB: '7', veces: 3 },
]);

const resultado = generarEquipos(jugadores, historial);

console.log(`Equipo A (${resultado.equipoA.ratingTotal} pts, ${resultado.equipoA.atacantes} atk / ${resultado.equipoA.defensores} def):`);
resultado.equipoA.jugadores.forEach((j) => console.log(`  - ${j.nombre} (${j.rating})`));

console.log(`\nEquipo B (${resultado.equipoB.ratingTotal} pts, ${resultado.equipoB.atacantes} atk / ${resultado.equipoB.defensores} def):`);
resultado.equipoB.jugadores.forEach((j) => console.log(`  - ${j.nombre} (${j.rating})`));

console.log(`\nDiferencia de rating: ${resultado.diferenciaRating} (de ${resultado.combinacionesEvaluadas} combinaciones evaluadas, método ${resultado.metodo})`);

// Tras jugar, por ejemplo 5-4 a favor del equipo A:
const cambio = calcularCambioElo(resultado.equipoA.ratingTotal, resultado.equipoB.ratingTotal, 5, 4);
console.log(`\nSi gana el equipo A 5-4: cada jugador de A ${cambio.cambioA >= 0 ? 'gana' : 'pierde'} ${Math.abs(cambio.cambioA).toFixed(2)} puntos, cada uno de B lo contrario.`);
