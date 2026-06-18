// =====================================================================
// Acceso a datos — panel de administrador.
// =====================================================================
// Gestión de jugadores, registrar el resultado de un partido jugado, y
// revisar/aplicar el ranking inicial sugerido por la votación. Todo lo
// de aquí asume que quien llama ya pasó por <RequireAdmin>; las RPCs
// además vuelven a comprobarlo por su cuenta en el lado del servidor.
// =====================================================================

import { supabase } from './supabase';
import type { Jugador, RolUsuario } from '../types/database';
import type { ResultadoAccion } from './partidos';

export async function listarTodosLosJugadores(): Promise<Jugador[]> {
  const { data, error } = await supabase
    .from('jugadores')
    .select('*')
    .order('activo', { ascending: false })
    .order('nombre', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Jugador[];
}

export interface CambiosJugadorAdmin {
  nombre: string;
  apellidos: string | null;
  telefono: string | null;
  posicion_preferida: Jugador['posicion_preferida'];
  rol: RolUsuario;
  tipo: Jugador['tipo'];
  activo: boolean;
}

export async function actualizarJugadorAdmin(
  jugadorId: string,
  cambios: CambiosJugadorAdmin
): Promise<ResultadoAccion> {
  const { error } = await supabase.from('jugadores').update(cambios).eq('id', jugadorId);
  return { error: error ? error.message : null };
}

export async function finalizarPartido(
  partidoId: string,
  golesA: number,
  golesB: number
): Promise<ResultadoAccion> {
  const { error } = await supabase.rpc('fn_finalizar_partido', {
    p_partido_id: partidoId,
    p_goles_a: golesA,
    p_goles_b: golesB,
  });
  return { error: error ? mensajeLegible(error.message) : null };
}

function mensajeLegible(mensajeOriginal: string): string {
  const partes = mensajeOriginal.split(':');
  if (partes.length > 1 && /^[A-Z_]+$/.test(partes[0].trim())) {
    return partes.slice(1).join(':').trim();
  }
  return mensajeOriginal;
}

export interface RatingSugerido {
  jugador_id: string;
  nombre: string;
  puntos_borda: number;
  rating_sugerido: number;
}

export async function calcularRatingsIniciales(): Promise<RatingSugerido[]> {
  const { data, error } = await supabase.rpc('fn_calcular_ratings_iniciales');
  if (error) throw error;
  return (data ?? []) as RatingSugerido[];
}

export async function aplicarRatingInicial(
  jugadorId: string,
  rating: number
): Promise<ResultadoAccion> {
  const { error } = await supabase.rpc('fn_aplicar_rating_inicial', {
    p_jugador_id: jugadorId,
    p_rating: rating,
  });
  return { error: error ? error.message : null };
}

export async function contarVotantes(): Promise<number> {
  const { data, error } = await supabase.from('rankings_iniciales').select('votante_id');
  if (error) throw error;
  return new Set((data ?? []).map((f) => f.votante_id)).size;
}
