// =====================================================================
// Login — entrada sin contraseña por código de un solo uso.
// =====================================================================

import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ScoreboardCodeInput } from '../components/ScoreboardCodeInput';

type Paso = 'email' | 'codigo' | 'contrasena';

export function Login() {
  const { estado, enviarCodigo, verificarCodigo, entrarConContrasena } = useAuth();
  const location = useLocation();
  const destino = (location.state as { desde?: string } | null)?.desde ?? '/partidos';

  const [paso, setPaso] = useState<Paso>('email');
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (estado === 'autenticado') {
    return <Navigate to={destino} replace />;
  }

  async function manejarEnvioEmail(evento: FormEvent) {
    evento.preventDefault();
    setError(null);
    setEnviando(true);
    const { error } = await enviarCodigo(email.trim());
    setEnviando(false);
    if (error) {
      setError(error);
      return;
    }
    setPaso('codigo');
  }

  async function manejarVerificacion(evento: FormEvent) {
    evento.preventDefault();
    if (codigo.length < 6) return;
    setError(null);
    setEnviando(true);
    const { error } = await verificarCodigo(email.trim(), codigo);
    setEnviando(false);
    if (error) {
      setError(error);
      setCodigo('');
    }
  }

  async function reenviarCodigo() {
    setError(null);
    setEnviando(true);
    const { error } = await enviarCodigo(email.trim());
    setEnviando(false);
    if (error) setError(error);
  }

  async function manejarEntrarConContrasena(evento: FormEvent) {
    evento.preventDefault();
    setError(null);
    setEnviando(true);
    const { error } = await entrarConContrasena(email.trim(), contrasena);
    setEnviando(false);
    if (error) setError(error);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <Cabecera />

        {paso === 'email' && (
          <form onSubmit={manejarEnvioEmail} className="mt-8 space-y-4">
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
            {error && <p className="font-body text-sm text-danger">{error}</p>}
            <button
              type="submit"
              disabled={enviando}
              className="w-full rounded-md bg-floodlight px-4 py-2 font-display text-sm font-semibold uppercase tracking-wide text-pitch-deep transition-colors hover:bg-floodlight-dim disabled:opacity-60"
            >
              {enviando ? 'Enviando…' : 'Enviar código'}
            </button>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setPaso('contrasena');
              }}
              className="block w-full text-center font-body text-xs text-muted hover:text-chalk"
            >
              ¿No te llega el correo? Entrar con contraseña
            </button>
          </form>
        )}

        {paso === 'contrasena' && (
          <form onSubmit={manejarEntrarConContrasena} className="mt-8 space-y-4">
            <div>
              <label htmlFor="email-contrasena" className="block font-body text-sm text-muted">
                Correo electrónico
              </label>
              <input
                id="email-contrasena"
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
              <label htmlFor="contrasena" className="block font-body text-sm text-muted">
                Contraseña
              </label>
              <input
                id="contrasena"
                type="password"
                required
                autoComplete="current-password"
                value={contrasena}
                onChange={(e) => setContrasena(e.target.value)}
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
                setPaso('email');
              }}
              className="block w-full text-center font-body text-xs text-muted hover:text-chalk"
            >
              Volver al código por email
            </button>
          </form>
        )}

        {paso === 'codigo' && (
          <form onSubmit={manejarVerificacion} className="mt-8 space-y-5">
            <p className="text-center font-body text-sm text-muted">
              Te hemos enviado un código a <span className="text-chalk">{email}</span>
            </p>
            <ScoreboardCodeInput valor={codigo} onChange={setCodigo} disabled={enviando} />
            {error && <p className="text-center font-body text-sm text-danger">{error}</p>}
            <button
              type="submit"
              disabled={enviando || codigo.length < 6}
              className="w-full rounded-md bg-floodlight px-4 py-2 font-display text-sm font-semibold uppercase tracking-wide text-pitch-deep transition-colors hover:bg-floodlight-dim disabled:opacity-60"
            >
              {enviando ? 'Comprobando…' : 'Verificar'}
            </button>
            <div className="flex justify-between font-body text-sm">
              <button
                type="button"
                onClick={() => setPaso('email')}
                className="text-muted hover:text-chalk"
              >
                Cambiar email
              </button>
              <button
                type="button"
                onClick={reenviarCodigo}
                disabled={enviando}
                className="text-confirmed hover:text-chalk"
              >
                Reenviar código
              </button>
            </div>
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
      <p className="mt-1 font-body text-sm text-muted">Entra con tu correo, sin contraseña</p>
    </div>
  );
}