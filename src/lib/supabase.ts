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
    // En el plan gratuito de Supabase no se pueden personalizar las
    // plantillas de email (asunto/cuerpo) sin configurar un SMTP propio
    // — por eso el email de login llega con el enlace de fábrica en vez
    // del código de 6 dígitos que diseñamos. Mientras no haya un SMTP
    // configurado (ver README), dejamos `detectSessionInUrl` en true
    // para que ese enlace de fábrica funcione igual: al pulsarlo, vuelve
    // a esta app con la sesión ya iniciada. El paso de introducir el
    // código (ScoreboardCodeInput) sigue ahí y funcionará tal cual en
    // cuanto se configure el SMTP y se edite la plantilla.
    detectSessionInUrl: true,
  },
});