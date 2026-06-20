// =====================================================================
// AdminPanel — gestión de jugadores y revisión/aplicación del ranking
// inicial sugerido por la votación.
// =====================================================================

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  actualizarJugadorAdmin,
  aplicarRatingInicial,
  calcularRatingsIniciales,
  contarVotantes,
  crearUsuarioCompleto,
  listarTodosLosJugadores,
  obtenerEstadoVotacion,
  type EstadoVotacion,
  type RatingSugerido,
} from '../lib/admin';
import { useAuth } from '../hooks/useAuth';
import type { Jugador, Posicion, RolUsuario } from '../types/database';
import { Avatar } from '../components/Avatar';
import { IconEngranaje, IconMas } from '../components/icons';

type Pestaña = 'jugadores' | 'ranking';

export function AdminPanel() {
  const [pestaña, setPestaña] = useState<Pestaña>('jugadores');

  return (
    <div className="mx-auto min-h-screen max-w-sm px-6 py-10">
      <h1 className="flex items-center gap-2 font-display text-2xl uppercase tracking-wide text-chalk">
        <IconEngranaje className="h-6 w-6 text-floodlight" />
        Panel de administrador
      </h1>

      <div className="mt-5 flex gap-1 rounded-md bg-pitch-mid p-1">
        <BotonPestaña activa={pestaña === 'jugadores'} onClick={() => setPestaña('jugadores')}>
          Jugadores
        </BotonPestaña>
        <BotonPestaña activa={pestaña === 'ranking'} onClick={() => setPestaña('ranking')}>
          Ranking inicial
        </BotonPestaña>
      </div>

      {pestaña === 'jugadores' && <SeccionJugadores />}
      {pestaña === 'ranking' && <SeccionRanking />}
    </div>
  );
}

function BotonPestaña({
  activa,
  onClick,
  children,
}: {
  activa: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-md py-1.5 font-body text-sm transition-colors ${
        activa ? 'bg-pitch-deep text-floodlight' : 'text-muted hover:text-chalk'
      }`}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------
// Jugadores
// ---------------------------------------------------------------------

function SeccionJugadores() {
  const [jugadores, setJugadores] = useState<Jugador[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [creandoUsuario, setCreandoUsuario] = useState(false);

  function cargar() {
    listarTodosLosJugadores()
      .then(setJugadores)
      .catch(() => setError('No se pudo cargar la lista de jugadores.'));
  }

  useEffect(cargar, []);

  return (
    <div className="mt-4 space-y-2">
      {creandoUsuario ? (
        <FormularioCrearUsuario
          onCancelar={() => setCreandoUsuario(false)}
          onCreado={() => {
            setCreandoUsuario(false);
            cargar();
          }}
        />
      ) : (
        <button
          onClick={() => setCreandoUsuario(true)}
          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-floodlight py-2 font-body text-sm font-semibold text-floodlight hover:bg-floodlight/10"
        >
          <IconMas className="h-4 w-4" />
          Crear usuario nuevo
        </button>
      )}

      {error && <p className="font-body text-sm text-danger">{error}</p>}
      {!error && jugadores === null && <p className="font-body text-sm text-muted">Cargando…</p>}

      {jugadores?.map((j) =>
        editandoId === j.id ? (
          <FormularioJugador
            key={j.id}
            jugador={j}
            onCancelar={() => setEditandoId(null)}
            onGuardado={() => {
              setEditandoId(null);
              cargar();
            }}
          />
        ) : (
          <FilaJugador key={j.id} jugador={j} onEditar={() => setEditandoId(j.id)} />
        )
      )}
    </div>
  );
}

function FormularioCrearUsuario({
  onCancelar,
  onCreado,
}: {
  onCancelar: () => void;
  onCreado: () => void;
}) {
  const { session } = useAuth();
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [password, setPassword] = useState('');
  const [posicion, setPosicion] = useState<Posicion>('defensor');
  const [rol, setRol] = useState<RolUsuario>('jugador');
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  async function crear() {
    setError(null);
    setExito(null);
    if (!session) {
      setError('No hay sesión activa.');
      return;
    }
    setCreando(true);
    const { error } = await crearUsuarioCompleto(
      { nombre: nombre.trim(), telefono: telefono.trim(), password, posicion, rol },
      session.access_token
    );
    setCreando(false);
    if (error) {
      setError(error);
      return;
    }
    setExito(`${nombre.trim()} ya puede entrar con ese teléfono y contraseña.`);
    setNombre('');
    setTelefono('');
    setPassword('');
    setPosicion('defensor');
    setRol('jugador');
    onCreado();
  }

  return (
    <div className="space-y-3 rounded-md border border-floodlight bg-pitch-mid p-3">
      <p className="font-body text-sm font-semibold text-chalk">Crear usuario nuevo</p>

      <input
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        placeholder="Nombre"
        className="w-full rounded-md border border-pitch-line bg-pitch-deep px-2 py-1.5 font-body text-sm text-chalk placeholder:text-muted"
      />
      <input
        type="tel"
        value={telefono}
        onChange={(e) => setTelefono(e.target.value)}
        placeholder="Teléfono (ej. 612345678 o +34612345678)"
        className="w-full rounded-md border border-pitch-line bg-pitch-deep px-2 py-1.5 font-body text-sm text-chalk placeholder:text-muted"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Contraseña (mínimo 6 caracteres)"
        className="w-full rounded-md border border-pitch-line bg-pitch-deep px-2 py-1.5 font-body text-sm text-chalk placeholder:text-muted"
      />

      <div className="grid grid-cols-2 gap-2">
        <select
          value={posicion}
          onChange={(e) => setPosicion(e.target.value as Posicion)}
          className="rounded-md border border-pitch-line bg-pitch-deep px-2 py-1.5 font-body text-sm capitalize text-chalk"
        >
          <option value="atacante">Atacante</option>
          <option value="defensor">Defensor</option>
          <option value="mixto">Mixto</option>
        </select>
        <select
          value={rol}
          onChange={(e) => setRol(e.target.value as RolUsuario)}
          className="rounded-md border border-pitch-line bg-pitch-deep px-2 py-1.5 font-body text-sm capitalize text-chalk"
        >
          <option value="jugador">Usuario normal</option>
          <option value="admin">Administrador</option>
        </select>
      </div>

      {error && <p className="font-body text-sm text-danger">{error}</p>}
      {exito && <p className="font-body text-sm text-confirmed">{exito}</p>}

      <div className="flex gap-2">
        <button
          onClick={() => void crear()}
          disabled={creando || !nombre.trim() || !telefono.trim() || password.length < 6}
          className="flex-1 rounded-md bg-floodlight px-3 py-1.5 font-display text-sm font-semibold uppercase tracking-wide text-pitch-deep disabled:opacity-60"
        >
          {creando ? 'Creando…' : 'Crear'}
        </button>
        <button
          onClick={onCancelar}
          className="rounded-md border border-pitch-line px-3 py-1.5 font-body text-sm text-muted hover:text-chalk"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}

function FilaJugador({ jugador, onEditar }: { jugador: Jugador; onEditar: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-pitch-line bg-pitch-mid p-3">
      <Avatar nombre={jugador.nombre} apellidos={jugador.apellidos} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-body text-sm text-chalk">
          {jugador.nombre} {jugador.apellidos}
          {!jugador.activo && <span className="ml-1.5 text-xs text-danger">(de baja)</span>}
        </p>
        <p className="font-body text-xs capitalize text-muted">
          {jugador.tipo} · {jugador.rol}
        </p>
      </div>
      <button
        onClick={onEditar}
        className="font-body text-xs font-semibold text-floodlight hover:text-floodlight-dim"
      >
        Editar
      </button>
    </div>
  );
}

function FormularioJugador({
  jugador,
  onCancelar,
  onGuardado,
}: {
  jugador: Jugador;
  onCancelar: () => void;
  onGuardado: () => void;
}) {
  const [nombre, setNombre] = useState(jugador.nombre);
  const [apellidos, setApellidos] = useState(jugador.apellidos ?? '');
  const [telefono, setTelefono] = useState(jugador.telefono ?? '');
  const [posicion, setPosicion] = useState<Posicion>(jugador.posicion_preferida);
  const [rol, setRol] = useState<RolUsuario>(jugador.rol);
  const [tipo, setTipo] = useState(jugador.tipo);
  const [activo, setActivo] = useState(jugador.activo);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    setError(null);
    setGuardando(true);
    const { error } = await actualizarJugadorAdmin(jugador.id, {
      nombre: nombre.trim(),
      apellidos: apellidos.trim() || null,
      telefono: telefono.trim() || null,
      posicion_preferida: posicion,
      rol,
      tipo,
      activo,
    });
    setGuardando(false);
    if (error) {
      setError(`No se pudo guardar: ${error}`);
      return;
    }
    onGuardado();
  }

  return (
    <div className="space-y-3 rounded-md border border-floodlight bg-pitch-mid p-3">
      <div className="grid grid-cols-2 gap-2">
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombre"
          className="rounded-md border border-pitch-line bg-pitch-deep px-2 py-1.5 font-body text-sm text-chalk"
        />
        <input
          value={apellidos}
          onChange={(e) => setApellidos(e.target.value)}
          placeholder="Apellidos"
          className="rounded-md border border-pitch-line bg-pitch-deep px-2 py-1.5 font-body text-sm text-chalk"
        />
      </div>

      <input
        type="tel"
        value={telefono}
        onChange={(e) => setTelefono(e.target.value)}
        placeholder="Teléfono (con prefijo, ej. +34612345678)"
        className="w-full rounded-md border border-pitch-line bg-pitch-deep px-2 py-1.5 font-body text-sm text-chalk"
      />

      <div className="grid grid-cols-2 gap-2">
        <select
          value={posicion}
          onChange={(e) => setPosicion(e.target.value as Posicion)}
          className="rounded-md border border-pitch-line bg-pitch-deep px-2 py-1.5 font-body text-sm capitalize text-chalk"
        >
          <option value="atacante">Atacante</option>
          <option value="defensor">Defensor</option>
          <option value="mixto">Mixto</option>
        </select>
        <select
          value={rol}
          onChange={(e) => setRol(e.target.value as RolUsuario)}
          className="rounded-md border border-pitch-line bg-pitch-deep px-2 py-1.5 font-body text-sm capitalize text-chalk"
        >
          <option value="jugador">Jugador</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      <div>
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as Jugador['tipo'])}
          className="w-full rounded-md border border-pitch-line bg-pitch-deep px-2 py-1.5 font-body text-sm capitalize text-chalk"
        >
          <option value="invitado">Invitado</option>
          <option value="registrado">Jugador habitual (registrado)</option>
        </select>
        <p className="mt-1 font-body text-xs text-muted">
          Pasar a "Jugador habitual" no le da acceso por sí solo a entrar en la app — eso pasa
          automáticamente en cuanto esa persona inicie sesión con el email que tenga puesto aquí.
          Este interruptor es solo para marcarlo como habitual desde ya, aunque todavía no haya
          entrado nunca.
        </p>
      </div>

      <label className="flex items-center gap-2 font-body text-sm text-chalk">
        <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
        Activo (aparece como opción para añadir a partidos nuevos)
      </label>

      {error && <p className="font-body text-sm text-danger">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={() => void guardar()}
          disabled={guardando}
          className="flex-1 rounded-md bg-floodlight px-3 py-1.5 font-display text-sm font-semibold uppercase tracking-wide text-pitch-deep disabled:opacity-60"
        >
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
        <button
          onClick={onCancelar}
          className="rounded-md border border-pitch-line px-3 py-1.5 font-body text-sm text-muted hover:text-chalk"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Ranking inicial
// ---------------------------------------------------------------------

function SeccionRanking() {
  const [sugerencias, setSugerencias] = useState<RatingSugerido[] | null>(null);
  const [votantes, setVotantes] = useState<number | null>(null);
  const [estadoVotacion, setEstadoVotacion] = useState<EstadoVotacion | null>(null);
  const [mostrarDetalle, setMostrarDetalle] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [aplicandoId, setAplicandoId] = useState<string | null>(null);
  const [ratings, setRatings] = useState<Record<string, string>>({});

  useEffect(() => {
    contarVotantes().then(setVotantes).catch(() => {});
    obtenerEstadoVotacion().then(setEstadoVotacion).catch(() => {});
  }, []);

  async function calcular() {
    setError(null);
    setCalculando(true);
    try {
      const datos = await calcularRatingsIniciales();
      setSugerencias(datos);
      setRatings(Object.fromEntries(datos.map((d) => [d.jugador_id, String(d.rating_sugerido)])));
    } catch {
      setError('No se pudo calcular el ranking. ¿Hay algún voto registrado todavía?');
    } finally {
      setCalculando(false);
    }
  }

  async function aplicar(jugadorId: string) {
    const valor = Number(ratings[jugadorId]);
    if (Number.isNaN(valor)) return;
    setAplicandoId(jugadorId);
    const { error } = await aplicarRatingInicial(jugadorId, valor);
    setAplicandoId(null);
    if (error) setError('No se pudo aplicar ese rating.');
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="rounded-md border border-pitch-line bg-pitch-mid p-3">
        <p className="font-body text-sm text-muted">
          {votantes ?? '…'} persona{votantes === 1 ? '' : 's'} ha
          {votantes === 1 ? '' : 'n'} votado hasta ahora.
        </p>

        {estadoVotacion && (
          <>
            <button
              onClick={() => setMostrarDetalle((v) => !v)}
              className="mt-1 font-body text-xs font-semibold uppercase tracking-wide text-floodlight hover:text-floodlight-dim"
            >
              {mostrarDetalle ? 'Ocultar quién falta' : '¿Quién falta por votar?'}
            </button>

            {mostrarDetalle && (
              <div className="mt-3 space-y-3">
                {estadoVotacion.noHaVotado.length > 0 ? (
                  <div>
                    <p className="font-body text-xs uppercase tracking-wide text-danger">
                      Aún no han votado ({estadoVotacion.noHaVotado.length})
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {estadoVotacion.noHaVotado.map((j) => (
                        <li key={j.id} className="font-body text-sm text-chalk">
                          {j.nombre}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="font-body text-sm text-confirmed">
                    Todo el mundo ha votado ya.
                  </p>
                )}

                {estadoVotacion.haVotado.length > 0 && (
                  <div>
                    <p className="font-body text-xs uppercase tracking-wide text-confirmed">
                      Ya han votado ({estadoVotacion.haVotado.length})
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {estadoVotacion.haVotado.map((j) => (
                        <li key={j.id} className="font-body text-sm text-muted">
                          {j.nombre}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        <Link
          to="/votacion"
          className="mt-3 inline-block font-body text-sm text-floodlight hover:text-floodlight-dim"
        >
          Ir a votar tu propio ranking →
        </Link>
      </div>

      <button
        onClick={() => void calcular()}
        disabled={calculando}
        className="w-full rounded-md bg-floodlight px-4 py-2 font-display text-sm font-semibold uppercase tracking-wide text-pitch-deep hover:bg-floodlight-dim disabled:opacity-60"
      >
        {calculando ? 'Calculando…' : 'Calcular ranking sugerido'}
      </button>

      {error && <p className="font-body text-sm text-danger">{error}</p>}

      {sugerencias && sugerencias.length === 0 && (
        <p className="font-body text-sm text-muted">Todavía no hay votos registrados.</p>
      )}

      {sugerencias && sugerencias.length > 0 && (
        <div className="space-y-2">
          {[...sugerencias]
            .sort((a, b) => b.rating_sugerido - a.rating_sugerido)
            .map((s) => (
              <div
                key={s.jugador_id}
                className="flex items-center gap-2 rounded-md border border-pitch-line bg-pitch-mid p-2"
              >
                <span className="flex-1 truncate font-body text-sm text-chalk">{s.nombre}</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={ratings[s.jugador_id] ?? ''}
                  onChange={(e) =>
                    setRatings((prev) => ({ ...prev, [s.jugador_id]: e.target.value }))
                  }
                  className="w-20 rounded-md border border-pitch-line bg-pitch-deep px-2 py-1 font-body text-sm tabular-nums text-chalk"
                />
                <button
                  onClick={() => void aplicar(s.jugador_id)}
                  disabled={aplicandoId === s.jugador_id}
                  className="font-body text-xs font-semibold text-confirmed hover:underline disabled:opacity-60"
                >
                  Aplicar
                </button>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
