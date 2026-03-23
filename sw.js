const CACHE_NAME = 'invoice-pwa-v2.8.5';

const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-192-maskable.png',
  './icons/icon-512-maskable.png'
];

// Install: preload ONLY this version's app shell into this version's cache
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  // intentionally no skipWaiting here
});

// Activate: remove old caches only after this SW becomes active
self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      caches.keys().then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
        )
      ),
      self.clients.claim()
    ])
  );
});

// Helpers
function isAppShellRequest(request) {
  const url = new URL(request.url);

  return (
    request.mode === 'navigate' ||
    url.pathname.endsWith('/') ||
    url.pathname.endsWith('/index.html') ||
    url.pathname.endsWith('/style.css') ||
    url.pathname.endsWith('/app.js') ||
    url.pathname.endsWith('/manifest.json') ||
    url.pathname.endsWith('/icons/icon-192.png') ||
    url.pathname.endsWith('/icons/icon-512.png') ||
    url.pathname.endsWith('/icons/icon-192-maskable.png') ||
    url.pathname.endsWith('/icons/icon-512-maskable.png')
  );
}

function isCacheableRequest(request) {
  return request.method === 'GET' && request.url.startsWith(self.location.origin);
}

// Fetch strategy:
// APP SHELL => CACHE ONLY from active SW cache
// other same-origin files => cache first, then network fallback
self.addEventListener('fetch', event => {
  const { request } = event;

  if (!isCacheableRequest(request)) return;

  if (isAppShellRequest(request)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async cache => {
        const cached = await cache.match(request);

        if (cached) return cached;

        if (request.mode === 'navigate') {
          const fallbackIndex = await cache.match('./index.html');
          if (fallbackIndex) return fallbackIndex;
        }

        return fetch(request);
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;

      return fetch(request).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return networkResponse;
      });
    })
  );
});

// Activate waiting SW only after user confirms update
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
