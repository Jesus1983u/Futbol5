// =====================================================================
// Acceso a datos — votación del ranking inicial.
// =====================================================================
// Cualquier jugador activo puede votar (no solo el admin); por eso
// vive separado de admin.ts. fn_guardar_votacion siempre actúa sobre
// el propio votante_id del que llama, así que no hace falta pasar
// ningún id de "quién vota" — solo el orden elegido.
// =====================================================================

import { supabase } from './supabase';
import type { Jugador } from '../types/database';
import type { ResultadoAccion } from './partidos';

export async function listarJugadoresParaVotar(propioId: string): Promise<Jugador[]> {
  const { data, error } = await supabase
    .from('jugadores')
    .select('*')
    .eq('activo', true)
    .neq('id', propioId)
    .order('nombre', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Jugador[];
}

/** Devuelve los ids de jugador en el orden de la votación anterior de
 *  esta persona (vacío si todavía no ha votado nunca). */
export async function obtenerMiVotoActual(propioId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('rankings_iniciales')
    .select('jugador_id, posicion')
    .eq('votante_id', propioId)
    .order('posicion', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((fila) => fila.jugador_id as string);
}
export async function guardarVotacion(orden: string[]): Promise<ResultadoAccion> {
  const { error } = await supabase.rpc('fn_guardar_votacion', { p_orden: orden });
  return { error: error ? error.message : null };
}
