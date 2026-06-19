# Fútbol 5 — App de gestión de partidos

Proyecto completo en sus cinco fases, más una ronda de ajustes después
de probarlo de verdad: login por teléfono + contraseña con cada cuenta
creada por ti (sin alta por cuenta propia), votación que se bloquea
tras enviarla, clasificación general por puntos, historial de
compañeros visible, nivel estimado al crear invitados, y algún detalle
visual más. Ver "Cómo funciona el login" y "Clasificación, historial y
mejoras en invitados" más abajo para el detalle de cada cosa.

## Qué hay aquí

```
schema.sql                          → esquema completo de Supabase, listo para pegar en el SQL Editor
wrangler.toml                       → despliegue en Cloudflare Workers (static assets)
index.html, vite.config.ts, etc.    → proyecto Vite + React + TypeScript + Tailwind
public/manifest.json, sw.js, icon-*.png → PWA: instalable en pantalla de inicio
worker/index.ts, tsconfig.worker.json → endpoint de servidor: crear usuarios (service role key)

src/types/database.ts               → tipos TypeScript que reflejan las tablas y vistas
src/lib/supabase.ts                 → cliente de Supabase
src/lib/partidos.ts                 → acceso a datos de partidos/inscripciones (RPCs incluidas)
src/lib/pagos.ts                    → acceso a datos de pagos pendientes y marcado de pagos
src/lib/admin.ts                    → acceso a datos del panel de administrador
src/lib/votacion.ts                 → acceso a datos de la votación del ranking inicial
src/lib/fecha.ts                    → formato de fechas en español
src/lib/telefono.ts                 → teléfono → email falso, compartido con worker/index.ts
src/components/icons.tsx            → iconos de trazo simple para títulos y navegación
src/lib/teamGenerator.ts            → generador de equipos equilibrados (fuerza bruta + heurística)
src/lib/elo.ts                      → sistema de rating estilo Elo, escala 0-100

src/contexts/AuthContext.tsx        → sesión + perfil de jugador vinculado
src/hooks/useAuth.ts                → hook de conveniencia sobre el contexto anterior
src/components/RequireAuth.tsx      → protege rutas que necesitan sesión iniciada
src/components/RequireAdmin.tsx     → protege rutas solo para el administrador
src/components/AppLayout.tsx        → barra de pestañas inferior (Partidos / Mi perfil)
src/components/Avatar.tsx           → iniciales en círculo, reutilizado en perfil y convocatoria
src/components/EstadoBadge.tsx      → insignia de estado de un partido
src/components/PartidoCard.tsx      → tarjeta de partido en la lista
src/components/RosterItem.tsx       → fila de jugador en la convocatoria
src/components/AnadirJugadorAdmin.tsx → control de admin para añadir jugador/invitado a un partido
src/components/GenerarEquiposPanel.tsx → conecta teamGenerator.ts con la pantalla del partido
src/components/RegistrarResultado.tsx → admin cierra un partido jugado con su resultado

src/pages/Login.tsx                 → pantalla de login (teléfono + contraseña)
src/pages/Perfil.tsx                → ver/editar perfil, rating y estadísticas
src/pages/Partidos.tsx              → lista de partidos (próximos / pasados)
src/pages/PartidoDetalle.tsx        → ficha de un partido: convocatoria, apuntarse, equipos
src/pages/CrearPartido.tsx          → formulario de admin para programar un partido
src/pages/Pagos.tsx                 → vista de admin: deuda pendiente agrupada por jugador
src/pages/AdminPanel.tsx            → gestión de jugadores + revisión del ranking inicial
src/pages/Votacion.tsx              → cualquiera ordena al resto del grupo de mejor a peor
src/pages/Clasificacion.tsx         → la general del grupo, puntos por victoria/empate/derrota
src/pages/Historial.tsx             → con quién ha jugado más veces cada cual
src/App.tsx, src/main.tsx           → arranque de la app y rutas

examples/demo-generador-equipos.ts  → ejemplo ejecutable del generador de equipos
```

## Cómo funciona apuntarse a un partido

"Me apunto" llama a la función `fn_inscribirse`: si quedan plazas te
deja confirmado, si no, te manda a la lista de espera. Al "Me bajo",
`fn_cancelar_inscripcion` te cancela y, si estabas confirmado,
promueve automáticamente al primero de la lista de espera (FIFO) —
nadie tiene que vigilar eso a mano.

**Corrección de seguridad en esta fase:** al construir la pantalla
real me di cuenta de que ambas funciones, tal y como estaban escritas
en la Fase 1, no comprobaban quién las llamaba — cualquier persona
autenticada podía apuntar o desapuntar a *cualquier otro* jugador, no
solo a sí misma, porque son funciones `SECURITY DEFINER` y por tanto
no pasan por las políticas RLS de la tabla. Lo arreglé directamente en
`schema.sql`: ahora una persona normal solo puede actuar sobre su
propia inscripción; añadir a un invitado o a otro jugador requiere ser
administrador. Si ya tenías el esquema de la Fase 1 desplegado, solo
hace falta volver a pegar la sección de `fn_inscribirse` y
`fn_cancelar_inscripcion` en el SQL Editor — `create or replace
function` sustituye la versión anterior sin tocar nada más.

De paso, ambas funciones ahora también actualizan `disponibilidad`
('voy' al apuntarte, 'no_voy' al bajarte) — antes esa columna se
quedaba siempre en 'pendiente' porque ninguna función la tocaba. No
monté una pantalla separada de "voy / no voy" antes de apuntarse
porque el encargo no la pedía explícitamente y habría sido un paso
intermedio sin mucho valor añadido; apuntarse y marcar la
disponibilidad son ahora la misma acción.

## Convocatoria y equipos, en el detalle del partido

Cada partido tiene su lista de confirmados y su lista de espera. El
administrador puede añadir a cualquier jugador existente o crear un
invitado nuevo sobre la marcha (queda como `tipo = 'invitado'`, igual
que el resto del sistema). El botón "Generar equipos" — la pieza que
marcaste como la más importante — ya está conectado de verdad: toma a
los confirmados, consulta el historial de quién ha jugado con quién, y
te muestra una propuesta de dos equipos antes de guardarla. Si la
propuesta no te convence, "Descartar" y vuelve a generar; al
"Confirmar equipos" se escribe el reparto en las inscripciones
correspondientes y cualquiera que abra el partido lo verá. Una vez el
partido deja de estar abierto, los equipos generados quedan fijos —
no permito regenerarlos para no liarte el reparto después de cerrar
inscripciones.

## Pagos y bloqueo de deuda

Cada inscripción confirmada tiene un `pago_estado` (pendiente/pagado).
Puedes marcarlo de dos sitios: directamente en la convocatoria del
partido (toca "Pendiente"/"Pagado" junto a cada nombre — útil justo
después de jugar, cuando vas cobrando en mano) o desde la nueva
pestaña **Pagos**, que solo ve el administrador, con todo el mundo que
debe dinero agrupado por persona y un botón para marcarlo pagado sin
tener que entrar partido por partido.

**Otra cosa que corregí al construir esto de verdad:** la regla de
bloqueo (`fn_tiene_deuda_pendiente`) tal y como quedó en la Fase 1
miraba *cualquier* inscripción con `pago_estado = 'pendiente'` — y
como ese es el valor por defecto desde el instante en que alguien se
apunta a un partido, en la práctica habría bloqueado a cualquiera en
cuanto se apuntara a su primer partido, antes incluso de jugarlo. Lo
arreglé creando una vista (`vista_pagos_pendientes`) que solo cuenta
partidos que **ya se han jugado** y en los que la persona estuvo
confirmada — eso sí es deuda real. Tanto el bloqueo como la pestaña de
Pagos y el aviso en el perfil leen de esta misma vista, así que no
hay forma de que se desincronicen entre ellos. Igual que con la
corrección de la Fase 3, si ya tenías el esquema desplegado, solo
hace falta volver a pegar la sección de la vista y de
`fn_tiene_deuda_pendiente` en el SQL Editor.

En el perfil de cada jugador aparece ahora un aviso si tiene partidos
sin pagar, con la lista de cuáles son — así no se queda nadie sin
entender por qué de repente no puede apuntarse a un partido nuevo.

## Panel de administrador y votación del ranking inicial

La pestaña **Admin** (solo la ves si eres administrador) tiene dos
partes. En "Jugadores" puedes editar nombre, apellidos y posición de
cualquiera — útil sobre todo para invitados, que al no tener cuenta no
pueden editarse a sí mismos —, subir o bajar a alguien de
administrador, y dar de baja a quien deje el grupo. "Dar de baja" no
borra nada: solo desactiva (`activo = false`), así que su historial,
estadísticas y apariciones en partidos pasados quedan intactos; lo
único que cambia es que ya no aparece como opción para añadir a
partidos nuevos.

En "Ranking inicial" revisas el resultado de la votación: cada
jugador, desde su perfil, ordena al resto del grupo de mejor a peor
(es la pantalla nueva en `/votacion`, abierta a cualquiera, no solo al
admin). Con "Calcular ranking sugerido" se agregan todos los votos por
el método Borda y se reescalan a la escala 0-100 de rating; revisas la
cifra sugerida para cada persona (puedes tocarla si no estás de
acuerdo) y la aplicas una a una con "Aplicar". Esto solo hace falta
una vez, al arrancar el grupo — a partir de ahí los ratings ya se
recalculan solos con cada resultado.

**Dos correcciones más al construir esto de verdad:**

Primera: `fn_finalizar_partido` no comprobaba si el partido ya tenía
un resultado registrado, así que llamarla dos veces por error
duplicaba el cambio de rating, las estadísticas y el historial de
compañeros. Ahora rechaza un segundo intento sobre el mismo partido.
Tampoco comprobaba que los equipos estuvieran ya asignados — si
generabas el resultado sin haber generado equipos antes, la función no
fallaba, simplemente no le cambiaba el rating a nadie, en silencio.
Ahora lo exige explícitamente y la pantalla de "Registrar resultado"
ni siquiera te deja intentarlo hasta que los equipos están listos.

Segunda: en la primera versión, cualquiera podía volver a `/votacion`
y reordenar su voto entero cuando quisiera — útil para corregir un
error, pero abierto a que alguien fuera cambiando su voto después de
ver cómo iba quedando el grupo. Ahora el voto se bloquea en cuanto se
envía: ya no se puede tocar a nadie que estuviera en esa lista. La
única excepción es cuando añades a alguien nuevo al grupo después de
que la gente ya hubiera votado — esa persona nueva aparece suelta, con
sus propias flechas, para que cada votante la encaje donde corresponda
sin poder mover a nadie más de su lista ya enviada. Por debajo sigue
siendo la misma `fn_guardar_votacion` (sustituye el voto entero), pero
ahora la pantalla decide cuándo dejarte usarla según si hay alguien
nuevo sin clasificar.

## Clasificación, historial y mejoras en invitados

**Clasificación** (`/clasificacion`, enlazada desde el perfil) es la
general del grupo como una tabla de liga: puntos por victoria/empate/
derrota, no el rating Elo — son dos cosas a propósito distintas. El
rating mide nivel para repartir equipos parejos; la clasificación es
solo "quién ha sumado más puntos jugando", como cualquier liga de
barrio. Está en 3 puntos por victoria y 1 por empate, como confirmaste.

*Arreglado (segunda vuelta, con tu captura delante):* la primera
corrección dejó de romper la tabla, pero el nombre seguía viéndose
muy cortado porque competía por sitio con cuatro columnas estrechas
(PJ, V, E, D) en la misma fila. Rehecho con dos líneas por jugador: el
nombre ahora tiene toda la fila para él en la línea de arriba, y las
estadísticas (PJ · V-E-D) van más compactas debajo, con los puntos a
la derecha. Así el nombre ya no se corta salvo que sea realmente muy
largo.

**Historial** (`/historial`, también enlazada desde el perfil) hace
visible la tabla `historial_companeros` que ya alimentaba al
generador de equipos por debajo: cuántas veces ha coincidido cada
pareja en el mismo equipo, de más a menos.

*Mejorado:* con un grupo grande, el número de parejas posibles crece
muy rápido (combinatorio — 20 jugadores ya dan 190 parejas), así que
antes había que hacer mucho scroll para verlas todas. Ahora hay un
buscador por nombre arriba, y por defecto solo se ven las 15 parejas
que más se repiten, con un botón "Ver todas (N)" para desplegar el
resto solo si se quiere.

**Al crear un invitado** (botón "+ Añadir jugador" dentro de un
partido) puedes ponerle un nivel estimado (0-100, 50 por defecto) para
que el generador de equipos lo tenga en cuenta desde el primer
partido, en vez de arrancar siempre en el 50 por defecto de cualquier
jugador nuevo. También puedes ponerle el teléfono, opcional: si lo
haces, el día que le crees su cuenta con ese mismo número (ver "Cómo
funciona el login" más abajo), se vincula solo y pasa a registrado sin
perder nada de su historial.

**Convertir a un invitado en jugador habitual a mano:** en el panel de
Admin → Jugadores → Editar, hay un desplegable para pasar el "tipo" de
invitado a registrado directamente, sin esperar a que esa persona
entre nunca por su cuenta. Eso no le da acceso a la app por sí solo
(sigue sin poder entrar si no tiene cuenta creada) — es solo para
marcarlo como habitual desde ya en las estadísticas y en cómo se le
trata en el resto de la app.

**Posición preferida, bloqueada tras la primera elección.** En "Mi
perfil", cada jugador elige su posición (atacante/defensor) una sola
vez — en cuanto la guarda, queda fijada: el selector desaparece y se
ve como un dato fijo, con una nota explicando que hay que pedírselo al
administrador para cambiarla. Tú, como administrador, sí puedes
cambiarla en cualquier momento desde el panel de Admin → Jugadores →
Editar, para cualquiera (incluido tú mismo) — esa vía no se bloquea
nunca.

## Cómo funciona el login

Teléfono + contraseña, y tú creas cada cuenta desde la propia app. No
hay alta por cuenta propia: nadie puede registrarse solo con el
enlace — si no le has creado la cuenta, no entra.

**Por qué no usamos el "teléfono" nativo de Supabase.** Lo intentamos
primero así, pero Supabase exige configurar un proveedor de SMS real
(Twilio o similar) solo para *activar* el inicio de sesión por
teléfono — aunque la app nunca llegue a mandar ningún SMS, porque se
entra con contraseña, no con código. Sin ese proveedor configurado, el
panel ni siquiera te deja guardar el interruptor, y cualquier intento
de entrar o crear una cuenta falla con "Phone logins are disabled".
No es un fallo nuestro: es así como funciona el panel de Supabase.

**La solución: cada teléfono se convierte en un email "falso".**
Cuando creas a alguien con el teléfono `612345678`, por debajo se crea
una cuenta de verdad con el email `612345678@futbol5.local` — un
dominio que no existe en internet, solo se usa como identificador
interno. Esa persona nunca ve ni necesita saber ese email: en la
pantalla de login solo escribe su teléfono, exactamente como si fuera
el método nativo. Esta conversión vive en un único archivo,
`src/lib/telefono.ts`, que usan tanto el Worker (al crear la cuenta)
como el login (al entrar) — así los dos lados generan siempre el mismo
email a partir del mismo teléfono.

Como el email no es de verdad, no hace falta ningún proveedor de SMS,
ni se manda ningún correo de confirmación: las cuentas se crean ya
confirmadas (`email_confirm: true`), exactamente como pediste.

**Cómo das de alta a alguien:** Admin → Jugadores → "Crear usuario
nuevo" — nombre, teléfono, contraseña, posición y rol. Al pulsar
"Crear" queda todo hecho de una vez. Ver "Crear usuarios desde la app"
más abajo para la configuración previa que hace falta (el secreto de
la "service role key").

Si quieres que el nombre le aparezca bien desde el primer momento (en
vez de un nombre provisional que tenga que cambiar él mismo luego),
puedes crearlo antes como invitado desde dentro de un partido (botón
"+ Añadir jugador" → "Teléfono") con el mismo número — al crearle
después la cuenta de acceso con ese mismo teléfono, se vincula solo,
conservando cualquier historial que ya tuviera como invitado.

Justo después de entrar, la app llama a la función SQL
`fn_completar_registro()` (en `schema.sql`), que decide qué fila de
`jugadores` corresponde a esa persona:

1. Si ya tenía una cuenta vinculada, la recupera tal cual.
2. Si ya le habías dado de alta como invitado con ese mismo teléfono
   (o email), la vincula y la pasa a "registrado" — conservando
   intacto su historial, estadísticas y rating.
3. Si no existe ningún jugador con ese teléfono/email, crea uno nuevo
   con un nombre provisional que la persona puede cambiar en su
   perfil.

**Vía de respaldo por email real, solo para ti.** Tu propia cuenta de
pruebas se creó con tu email real durante el desarrollo, así que sigue
funcionando con el enlace "Entrar con email" en el login. No es el
camino para el grupo — ellos solo tienen teléfono — es solo para que
no te quedes tú sin entrar si alguna vez hace falta.

### Si ya tenías el esquema de antes desplegado en Supabase

Esto es importante y solo aplica una vez: como tu proyecto de Supabase
ya está en marcha con datos reales, no puedes simplemente volver a
pegar `schema.sql` entero — el `create table jugadores` fallaría
porque la tabla ya existe. Para esta ronda hacen falta estos pasos en
el SQL Editor, en este orden:

1. Las dos columnas nuevas, sueltas (esto no está en ningún
   `create table`, son `alter table` aparte):
   ```sql
   alter table jugadores add column telefono text;
   alter table jugadores add column posicion_confirmada boolean not null default false;
   ```
2. Después, vuelve a pegar solo la función `fn_completar_registro()`
   completa desde `schema.sql` — `create or replace function` sí se
   puede repetir sin problema sobre una base de datos ya en marcha,
   sustituye la versión anterior sin tocar nada más.

Con eso, tu base de datos queda al día sin perder nada de lo que ya
tenías. Para despliegues nuevos desde cero, `schema.sql` ya incluye
ambas columnas en el sitio de siempre, así que no hace falta este
paso.

**Si te falla guardar en el panel de Admin con "No se pudo guardar"
(activar/desactivar, o pasar de invitado a habitual):** casi seguro es
justo esto — la columna `telefono` no existe todavía en tu base de
datos porque falta el paso 1 de arriba. El formulario de edición ahora
manda ese campo en cada guardado, así que si la columna no está
creada, Postgres rechaza el `update` entero (no solo la parte del
teléfono) y por eso parecía que ni siquiera el interruptor de
activo/inactivo funcionaba. Ahora además, si vuelve a fallar, el
mensaje rojo te dirá el motivo exacto en vez de un genérico "no se
pudo guardar" — así si es otra cosa, lo vemos enseguida.

**Si ya intentaste crear usuarios antes de este cambio y te dio
"Phone logins are disabled":** esos intentos no llegaron a crear
ninguna cuenta de verdad (Supabase los rechazó antes de guardar nada),
así que no hay nada que limpiar — simplemente vuelve a intentarlo
ahora con el mismo teléfono y contraseña y debería funcionar.

## Crear usuarios desde la app

Ya no hace falta entrar al panel de Supabase para dar de alta a
alguien: en **Admin → Jugadores → "Crear usuario nuevo"** rellenas
nombre, teléfono, contraseña, posición y si es usuario normal o
administrador, y al pulsar "Crear" queda todo hecho — la cuenta de
acceso y su fila de jugador, en un solo paso.

**Por qué esto necesitaba una pieza nueva de servidor.** Crear una
cuenta de acceso (no solo una fila en una tabla) requiere la "service
role key" de Supabase, una clave que se salta todos los permisos y
por eso nunca puede llegar al navegador — si estuviera en el código
del frontend, cualquiera podría sacarla inspeccionando el JavaScript y
crear o borrar lo que quisiera. Por eso ahora el Worker de Cloudflare,
además de servir la app, también ejecuta un trozo de código de
servidor propio (`worker/index.ts`) para la ruta `/api/crear-usuario`.
Esa es la única pieza que conoce esa clave. El flujo: comprueba que
quien llama tiene una sesión válida, comprueba que esa persona es
administrador en la tabla `jugadores`, valida los datos, convierte el
teléfono al email falso (ver "Cómo funciona el login" más arriba),
crea la cuenta en Supabase Auth ya confirmada, sin mandar ningún
email ni SMS, y por último crea o actualiza su fila de jugador con los
datos que ya elegiste — sin esperar a que esa persona inicie sesión
por primera vez.

**Configuración que falta hacer una vez, antes de que esto funcione:**

1. Ve a Supabase → **Project Settings → API** y copia la **service
   role key** (no la `anon` key — la de "service_role", que pone una
   advertencia al lado).
2. En tu terminal, dentro de la carpeta del proyecto:
   ```
   npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
   ```
   Te pedirá que pegues el valor — pégalo y pulsa Enter. Esto la guarda
   cifrada en Cloudflare, no en ningún archivo del proyecto.
3. Abre `wrangler.toml` y cambia `SUPABASE_URL` (dentro de `[vars]`)
   por la URL real de tu proyecto — la misma que ya tienes en tu
   `.env` del frontend.
4. `npm run build` y `npx wrangler deploy` como siempre.

Una vez hecho esto, no hay que repetirlo salvo que cambies de proyecto
de Supabase. La clave no se borra entre despliegues.

**Una nota sobre las contraseñas:** Supabase exige un mínimo de 6
caracteres. Tú eliges la contraseña de cada persona y se la dices por
donde prefieras (WhatsApp, en persona); no hay recuperación automática
si la olvida — en ese caso, edítala tú desde Supabase → Authentication
→ Users → esa persona → "..." → cambiar contraseña.

## Responsable de la reserva y equipos manuales

**Quién ha reservado la pista.** Al crear un partido hay un campo
opcional nuevo, "Pista reservada por", con un desplegable de todos los
jugadores activos. Es opcional a propósito — si no lo rellenas, el
partido se crea igual, sin más. Si lo rellenas, en la ficha del
partido aparece "Pista reservada por: [nombre]" justo debajo del
contador de jugadores, para que quede claro a quién hay que pagar esa
semana. Por debajo es una columna nueva en `partidos`
(`reservador_id`), que apunta a un jugador pero no lo obliga: si esa
persona se diera de baja algún día, el partido no se rompe, solo
queda sin reservador asignado.

**Equipos manuales, además de los automáticos.** Al ir a crear los
equipos de un partido, ahora aparecen dos opciones: 🤖 Generación
automática (el algoritmo de siempre) o ✋ Equipos manuales. En modo
manual puedes armar tú los dos equipos jugador a jugador, viendo en
todo momento la suma de rating de cada lado para juzgar si están
medianamente equilibrados — útil para semanas en las que quieres forzar
un reparto concreto (separar a dos amigos que siempre coinciden,
probar una pareja nueva, lo que sea) en vez de dejarlo al algoritmo.

*Sobre "arrastrar":* lo pediste como "arrastrar jugadores entre Equipo
A y Equipo B", pero lo he construido como "tocar para mover" en su
lugar — tocas a un jugador y pasa al otro equipo al instante, sin
necesidad de arrastrar nada. La razón: el arrastrar-y-soltar nativo
del navegador no funciona con el dedo en una pantalla táctil sin
añadir una librería aparte, y esta app está pensada sobre todo para el
móvil (ahora más, con la PWA instalable). Tocar es más fiable y más
rápido en el dedo que un arrastre. Si al probarlo prefieres el
arrastre real, dímelo y lo cambio — sería añadir una librería como
`@dnd-kit/core`, que sí soporta bien touch.

Una vez guardados, los equipos manuales quedan exactamente igual que
los generados automáticamente — misma tabla, mismo campo `equipo` en
cada inscripción. No hay ninguna diferencia para el resto de la app
(votación, estadísticas, nada) entre un equipo armado a mano o por el
algoritmo.

## Permisos: jugador normal frente a administrador

Esto lo he sacado revisando directamente las políticas de la base de
datos (RLS) y las funciones SQL, no de memoria, para que sea exacto.

Cualquier **jugador** (sin ser admin) puede: iniciar sesión con el
teléfono y contraseña que le hayas creado; ver todo — partidos
pasados y futuros, convocatorias, equipos generados, clasificación
general, historial de compañeros; apuntarse y desapuntarse a sí mismo
de un partido abierto (nunca a otra persona); votar el ranking inicial
del resto del grupo; ver sus propios pagos pendientes; y editar su
nombre, apellidos y posición preferida (esto último, solo la primera
vez) desde su perfil.

Solo el **administrador** puede: crear, editar y cancelar partidos
(incluyendo asignar quién ha reservado la pista); añadir o quitar a
cualquier persona de una convocatoria (no solo a sí mismo); generar y
confirmar los equipos, automática o manualmente; registrar el
resultado de un partido jugado (esto es lo que dispara el cambio de
rating de todo el mundo); marcar pagos como hechos o pendientes;
crear, editar y dar de baja jugadores; aplicar el ranking inicial
calculado a partir de las votaciones; y crear usuarios nuevos
completos.

**Una precisión honesta, ya que me pides dejarlo bien definido:** casi
todo lo de arriba está reforzado en el servidor — alguien con
conocimientos técnicos no podría saltárselo llamando directamente a la
API, aunque modificara la app. Hay dos excepciones, ambas de bajo
riesgo para un grupo de amigos, que conviene que sepas: el bloqueo de
"la posición preferida solo se puede elegir una vez" y el de "el voto
del ranking inicial se bloquea tras enviarlo" están aplicados solo en
la pantalla (React), no en la base de datos — alguien que supiera
llamar a la API directamente podría seguir cambiando esas dos cosas
suyas propias sin que el servidor lo impida. Para un grupo cerrado
donde tú creas cada cuenta, no le veo riesgo real, pero si en algún
momento te preocupa, se puede mover ese bloqueo a la base de datos
también — dímelo y lo hago.

## Decisiones de diseño visual

Nada de plantilla genérica de SaaS: la paleta y la tipografía están
pensadas para "partido de fútbol 5 nocturno en una pista de Utrera"
en vez de un dashboard cualquiera. Verde de césped oscuro de fondo
(nunca negro puro), un ámbar cálido como acento principal —el foco de
iluminación de la pista— para las acciones importantes, y un
verde-azulado para lo confirmado/exitoso. La tipografía de titulares
(Oswald, condensada) tiene ese aire de marcador de estadio; el cuerpo
de texto usa una tipografía humanista (Source Sans 3) para que se lea
bien en el móvil. El elemento que más se nota de toda la pantalla de
login es el propio input del código: seis casillas que se iluminan en
ámbar al recibir el foco, como un marcador electrónico.

## Decisiones de arquitectura (y dónde me desvío un poco del encargo)

**Cloudflare Workers en vez de Pages.** El encargo pedía Cloudflare
Pages, pero desde principios de 2026 Cloudflare ha puesto Pages en
modo mantenimiento: las funciones nuevas (Cron Triggers, Durable
Objects, observabilidad) van solo a Workers, y la propia documentación
oficial recomienda empezar proyectos nuevos directamente en Workers
con "static assets" (sirve el frontend y la API desde el mismo
proyecto). Como el recordatorio 24h antes del partido necesita un Cron
Trigger, y tú ya usas Workers en tus otras apps, monto este proyecto
sobre Workers en vez de Pages — `wrangler.toml` ya está listo para
eso. Si prefieres Pages igualmente, el frontend funciona igual — solo
cambia dónde vive el cron del recordatorio.

**Login por teléfono + contraseña, creado por el admin (cambiado dos
veces).** El encargo no especificaba el mecanismo exacto de login,
solo que hubiera roles admin/jugador. Empecé con código de un solo uso
por email, sin contraseñas, porque es lo que ya usas en la intranet de
facturación y evita gestionar altas y recuperación de contraseña —
pero pediste más control sobre quién entra, así que pasé a que tú
crees cada cuenta a mano. El primer intento usó el "teléfono" nativo
de Supabase Auth, pero topó con una exigencia real de la plataforma:
Supabase no deja activar ese inicio de sesión sin configurar un
proveedor de SMS, aunque nuestra app nunca mande ningún SMS (se entra
con contraseña). En vez de depender de un Twilio que no hace falta
para nada, cada teléfono se traduce a un email "falso" determinista
(`612345678@futbol5.local`) y se usa el email+contraseña que ya
funcionaba — la persona solo ve y escribe su teléfono, el cambio es
invisible. Sigue sin haber recuperación de contraseña automática: si
alguien la olvida, tienes que cambiársela tú desde el panel de
Supabase.

**Una sola tabla `jugadores` para registrados e invitados.** El
encargo separaba "Usuarios" e "Invitados" en dos tablas. Lo unifico en
una sola tabla con un campo `tipo` ('registrado' | 'invitado') porque
así "Convertir en jugador registrado" es una simple actualización de
fila (cambia el tipo y se vincula a un usuario de Supabase Auth) que
conserva intacto su historial de compañeros, sus estadísticas y su
rating. Con dos tablas separadas, ese historial se perdería en la
conversión o habría que migrarlo a mano cada vez.

**`pagos` como tabla de auditoría, no como única fuente de verdad.**
`inscripciones.pago_estado` guarda el estado "vivo" (pagado/pendiente),
que es lo que se consulta constantemente para la regla de bloqueo.
`pagos` guarda el historial de cada cambio de estado (quién lo marcó y
cuándo), por si algún día hay que revisar una discrepancia.

**Rating en escala 0-100 con Elo reescalado.** El Elo clásico de
ajedrez usa un denominador de 400 sobre una escala de miles de puntos.
Aquí, para mantenerlo entre 0 y 100 sin que se sature en los extremos
ni tarde demasiados partidos en converger, reescalo el denominador a
50 y uso un factor K base de 4 (en vez del 16-32 habitual). Con eso,
una sorpresa total (favorito perdiendo claramente) mueve unos 6-8
puntos; un resultado esperado mueve 1-2. Son constantes fáciles de
tocar (`ELO_K_BASE`, `ELO_DENOMINADOR` en `elo.ts`) si después de
varios partidos reales el ritmo de cambio no te convence.

**El cambio de Elo se aplica igual a todos los jugadores de un
equipo**, no se reparte de forma distinta según el rating individual
de cada uno dentro del equipo. El encargo no pedía ese nivel de
detalle y añadirlo ahora sin datos reales de partidos sería
sobre-ingeniería; si más adelante quieres que el jugador "menos
favorito dentro de un equipo ya favorito" gane proporcionalmente más,
se puede afinar.

**Recordatorio 24h antes por email (Resend + Cron).** Ya decidido —
la función SQL `fn_partidos_para_recordatorio()` está lista; falta
montar el Cloudflare Worker con Cron Trigger que la llame y dispare
los emails. Lo monto en la fase de notificaciones.

## Cómo probar todo esto ya mismo

El esquema y los algoritmos ya están verificados: compilé todo el
proyecto en modo TypeScript estricto (cero errores) y además hice un
build de producción completo de Vite para confirmar que React,
Tailwind y el resto de piezas encajan entre sí antes de entregarlo.

Para correrlo tú:

```bash
npm install
cp .env.example .env   # rellena con la URL y la anon key de tu proyecto de Supabase
npm run dev
```

Y para ver el generador de equipos en acción de forma aislada:

```bash
npx tsx examples/demo-generador-equipos.ts
```

Con el mismo grupo de 10 jugadores del ejemplo (6 atacantes, 4
defensores, e incluyendo un jugador que ha jugado 25 veces con otro),
el algoritmo separa exhaustivamente las 126 combinaciones posibles,
elige una con solo 5 puntos de diferencia de rating, reparte 3
atacantes y 2 defensores en cada equipo, y evita juntar a la pareja
que ya ha coincidido 25 veces.

## Cómo desplegar el esquema en Supabase

1. Crea un proyecto nuevo en Supabase (ya me confirmaste que quieres
   uno nuevo para esta app, separado del de la CRM y del de la
   distribuidora).
2. Abre el SQL Editor del proyecto y pega el contenido completo de
   `schema.sql`. Se ejecuta de una sola vez: crea los tipos, las
   tablas, los índices, las funciones (incluida la nueva
   `fn_completar_registro`) y las políticas de seguridad (RLS).
3. Date de alta a ti mismo: Supabase → **Authentication → Users →
   "Add user"**, con tu teléfono (formato `+34...`), una contraseña
   que tú elijas, y **"Auto Confirm User"** marcado. Entra con eso por
   `/login` — la app te creará automáticamente tu fila de jugador.
   Luego, en el SQL Editor, sube esa fila a administrador:
   ```sql
   update jugadores set rol = 'admin' where telefono = '+34TUNUMERO';
   ```
4. Para cada persona del grupo, una vez tengas la app desplegada
   (sigue leyendo) y seas administrador, ya puedes crearle la cuenta
   desde dentro de la propia app — Admin → Jugadores → "Crear usuario
   nuevo" — en vez de entrar al panel de Supabase cada vez. Ver "Crear
   usuarios desde la app" más abajo para los detalles y la
   configuración que falta para que esa pantalla funcione.
5. Copia `.env.example` a `.env` con la URL y la anon key de tu
   proyecto (Project Settings → API). Esto es lo único que necesitas
   para `npm run dev` en local **y** para desplegar: al hacer
   `npm run build`, Vite lee el `.env` y deja esos valores ya escritos
   dentro del JavaScript compilado. No hace falta (ni sirve) añadirlos
   como "Environment Variables" en el panel de Cloudflare — esas
   variables de Cloudflare solo las vería el código que corre dentro
   del propio Worker (`worker/index.ts`), no el JavaScript que se le
   sirve al navegador.
6. Configura el secreto de la "service role key" (ver "Crear usuarios
   desde la app" más abajo para el paso a paso) — sin esto, todo lo
   demás funciona igual, solo fallaría el botón de "Crear usuario
   nuevo".
7. `npm run build` y luego `npx wrangler login` (la primera vez, para
   autorizar wrangler contra tu cuenta de Cloudflare) y `npx wrangler
   deploy`. Te da una URL del tipo
   `futbol5-app.tu-usuario.workers.dev` para compartir con el grupo.

## PWA: instalable en el móvil, sin notificaciones todavía

La app ya se puede "Añadir a pantalla de inicio" como una PWA
(Progressive Web App): icono propio, abre a pantalla completa sin la
barra del navegador, y arranca directamente en `/partidos`. No hace
falta tienda de aplicaciones ni nada que instalar más allá de eso.

Lo que añadí: `public/manifest.json` (nombre, colores, los iconos),
unos iconos nuevos a juego con la paleta de la app (`public/icon-*.png`
y `public/apple-touch-icon.png` para iOS) y un service worker mínimo
(`public/sw.js`) registrado desde `src/main.tsx`.

**Sobre ese service worker, una decisión deliberada:** no cachea nada
todavía, a propósito. Como cada `npm run build` genera archivos con
nombres distintos (el hash en `index-XXXX.js`), un service worker que
guardara en caché el HTML o el JS podría dejar a alguien atascado en
una versión vieja de la app después de un despliegue nuevo — justo el
tipo de bug confuso que no quiero meterte, sobre todo sabiendo que
sueles probar cada cambio justo después de desplegarlo. Por ahora solo
existe para cumplir el requisito técnico de "tener un service worker
registrado", que es lo que hace falta para que el navegador ofrezca
instalar la app. Si en algún momento quieres que funcione algo offline
de verdad (ver el último partido sin cobertura, por ejemplo), eso se
puede añadir después con cuidado, idealmente con una librería como
Workbox que gestiona bien el versionado del caché.

**Cómo probarlo:** despliega esta versión, abre la URL en el móvil
(Chrome en Android, Safari en iPhone), y debería aparecer la opción de
instalar — en Android suele salir un aviso automático o la opción
"Añadir a pantalla de inicio" en el menú; en iPhone es Safari → botón
de compartir → "Añadir a pantalla de inicio" (ahí no hay aviso
automático, hay que ir a buscarlo).

**Sobre las notificaciones push** (lo que pedías que avisara de
partido creado, equipos generados, recordatorio, plaza libre, deuda
pendiente): esto es un proyecto bastante más grande que la parte
instalable, y antes de ponerme quiero ser claro contigo sobre lo que
implica:

- Hace falta una pieza de servidor nueva (un endpoint en el Worker de
  Cloudflare) con su propia clave criptográfica (VAPID) que nunca
  puede llegar al navegador — parecido a lo que ya hablamos para el
  recordatorio 24h por email, pero para empujar notificaciones en vez
  de mandar correos.
- Hace falta una tabla nueva en Supabase para guardar la suscripción
  push de cada móvil (cada dispositivo que acepta notificaciones
  genera una suscripción distinta que hay que guardar para poder
  avisarle después).
- Cada tipo de aviso (partido creado, equipos generados, etc.)
  necesita su propio disparador — probablemente vía Database Webhooks
  de Supabase, que pueden llamar a ese endpoint cuando se inserta una
  fila nueva en `partidos`, por ejemplo.
- **En iPhone, las notificaciones push solo funcionan si la persona ya
  se ha instalado la PWA primero** (justo lo de arriba) — no funcionan
  desde una pestaña normal de Safari. En Android con Chrome funcionan
  sin necesidad de haberla instalado. Con un grupo de amigos donde
  seguramente hay varios iPhone, esto es una limitación real que hay
  que contar de antemano, no un detalle pequeño.
- Las preferencias por persona (qué avisos quiere recibir cada uno) son
  la parte fácil, una vez exista todo lo de arriba.

Todo esto es construible, pero es su propia fase, con su propio
tiempo de pruebas en los dos sistemas — no algo de un día. Te pregunto
al final cómo quieres seguir con esto.

## Qué falta (roadmap)

Los cuatro bloques que planteaste al principio están construidos:
autenticación y perfiles, partidos e inscripciones, pagos y bloqueo de
deuda, y panel de administrador. Las dos decisiones pendientes de la
ronda anterior ya están resueltas: 3 puntos por victoria / 1 por
empate en la clasificación, y login por teléfono + contraseña con
cada cuenta creada por ti.

**Antes de dar el enlace a nadie del grupo:** si ya tenías el esquema
desplegado, no olvides el paso de migración de "Si ya tenías el
esquema de antes desplegado en Supabase" (las columnas `telefono` y
`posicion_confirmada` nuevas + volver a pegar `fn_completar_registro`)
— sin eso, el login por teléfono no tiene dónde guardar el número, y
el panel de Admin falla al guardar cualquier cambio en un jugador.
Tampoco olvides el secreto `SUPABASE_SERVICE_ROLE_KEY` (ver "Crear
usuarios desde la app") — sin él, todo funciona igual salvo el botón
de "Crear usuario nuevo". Y para esta ronda en concreto, hace falta
otra columna nueva (ver el bloque SQL justo debajo).

**Cambio importante en esta ronda:** el login ya no usa el "teléfono"
nativo de Supabase (chocaba con la exigencia de un proveedor de SMS
real) — ahora usa email+contraseña con un email construido a partir
del teléfono, invisible para la persona. Si habías intentado crear
usuarios antes de este cambio y te dio "Phone logins are disabled",
no hay nada que limpiar: esos intentos nunca llegaron a crear ninguna
cuenta. Ver "Cómo funciona el login" para el detalle completo.

Esta ronda añadió: el campo "Pista reservada por" al crear un
partido, y la opción de armar equipos manualmente además de la
generación automática — ambas detalladas en "Responsable de la reserva
y equipos manuales" más arriba.

Si ya tenías el esquema desplegado, esta columna nueva (para el
reservador de la pista) hace falta también:
```sql
alter table partidos add column reservador_id uuid references jugadores(id) on delete set null;
```

La app ya se puede instalar como PWA (icono en pantalla de inicio, sin
notificaciones todavía) — ver "PWA: instalable en el móvil" más
arriba. Las notificaciones push son la pieza pendiente más grande
ahora mismo: te pregunto al final de mi respuesta cómo quieres
abordarlas, porque es un proyecto en sí mismo, con su propia
infraestructura de servidor y limitaciones reales en iPhone.

Lo único que se quedó fuera desde la Fase 1, porque era una decisión
aparte (notificaciones por email), es montar el Cloudflare Worker con
Cron Trigger que llame a `fn_partidos_para_recordatorio()` 24h antes
de cada partido y dispare los emails vía Resend — la función SQL ya
está lista, solo falta el Worker que la invoque y la integración con
Resend. (Lo de crear cuentas desde dentro de la app, que hasta esta
ronda estaba en esta misma lista como pendiente, ya está hecho — ver
"Crear usuarios desde la app" más arriba.)

Más allá de eso, todo lo que viene ahora es pulido sobre lo que ya
funciona: probarlo con el grupo real, ver qué fricciones aparecen
sobre el terreno, y ajustar lo que haga falta — el ritmo de cambio del
rating, el diseño visual, lo que sea. Dime qué tal va cuando lo
probéis.
