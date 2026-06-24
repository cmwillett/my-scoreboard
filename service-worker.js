const CACHE_NAME = 'my-scoreboard-v0.8.5';

const APP_SHELL = [
  './',
  './index.html',
  './privacy.html',
  './terms.html',
  './manifest.json',
  './src/app.js',
  './src/api.js',
  './src/config.js',
  './src/components/gameCard.js',
  './src/components/golferCard.js',
  './src/components/modal.js',
  './src/components/navBar.js',
  './src/components/pwaInstall.js',
  './src/components/pageTools.js',
  './src/components/scoreCard.js',
  './src/pages/admin.js',
  './src/pages/golfers.js',
  './src/pages/scoreboard.js',
  './src/pages/worldcup.js',
  './src/services/refresh.js',
  './src/services/settings.js',
  './src/services/storage.js',
  './src/utils/date.js',
  './src/styles/main.css',
  './src/styles/cards.css',
  './src/styles/mobile.css',
  './src/styles/scoreboard.css',
  './src/styles/golfers.css',
  './src/styles/worldcup.css',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  // Never cache Apps Script/API responses. Scores should stay fresh.
  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;

      return fetch(request).then(response => {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(request, responseClone);
        });
        return response;
      });
    })
  );
});
