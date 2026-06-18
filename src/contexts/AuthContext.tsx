// =====================================================================
// AuthContext — sesión de Supabase Auth + el registro `jugadores`
// vinculado a esa sesión.
// =====================================================================
// El login es por teléfono + contraseña: tú (el admin) creas cada
// cuenta a mano en Supabase → Authentication → Users → "Add user",
// con el teléfono de la persona y una contraseña que tú le asignas
// ("Auto Confirm User" marcado, así no se manda ningún SMS). No hay
// alta por cuenta propia — nadie entra si no le has creado la cuenta
// tú antes.
//
// Se mantiene además `entrarConContrasena` (email + contraseña) como
// vía de respaldo, sobre todo para que tu propia cuenta de pruebas
// (creada por email durante el desarrollo) no se quede colgada el día
// que cambies de móvil o borres el almacenamiento del navegador.
//
// Justo después de iniciar sesión, llamamos a `fn_completar_registro`
// (ver schema.sql) para obtener la fila de `jugadores` — vinculando un
// invitado preexistente si ya le habías dado de alta (por teléfono o
// email), o creando una fila nueva si es la primera vez que entra
// alguien con ese teléfono/email.
// =====================================================================

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Jugador } from '../types/database';

type EstadoAuth = 'cargando' | 'sin_sesion' | 'autenticado';

interface AuthContextValue {
  estado: EstadoAuth;
  session: Session | null;
  jugador: Jugador | null;
  errorJugador: string | null;
  iniciarSesionTelefono: (telefono: string, password: string) => Promise<{ error: string | null }>;
  entrarConContrasena: (email: string, password: string) => Promise<{ error: string | null }>;
  cerrarSesion: () => Promise<void>;
  actualizarJugador: (cambios: Partial<Jugador>) => Promise<{ error: string | null }>;
  refrescarJugador: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function mensajeCredencialesInvalidas(mensaje: string): string {
  if (mensaje.includes('Invalid login credentials')) {
    return 'Teléfono/email o contraseña incorrectos.';
  }
  return mensaje;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoAuth>('cargando');
  const [session, setSession] = useState<Session | null>(null);
  const [jugador, setJugador] = useState<Jugador | null>(null);
  const [errorJugador, setErrorJugador] = useState<string | null>(null);

  const cargarJugador = useCallback(async () => {
    setErrorJugador(null);
    const { data, error } = await supabase.rpc('fn_completar_registro');
    if (error) {
      setErrorJugador(
        'No se pudo cargar tu perfil de jugador. Recarga la página o avisa al administrador.'
      );
      setJugador(null);
      return;
    }
    setJugador(data as Jugador);
  }, []);

  useEffect(() => {
    let activo = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!activo) return;
      setSession(data.session);
      setEstado(data.session ? 'autenticado' : 'sin_sesion');
      if (data.session) void cargarJugador();
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_evento, nuevaSession) => {
      setSession(nuevaSession);
      setEstado(nuevaSession ? 'autenticado' : 'sin_sesion');
      if (nuevaSession) {
        void cargarJugador();
      } else {
        setJugador(null);
      }
    });

    return () => {
      activo = false;
      listener.subscription.unsubscribe();
    };
  }, [cargarJugador]);

  // Vía principal para el grupo: el admin crea la cuenta de antemano
  // con este mismo teléfono, así que aquí solo hace falta iniciar
  // sesión, nunca registrarse.
  const iniciarSesionTelefono = useCallback(async (telefono: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ phone: telefono, password });
    return { error: error ? mensajeCredencialesInvalidas(error.message) : null };
  }, []);

  // Vía de respaldo por email, para no dejar sin acceso a quien tenga
  // una cuenta de pruebas creada antes de pasar a teléfono+contraseña.
  const entrarConContrasena = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? mensajeCredencialesInvalidas(error.message) : null };
  }, []);

  const cerrarSesion = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const actualizarJugador = useCallback(
    async (cambios: Partial<Jugador>) => {
      if (!jugador) return { error: 'No hay un perfil cargado todavía.' };
      const { data, error } = await supabase
        .from('jugadores')
        .update(cambios)
        .eq('id', jugador.id)
        .select()
        .single();
      if (error) return { error: error.message };
      setJugador(data as Jugador);
      return { error: null };
    },
    [jugador]
  );

  const value: AuthContextValue = {
    estado,
    session,
    jugador,
    errorJugador,
    iniciarSesionTelefono,
    entrarConContrasena,
    cerrarSesion,
    actualizarJugador,
    refrescarJugador: cargarJugador,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuthContext debe usarse dentro de un <AuthProvider>.');
  }
  return ctx;
}
