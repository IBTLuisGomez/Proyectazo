const CACHE_NAME = 'nexus-orb-v3.19';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './favicon.svg',
  './assets/tailwind.css',
  './assets/contraste.css',
  './assets/tema-claro.css',
  './js/errores.js',
  './js/idb-store.js',
  './js/smoke-palette.js',
  './js/clasificador-reglas.js',
  './js/captura-parser.js',
  './js/notas-core.js',
  './js/foco-core.js',
  './js/pasos-core.js',
  './js/energia-core.js',
  './js/modulos-core.js',
  './js/orb-shader-engine.js',
  './js/app.js',
  './js/app/views/ahora-hoy.js',
  './js/app/views/soltar.js',
  './js/app/views/mas.js',
  './js/app/views/repasar.js',
  './js/app/views/notas.js',
  './js/app/views/hacer.js',
  './js/app/features/modos-foco.js',
  './js/app/features/ia-nexus.js',
  './js/app/features/correo-push.js',
  './js/app/views/bitacora-radar.js',
  './js/app/features/crud.js',
  './js/app/views/tareas.js',
  './js/app/features/temporizador.js',
  './js/app/ui/modales-ajustes.js',
  './js/app/views/lienzo.js',
  './js/app/features/movil.js',
  './js/app/features/captura.js',
  './js/app/ui/contraste.js',
  './js/app/features/fechas.js',
  './js/app/features/jarvis.js',
  './js/app/features/acompanamiento.js',
  './js/app/features/pasos.js',
  './js/app/features/energia.js',
  './js/app/features/modulos.js',
  './js/app/modulos/habitos.js',
  './js/app/modulos/personas.js',
  './js/app/modulos/finanzas.js',
  './js/app/ui/acciones.js',
  './js/app/ui/html.js',
  './assets/nexus_n.jpg',
  './assets/nexus_n_banner.jpg',
  './assets/nexus_core.jpg',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon-maskable.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  // Ignore API requests and video media streaming in cache
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/nexus') || url.pathname.endsWith('.mp4')) {
    return;
  }

  // Red primero para el HTML, el código de la app y el CSS: deben ir siempre en la misma versión
  const isDocument = event.request.mode === 'navigate'
    || url.pathname.endsWith('.html')
    || url.pathname.endsWith('/')
    || url.pathname.includes('/js/')
    || url.pathname.endsWith('/tailwind.css');
  if (isDocument) {
    event.respondWith(
      fetch(event.request).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return networkResponse;
      }).catch(() => caches.match(event.request).then(cached => cached || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }
      return fetch(event.request).catch(() => caches.match('./index.html'));
    })
  );
});

// Soporte de Notificaciones del Sistema (PC y Móvil)
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) ? event.notification.data.url : './index.html';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (let client of windowClients) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

self.addEventListener('push', event => {
  if (event.data) {
    try {
      const data = event.data.json();
      event.waitUntil(
        self.registration.showNotification(data.title || 'Nexus Orb', {
          body: data.body || 'Recordatorio de enfoque',
          icon: './assets/logo_icon_sin_bk.png',
          badge: './favicon.svg',
          data: data.data || { url: './index.html' }
        })
      );
    } catch (e) {
      event.waitUntil(
        self.registration.showNotification('Nexus Orb', {
          body: event.data.text(),
          icon: './assets/logo_icon_sin_bk.png'
        })
      );
    }
  }
});
