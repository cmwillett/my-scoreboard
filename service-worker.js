const CACHE_NAME = 'my-scoreboard-v1.4.19';

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
  './src/components/pickEmsSummary.js',
  './src/pages/admin.js',
  './src/pages/addgame.js',
  './src/pages/golfers.js',
  './src/pages/myPicks.js',
  './src/pages/scoreboard.js',
  './src/pages/worldcup.js',
  './src/services/refresh.js',
  './src/services/settings.js',
  './src/services/storage.js',
  './src/userData.js',
  './src/utils/date.js',
  './src/utils/pickEms.js',
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
        // looks fresh, independent of anything CACHE_NAME does.
        // `cache: 'reload'` forces every shell file to bypass the HTTP cache
        // and hit the network for real, every time a new CACHE_NAME triggers
        // this install step. (A v1.4.15 bolding report was originally
        // suspected to be this exact bug hitting pickEmsSummary.js - it
        // turned out the bolding was rendering correctly the whole time, but
        // that file was ALSO found to be missing from this list entirely at
        // the time, which would have left it exposed to this same gap via
        // the plain, non-`reload` fetch in the runtime handler below on its
        // very first post-install request. Both gaps are closed as of
        // v1.4.19: this file (plus a few others that were similarly
        // missing) is precached here now, and the runtime handler below
        // also uses `cache: 'reload'` on a cache miss, so neither an
        // omitted-from-the-list file nor a future one added without
        // remembering to list it here can go stale this way again.)
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

      // Same reasoning as the install handler above: a plain fetch() here
      // can still be satisfied from the browser's own HTTP cache. This path
      // only runs once per file per CACHE_NAME (after that, the line above
      // serves it from Cache Storage), but that one time matters - it's
      // exactly how a file missing from APP_SHELL (or added later without
      // remembering to list it there) could go stale independent of
      // anything CACHE_NAME does.
      return fetch(request, { cache: 'reload' }).then(response => {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(request, responseClone);
        });
        return response;
      });
    })
  );
});
