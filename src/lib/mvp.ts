// =====================================================================
// mvp.ts — funciones de acceso a datos para el sistema de votación MVP.
// =====================================================================

import { supabase } from './supabase';

export interface VotoMvp {
  partido_id: string;
  votante_id: string;
  candidato_id: string;
}

export interface CandidatoMvp {
  id: string;
  nombre: string;
  apellidos: string | null;
  equipo: 'A' | 'B';
}

export interface ResultadoMvp {
  equipo: string;
  mvp_nombre: string;
  votos_recibidos: number;
}

/** Candidatos del equipo contrario al jugador actual para votar MVP. */
export async function listarCandidatosMvp(
  partidoId: string,
  miId: string
): Promise<CandidatoMvp[]> {
  // Primero averiguamos el equipo del jugador actual
  const { data: miInscripcion, error: e1 } = await supabase
    .from('inscripciones')
    .select('equipo')
    .eq('partido_id', partidoId)
    .eq('jugador_id', miId)
    .eq('estado_inscripcion', 'confirmado')
    .maybeSingle();

  if (e1) throw e1;
  if (!miInscripcion?.equipo) return [];

  const equipoContrario = miInscripcion.equipo === 'A' ? 'B' : 'A';

  const { data, error: e2 } = await supabase
    .from('inscripciones')
    .select('jugador_id, equipo, jugador:jugadores(id, nombre, apellidos)')
    .eq('partido_id', partidoId)
    .eq('equipo', equipoContrario)
    .eq('estado_inscripcion', 'confirmado');

  if (e2) throw e2;
  return (data ?? []).map((fila) => {
    const jugadores = fila.jugador as { id: string; nombre: string; apellidos: string | null }[] | { id: string; nombre: string; apellidos: string | null };
    const j = Array.isArray(jugadores) ? jugadores[0] : jugadores;
    return { id: j.id, nombre: j.nombre, apellidos: j.apellidos, equipo: fila.equipo as 'A' | 'B' };
  });
}

/** El voto ya emitido por el jugador en ese partido, o null si no ha votado. */
export async function miVotoMvp(
  partidoId: string,
  miId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('mvp_votos')
    .select('candidato_id')
    .eq('partido_id', partidoId)
    .eq('votante_id', miId)
    .maybeSingle();

  if (error) throw error;
  return data?.candidato_id ?? null;
}

/** Emite (o cambia) el voto MVP del jugador actual para ese partido. */
export async function votarMvp(
  partidoId: string,
  candidatoId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('fn_votar_mvp', {
    p_partido_id: partidoId,
    p_candidato_id: candidatoId,
  });
  if (!error) return { error: null };
  if (error.message.includes('INVITADO')) return { error: 'Los invitados no pueden votar el MVP.' };
  if (error.message.includes('PARTIDO_NO_JUGADO')) return { error: 'El partido todavía no ha terminado.' };
  if (error.message.includes('NO_PARTICIPANTE')) return { error: 'No participaste en ese partido.' };
  if (error.message.includes('MISMO_EQUIPO')) return { error: 'Tienes que votar a alguien del equipo contrario.' };
  return { error: error.message };
}

/** Cuántos jugadores de cada equipo han votado ya el MVP del partido. */
export async function contarVotosMvp(
  partidoId: string
): Promise<{ totalVotantes: number; totalVotos: number }> {
  const [{ count: totalVotos }, { count: totalVotantes }] = await Promise.all([
    supabase
      .from('mvp_votos')
      .select('*', { count: 'exact', head: true })
      .eq('partido_id', partidoId),
    supabase
      .from('inscripciones')
      .select('jugador_id, jugadores!inner(tipo)', { count: 'exact', head: true })
      .eq('partido_id', partidoId)
      .eq('estado_inscripcion', 'confirmado')
      .eq('jugadores.tipo', 'registrado'),
  ]);
  return {
    totalVotos: totalVotos ?? 0,
    totalVotantes: totalVotantes ?? 0,
  };
}

/** Solo admin: cierra la votación y aplica el bonus de rating al MVP. */
export async function cerrarVotacionMvp(
  partidoId: string
): Promise<{ resultado: ResultadoMvp[]; error: string | null }> {
  const { data, error } = await supabase.rpc('fn_cerrar_votacion_mvp', {
    p_partido_id: partidoId,
  });
  if (error) return { resultado: [], error: error.message };
  return { resultado: (data ?? []) as ResultadoMvp[], error: null };
}
