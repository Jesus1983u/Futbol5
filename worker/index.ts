// =====================================================================
// Worker — además de servir los archivos estáticos (igual que antes),
// esto añade un endpoint de servidor: POST /api/crear-usuario.
// =====================================================================
// Es la única pieza de esta app que toca la "service role key" de
// Supabase, así que es la única pieza con permiso para crear cuentas
// de usuario directamente. Esa clave vive solo aquí, como secreto de
// Cloudflare (`wrangler secret put SUPABASE_SERVICE_ROLE_KEY`) — nunca
// en el código, nunca en wrangler.toml, nunca llega al navegador.
//
// Flujo de la petición:
//   1. Comprobar que quien llama tiene una sesión válida de Supabase
//      (su token de acceso, tal cual lo usa el navegador).
//   2. Comprobar que esa persona es administrador (tabla `jugadores`).
//   3. Validar los datos del formulario.
//   4. Crear el usuario en Supabase Auth (teléfono + contraseña,
//      auto-confirmado: no se manda ningún SMS).
//   5. Crear o actualizar su fila en `jugadores` con los datos ya
//      elegidos por el admin (nombre, posición, rol) en el mismo paso,
//      en vez de esperar a que esa persona inicie sesión.
//
// Para cualquier ruta que no sea /api/*, este Worker no se ejecuta en
// absoluto (ver `run_worker_first` en wrangler.toml) — los archivos
// estáticos se sirven exactamente igual que antes de esta pieza.
// =====================================================================

import { createClient } from '@supabase/supabase-js';

interface Env {
  ASSETS: Fetcher;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

interface CuerpoCrearUsuario {
  nombre?: string;
  telefono?: string;
  password?: string;
  posicion?: string;
  rol?: string;
}

function jsonResponse(cuerpo: unknown, estado: number): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Mismo criterio que en el login del frontend: si no empieza por
 *  "+", se asume móvil español y se le pone el prefijo. Se repite
 *  aquí porque el servidor nunca debe fiarse solo de la validación
 *  del cliente. */
function normalizarTelefono(valor: string): string {
  const limpio = valor.replace(/[\s-]/g, '');
  return limpio.startsWith('+') ? limpio : `+34${limpio}`;
}

async function manejarCrearUsuario(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Método no permitido.' }, 405);
  }

  const cabeceraAuth = request.headers.get('Authorization') ?? '';
  const token = cabeceraAuth.startsWith('Bearer ') ? cabeceraAuth.slice(7) : '';
  if (!token) {
    return jsonResponse({ error: 'No autenticado.' }, 401);
  }

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1) ¿Quién llama? Se valida el token tal cual lo manda el navegador.
  const { data: datosUsuario, error: errorUsuario } = await supabase.auth.getUser(token);
  if (errorUsuario || !datosUsuario.user) {
    return jsonResponse({ error: 'Sesión no válida. Vuelve a iniciar sesión.' }, 401);
  }

  // 2) ¿Es administrador? Se comprueba en la tabla jugadores, no en
  // nada que venga del cliente.
  const { data: jugadorQueLlama, error: errorJugador } = await supabase
    .from('jugadores')
    .select('rol, activo')
    .eq('auth_user_id', datosUsuario.user.id)
    .maybeSingle();

  if (errorJugador || !jugadorQueLlama || jugadorQueLlama.rol !== 'admin' || !jugadorQueLlama.activo) {
    return jsonResponse({ error: 'Solo el administrador puede crear usuarios.' }, 403);
  }

  // 3) Validar los datos del formulario.
  let cuerpo: CuerpoCrearUsuario;
  try {
    cuerpo = await request.json();
  } catch {
    return jsonResponse({ error: 'Datos de la petición no válidos.' }, 400);
  }

  const nombre = (cuerpo.nombre ?? '').trim();
  const password = cuerpo.password ?? '';
  const posicion = cuerpo.posicion;
  const rol = cuerpo.rol;

  if (!nombre) return jsonResponse({ error: 'Falta el nombre.' }, 400);
  if (!cuerpo.telefono?.trim()) return jsonResponse({ error: 'Falta el teléfono.' }, 400);
  if (password.length < 6) {
    return jsonResponse({ error: 'La contraseña tiene que tener al menos 6 caracteres.' }, 400);
  }
  if (posicion !== 'atacante' && posicion !== 'defensor') {
    return jsonResponse({ error: 'Posición no válida.' }, 400);
  }
  if (rol !== 'jugador' && rol !== 'admin') {
    return jsonResponse({ error: 'Rol no válido.' }, 400);
  }

  const telefono = normalizarTelefono(cuerpo.telefono.trim());

  // 4) Crear el usuario en Supabase Auth. phone_confirm:true = no se
  // manda ningún SMS, queda confirmado directamente (igual que
  // marcar "Auto Confirm User" a mano en el dashboard).
  const { data: nuevoAuthUser, error: errorCreacion } = await supabase.auth.admin.createUser({
    phone: telefono,
    password,
    phone_confirm: true,
  });

  if (errorCreacion || !nuevoAuthUser.user) {
    const mensaje = errorCreacion?.message ?? 'No se pudo crear el usuario.';
    const yaExiste = mensaje.toLowerCase().includes('already') || mensaje.toLowerCase().includes('registered');
    return jsonResponse(
      { error: yaExiste ? 'Ya existe una cuenta con ese teléfono.' : mensaje },
      400
    );
  }

  // 5) Vincular con un invitado preexistente por teléfono (mismo
  // criterio que fn_completar_registro), o crear la fila nueva. Se
  // hace aquí mismo, con los datos que el admin ya eligió, en vez de
  // esperar a que esa persona inicie sesión por primera vez.
  const { data: invitadoPrevio } = await supabase
    .from('jugadores')
    .select('id')
    .eq('telefono', telefono)
    .eq('tipo', 'invitado')
    .is('auth_user_id', null)
    .maybeSingle();

  const datosJugador = {
    auth_user_id: nuevoAuthUser.user.id,
    tipo: 'registrado',
    rol,
    nombre,
    telefono,
    posicion_preferida: posicion,
    posicion_confirmada: true,
  };

  const { error: errorJugadorFinal } = invitadoPrevio
    ? await supabase.from('jugadores').update(datosJugador).eq('id', invitadoPrevio.id)
    : await supabase.from('jugadores').insert(datosJugador);

  if (errorJugadorFinal) {
    // El usuario de Auth ya se creó; esto solo afecta a su fila de
    // jugador, que igualmente se generaría sola en su primer login
    // (fn_completar_registro) si este paso fallara por lo que sea.
    return jsonResponse(
      {
        error: `Usuario creado, pero hubo un problema guardando sus datos de jugador: ${errorJugadorFinal.message}. Se completará solo en su primer inicio de sesión.`,
      },
      207
    );
  }

  return jsonResponse({ ok: true, telefono }, 200);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/crear-usuario') {
      return manejarCrearUsuario(request, env);
    }

    // Cualquier otra ruta bajo /api/* que no exista todavía.
    if (url.pathname.startsWith('/api/')) {
      return jsonResponse({ error: 'No encontrado.' }, 404);
    }

    return env.ASSETS.fetch(request);
  },
};
