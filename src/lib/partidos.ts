// =====================================================================
// Acceso a datos — partidos e inscripciones.
// =====================================================================
// Capa fina sobre supabase-js: cada función hace una sola cosa y
// devuelve datos ya tipados, para que las pantallas no tengan que
// conocer los nombres de columnas ni la forma de las respuestas de
// PostgREST.
// =====================================================================

import { supabase } from './supabase';
import type {
  EstadisticasJugador,
  Inscripcion,
  InscripcionConJugador,
  Jugador,
  Partido,
  PartidoConContador,
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

export async function obtenerPartido(id: string): Promise<Partido | null> {
  const { data, error } = await supabase.from('partidos').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data as Partido | null;
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

export async function crearInvitado(nombre: string): Promise<Jugador> {
  const { data, error } = await supabase
    .from('jugadores')
    .insert({ nombre, tipo: 'invitado' })
    .select()
    .single();
  if (error) throw error;
  return data as Jugador;
}

export interface ParEnHistorial {
  jugadorA: string;
  jugadorB: string;
  veces: number;
}

export async function obtenerHistorialPares(): Promise<ParEnHistorial[]> {
  const { data, error } = await supabase
    .from('historial_companeros')
    .select('jugador_menor_id, jugador_mayor_id, veces_jugado_juntos');
  if (error) throw error;
  return (data ?? []).map((fila) => ({
    jugadorA: fila.jugador_menor_id,
    jugadorB: fila.jugador_mayor_id,
    veces: fila.veces_jugado_juntos,
  }));
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

export type { Inscripcion };
