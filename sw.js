/**
 * Service Worker — Control de Gastos PWA
 *
 * Estrategia de caché por tipo de recurso:
 *
 *  HTML (index.html)     → Network-First: siempre intenta la red, cae al cache si no hay conexión.
 *  JS / CSS / iconos     → Stale-While-Revalidate: sirve del cache inmediatamente Y actualiza
 *                          en background para la próxima carga. Garantiza velocidad + frescura.
 *  Backend PHP / APIs    → Network-Only: nunca se cachea. Datos siempre en tiempo real.
 *
 * Actualización automática:
 *  - El SW se registra con { updateViaCache: 'none' } en app.js para que el browser
 *    SIEMPRE verifique si sw.js cambió en Netlify, ignorando el HTTP cache del archivo SW.
 *  - Cuando Netlify despliega cambios, este archivo cambia (CACHE_VERSION o cualquier línea),
 *    el browser lo detecta, instala el SW nuevo, y al activarse limpia los caches viejos.
 *  - app.js envía SKIP_WAITING inmediatamente para que el nuevo SW tome control sin esperar.
 *
 * Para forzar una actualización manual al hacer deploy:
 *  → Cambiá CACHE_VERSION a un número mayor.
 */

const CACHE_VERSION = 'v4';
const STATIC_CACHE  = `gastos-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `gastos-dynamic-${CACHE_VERSION}`;

// Assets que se precargan al instalar el SW — permiten uso offline
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/variables.css',
  './css/base.css',
  './css/components.css',
  './css/navigation.css',
  './css/animations.css',
  './css/ranks.css',
  './js/lightbox.js',
  './js/mock-api.js',
  './js/api.js',
  './js/state.js',
  './js/ranks.js',
  './js/animations.js',
  './js/modals.js',
  './js/router.js',
  './js/ui.js',
  './js/app.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-512-maskable.png',
  './assets/icons/Bubble.png',
];

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())   // Activa el nuevo SW sin esperar que todas las pestañas cierren
      .catch(err => {
        console.warn('[SW] Precache parcial (puede pasar en dev):', err.message);
        return self.skipWaiting();
      })
  );
});

// ── Activate: eliminar caches de versiones anteriores ───────────────────────
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== STATIC_CACHE && k !== DYNAMIC_CACHE)
          .map(k => {
            console.log('[SW] Cache eliminado:', k);
            return caches.delete(k);
          })
      ))
      .then(() => self.clients.claim())  // Toma control de todas las pestañas abiertas
  );
});

// ── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // Solo manejar GET
  if (request.method !== 'GET') return;

  // Backend PHP y APIs → nunca cachear
  if (url.pathname.includes('/backend/') || url.pathname.endsWith('.php')) return;

  // Otros esquemas (chrome-extension, etc.)
  if (!url.protocol.startsWith('http')) return;

  // sw.js nunca debe cachearse (el browser lo maneja con updateViaCache: 'none')
  if (url.pathname.endsWith('/sw.js')) return;

  // index.html → Network-First (siempre intenta traer la versión más nueva)
  if (url.pathname === '/' || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/')) {
    e.respondWith(networkFirst(request, DYNAMIC_CACHE));
    return;
  }

  // JS y CSS → Stale-While-Revalidate (rápido + siempre actualizado en background)
  if (url.pathname.match(/\.(js|css)$/)) {
    e.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Imágenes e iconos → Cache-First (cambian poco, optimiza velocidad)
  if (url.pathname.match(/\.(png|svg|jpg|jpeg|webp|ico|woff2?|ttf)$/)) {
    e.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Resto → Network-First con fallback
  e.respondWith(networkFirst(request, DYNAMIC_CACHE));
});

// ── Estrategias de caché ─────────────────────────────────────────────────────

/**
 * Cache-First: sirve del cache; si no está, va a la red y cachea.
 * Ideal para imágenes que cambian raramente.
 */
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Recurso no disponible offline.', { status: 503 });
  }
}

/**
 * Network-First: intenta la red; si falla, cae al cache.
 * Ideal para HTML — garantiza contenido fresco cuando hay conexión.
 */
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    // Fallback SPA: cualquier ruta cae a index.html
    const fallback = await caches.match('./index.html');
    return fallback || new Response('Sin conexión.', { status: 503 });
  }
}

/**
 * Stale-While-Revalidate: sirve del cache inmediatamente Y actualiza en background.
 * Ideal para JS/CSS: carga rápida + siempre actualizado en la siguiente visita.
 */
async function staleWhileRevalidate(request) {
  const cache  = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);

  // Actualizar en background independientemente de si hay cache o no
  const fetchPromise = fetch(request).then(response => {
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => null);

  // Si hay cache, sirve inmediatamente y actualiza en background
  if (cached) return cached;

  // Si no hay cache, espera la red
  const fresh = await fetchPromise;
  return fresh || new Response('Recurso no disponible offline.', { status: 503 });
}

// ── Mensajes desde el cliente ────────────────────────────────────────────────
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
