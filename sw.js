const CACHE_NAME = 'invoice-pwa-v2.4.5';

const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Install: preload ONLY this version's app shell into this version's cache
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  // აქ intentionally skipWaiting არ არის
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
    url.pathname.endsWith('/icon-192.png') ||
    url.pathname.endsWith('/icon-512.png')
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

        // fallback for navigation aliases like "/" -> "./index.html"
        if (request.mode === 'navigate') {
          const fallbackIndex = await cache.match('./index.html');
          if (fallbackIndex) return fallbackIndex;
        }

        // only if something was not precached for some reason
        return fetch(request);
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;

      return fetch(request).then(networkResponse => {
        const copy = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
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
