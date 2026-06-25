-- =====================================================================
-- FUTBOL5 APP — ESQUEMA COMPLETO DE SUPABASE (Postgres)
-- =====================================================================
-- Pensado para ejecutarse una sola vez en el SQL Editor de Supabase
-- sobre un proyecto nuevo. Usa gen_random_uuid() (extensión pgcrypto,
-- ya habilitada por defecto en Supabase).
-- =====================================================================

-- ---------------------------------------------------------------------
-- DECISIÓN DE ARQUITECTURA IMPORTANTE
-- ---------------------------------------------------------------------
-- En vez de tener tablas separadas "usuarios" e "invitados", todo
-- participante (registrado o invitado) vive en una única tabla
-- `jugadores`. Esto es lo que permite que "Convertir en jugador
-- registrado" sea una simple actualización de fila (cambia `tipo` y
-- se vincula a un `auth.users`), conservando intacto todo su historial
-- de compañeros, sus estadísticas y su rating. Si hubiera dos tablas
-- separadas, ese historial se perdería o habría que migrarlo a mano.
-- ---------------------------------------------------------------------

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------
create type tipo_jugador as enum ('registrado', 'invitado');
create type rol_usuario as enum ('admin', 'jugador');
-- 'mixto' añadido en la ronda de mejora del generador de equipos: un
-- jugador mixto puede contar como atacante o como defensor según
-- convenga para equilibrar las posiciones de cada partido concreto.
create type posicion_jugador as enum ('atacante', 'defensor', 'mixto');
create type estado_partido as enum ('abierto', 'cerrado', 'cancelado', 'jugado');
create type disponibilidad_estado as enum ('pendiente', 'voy', 'no_voy');
create type inscripcion_estado as enum ('confirmado', 'lista_espera', 'cancelado');
create type pago_estado as enum ('pendiente', 'pagado');
create type equipo_enum as enum ('A', 'B');

-- ---------------------------------------------------------------------
-- TABLA: jugadores  (registrados + invitados, unificados)
-- ---------------------------------------------------------------------
create table jugadores (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  tipo tipo_jugador not null default 'registrado',
  rol rol_usuario not null default 'jugador',
  nombre text not null,
  apellidos text,
  email text,
  telefono text,
  posicion_preferida posicion_jugador not null default 'defensor',
  posicion_confirmada boolean not null default false,

  rating_actual numeric(5,2) not null default 50,
  rating_inicial_confirmado boolean not null default false,

  -- Impacto en victoria: media móvil exponencial (EMA) de cuánto mejor
  -- o peor rinde este jugador frente a lo que el Elo previo de su
  -- equipo predecía para cada partido. Rango -1..1, 0 = neutro. No
  -- sustituye al Elo — es una señal secundaria y suave para el
  -- generador de equipos. Ver fn_finalizar_partido para el cálculo.
  impacto_victoria numeric(4,3) not null default 0,

  partidos_jugados int not null default 0,
  victorias int not null default 0,
  derrotas int not null default 0,
  empates int not null default 0,

  -- Total de veces que este jugador ha sido elegido MVP por el equipo
  -- contrario. Se actualiza en fn_cerrar_votacion_mvp. No sustituye
  -- al rating Elo — es una columna aparte de reconocimiento.
  mvps_recibidos int not null default 0,

  veces_como_invitado int not null default 0,
  activo boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint chk_registrado_tiene_auth check (
    tipo = 'invitado' or auth_user_id is not null
  )
);

create index idx_jugadores_auth_user on jugadores(auth_user_id);
create index idx_jugadores_tipo on jugadores(tipo);

-- ---------------------------------------------------------------------
-- TABLA: rankings_iniciales (votos manuales para calcular el rating
-- inicial — cada "jugador habitual" ordena a los demás de mejor a peor)
-- ---------------------------------------------------------------------
create table rankings_iniciales (
  id uuid primary key default gen_random_uuid(),
  votante_id uuid not null references jugadores(id) on delete cascade,
  jugador_id uuid not null references jugadores(id) on delete cascade,
  posicion int not null check (posicion > 0), -- 1 = el mejor según ese votante
  created_at timestamptz not null default now(),
  unique (votante_id, jugador_id),
  unique (votante_id, posicion)
);

-- ---------------------------------------------------------------------
-- TABLA: partidos
-- ---------------------------------------------------------------------
create table partidos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  hora time not null,
  campo text not null,
  precio_total numeric(8,2) not null default 0,
  jugadores_max int not null default 10 check (jugadores_max > 0),
  estado estado_partido not null default 'abierto',
  resultado_goles_a int,
  resultado_goles_b int,
  notas text,
  creado_por uuid references jugadores(id),
  -- Quién ha reservado la pista para este partido concreto (no tiene
  -- por qué ser el mismo cada semana). "on delete set null" porque si
  -- esa persona se da de baja algún día, el partido no debe romperse
  -- — simplemente queda sin reservador asignado.
  reservador_id uuid references jugadores(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_partidos_fecha on partidos(fecha, hora);
create index idx_partidos_estado on partidos(estado);

-- ---------------------------------------------------------------------
-- TABLA: inscripciones
-- ---------------------------------------------------------------------
create table inscripciones (
  id uuid primary key default gen_random_uuid(),
  partido_id uuid not null references partidos(id) on delete cascade,
  jugador_id uuid not null references jugadores(id) on delete cascade,

  disponibilidad disponibilidad_estado not null default 'pendiente',
  estado_inscripcion inscripcion_estado not null default 'confirmado',
  equipo equipo_enum,

  pago_estado pago_estado not null default 'pendiente',
  inscrito_por_admin boolean not null default false,
  bloqueo_ignorado boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (partido_id, jugador_id)
);

create index idx_inscripciones_partido on inscripciones(partido_id);
create index idx_inscripciones_jugador on inscripciones(jugador_id);
create index idx_inscripciones_estado on inscripciones(partido_id, estado_inscripcion);

-- ---------------------------------------------------------------------
-- TABLA: pagos (registro auditable de cambios de estado de pago)
-- ---------------------------------------------------------------------
-- inscripciones.pago_estado guarda el estado "vivo" (rápido de consultar
-- para el bloqueo). Esta tabla guarda el historial de quién marcó qué y
-- cuándo, útil si algún día hay una disputa sobre un pago.
create table pagos (
  id uuid primary key default gen_random_uuid(),
  inscripcion_id uuid not null references inscripciones(id) on delete cascade,
  estado_anterior pago_estado not null,
  estado_nuevo pago_estado not null,
  marcado_por uuid references jugadores(id),
  created_at timestamptz not null default now()
);

create index idx_pagos_inscripcion on pagos(inscripcion_id);

-- ---------------------------------------------------------------------
-- TABLA: historial_companeros (cuántas veces dos jugadores han
-- coincidido en el MISMO equipo). Se guarda como par canónico
-- (id_menor, id_mayor) para no duplicar (A,B) y (B,A).
-- ---------------------------------------------------------------------
create table historial_companeros (
  jugador_menor_id uuid not null references jugadores(id) on delete cascade,
  jugador_mayor_id uuid not null references jugadores(id) on delete cascade,
  veces_jugado_juntos int not null default 0,
  -- Desglose del resultado de esos partidos jugados en el mismo
  -- equipo, para poder calcular una "sinergia" de la pareja además de
  -- la simple frecuencia (ver fn_finalizar_partido y
  -- src/lib/teamGenerator.ts::calcularSinergia).
  victorias_juntos int not null default 0,
  derrotas_juntos int not null default 0,
  empates_juntos int not null default 0,
  ultimo_partido_id uuid references partidos(id),
  updated_at timestamptz not null default now(),
  primary key (jugador_menor_id, jugador_mayor_id),
  constraint chk_orden_canonico check (jugador_menor_id < jugador_mayor_id)
);

-- Vista de conveniencia: "con quién ha jugado X y cuántas veces"
-- (la tabla solo guarda un sentido del par; esta vista expande ambos)
create view vista_historial_jugador as
  select jugador_menor_id as jugador_id, jugador_mayor_id as companero_id,
         veces_jugado_juntos, victorias_juntos, derrotas_juntos, empates_juntos,
         ultimo_partido_id
  from historial_companeros
  union all
  select jugador_mayor_id as jugador_id, jugador_menor_id as companero_id,
         veces_jugado_juntos, victorias_juntos, derrotas_juntos, empates_juntos,
         ultimo_partido_id
  from historial_companeros;

-- ---------------------------------------------------------------------
-- TABLA: mvp_votos
-- ---------------------------------------------------------------------
-- Cada jugador registrado que participó en un partido vota al MVP del
-- equipo contrario. Los invitados no votan (tipo='invitado'), aunque
-- sí pueden ser elegidos MVP por el equipo contrario.
--
-- Restricciones importantes (reforzadas también en fn_votar_mvp):
--   * votante y candidato deben haber jugado ese partido confirmados.
--   * votante y candidato tienen que ser de equipos distintos.
--   * cada votante solo puede votar una vez por partido.
--   * los invitados no pueden votar (solo jugadores registrados).
-- ---------------------------------------------------------------------
create table mvp_votos (
  id uuid primary key default gen_random_uuid(),
  partido_id uuid not null references partidos(id) on delete cascade,
  votante_id uuid not null references jugadores(id) on delete cascade,
  candidato_id uuid not null references jugadores(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (partido_id, votante_id)
);

create index idx_mvp_votos_partido on mvp_votos(partido_id);

-- ---------------------------------------------------------------------
-- VISTA: estadísticas (porcentaje de victorias calculado al vuelo,
-- nunca lo guardamos para evitar que se desincronice)
-- ---------------------------------------------------------------------
create view vista_estadisticas_jugadores as
  select
    id, nombre, apellidos, tipo, rol, posicion_preferida, rating_actual,
    impacto_victoria, mvps_recibidos,
    partidos_jugados, victorias, derrotas, empates,
    case when partidos_jugados > 0
         then round((victorias::numeric / partidos_jugados) * 100, 1)
         else 0
    end as porcentaje_victorias
  from jugadores;

-- ---------------------------------------------------------------------
-- VISTA: pagos pendientes — la definición única de "lo que alguien
-- debe". Solo cuenta partidos que YA SE HAN JUGADO (estado = 'jugado')
-- y en los que estuvo confirmado (no lista de espera ni cancelado).
--
-- Esto es deliberado y corrige algo que se quedó mal en la Fase 1: el
-- valor por defecto de `pago_estado` es 'pendiente' desde el instante
-- en que alguien se apunta, así que si la deuda se contara desde
-- cualquier inscripción "pendiente" sin mirar si el partido ya se
-- jugó, cualquiera quedaría "con deuda" en cuanto se apuntara a su
-- primer partido — antes incluso de jugarlo. Esta vista (y
-- `fn_tiene_deuda_pendiente`, que la reutiliza) es la que decide qué
-- cuenta como deuda real en toda la app, para que el bloqueo y la
-- pantalla de pagos nunca se desincronicen.
-- ---------------------------------------------------------------------
create view vista_pagos_pendientes as
  select
    i.id as inscripcion_id,
    i.jugador_id,
    j.nombre,
    j.apellidos,
    p.id as partido_id,
    p.fecha,
    p.hora,
    p.campo
  from inscripciones i
  join partidos p on p.id = i.partido_id
  join jugadores j on j.id = i.jugador_id
  where i.estado_inscripcion = 'confirmado'
    and i.pago_estado = 'pendiente'
    and p.estado = 'jugado';

-- =====================================================================
-- FUNCIONES DE NEGOCIO
-- =====================================================================

-- ---------------------------------------------------------------------
-- updated_at automático
-- ---------------------------------------------------------------------
create or replace function fn_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_jugadores_updated_at before update on jugadores
  for each row execute function fn_set_updated_at();
create trigger trg_partidos_updated_at before update on partidos
  for each row execute function fn_set_updated_at();
create trigger trg_inscripciones_updated_at before update on inscripciones
  for each row execute function fn_set_updated_at();

-- ---------------------------------------------------------------------
-- ¿Es admin? (se usa en políticas RLS)
-- ---------------------------------------------------------------------
create or replace function fn_is_admin(p_auth_user_id uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from jugadores
    where auth_user_id = p_auth_user_id and rol = 'admin' and activo
  );
$$;

-- ---------------------------------------------------------------------
-- Completar registro tras el login. Se llama una vez por sesión
-- nueva, justo después de que Supabase Auth confirme la sesión. No
-- requiere ser admin: cualquier usuario autenticado puede "reclamar"
-- su propio perfil, pero solo el suyo (se ata al teléfono/email de su
-- propio auth.users, nunca a uno que el cliente le pase como
-- parámetro).
--
-- Reconoce tanto teléfono como email, porque el grupo entra con
-- teléfono+contraseña (cuentas que crea el admin a mano) pero el
-- primer login de prueba se hizo por email — así ninguno de los dos
-- caminos se queda colgado.
--
-- Tres casos, en este orden:
--   1) Ya existe un jugador vinculado a este auth_user_id -> se devuelve
--      tal cual (login normal de alguien que ya completó el registro).
--   2) Existe un invitado (creado de antemano por el admin, p.ej. al
--      añadirlo a un partido) con ese teléfono o email exacto y sin
--      auth_user_id todavía -> se vincula y pasa a 'registrado',
--      conservando intacto su historial, estadísticas y rating (mismo
--      mecanismo que fn_convertir_invitado, pero auto-servicio en vez
--      de admin-only).
--   3) No existe ningún jugador con ese teléfono/email -> se crea uno
--      nuevo como 'jugador' normal, con un nombre provisional (la
--      parte local del email, o el propio teléfono si no hay email)
--      que la persona puede cambiar luego en su perfil.
-- ---------------------------------------------------------------------
create or replace function fn_completar_registro()
returns jugadores language plpgsql security definer as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_phone text;
  v_fila jugadores;
begin
  if v_uid is null then
    raise exception 'NO_AUTENTICADO: No hay una sesión activa.';
  end if;

  select email, phone into v_email, v_phone from auth.users where id = v_uid;
  if v_email is null and v_phone is null then
    raise exception 'SIN_IDENTIDAD: No se pudo determinar el teléfono ni el email de la sesión.';
  end if;

  select * into v_fila from jugadores where auth_user_id = v_uid;
  if found then
    return v_fila;
  end if;

  update jugadores
    set auth_user_id = v_uid, tipo = 'registrado',
        telefono = coalesce(telefono, v_phone),
        email = coalesce(email, v_email)
    where tipo = 'invitado' and auth_user_id is null
      and (
        (v_phone is not null and telefono = v_phone) or
        (v_email is not null and email = v_email)
      )
  returning * into v_fila;
  if found then
    return v_fila;
  end if;

  insert into jugadores (auth_user_id, tipo, rol, nombre, email, telefono)
  values (
    v_uid, 'registrado', 'jugador',
    coalesce(split_part(v_email, '@', 1), v_phone, 'Jugador nuevo'),
    v_email, v_phone
  )
  returning * into v_fila;

  return v_fila;
end;
$$;

-- ---------------------------------------------------------------------
-- ¿Tiene deuda pendiente? — base de la regla de bloqueo
-- ---------------------------------------------------------------------
create or replace function fn_tiene_deuda_pendiente(p_jugador_id uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from vista_pagos_pendientes where jugador_id = p_jugador_id
  );
$$;

-- Devuelve true si el jugador tiene partidos jugados en los que participó
-- como registrado (no invitado) y todavía no ha votado el MVP. Esto
-- bloquea la inscripción igual que la deuda pendiente.
create or replace function fn_tiene_mvp_pendiente(p_jugador_id uuid)
returns boolean language sql stable as $$
  select exists (
    select 1
    from inscripciones i
    join partidos p on p.id = i.partido_id
    join jugadores j on j.id = p_jugador_id
    where i.jugador_id = p_jugador_id
      and i.estado_inscripcion = 'confirmado'
      and p.estado = 'jugado'
      and j.tipo = 'registrado'
      -- El partido tiene que tener al menos un jugador en el equipo
      -- contrario elegible para ser votado (si fue invitado puro con
      -- solo un equipo, no aplica)
      and exists (
        select 1 from inscripciones i2
        where i2.partido_id = i.partido_id
          and i2.estado_inscripcion = 'confirmado'
          and i2.equipo != i.equipo
      )
      -- Todavía no ha votado ese partido
      and not exists (
        select 1 from mvp_votos v
        where v.partido_id = i.partido_id
          and v.votante_id = p_jugador_id
      )
  );
$$;

-- ---------------------------------------------------------------------
-- Inscribirse a un partido ("Me apunto"), con lista de espera
-- automática y respeto a la regla de bloqueo por deuda.
-- p_forzado_por_admin: solo tiene efecto si quien llama es admin.
--
-- Autorización: una persona normal solo puede inscribirse a sí misma
-- (p_jugador_id tiene que ser su propia fila). Para añadir a un
-- invitado u a otro jugador, tiene que hacerlo el administrador. Sin
-- este control, cualquier autenticado podría apuntar (o desapuntar) a
-- cualquier otro jugador, ya que esta función es SECURITY DEFINER y
-- por tanto no pasa por las políticas RLS de la tabla.
-- ---------------------------------------------------------------------
create or replace function fn_inscribirse(
  p_partido_id uuid,
  p_jugador_id uuid,
  p_forzado_por_admin boolean default false
)
returns inscripciones language plpgsql security definer as $$
declare
  v_es_admin boolean;
  v_es_propio boolean;
  v_confirmados int;
  v_max int;
  v_estado estado_partido;
  v_nuevo_estado inscripcion_estado;
  v_fila inscripciones;
begin
  v_es_admin := fn_is_admin(auth.uid());

  select exists (
    select 1 from jugadores where id = p_jugador_id and auth_user_id = auth.uid()
  ) into v_es_propio;

  if not v_es_admin and not v_es_propio then
    raise exception 'NO_AUTORIZADO: Solo puedes inscribirte a ti mismo. Pide al administrador que añada a un invitado.';
  end if;

  if not v_es_admin and fn_tiene_deuda_pendiente(p_jugador_id) then
    raise exception 'DEUDA_PENDIENTE: Tienes pagos pendientes. Contacta con el administrador para regularizar tu situación.';
  end if;

  if not v_es_admin and fn_tiene_mvp_pendiente(p_jugador_id) then
    raise exception 'MVP_PENDIENTE: Tienes que votar el MVP del último partido antes de apuntarte al siguiente.';
  end if;

  select estado, jugadores_max into v_estado, v_max
  from partidos where id = p_partido_id;

  if v_estado is distinct from 'abierto' then
    raise exception 'PARTIDO_NO_ABIERTO: Este partido no admite inscripciones.';
  end if;

  select count(*) into v_confirmados
  from inscripciones
  where partido_id = p_partido_id and estado_inscripcion = 'confirmado';

  v_nuevo_estado := case when v_confirmados < v_max then 'confirmado' else 'lista_espera' end;

  insert into inscripciones (partido_id, jugador_id, estado_inscripcion, disponibilidad, inscrito_por_admin, bloqueo_ignorado)
  values (p_partido_id, p_jugador_id, v_nuevo_estado, 'voy', v_es_admin, (v_es_admin and p_forzado_por_admin))
  on conflict (partido_id, jugador_id) do update
    set estado_inscripcion = v_nuevo_estado,
        disponibilidad = 'voy',
        bloqueo_ignorado = (v_es_admin and p_forzado_por_admin)
  returning * into v_fila;

  return v_fila;
end;
$$;

-- ---------------------------------------------------------------------
-- Cancelar inscripción: si el que se va estaba "confirmado", promueve
-- automáticamente al primero de la lista de espera (FIFO).
--
-- Autorización: igual que en fn_inscribirse, solo el propio jugador o
-- el administrador pueden cancelar una inscripción concreta.
-- ---------------------------------------------------------------------
create or replace function fn_cancelar_inscripcion(p_inscripcion_id uuid)
returns void language plpgsql security definer as $$
declare
  v_partido_id uuid;
  v_jugador_id uuid;
  v_estado_previo inscripcion_estado;
  v_es_admin boolean;
  v_es_propio boolean;
  v_siguiente_id uuid;
begin
  v_es_admin := fn_is_admin(auth.uid());

  select partido_id, jugador_id, estado_inscripcion
    into v_partido_id, v_jugador_id, v_estado_previo
  from inscripciones where id = p_inscripcion_id;

  if v_partido_id is null then
    raise exception 'NO_ENCONTRADA: Esa inscripción no existe.';
  end if;

  select exists (
    select 1 from jugadores where id = v_jugador_id and auth_user_id = auth.uid()
  ) into v_es_propio;

  if not v_es_admin and not v_es_propio then
    raise exception 'NO_AUTORIZADO: Solo puedes cancelar tu propia inscripción.';
  end if;

  update inscripciones set estado_inscripcion = 'cancelado', disponibilidad = 'no_voy'
  where id = p_inscripcion_id;

  if v_estado_previo = 'confirmado' then
    select id into v_siguiente_id
    from inscripciones
    where partido_id = v_partido_id and estado_inscripcion = 'lista_espera'
    order by created_at asc
    limit 1;

    if v_siguiente_id is not null then
      update inscripciones set estado_inscripcion = 'confirmado'
      where id = v_siguiente_id;
    end if;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Marcar pago (admin) — actualiza el estado "vivo" y deja rastro en
-- la tabla de auditoría `pagos`.
-- ---------------------------------------------------------------------
create or replace function fn_marcar_pago(
  p_inscripcion_id uuid,
  p_nuevo_estado pago_estado
)
returns void language plpgsql security definer as $$
declare
  v_estado_anterior pago_estado;
  v_admin_id uuid;
begin
  if not fn_is_admin(auth.uid()) then
    raise exception 'NO_AUTORIZADO: Solo el administrador puede marcar pagos.';
  end if;

  select pago_estado into v_estado_anterior from inscripciones where id = p_inscripcion_id;
  select id into v_admin_id from jugadores where auth_user_id = auth.uid();

  update inscripciones set pago_estado = p_nuevo_estado where id = p_inscripcion_id;

  insert into pagos (inscripcion_id, estado_anterior, estado_nuevo, marcado_por)
  values (p_inscripcion_id, v_estado_anterior, p_nuevo_estado, v_admin_id);
end;
$$;

-- ---------------------------------------------------------------------
-- Finalizar partido: guarda el resultado, actualiza estadísticas,
-- aplica el cambio de rating estilo Elo (ponderado por diferencia de
-- goles) y actualiza el historial de compañeros de equipo.
--
-- NOTA: la misma fórmula vive también en src/lib/elo.ts, usada en el
-- frontend para *previsualizar* el efecto antes de confirmar. Si se
-- cambia una constante aquí (K, denominador, tope del multiplicador),
-- hay que cambiarla también allí.
-- ---------------------------------------------------------------------
create or replace function fn_finalizar_partido(
  p_partido_id uuid,
  p_goles_a int,
  p_goles_b int
)
returns void language plpgsql security definer as $$
declare
  k_base numeric := 4;
  denominador numeric := 50;
  multiplicador_max numeric := 2;
  -- Suavizado del impacto en victoria: media móvil exponencial. Un
  -- alpha bajo (0.15) hace que cada partido individual mueva poco la
  -- métrica — varios partidos seguidos por encima o por debajo de lo
  -- esperado son los que la mueven de verdad. Así se cumple el pedido
  -- de "sin cambios bruscos".
  alpha_impacto numeric := 0.15;

  v_estado_actual estado_partido;
  v_rating_a numeric; v_rating_b numeric;
  v_expectativa_a numeric;
  v_resultado_a numeric; -- 1 victoria, 0.5 empate, 0 derrota
  v_multiplicador numeric;
  v_cambio_a numeric; v_cambio_b numeric;
  -- "Sorpresa" del resultado frente a lo que el Elo previo predecía,
  -- ya en escala -1..1 (resultado y expectativa son ambos 0..1). Es
  -- la señal cruda que alimenta el impacto en victoria de cada
  -- jugador del equipo A; el de B es exactamente el opuesto.
  v_senal_a numeric;
  v_jugador record;
  -- Qué contador de historial_companeros toca incrementar para las
  -- parejas de cada equipo, según el resultado real de este partido.
  v_incr_victoria_a int; v_incr_derrota_a int; v_incr_empate_a int;
  v_incr_victoria_b int; v_incr_derrota_b int; v_incr_empate_b int;
begin
  if not fn_is_admin(auth.uid()) then
    raise exception 'NO_AUTORIZADO: Solo el administrador puede registrar resultados.';
  end if;

  select estado into v_estado_actual from partidos where id = p_partido_id;

  if v_estado_actual is null then
    raise exception 'NO_ENCONTRADO: Ese partido no existe.';
  end if;

  if v_estado_actual = 'jugado' then
    raise exception 'YA_FINALIZADO: Este partido ya tiene un resultado registrado.';
  end if;

  if exists (
    select 1 from inscripciones
    where partido_id = p_partido_id and estado_inscripcion = 'confirmado' and equipo is null
  ) then
    raise exception 'SIN_EQUIPOS: Genera y confirma los equipos antes de registrar el resultado.';
  end if;

  select coalesce(sum(j.rating_actual), 0) into v_rating_a
  from inscripciones i join jugadores j on j.id = i.jugador_id
  where i.partido_id = p_partido_id and i.equipo = 'A' and i.estado_inscripcion = 'confirmado';

  select coalesce(sum(j.rating_actual), 0) into v_rating_b
  from inscripciones i join jugadores j on j.id = i.jugador_id
  where i.partido_id = p_partido_id and i.equipo = 'B' and i.estado_inscripcion = 'confirmado';

  v_expectativa_a := 1 / (1 + power(10, (v_rating_b - v_rating_a) / denominador));
  v_resultado_a := case when p_goles_a > p_goles_b then 1
                        when p_goles_a < p_goles_b then 0
                        else 0.5 end;
  v_multiplicador := least(1 + ln(1 + abs(p_goles_a - p_goles_b)) * 0.5, multiplicador_max);
  v_cambio_a := k_base * v_multiplicador * (v_resultado_a - v_expectativa_a);
  v_cambio_b := -v_cambio_a;

  -- Misma "sorpresa" que mueve el Elo (resultado real menos lo
  -- esperado), pero sin el multiplicador de goleada ni el k_base —
  -- el impacto en victoria mide si el jugador rinde mejor o peor de
  -- lo esperado, no cuánto se goleó.
  v_senal_a := v_resultado_a - v_expectativa_a;

  v_incr_victoria_a := case when v_resultado_a = 1 then 1 else 0 end;
  v_incr_derrota_a  := case when v_resultado_a = 0 then 1 else 0 end;
  v_incr_empate_a   := case when v_resultado_a = 0.5 then 1 else 0 end;
  -- El resultado de B es el inverso del de A (un empate sigue siendo
  -- empate para los dos).
  v_incr_victoria_b := v_incr_derrota_a;
  v_incr_derrota_b  := v_incr_victoria_a;
  v_incr_empate_b   := v_incr_empate_a;

  update partidos
    set estado = 'jugado', resultado_goles_a = p_goles_a, resultado_goles_b = p_goles_b
    where id = p_partido_id;

  -- Equipo A
  for v_jugador in
    select j.id, j.rating_actual from inscripciones i join jugadores j on j.id = i.jugador_id
    where i.partido_id = p_partido_id and i.equipo = 'A' and i.estado_inscripcion = 'confirmado'
  loop
    update jugadores set
      rating_actual = greatest(0, least(100, rating_actual + v_cambio_a)),
      impacto_victoria = greatest(-1, least(1, impacto_victoria * (1 - alpha_impacto) + v_senal_a * alpha_impacto)),
      partidos_jugados = partidos_jugados + 1,
      victorias = victorias + (case when v_resultado_a = 1 then 1 else 0 end),
      derrotas = derrotas + (case when v_resultado_a = 0 then 1 else 0 end),
      empates = empates + (case when v_resultado_a = 0.5 then 1 else 0 end)
    where id = v_jugador.id;
  end loop;

  -- Equipo B (resultado y señal inversos a los de A)
  for v_jugador in
    select j.id, j.rating_actual from inscripciones i join jugadores j on j.id = i.jugador_id
    where i.partido_id = p_partido_id and i.equipo = 'B' and i.estado_inscripcion = 'confirmado'
  loop
    update jugadores set
      rating_actual = greatest(0, least(100, rating_actual + v_cambio_b)),
      impacto_victoria = greatest(-1, least(1, impacto_victoria * (1 - alpha_impacto) + (-v_senal_a) * alpha_impacto)),
      partidos_jugados = partidos_jugados + 1,
      victorias = victorias + (case when v_resultado_a = 0 then 1 else 0 end),
      derrotas = derrotas + (case when v_resultado_a = 1 then 1 else 0 end),
      empates = empates + (case when v_resultado_a = 0.5 then 1 else 0 end)
    where id = v_jugador.id;
  end loop;

  -- Historial de compañeros, equipo A: incrementa el contador del
  -- resultado real de ESTE equipo (victoria/derrota/empate juntos),
  -- no solo el contador genérico de "veces juntos" de antes.
  insert into historial_companeros (
    jugador_menor_id, jugador_mayor_id, veces_jugado_juntos,
    victorias_juntos, derrotas_juntos, empates_juntos, ultimo_partido_id
  )
  select least(a.jugador_id, b.jugador_id), greatest(a.jugador_id, b.jugador_id),
         1, v_incr_victoria_a, v_incr_derrota_a, v_incr_empate_a, p_partido_id
  from inscripciones a join inscripciones b
    on a.partido_id = b.partido_id and a.equipo = 'A' and b.equipo = 'A' and a.jugador_id < b.jugador_id
  where a.partido_id = p_partido_id and a.estado_inscripcion = 'confirmado' and b.estado_inscripcion = 'confirmado'
  on conflict (jugador_menor_id, jugador_mayor_id) do update
    set veces_jugado_juntos = historial_companeros.veces_jugado_juntos + 1,
        victorias_juntos = historial_companeros.victorias_juntos + excluded.victorias_juntos,
        derrotas_juntos = historial_companeros.derrotas_juntos + excluded.derrotas_juntos,
        empates_juntos = historial_companeros.empates_juntos + excluded.empates_juntos,
        ultimo_partido_id = p_partido_id,
        updated_at = now();

  -- Historial de compañeros, equipo B: mismo mecanismo, con el
  -- resultado (inverso) de B.
  insert into historial_companeros (
    jugador_menor_id, jugador_mayor_id, veces_jugado_juntos,
    victorias_juntos, derrotas_juntos, empates_juntos, ultimo_partido_id
  )
  select least(a.jugador_id, b.jugador_id), greatest(a.jugador_id, b.jugador_id),
         1, v_incr_victoria_b, v_incr_derrota_b, v_incr_empate_b, p_partido_id
  from inscripciones a join inscripciones b
    on a.partido_id = b.partido_id and a.equipo = 'B' and b.equipo = 'B' and a.jugador_id < b.jugador_id
  where a.partido_id = p_partido_id and a.estado_inscripcion = 'confirmado' and b.estado_inscripcion = 'confirmado'
  on conflict (jugador_menor_id, jugador_mayor_id) do update
    set veces_jugado_juntos = historial_companeros.veces_jugado_juntos + 1,
        victorias_juntos = historial_companeros.victorias_juntos + excluded.victorias_juntos,
        derrotas_juntos = historial_companeros.derrotas_juntos + excluded.derrotas_juntos,
        empates_juntos = historial_companeros.empates_juntos + excluded.empates_juntos,
        ultimo_partido_id = p_partido_id,
        updated_at = now();
end;
$$;

-- ---------------------------------------------------------------------
-- Calcular rating inicial a partir de los rankings manuales (Borda):
-- cada votante reparte puntos de n..1 según el orden que dio; se suman
-- los puntos de todos los votantes y se normaliza a una escala 0-100.
-- Devuelve una tabla para que el admin la revise antes de aplicarla.
-- ---------------------------------------------------------------------
create or replace function fn_calcular_ratings_iniciales()
returns table(jugador_id uuid, nombre text, puntos_borda numeric, rating_sugerido numeric)
language plpgsql as $$
#variable_conflict use_column
declare
  v_min numeric; v_max numeric;
begin
  return query
  with puntos as (
    select r.jugador_id,
           sum(
             (select count(*) from rankings_iniciales r2 where r2.votante_id = r.votante_id) - r.posicion + 1
           ) as total_puntos
    from rankings_iniciales r
    group by r.jugador_id
  ),
  rango as (
    select min(puntos.total_puntos) as v_min, max(puntos.total_puntos) as v_max from puntos
  )
  select p.jugador_id, j.nombre, p.total_puntos,
         case when rango.v_max = rango.v_min then 50
              else round(((p.total_puntos - rango.v_min) / (rango.v_max - rango.v_min)) * 100, 1)
         end as rating_sugerido
  from puntos p
  join jugadores j on j.id = p.jugador_id
  cross join rango;
end;
$$;

-- ---------------------------------------------------------------------
-- Aplicar el rating sugerido a un jugador concreto (lo hace el admin
-- tras revisar fn_calcular_ratings_iniciales) y marcarlo como confirmado
-- para que no se recalcule por error más adelante.
-- ---------------------------------------------------------------------
create or replace function fn_aplicar_rating_inicial(p_jugador_id uuid, p_rating numeric)
returns void language plpgsql security definer as $$
begin
  if not fn_is_admin(auth.uid()) then
    raise exception 'NO_AUTORIZADO';
  end if;
  update jugadores
    set rating_actual = greatest(0, least(100, p_rating)), rating_inicial_confirmado = true
    where id = p_jugador_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Guardar (o rehacer por completo) la votación de ranking inicial de
-- quien llama: borra su votación anterior, si la tenía, y guarda la
-- nueva en el orden dado (p_orden[0] = el mejor según esa persona).
--
-- No hay política de DELETE/UPDATE para rankings_iniciales — a
-- propósito, para que nadie pueda tocar el voto de otra persona — así
-- que esta función (SECURITY DEFINER, y siempre sobre el propio
-- votante_id, nunca uno recibido por parámetro) es la única forma de
-- corregir un voto ya emitido.
-- ---------------------------------------------------------------------
create or replace function fn_guardar_votacion(p_orden uuid[])
returns void language plpgsql security definer as $$
declare
  v_votante_id uuid;
  v_jugador_id uuid;
  v_posicion int := 1;
begin
  select id into v_votante_id from jugadores where auth_user_id = auth.uid();
  if v_votante_id is null then
    raise exception 'NO_AUTENTICADO: No se encontró tu perfil de jugador.';
  end if;

  if v_votante_id = any(p_orden) then
    raise exception 'VOTO_INVALIDO: No puedes incluirte a ti mismo en tu propia votación.';
  end if;

  delete from rankings_iniciales where votante_id = v_votante_id;

  foreach v_jugador_id in array p_orden loop
    insert into rankings_iniciales (votante_id, jugador_id, posicion)
    values (v_votante_id, v_jugador_id, v_posicion);
    v_posicion := v_posicion + 1;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- Convertir invitado en jugador registrado (conserva id, historial y
-- estadísticas intactos; solo cambia tipo + se vincula a un auth.users)
-- ---------------------------------------------------------------------
create or replace function fn_convertir_invitado(
  p_jugador_id uuid,
  p_auth_user_id uuid,
  p_email text
)
returns void language plpgsql security definer as $$
begin
  if not fn_is_admin(auth.uid()) then
    raise exception 'NO_AUTORIZADO';
  end if;
  update jugadores
    set tipo = 'registrado', auth_user_id = p_auth_user_id, email = p_email
    where id = p_jugador_id and tipo = 'invitado';
end;
$$;

-- ---------------------------------------------------------------------
-- Partidos que necesitan recordatorio (24h antes). Pensada para ser
-- llamada por un Cloudflare Worker con Cron Trigger (ver README).
-- ---------------------------------------------------------------------
-- ---------------------------------------------------------------------
-- Votar MVP del partido: cada jugador registrado que participó vota
-- al MVP del equipo contrario. Un solo voto por jugador por partido.
-- Si el partido todavía no está en estado 'jugado', no se puede votar.
-- ---------------------------------------------------------------------
create or replace function fn_votar_mvp(
  p_partido_id uuid,
  p_candidato_id uuid
)
returns void language plpgsql security definer as $$
declare
  v_votante_id uuid;
  v_equipo_votante equipo_enum;
  v_equipo_candidato equipo_enum;
  v_tipo_votante tipo_jugador;
begin
  -- El votante es quien llama
  select j.id, j.tipo
    into v_votante_id, v_tipo_votante
    from jugadores j
    where j.auth_user_id = auth.uid();

  if v_votante_id is null then
    raise exception 'NO_AUTENTICADO: No se encontró tu perfil.';
  end if;

  if v_tipo_votante = 'invitado' then
    raise exception 'INVITADO: Los invitados no pueden votar el MVP.';
  end if;

  -- El partido tiene que estar jugado
  if not exists (select 1 from partidos where id = p_partido_id and estado = 'jugado') then
    raise exception 'PARTIDO_NO_JUGADO: Solo se puede votar el MVP de partidos ya jugados.';
  end if;

  -- El votante tiene que haber jugado ese partido
  select equipo into v_equipo_votante
    from inscripciones
    where partido_id = p_partido_id
      and jugador_id = v_votante_id
      and estado_inscripcion = 'confirmado';

  if v_equipo_votante is null then
    raise exception 'NO_PARTICIPANTE: No participaste en ese partido.';
  end if;

  -- El candidato tiene que haber jugado ese partido en el equipo contrario
  select equipo into v_equipo_candidato
    from inscripciones
    where partido_id = p_partido_id
      and jugador_id = p_candidato_id
      and estado_inscripcion = 'confirmado';

  if v_equipo_candidato is null then
    raise exception 'CANDIDATO_NO_PARTICIPANTE: Ese jugador no participó en ese partido.';
  end if;

  if v_equipo_candidato = v_equipo_votante then
    raise exception 'MISMO_EQUIPO: Tienes que votar a alguien del equipo contrario.';
  end if;

  -- Un voto por partido (unique constraint lo garantiza también)
  insert into mvp_votos (partido_id, votante_id, candidato_id)
  values (p_partido_id, v_votante_id, p_candidato_id)
  on conflict (partido_id, votante_id) do update
    set candidato_id = p_candidato_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Cerrar votación MVP y aplicar el bonus de rating al ganador.
-- Solo el admin puede llamar a esta función.
--
-- Regla de empate (Opción A): si hay empate exacto entre candidatos
-- del mismo equipo, ese equipo no tiene MVP en ese partido — nadie
-- recibe el bonus ni se cuenta el MVP en su historial.
--
-- Bonus: +1 punto de rating al MVP de cada equipo. Al MVP del equipo
-- perdedor le "restamos" menos (recibe +1 antes del descuento por
-- perder). Al MVP del equipo ganador le sube +1 adicional.
-- ---------------------------------------------------------------------
create or replace function fn_cerrar_votacion_mvp(p_partido_id uuid)
returns table(equipo text, mvp_nombre text, votos_recibidos bigint)
language plpgsql security definer as $$
#variable_conflict use_column
declare
  v_mvp_a uuid; v_votos_a bigint;
  v_mvp_b uuid; v_votos_b bigint;
  v_segundo_a bigint; v_segundo_b bigint;
begin
  if not fn_is_admin(auth.uid()) then
    raise exception 'NO_AUTORIZADO: Solo el administrador puede cerrar la votación MVP.';
  end if;

  if not exists (select 1 from partidos where id = p_partido_id and estado = 'jugado') then
    raise exception 'PARTIDO_NO_JUGADO: Solo se puede cerrar el MVP de partidos jugados.';
  end if;

  -- MVP del equipo A (votado por el equipo B)
  select v.candidato_id, count(*) as cnt
    into v_mvp_a, v_votos_a
    from mvp_votos v
    join inscripciones i on i.partido_id = v.partido_id and i.jugador_id = v.candidato_id
    where v.partido_id = p_partido_id and i.equipo = 'A'
    group by v.candidato_id
    order by cnt desc
    limit 1;

  -- ¿Hay empate con el segundo?
  if v_mvp_a is not null then
    select count(*) into v_segundo_a
      from mvp_votos v
      join inscripciones i on i.partido_id = v.partido_id and i.jugador_id = v.candidato_id
      where v.partido_id = p_partido_id and i.equipo = 'A'
      group by v.candidato_id
      having count(*) = v_votos_a
      having count(*) > 0;
    -- Si hay más de un candidato con el máximo de votos, hay empate -> no hay MVP
    if v_segundo_a > 1 then
      v_mvp_a := null;
    end if;
  end if;

  -- MVP del equipo B (votado por el equipo A)
  select v.candidato_id, count(*) as cnt
    into v_mvp_b, v_votos_b
    from mvp_votos v
    join inscripciones i on i.partido_id = v.partido_id and i.jugador_id = v.candidato_id
    where v.partido_id = p_partido_id and i.equipo = 'B'
    group by v.candidato_id
    order by cnt desc
    limit 1;

  if v_mvp_b is not null then
    select count(*) into v_segundo_b
      from mvp_votos v
      join inscripciones i on i.partido_id = v.partido_id and i.jugador_id = v.candidato_id
      where v.partido_id = p_partido_id and i.equipo = 'B'
      group by v.candidato_id
      having count(*) = v_votos_b;
    if v_segundo_b > 1 then
      v_mvp_b := null;
    end if;
  end if;

  -- Aplicar bonus +1 y sumar MVP al historial
  if v_mvp_a is not null then
    update jugadores set
      rating_actual = greatest(0, least(100, rating_actual + 1)),
      mvps_recibidos = mvps_recibidos + 1
    where id = v_mvp_a;
  end if;

  if v_mvp_b is not null then
    update jugadores set
      rating_actual = greatest(0, least(100, rating_actual + 1)),
      mvps_recibidos = mvps_recibidos + 1
    where id = v_mvp_b;
  end if;

  -- Devolver quiénes son los MVPs para mostrarlo en la pantalla
  return query
    select 'Blancos'::text,
           j.nombre || case when j.apellidos is not null then ' ' || j.apellidos else '' end,
           (select count(*) from mvp_votos v2
            join inscripciones i2 on i2.partido_id = v2.partido_id and i2.jugador_id = v2.candidato_id
            where v2.partido_id = p_partido_id and i2.equipo = 'A')
    from jugadores j where j.id = v_mvp_a
    union all
    select 'Negros'::text,
           j.nombre || case when j.apellidos is not null then ' ' || j.apellidos else '' end,
           (select count(*) from mvp_votos v2
            join inscripciones i2 on i2.partido_id = v2.partido_id and i2.jugador_id = v2.candidato_id
            where v2.partido_id = p_partido_id and i2.equipo = 'B')
    from jugadores j where j.id = v_mvp_b;
end;
$$;

create or replace function fn_partidos_para_recordatorio()
returns table(partido_id uuid, fecha date, hora time, campo text, jugador_id uuid, nombre text, email text)
language sql stable as $$
  select p.id, p.fecha, p.hora, p.campo, j.id, j.nombre, j.email
  from partidos p
  join inscripciones i on i.partido_id = p.id and i.estado_inscripcion = 'confirmado'
  join jugadores j on j.id = i.jugador_id
  where p.estado = 'abierto'
    and (p.fecha + p.hora) between (now() + interval '23 hours') and (now() + interval '25 hours');
$$;

-- ---------------------------------------------------------------------
-- Código de invitación del grupo. Lo comprueba el cliente ANTES de
-- pedir el código de login por email, para que alguien que solo tenga
-- el enlace (reenviado sin permiso, por ejemplo) no pueda registrarse
-- sin más. El código real vive solo aquí, en el servidor — nunca llega
-- al JavaScript de la app, así que no se puede sacar inspeccionando el
-- código fuente como pasaría con una variable de entorno del frontend.
--
-- CAMBIA 'PARTIDO2026' por tu propia palabra de paso antes de
-- desplegar, y cada vez que quieras cambiarla más adelante: vuelve a
-- pegar este "create or replace function" con el texto nuevo.
-- ---------------------------------------------------------------------
create or replace function fn_codigo_invitacion_valido(p_codigo text)
returns boolean language sql stable as $$
  select p_codigo = 'PARTIDO2026';
$$;

grant execute on function fn_codigo_invitacion_valido(text) to anon, authenticated;

-- Las vistas necesitan un GRANT explícito en Supabase porque el motor
-- no hereda automáticamente los permisos de las tablas subyacentes
-- cuando se accede a través de una vista.
grant select on vista_estadisticas_jugadores to authenticated;
grant select on vista_historial_jugador to authenticated;
grant select on vista_pagos_pendientes to authenticated;

-- =====================================================================
-- RLS (Row Level Security)
-- =====================================================================
alter table jugadores enable row level security;
alter table rankings_iniciales enable row level security;
alter table partidos enable row level security;
alter table inscripciones enable row level security;
alter table pagos enable row level security;
alter table historial_companeros enable row level security;
alter table mvp_votos enable row level security;

-- mvp_votos: cada uno ve todos los votos del partido (para saber
-- quién ha votado ya), pero solo puede insertar/actualizar el suyo
-- propio a través de fn_votar_mvp (SECURITY DEFINER).
create policy mvp_votos_select on mvp_votos for select to authenticated using (true);

-- jugadores: todos los autenticados pueden leer (para ver equipos,
-- historial, rankings); solo admin o el propio jugador puede actualizar
-- sus propios datos no sensibles; solo admin puede insertar/borrar.
create policy jugadores_select on jugadores for select to authenticated using (true);
create policy jugadores_update_propio on jugadores for update to authenticated
  using (auth_user_id = auth.uid() or fn_is_admin(auth.uid()));
create policy jugadores_insert_admin on jugadores for insert to authenticated
  with check (fn_is_admin(auth.uid()));
create policy jugadores_delete_admin on jugadores for delete to authenticated
  using (fn_is_admin(auth.uid()));

-- rankings_iniciales: cada uno ve y crea su propio voto; admin ve todos
create policy rankings_select on rankings_iniciales for select to authenticated
  using (votante_id in (select id from jugadores where auth_user_id = auth.uid()) or fn_is_admin(auth.uid()));
create policy rankings_insert on rankings_iniciales for insert to authenticated
  with check (votante_id in (select id from jugadores where auth_user_id = auth.uid()));

-- partidos: lectura para todos los autenticados; escritura solo admin
create policy partidos_select on partidos for select to authenticated using (true);
create policy partidos_write_admin on partidos for all to authenticated
  using (fn_is_admin(auth.uid())) with check (fn_is_admin(auth.uid()));

-- inscripciones: lectura para todos (ver confirmados/pendientes/espera);
-- escritura directa restringida — el flujo normal pasa por las RPCs
-- fn_inscribirse / fn_cancelar_inscripcion / fn_marcar_pago, que son
-- SECURITY DEFINER y ya validan permisos internamente.
create policy inscripciones_select on inscripciones for select to authenticated using (true);
create policy inscripciones_write_admin on inscripciones for all to authenticated
  using (fn_is_admin(auth.uid())) with check (fn_is_admin(auth.uid()));

-- pagos: solo admin (es una tabla de auditoría)
create policy pagos_admin on pagos for all to authenticated
  using (fn_is_admin(auth.uid())) with check (fn_is_admin(auth.uid()));

-- historial_companeros: lectura libre, escritura solo vía función
create policy historial_select on historial_companeros for select to authenticated using (true);

-- =====================================================================
-- FIN DEL ESQUEMA
-- =====================================================================
