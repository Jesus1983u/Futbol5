// =====================================================================
// Login — teléfono + contraseña. No hay alta por cuenta propia: el
// administrador crea cada cuenta desde la propia app (Admin →
// Jugadores → "Crear usuario nuevo"), así que esta pantalla solo
// inicia sesión, nunca registra a nadie nuevo.
//
// Por debajo, AuthContext convierte el teléfono escrito aquí al mismo
// email falso que se generó al crear la cuenta — la persona nunca lo
// ve ni necesita saberlo (ver src/lib/telefono.ts).
// =====================================================================

import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

type Paso = 'telefono' | 'email';

export function Login() {
  const { estado, iniciarSesionTelefono, entrarConContrasena } = useAuth();
  const location = useLocation();
  const destino = (location.state as { desde?: string } | null)?.desde ?? '/partidos';

  const [paso, setPaso] = useState<Paso>('telefono');
  const [telefono, setTelefono] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [passwordEmail, setPasswordEmail] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (estado === 'autenticado') {
    return <Navigate to={destino} replace />;
  }

  async function manejarEntradaTelefono(evento: FormEvent) {
    evento.preventDefault();
    setError(null);
    setEnviando(true);
    const { error } = await iniciarSesionTelefono(telefono.trim(), password);
    setEnviando(false);
    if (error) setError(error);
  }

  async function manejarEntradaEmail(evento: FormEvent) {
    evento.preventDefault();
    setError(null);
    setEnviando(true);
    const { error } = await entrarConContrasena(email.trim(), passwordEmail);
    setEnviando(false);
    if (error) setError(error);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <Cabecera />

        {paso === 'telefono' && (
          <form onSubmit={manejarEntradaTelefono} className="mt-8 space-y-4">
            <div>
              <label htmlFor="telefono" className="block font-body text-sm text-muted">
                Teléfono
              </label>
              <input
                id="telefono"
                type="tel"
                required
                autoComplete="tel"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="612 345 678"
                className="mt-1 w-full rounded-md border border-pitch-line bg-pitch-mid px-3 py-2 font-body text-chalk placeholder:text-muted focus:border-floodlight"
              />
            </div>
            <div>
              <label htmlFor="password-telefono" className="block font-body text-sm text-muted">
                Contraseña
              </label>
              <input
                id="password-telefono"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-md border border-pitch-line bg-pitch-mid px-3 py-2 font-body text-chalk focus:border-floodlight"
              />
            </div>
            {error && <p className="font-body text-sm text-danger">{error}</p>}
            <button
              type="submit"
              disabled={enviando}
              className="w-full rounded-md bg-floodlight px-4 py-2 font-display text-sm font-semibold uppercase tracking-wide text-pitch-deep transition-colors hover:bg-floodlight-dim disabled:opacity-60"
            >
              {enviando ? 'Entrando…' : 'Entrar'}
            </button>
            <p className="text-center font-body text-xs text-muted">
              ¿No tienes cuenta todavía? Pídesela al administrador del grupo.
            </p>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setPaso('email');
              }}
              className="block w-full text-center font-body text-xs text-muted hover:text-chalk"
            >
              Entrar con email
            </button>
          </form>
        )}

        {paso === 'email' && (
          <form onSubmit={manejarEntradaEmail} className="mt-8 space-y-4">
            <div>
              <label htmlFor="email" className="block font-body text-sm text-muted">
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tunombre@correo.com"
                className="mt-1 w-full rounded-md border border-pitch-line bg-pitch-mid px-3 py-2 font-body text-chalk placeholder:text-muted focus:border-floodlight"
              />
            </div>
            <div>
              <label htmlFor="password-email" className="block font-body text-sm text-muted">
                Contraseña
              </label>
              <input
                id="password-email"
                type="password"
                required
                autoComplete="current-password"
                value={passwordEmail}
                onChange={(e) => setPasswordEmail(e.target.value)}
                className="mt-1 w-full rounded-md border border-pitch-line bg-pitch-mid px-3 py-2 font-body text-chalk focus:border-floodlight"
              />
            </div>
            {error && <p className="font-body text-sm text-danger">{error}</p>}
            <button
              type="submit"
              disabled={enviando}
              className="w-full rounded-md bg-floodlight px-4 py-2 font-display text-sm font-semibold uppercase tracking-wide text-pitch-deep transition-colors hover:bg-floodlight-dim disabled:opacity-60"
            >
              {enviando ? 'Entrando…' : 'Entrar'}
            </button>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setPaso('telefono');
              }}
              className="block w-full text-center font-body text-xs text-muted hover:text-chalk"
            >
              Volver a teléfono
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

/** Cabecera con un motivo minimalista de línea de medio campo: una
 *  línea horizontal con el círculo central, dibujada en trazo fino
 *  sobre el verde de fondo. Es el único guiño ilustrativo de la
 *  pantalla; todo lo demás se mantiene sobrio a propósito. */
function Cabecera() {
  return (
    <div className="text-center">
      <svg
        viewBox="0 0 200 40"
        className="mx-auto mb-4 h-8 w-full max-w-[220px] text-pitch-line"
        aria-hidden="true"
      >
        <line x1="0" y1="20" x2="200" y2="20" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="100" cy="20" r="14" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="100" cy="20" r="2" fill="currentColor" />
      </svg>
      <h1 className="font-display text-2xl font-semibold uppercase tracking-wide text-chalk">
        Fútbol 5 Utrera
      </h1>
      <p className="mt-1 font-body text-sm text-muted">Entra con tu teléfono y contraseña</p>
    </div>
  );
}
