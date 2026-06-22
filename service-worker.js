// service-worker.js
const CACHE_NAME = 'mandarim-srs-v1';

// Lista oficial com a estrutura correta dos seus arquivos estáticos
const urlsToCache = [
  './',
  './index.html',
  './js/app.js',
  './js/storage.js',
  './js/scheduler.js',
  './js/flashcards.js',
  './js/management.js',
  './js/statistics.js',
  './js/importExport.js',
  './js/router.js',
  './js/audio.js'
];

// Instalação do Service Worker e criação do Cache
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Cache aberto com sucesso. Armazenando arquivos estruturados...');
        // Usamos urlsToCache diretamente, eliminando o erro de "ASSETS is not defined"
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// Ativação e limpeza de caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Limpando cache antigo:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Interceptação de requisições para funcionamento Offline
self.addEventListener('fetch', (event) => {
  // Ignora requisições de ferramentas como Live Server ou extensões
  if (!event.request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response; // Retorna do cache se encontrar
        }
        return fetch(event.request); // Se não encontrar, busca na rede
      })
  );
});