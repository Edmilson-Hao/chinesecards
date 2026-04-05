const CACHE_NAME = 'mandarim-master-offline-v2';

const ASSETS = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './hsk_data.js',
    './manifest.json',
    './sw.js',
    'https://cdn-icons-png.flaticon.com/512/3898/3898098.png'
];

self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(cached => {
            return cached || fetch(event.request).then(response => {
                return caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, response.clone());
                    return response;
                });
            });
        })
    );
});