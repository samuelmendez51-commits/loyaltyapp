const CACHE_NAME = 'burreria-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/manifest.json',
  '/logo.png',
];

// 1. INSTALACIÓN
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// 2. ACTIVACIÓN
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
});

// 3. ESTRATEGIA DE CARGA
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

// 4. MOTOR DE PUSH (GEOPUSH)
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : { 
    title: 'La Burrería 🤠', 
    body: '¡Estás cerca! Pasa por tus sellos del día.' 
  };

  const options = {
    body: data.body,
    icon: '/logo.png',
    badge: '/logo.png',
    vibrate: [200, 100, 200], // Patrón de vibración: vibrar-pausa-vibrar corregido
     data: { url: '/' }
      };
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// 5. CLICK EN NOTIFICACIÓN
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});