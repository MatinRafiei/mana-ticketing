// Service Worker for Persian In-Company Ticketing App
const CACHE_NAME = 'ticketing-v1.2';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './icons/icon.svg',
  './js/app.js',
  './js/state.js',
  './js/notifications.js',
  './js/icons.js',
  './js/utils/audio.js',
  './js/utils/jalali.js',
  './js/storage/local.js',
  './js/storage/gdrive.js',
  './js/components/navbar.js',
  './js/components/ticketList.js',
  './js/components/ticketModal.js',
  './js/components/ticketDetail.js',
  './js/components/adminTab.js',
  './js/components/settingsModal.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('Caching partial assets on install:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Network first, falling back to cache
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Cache successful responses
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => caches.match(event.request))
  );
});

// Handle Background Push Notifications
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const ticketId = event.notification.data?.ticketId;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          client.focus();
          if (ticketId) {
            client.postMessage({ type: 'OPEN_TICKET', ticketId });
          }
          return;
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('./index.html' + (ticketId ? `?ticket=${ticketId}` : ''));
      }
    })
  );
});
