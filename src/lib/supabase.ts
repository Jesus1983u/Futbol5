// =====================================================================
// Cliente de Supabase
// =====================================================================
// Usamos el cliente oficial @supabase/supabase-js de forma directa.
//
// NOTA para Jesús: en TrainOS tuviste un bloqueo del cliente de Supabase
// al volver de pestañas externas (Strava, ChatGPT) que se resolvió
// cambiando a llamadas `fetch` directas contra la REST API. Aquí no hay
// ningún flujo que abra pestañas externas en el sentido de esa app, pero
// SÍ hay un salto fuera de la pestaña al hacer clic en el enlace del
// email de login — si alguna vez notas algo parecido (la app se queda
// "colgada" al volver), el arreglo es el mismo: sustituir las llamadas
// de este archivo por `fetch` directo a `${url}/rest/v1/...` y
// `${url}/auth/v1/...` con la `anon key` en la cabecera `apikey`.
// =====================================================================

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. Copia .env.example a .env y rellena los valores de tu proyecto de Supabase.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // El login es por teléfono/email + contraseña (ver AuthContext.tsx),
    // no por enlace de email, así que esto no debería entrar en juego en
    // el uso normal. Se deja en true por si alguna vez se reactiva algún
    // flujo basado en enlaces (recuperar contraseña, por ejemplo).
    detectSessionInUrl: true,
  },
});
