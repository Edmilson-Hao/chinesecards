/* 4. SERVICE WORKER PARA OFFLINE (Stale-While-Revalidate) */
const CACHE_NAME = 'mandarim-v2-ebbinghaus';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/lz-string/1.4.4/lz-string.min.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse.clone()));
        return networkResponse;
      });
      return cachedResponse || fetchPromise;
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/'));
});