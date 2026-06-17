// =====================================================================
// Acceso a datos — pagos.
// =====================================================================
// `vista_pagos_pendientes` (en schema.sql) es la única definición de
// "lo que alguien debe": solo partidos ya jugados, donde estuvo
// confirmado y todavía no se ha marcado como pagado. Tanto la pantalla
// de admin como el aviso en el perfil de cada jugador leen de la
// misma vista, así que nunca pueden desincronizarse entre ellas.
// =====================================================================

import { supabase } from './supabase';
import type { PagoEstado, PagoPendiente } from '../types/database';
import type { ResultadoAccion } from './partidos';

export async function listarPagosPendientes(): Promise<PagoPendiente[]> {
  const { data, error } = await supabase
    .from('vista_pagos_pendientes')
    .select('*')
    .order('fecha', { ascending: false });
  if (error) throw error;
  return (data ?? []) as PagoPendiente[];
}

export async function listarPagosPendientesDe(jugadorId: string): Promise<PagoPendiente[]> {
  const { data, error } = await supabase
    .from('vista_pagos_pendientes')
    .select('*')
    .eq('jugador_id', jugadorId)
    .order('fecha', { ascending: false });
  if (error) throw error;
  return (data ?? []) as PagoPendiente[];
}

export async function marcarPago(
  inscripcionId: string,
  nuevoEstado: PagoEstado
): Promise<ResultadoAccion> {
  const { error } = await supabase.rpc('fn_marcar_pago', {
    p_inscripcion_id: inscripcionId,
    p_nuevo_estado: nuevoEstado,
  });
  return { error: error ? error.message : null };
}
