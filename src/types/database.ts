// =====================================================================
// Tipos compartidos — reflejan 1:1 las tablas/enums de schema.sql
// =====================================================================

export type TipoJugador = 'registrado' | 'invitado';
export type RolUsuario = 'admin' | 'jugador';
export type Posicion = 'atacante' | 'defensor' | 'mixto';
export type EstadoPartido = 'abierto' | 'cerrado' | 'cancelado' | 'jugado';
export type DisponibilidadEstado = 'pendiente' | 'voy' | 'no_voy';
export type InscripcionEstado = 'confirmado' | 'lista_espera' | 'cancelado';
export type PagoEstado = 'pendiente' | 'pagado';
export type Equipo = 'A' | 'B';

export interface Jugador {
  id: string;
  auth_user_id: string | null;
  tipo: TipoJugador;
  rol: RolUsuario;
  nombre: string;
  apellidos: string | null;
  email: string | null;
  telefono: string | null;
  posicion_preferida: Posicion;
  posicion_confirmada: boolean;
  rating_actual: number;
  rating_inicial_confirmado: boolean;
  // Media móvil exponencial de cuánto mejor/peor rinde este jugador
  // frente a lo que el Elo previo de su equipo predecía. -1..1, 0 =
  // neutro. Ver fn_finalizar_partido en schema.sql.
  impacto_victoria: number;
  partidos_jugados: number;
  victorias: number;
  derrotas: number;
  empates: number;
  veces_como_invitado: number;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Partido {
  id: string;
  fecha: string; // 'YYYY-MM-DD'
  hora: string; // 'HH:MM:SS'
  campo: string;
  precio_total: number;
  jugadores_max: number;
  estado: EstadoPartido;
  resultado_goles_a: number | null;
  resultado_goles_b: number | null;
  notas: string | null;
  creado_por: string | null;
  reservador_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Partido con el nombre del reservador ya resuelto (join), tal y
 *  como lo devuelve `obtenerPartido`. */
export interface PartidoConReservador extends Partido {
  reservador: { id: string; nombre: string; apellidos: string | null } | null;
}

export interface Inscripcion {
  id: string;
  partido_id: string;
  jugador_id: string;
  disponibilidad: DisponibilidadEstado;
  estado_inscripcion: InscripcionEstado;
  equipo: Equipo | null;
  pago_estado: PagoEstado;
  inscrito_por_admin: boolean;
  bloqueo_ignorado: boolean;
  created_at: string;
  updated_at: string;
}

export interface HistorialCompanero {
  companero_id: string;
  veces_jugado_juntos: number;
  ultimo_partido_id: string | null;
}

// Forma mínima que necesita el generador de equipos — se construye
// a partir de Jugador + sus inscripciones confirmadas para un partido.
export interface JugadorParaGenerador {
  id: string;
  nombre: string;
  rating: number;
  posicion: Posicion;
  impactoVictoria: number;
}

// Refleja la vista vista_estadisticas_jugadores (porcentaje_victorias
// se calcula al vuelo en SQL, nunca se guarda).
export interface EstadisticasJugador {
  id: string;
  nombre: string;
  apellidos: string | null;
  tipo: TipoJugador;
  rol: RolUsuario;
  posicion_preferida: Posicion;
  rating_actual: number;
  impacto_victoria: number;
  partidos_jugados: number;
  victorias: number;
  derrotas: number;
  empates: number;
  porcentaje_victorias: number;
}

// Un partido con el recuento de plazas confirmadas ya calculado, tal
// y como lo necesita la lista de partidos.
export interface PartidoConContador extends Partido {
  confirmados: number;
}

// Una inscripción con los datos del jugador ya incrustados (vienen
// del embed de PostgREST `jugador:jugadores(*)`), tal y como lo
// necesita la lista de convocados de un partido.
export interface InscripcionConJugador extends Inscripcion {
  jugador: Jugador;
}

// Refleja la vista vista_pagos_pendientes: una fila por cada partido
// ya jugado, confirmado y sin marcar como pagado.
export interface PagoPendiente {
  inscripcion_id: string;
  jugador_id: string;
  nombre: string;
  apellidos: string | null;
  partido_id: string;
  fecha: string;
  hora: string;
  campo: string;
}
