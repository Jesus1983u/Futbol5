// =====================================================================
// AuthContext — sesión de Supabase Auth + el registro `jugadores`
// vinculado a esa sesión.
// =====================================================================
// El login es sin contraseña: la persona escribe su email, recibe un
// código de 6 dígitos, lo introduce y queda autenticada. Justo después
// de confirmar el código, llamamos a la función `fn_completar_registro`
// (ver schema.sql) para obtener su fila de `jugadores` — vinculando un
// invitado preexistente si el admin ya le había dado de alta, o creando
// una fila nueva si es la primera vez que entra alguien con ese email.
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
  enviarCodigo: (email: string) => Promise<{ error: string | null }>;
  verificarCodigo: (email: string, codigo: string) => Promise<{ error: string | null }>;
  entrarConContrasena: (email: string, password: string) => Promise<{ error: string | null }>;
  cerrarSesion: () => Promise<void>;
  actualizarJugador: (cambios: Partial<Jugador>) => Promise<{ error: string | null }>;
  refrescarJugador: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function mapearErrorSupabase(mensaje: string): string {
  if (mensaje.includes('Invalid login credentials') || mensaje.includes('Token has expired')) {
    return 'El código no es válido o ha caducado. Pide uno nuevo.';
  }
  if (mensaje.toLowerCase().includes('rate limit')) {
    return 'Has agotado el límite de correos del plan gratuito de Supabase (2 por hora en total para todo el proyecto). Espera una hora y vuelve a intentarlo, o pídele al administrador que configure un SMTP propio para no tener este límite.';
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

  const enviarCodigo = useCallback(async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    return { error: error ? mapearErrorSupabase(error.message) : null };
  }, []);

  const verificarCodigo = useCallback(async (email: string, codigo: string) => {
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: codigo,
      type: 'email',
    });
    return { error: error ? mapearErrorSupabase(error.message) : null };
  }, []);

  // Vía de respaldo que no pasa por email en absoluto: para usarla, alguien
  // (normalmente el propio admin, antes de que exista ningún otro admin)
  // tiene que crear el usuario a mano en Supabase → Authentication → Users
  // → "Add user", con "Auto Confirm User" marcado y una contraseña. No es
  // el flujo pensado para el grupo — ese sigue siendo el código por
  // email — pero permite entrar de inmediato si el correo está bloqueado
  // por el límite de envíos o aún no hay SMTP configurado.
  const entrarConContrasena = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) return { error: null };
    if (error.message.includes('Invalid login credentials')) {
      return { error: 'Email o contraseña incorrectos.' };
    }
    return { error: error.message };
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
    enviarCodigo,
    verificarCodigo,
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