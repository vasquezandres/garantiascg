// ================================================================
// service-worker.js
// PWA mínima: instalable + cache solo de assets estáticos.
// ================================================================
//
// Filosofía: "instalable, no offline-first".
// - Cacheamos solo el shell de la app (HTML del módulo interno + CSS + JS + iconos).
// - NUNCA cacheamos respuestas de la API (Apps Script).
// - NUNCA cacheamos /firmar.html ni nada relacionado al cliente externo.
//   La pantalla de firma siempre debe ir a la red para garantizar
//   que el cliente reciba el estado real del formulario.
// - Si subes una versión nueva del frontend, sube también
//   CACHE_VERSION para que los clientes refresquen.
// ================================================================

const CACHE_VERSION = 'garantias-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/assets/styles.css',
  '/assets/api.js',
  '/assets/config.js',
  '/assets/crear.js',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// ===== INSTALL: precachear assets básicos =====
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => { /* si algún asset falla no rompemos la instalación */ })
  );
});

// ===== ACTIVATE: limpiar caches viejos =====
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names => Promise.all(
      names.filter(n => n !== CACHE_VERSION).map(n => caches.delete(n))
    )).then(() => self.clients.claim())
  );
});

// ===== FETCH: estrategia muy conservadora =====
self.addEventListener('fetch', event => {
  const req = event.request;

  // Solo manejamos GET. Cualquier POST (incluyendo a Apps Script) va directo a red.
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Nunca interceptar dominios externos (Apps Script, Font Awesome CDN, etc.)
  if (url.origin !== self.location.origin) return;

  // Nunca cachear ni servir desde cache la pantalla de firma:
  // siempre debe ver el estado actual del formulario.
  if (url.pathname === '/firmar' || url.pathname === '/firmar.html') return;
  if (url.pathname.startsWith('/assets/firmar.js')) return;

  // Para todo lo demás del mismo origen: network-first con fallback a cache.
  // Así el usuario interno siempre ve la versión más nueva si tiene red,
  // pero la app sigue siendo instalable y abre offline el shell básico.
  event.respondWith(
    fetch(req)
      .then(res => {
        // Solo cacheamos respuestas válidas y "completas"
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then(cached => cached || caches.match('/index.html')))
  );
});
