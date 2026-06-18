// =====================================================================
// Service Worker — deliberadamente mínimo.
// =====================================================================
// Su único trabajo por ahora es existir y registrarse, que es uno de
// los requisitos para que el navegador ofrezca "Añadir a pantalla de
// inicio". No cachea nada todavía a propósito: como cada `npm run
// build` genera archivos con nombres distintos (hash en el nombre,
// p.ej. index-Xy12.js), un service worker que cachee el HTML o el JS
// podría dejar a alguien atrapado en una versión vieja de la app después
// de un despliegue nuevo — justo el tipo de bug confuso ("¿por qué no
// se actualiza?") que conviene evitar. Si en el futuro se quiere
// trabajar offline de verdad, lo suyo es montarlo con una librería
// como Workbox que gestiona el versionado del caché correctamente, en
// vez de a mano aquí.
//
// `skipWaiting` + `clients.claim()` hacen que, cuando subas una versión
// nueva del Worker (este archivo cambia muy poco, pero por si acaso),
// se active enseguida en vez de esperar a que se cierren todas las
// pestañas abiertas.
// =====================================================================

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
