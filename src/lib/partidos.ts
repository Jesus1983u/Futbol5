// =====================================================================
// Acceso a datos — partidos e inscripciones.
// =====================================================================
// Capa fina sobre supabase-js: cada función hace una sola cosa y
// devuelve datos ya tipados, para que las pantallas no tengan que
// conocer los nombres de columnas ni la forma de las respuestas de
// PostgREST.
// =====================================================================

import { supabase } from './supabase';
import { calcularSinergia, MIN_PARTIDOS_PARA_SINERGIA } from './teamGenerator';
import type {
  EstadisticasJugador,
  Inscripcion,
  InscripcionConJugador,
  Jugador,
  Partido,
  PartidoConContador,
  PartidoConReservador,
} from '../types/database';

export async function listarPartidos(): Promise<PartidoConContador[]> {
  const { data: partidos, error } = await supabase
    .from('partidos')
    .select('*')
    .order('fecha', { ascending: true })
    .order('hora', { ascending: true });
  if (error) throw error;
  if (!partidos || partidos.length === 0) return [];

  const { data: confirmados, error: errorConfirmados } = await supabase
    .from('inscripciones')
    .select('partido_id')
    .eq('estado_inscripcion', 'confirmado')
    .in(
      'partido_id',
      (partidos as Partido[]).map((p) => p.id)
    );
  if (errorConfirmados) throw errorConfirmados;

  const conteos = new Map<string, number>();
  for (const fila of confirmados ?? []) {
    conteos.set(fila.partido_id, (conteos.get(fila.partido_id) ?? 0) + 1);
  }

  return (partidos as Partido[]).map((p) => ({ ...p, confirmados: conteos.get(p.id) ?? 0 }));
}

export async function obtenerPartido(id: string): Promise<PartidoConReservador | null> {
  const { data, error } = await supabase
    .from('partidos')
    .select('*, reservador:jugadores!partidos_reservador_id_fkey(id, nombre, apellidos)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as PartidoConReservador | null;
}

export async function listarInscripciones(partidoId: string): Promise<InscripcionConJugador[]> {
  const { data, error } = await supabase
    .from('inscripciones')
    .select('*, jugador:jugadores(*)')
    .eq('partido_id', partidoId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as InscripcionConJugador[];
}

export interface DatosNuevoPartido {
  fecha: string;
  hora: string;
  campo: string;
  precio_total: number;
  jugadores_max: number;
  notas: string | null;
  reservador_id: string | null;
}

export async function crearPartido(
  datos: DatosNuevoPartido,
  creadoPorJugadorId: string
): Promise<Partido> {
  const { data, error } = await supabase
    .from('partidos')
    .insert({ ...datos, creado_por: creadoPorJugadorId })
    .select()
    .single();
  if (error) throw error;
  return data as Partido;
}

export async function actualizarEstadoPartido(
  partidoId: string,
  estado: Partido['estado']
): Promise<void> {
  const { error } = await supabase.from('partidos').update({ estado }).eq('id', partidoId);
  if (error) throw error;
}

/** Resultado de las RPC fn_inscribirse / fn_cancelar_inscripcion: cuando
 *  fallan por una razón esperada (deuda, partido cerrado, no autorizado)
 *  devolvemos un mensaje legible en vez de propagar la excepción cruda
 *  de Postgres. */
export interface ResultadoAccion {
  error: string | null;
}

function mensajeLegible(mensajeOriginal: string): string {
  const partes = mensajeOriginal.split(':');
  if (partes.length > 1 && /^[A-Z_]+$/.test(partes[0].trim())) {
    return partes.slice(1).join(':').trim();
  }
  return mensajeOriginal;
}

export async function inscribirse(
  partidoId: string,
  jugadorId: string,
  forzadoPorAdmin = false
): Promise<ResultadoAccion> {
  const { error } = await supabase.rpc('fn_inscribirse', {
    p_partido_id: partidoId,
    p_jugador_id: jugadorId,
    p_forzado_por_admin: forzadoPorAdmin,
  });
  return { error: error ? mensajeLegible(error.message) : null };
}

export async function cancelarInscripcion(inscripcionId: string): Promise<ResultadoAccion> {
  const { error } = await supabase.rpc('fn_cancelar_inscripcion', {
    p_inscripcion_id: inscripcionId,
  });
  return { error: error ? mensajeLegible(error.message) : null };
}

export async function listarJugadoresActivos(): Promise<Jugador[]> {
  const { data, error } = await supabase
    .from('jugadores')
    .select('*')
    .eq('activo', true)
    .order('nombre', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Jugador[];
}

export async function crearInvitado(
  nombre: string,
  ratingEstimado?: number,
  email?: string,
  telefono?: string
): Promise<Jugador> {
  const datos: Record<string, unknown> = { nombre, tipo: 'invitado' };
  if (ratingEstimado !== undefined) {
    datos.rating_actual = ratingEstimado;
    datos.rating_inicial_confirmado = true;
  }
  if (email) datos.email = email;
  if (telefono) datos.telefono = telefono;
  const { data, error } = await supabase.from('jugadores').insert(datos).select().single();
  if (error) throw error;
  return data as Jugador;
}

export interface ParEnHistorial {
  jugadorA: string;
  jugadorB: string;
  veces: number;
  victorias: number;
  derrotas: number;
  empates: number;
}

export async function obtenerHistorialPares(): Promise<ParEnHistorial[]> {
  const { data, error } = await supabase
    .from('historial_companeros')
    .select(
      'jugador_menor_id, jugador_mayor_id, veces_jugado_juntos, victorias_juntos, derrotas_juntos, empates_juntos'
    );
  if (error) throw error;
  return (data ?? []).map((fila) => ({
    jugadorA: fila.jugador_menor_id,
    jugadorB: fila.jugador_mayor_id,
    veces: fila.veces_jugado_juntos,
    victorias: fila.victorias_juntos,
    derrotas: fila.derrotas_juntos,
    empates: fila.empates_juntos,
  }));
}

export interface ParConNombres {
  nombreA: string;
  nombreB: string;
  veces: number;
  sinergia: number;
}

/** Para la pantalla de Historial: igual que obtenerHistorialPares pero
 *  con los nombres ya resueltos, ordenado de más a menos veces juntos.
 *  Se hace el cruce en JS en vez de pedirle a PostgREST que incruste
 *  dos relaciones distintas hacia la misma tabla (jugador_menor_id y
 *  jugador_mayor_id), que necesitaría nombrar las foreign keys exactas
 *  — esto es más simple y el grupo es pequeño, así que no pesa nada. */
export async function listarHistorialCompaneros(): Promise<ParConNombres[]> {
  const [pares, { data: jugadores, error }] = await Promise.all([
    obtenerHistorialPares(),
    supabase.from('jugadores').select('id, nombre, apellidos'),
  ]);
  if (error) throw error;
  const nombrePorId = new Map(
    (jugadores ?? []).map((j) => [j.id as string, `${j.nombre} ${j.apellidos ?? ''}`.trim()])
  );
  return pares
    .map((p) => ({
      nombreA: nombrePorId.get(p.jugadorA) ?? '(jugador dado de baja)',
      nombreB: nombrePorId.get(p.jugadorB) ?? '(jugador dado de baja)',
      veces: p.veces,
      sinergia: calcularSinergia(p.victorias, p.derrotas, p.veces),
    }))
    .sort((a, b) => b.veces - a.veces);
}

export interface CompaneroConHistorial {
  nombre: string;
  veces: number;
  victorias: number;
  empates: number;
  derrotas: number;
}

/** Para la pantalla de Historial de cada usuario: solo las parejas en
 *  las que participa él mismo, con el desglose V/E/D. */
export async function listarMisCompaneros(
  miId: string
): Promise<CompaneroConHistorial[]> {
  const [pares, { data: jugadores, error }] = await Promise.all([
    obtenerHistorialPares(),
    supabase.from('jugadores').select('id, nombre, apellidos'),
  ]);
  if (error) throw error;
  const nombrePorId = new Map(
    (jugadores ?? []).map((j) => [j.id as string, `${j.nombre} ${j.apellidos ?? ''}`.trim()])
  );
  return pares
    .filter((p) => p.jugadorA === miId || p.jugadorB === miId)
    .map((p) => {
      const otroId = p.jugadorA === miId ? p.jugadorB : p.jugadorA;
      return {
        nombre: nombrePorId.get(otroId) ?? '(jugador dado de baja)',
        veces: p.veces,
        victorias: p.victorias,
        empates: p.empates,
        derrotas: p.derrotas,
      };
    })
    .sort((a, b) => b.veces - a.veces);
}

export interface CompaneroDestacado {
  nombre: string;
  sinergia: number;
  partidos: number;
}

/** Mejor y peor compañero histórico de un jugador, para mostrar en su
 *  perfil. "Mejor"/"peor" se basa en la sinergia (ver
 *  src/lib/teamGenerator.ts::calcularSinergia), no en la frecuencia —
 *  jugar mucho junto a alguien no es lo mismo que ganar más de lo
 *  esperado con esa persona. Si no hay ninguna pareja con al menos
 *  MIN_PARTIDOS_PARA_SINERGIA partidos juntos, ambos salen null en
 *  vez de mostrar un dato poco fiable basado en 1-2 partidos. */
export async function obtenerMejorPeorCompanero(
  jugadorId: string
): Promise<{ mejor: CompaneroDestacado | null; peor: CompaneroDestacado | null }> {
  const [pares, { data: jugadores, error }] = await Promise.all([
    obtenerHistorialPares(),
    supabase.from('jugadores').select('id, nombre, apellidos'),
  ]);
  if (error) throw error;
  const nombrePorId = new Map(
    (jugadores ?? []).map((j) => [j.id as string, `${j.nombre} ${j.apellidos ?? ''}`.trim()])
  );

  const propios = pares
    .filter((p) => p.jugadorA === jugadorId || p.jugadorB === jugadorId)
    .filter((p) => p.veces >= MIN_PARTIDOS_PARA_SINERGIA)
    .map((p) => {
      const otroId = p.jugadorA === jugadorId ? p.jugadorB : p.jugadorA;
      return {
        nombre: nombrePorId.get(otroId) ?? '(jugador dado de baja)',
        sinergia: calcularSinergia(p.victorias, p.derrotas, p.veces),
        partidos: p.veces,
      };
    });

  if (propios.length === 0) return { mejor: null, peor: null };

  const ordenados = [...propios].sort((a, b) => b.sinergia - a.sinergia);
  const mejor = ordenados[0];
  const peor = ordenados[ordenados.length - 1];
  // Si solo hay una pareja con datos suficientes, mejor y peor serían
  // la misma persona — más confuso que útil, así que en ese caso solo
  // se devuelve "mejor".
  return { mejor, peor: peor.nombre === mejor.nombre ? null : peor };
}

export async function guardarEquipos(
  asignaciones: { inscripcionId: string; equipo: 'A' | 'B' }[]
): Promise<ResultadoAccion> {
  for (const { inscripcionId, equipo } of asignaciones) {
    const { error } = await supabase
      .from('inscripciones')
      .update({ equipo })
      .eq('id', inscripcionId);
    if (error) return { error: error.message };
  }
  return { error: null };
}

export async function obtenerEstadisticas(jugadorId: string): Promise<EstadisticasJugador | null> {
  const { data, error } = await supabase
    .from('vista_estadisticas_jugadores')
    .select('*')
    .eq('id', jugadorId)
    .maybeSingle();
  if (error) throw error;
  return data as EstadisticasJugador | null;
}

export async function listarEstadisticas(): Promise<EstadisticasJugador[]> {
  const { data, error } = await supabase.from('vista_estadisticas_jugadores').select('*');
  if (error) throw error;
  return (data ?? []) as EstadisticasJugador[];
}

export type { Inscripcion };
