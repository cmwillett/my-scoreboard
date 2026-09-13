const CACHE_NAME = 'my-scoreboard-v1.4.17';

const APP_SHELL = [
  './',
  './index.html',
  './privacy.html',
  './terms.html',
  './manifest.json',
  './src/app.js',
  './src/api.js',
  './src/config.js',
  './src/firebase.js',
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
      .then(cache => Promise.all(
        // cache.addAll(APP_SHELL) looks like it forces a fresh network
        // fetch for every file, but it doesn't - it uses default fetch
        // semantics, which can still be satisfied from the BROWSER's own
        // HTTP cache (a layer entirely separate from this Cache Storage
        // API) if that file's Cache-Control/ETag from GitHub Pages still
        // looks fresh. That's exactly how one file (pickEmsSummary.js) came
        // back stale in a v1.4.15 install while others in the same deploy
        // (like config.js, which is why the version badge itself updated
        // correctly) happened to have already-expired HTTP cache entries -
        // each file's staleness was independent luck, not tied to
        // CACHE_NAME at all. `cache: 'reload'` forces every shell file to
        // bypass the HTTP cache and hit the network for real, every time a
        // new CACHE_NAME triggers this install step.
        APP_SHELL.map(url =>
          fetch(url, { cache: 'reload' }).then(response => cache.put(url, response))
        )
      ))
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
