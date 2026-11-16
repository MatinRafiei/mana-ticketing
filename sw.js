// Service Worker for Persian In-Company Ticketing App with Web-Push Support
const CACHE_NAME = 'ticketing-v3.0';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './icons/icon.svg',
  './icons/company_logo.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './js/app.js',
  './js/state.js',
  './js/notifications.js',
  './js/icons.js',
  './js/utils/audio.js',
  './js/utils/jalali.js',
  './js/storage/local.js',
  './js/storage/server.js',
  './js/components/navbar.js',
  './js/components/ticketList.js',
  './js/components/ticketModal.js',
  './js/components/ticketDetail.js',
  './js/components/adminTab.js',
  './js/components/profileModal.js',
  './js/components/loginModal.js'
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
  // Do not cache API routes or uploads from server
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/uploads')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
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

// ===================================================================
// Web-Push Event: Handles notifications arriving when app/tab is closed
// ===================================================================
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'تیکتینگ مانا', body: event.data.text() };
    }
  }

  const title = data.title || 'اعلان جدید در سامانه تیکتینگ مانا';
  const options = {
    body: data.body || 'شما یک اعلان جدید دریافت کردید.',
    icon: './icons/icon-192.png',
    badge: './icons/company_logo.png',
    vibrate: [250, 150, 250, 150, 250],
    data: {
      ticketId: data.ticketId || null,
      url: data.url || './'
    },
    dir: 'rtl',
    lang: 'fa',
    tag: data.ticketId ? `ticket-${data.ticketId}` : 'general',
    renotify: true
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ===================================================================
// Notification Click Event: Wakes up window or opens ticket
// ===================================================================
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const ticketId = event.notification.data?.ticketId;
  const targetUrl = event.notification.data?.url || './';

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
        return clients.openWindow(targetUrl);
      }
    })
  );
});
