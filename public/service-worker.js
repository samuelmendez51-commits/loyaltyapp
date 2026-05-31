const CACHE_NAME = 'loyaltyclub-v3';
const CACHE_STATIC = 'loyaltyclub-static-v3';
const OFFLINE_URL = '/';

const ASSETS_STATIC = [
  '/',
  '/manifest.json',
  '/logo.png',
  '/apple-wallet.svg',
  '/google-wallet.svg',
];

// ── INSTALACIÓN ──────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_STATIC).then((cache) => {
      return cache.addAll(ASSETS_STATIC);
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVACIÓN ───────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== CACHE_STATIC)
          .map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// ── ESTRATEGIA DE FETCH ──────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Ignorar requests que no son GET
  if (event.request.method !== 'GET') return;

  // Para Supabase y APIs externas: Network-first con fallback a cache
  if (url.hostname.includes('supabase.co') || url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Guardar en cache solo las respuestas exitosas
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
          return response;
        })
        .catch(() => {
          // Sin red: intentar desde cache
          return caches.match(event.request) || new Response(
            JSON.stringify({ error: 'Sin conexión - datos en caché no disponibles' }),
            { headers: { 'Content-Type': 'application/json' } }
          );
        })
    );
    return;
  }

  // Para assets estáticos (_next, imágenes, CSS): Cache-first
  if (
    url.pathname.startsWith('/_next/') ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|ico|woff|woff2|css|js)$/)
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_STATIC).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Para páginas de la app: Network-first (siempre frescas)
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request) || caches.match(OFFLINE_URL);
      })
  );
});

// ── PUSH NOTIFICATIONS ───────────────────────────────────────────
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {
    title: 'LoyaltyClub 🏆',
    body: '¡Tienes una actualización importante!'
  };

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/logo.png',
      badge: '/logo.png',
      vibrate: [200, 100, 200],
      data: { url: data.url || '/' },
      actions: [
        { action: 'open', title: 'Ver ahora' },
        { action: 'close', title: 'Ignorar' }
      ]
    })
  );
});

// ── CLICK EN NOTIFICACIÓN ─────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'close') return;
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      const url = event.notification.data?.url || '/';
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

// ── BACKGROUND SYNC (para sellos offline) ────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-sellos-pendientes') {
    event.waitUntil(
      // Al recuperar conexión, la app manejará la sincronización vía Supabase Realtime
      console.log('[SW] Background sync: sellos pendientes')
    );
  }
});