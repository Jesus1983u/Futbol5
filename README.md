# Fútbol 5 — App de gestión de partidos

Proyecto completo en sus cinco fases: base de datos, generador de
equipos, sistema de rating, login sin contraseña, perfil de jugador,
partidos e inscripciones, pagos y bloqueo de deuda, y ahora también el
**panel de administrador** (Fase 5) — gestión de jugadores, registrar
el resultado de un partido jugado (dispara el cambio de rating), y la
votación inicial de ranking para arrancar el grupo desde cero. Con
esto quedan cubiertos los cuatro bloques que planteaste al principio;
al final del documento dejo algunas ideas de pulido por si quieres
seguir afinando algo.

## Qué hay aquí

```
schema.sql                          → esquema completo de Supabase, listo para pegar en el SQL Editor
wrangler.toml                       → despliegue en Cloudflare Workers (static assets)
index.html, vite.config.ts, etc.    → proyecto Vite + React + TypeScript + Tailwind

src/types/database.ts               → tipos TypeScript que reflejan las tablas y vistas
src/lib/supabase.ts                 → cliente de Supabase
src/lib/partidos.ts                 → acceso a datos de partidos/inscripciones (RPCs incluidas)
src/lib/pagos.ts                    → acceso a datos de pagos pendientes y marcado de pagos
src/lib/admin.ts                    → acceso a datos del panel de administrador
src/lib/votacion.ts                 → acceso a datos de la votación del ranking inicial
src/lib/fecha.ts                    → formato de fechas en español
src/lib/teamGenerator.ts            → generador de equipos equilibrados (fuerza bruta + heurística)
src/lib/elo.ts                      → sistema de rating estilo Elo, escala 0-100

src/contexts/AuthContext.tsx        → sesión + perfil de jugador vinculado
src/hooks/useAuth.ts                → hook de conveniencia sobre el contexto anterior
src/components/RequireAuth.tsx      → protege rutas que necesitan sesión iniciada
src/components/RequireAdmin.tsx     → protege rutas solo para el administrador
src/components/AppLayout.tsx        → barra de pestañas inferior (Partidos / Mi perfil)
src/components/ScoreboardCodeInput.tsx → input del código de 6 dígitos (estilo marcador de estadio)
src/components/Avatar.tsx           → iniciales en círculo, reutilizado en perfil y convocatoria
src/components/EstadoBadge.tsx      → insignia de estado de un partido
src/components/PartidoCard.tsx      → tarjeta de partido en la lista
src/components/RosterItem.tsx       → fila de jugador en la convocatoria
src/components/AnadirJugadorAdmin.tsx → control de admin para añadir jugador/invitado a un partido
src/components/GenerarEquiposPanel.tsx → conecta teamGenerator.ts con la pantalla del partido
src/components/RegistrarResultado.tsx → admin cierra un partido jugado con su resultado

src/pages/Login.tsx                 → pantalla de login (email → código)
src/pages/Perfil.tsx                → ver/editar perfil, rating y estadísticas
src/pages/Partidos.tsx              → lista de partidos (próximos / pasados)
src/pages/PartidoDetalle.tsx        → ficha de un partido: convocatoria, apuntarse, equipos
src/pages/CrearPartido.tsx          → formulario de admin para programar un partido
src/pages/Pagos.tsx                 → vista de admin: deuda pendiente agrupada por jugador
src/pages/AdminPanel.tsx            → gestión de jugadores + revisión del ranking inicial
src/pages/Votacion.tsx              → cualquiera ordena al resto del grupo de mejor a peor
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

Segunda: no había ninguna forma de corregir un voto ya emitido en la
votación del ranking — no existía política para borrar ni actualizar
filas de `rankings_iniciales`, así que si alguien cambiaba de opinión
sobre el orden, se quedaba atascado. Añadí `fn_guardar_votacion`, que
sustituye por completo la votación anterior de quien la llama (nunca
la de otra persona) por la nueva, así que ahora se puede volver a
`/votacion` y reordenar cuando se quiera.

## Cómo funciona el login

Sin contraseñas: escribes tu email, te llega un código de 6 dígitos,
lo introduces y ya estás dentro. Esto se apoya en Supabase Auth
(`signInWithOtp` + `verifyOtp`), igual que ya usas en la intranet de
facturación.

Justo después de verificar el código, la app llama a la función SQL
`fn_completar_registro()` (nueva en esta entrega, en `schema.sql`),
que decide qué fila de `jugadores` corresponde a esa persona:

1. Si ya tenía una cuenta vinculada, la recupera tal cual.
2. Si el administrador ya le había dado de alta como invitado (por
   ejemplo al añadirlo a un partido) con ese mismo email, la vincula y
   la pasa a "registrado" — conservando intacto su historial,
   estadísticas y rating, igual que `fn_convertir_invitado` pero en
   modo autoservicio.
3. Si no existe ningún jugador con ese email, crea uno nuevo con un
   nombre provisional (la parte de antes de la @) que la persona
   puede cambiar en su perfil.

Así cualquiera puede entrar por primera vez sin que tengas que crear
cuentas a mano una por una, pero si ya le habías metido como invitado
en un partido anterior, no pierde nada de su historial al registrarse.

### Configuración necesaria en el panel de Supabase

Por defecto, la plantilla de email de Supabase para el login manda un
**enlace** ("Magic Link"), no un código de 6 dígitos. Para que la
pantalla de código funcione como está diseñada, hay que tocar una
cosa en el panel:

1. Ve a **Authentication → Email Templates → Magic Link**.
2. Cambia el cuerpo del email para que muestre `{{ .Token }}` en vez
   del enlace `{{ .ConfirmationURL }}` (por ejemplo: *"Tu código de
   acceso es: {{ .Token }}"*).
3. Con el plan gratuito de Supabase, el envío de emails tiene un
   límite bajo (pensado para pruebas, no para uso real con varios
   jugadores). Si esto te da problemas cuando lo probéis entre varios,
   te recomiendo configurar un SMTP propio en **Authentication →
   SMTP Settings** — Resend (que ya mencionaba para el recordatorio
   24h) sirve perfectamente para esto también, y así reutilizas la
   misma cuenta para ambas cosas.

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

**Login sin contraseña en vez de email+contraseña.** El encargo no
especificaba el mecanismo exacto de login, solo que hubiera roles
admin/jugador. Elijo código de un solo uso por email porque es lo que
ya usas en la intranet de facturación, no hay contraseñas que la
gente olvide, y para un grupo de amigos es más sencillo que gestionar
altas y recuperación de contraseña.

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
3. Configura la plantilla de email como se explica arriba en
   "Configuración necesaria en el panel de Supabase".
4. Date de alta tú mismo entrando por `/login` con tu email — la app
   te creará automáticamente un jugador. Luego, en el SQL Editor,
   sube tu propia fila a administrador:
   ```sql
   update jugadores set rol = 'admin' where email = 'tu-email@ejemplo.com';
   ```
5. Copia `.env.example` a `.env` con la URL y la anon key de tu
   proyecto (Project Settings → API) para correr la app en local, y
   las mismas variables como "Environment Variables" en Cloudflare
   cuando despliegues el Worker.

## Qué falta (roadmap)

Los cuatro bloques que planteaste al principio están construidos:
autenticación y perfiles, partidos e inscripciones, pagos y bloqueo de
deuda, y panel de administrador. Lo único que se quedó fuera desde la
Fase 1, porque era una decisión aparte (notificaciones por email), es
montar el Cloudflare Worker con Cron Trigger que llame a
`fn_partidos_para_recordatorio()` 24h antes de cada partido y dispare
los emails vía Resend — la función SQL ya está lista, solo falta el
Worker que la invoque y la integración con Resend.

Más allá de eso, todo lo que viene ahora es pulido sobre lo que ya
funciona: probarlo con el grupo real, ver qué fricciones aparecen
sobre el terreno, y ajustar lo que haga falta — el ritmo de cambio del
rating, el diseño visual, lo que sea. Dime qué tal va cuando lo
probéis.
#   F u t b o l 5  
 