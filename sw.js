const CACHE_NAME = 'invoice-pwa-v2.0.0';

const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Install: preload app shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
});

// Activate: remove old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
});

// Helpers
function isAppShellRequest(request) {
  const url = new URL(request.url);

  return (
    request.mode === 'navigate' ||
    url.pathname.endsWith('/index.html') ||
    url.pathname.endsWith('/style.css') ||
    url.pathname.endsWith('/app.js') ||
    url.pathname.endsWith('/manifest.json')
  );
}

function isCacheableRequest(request) {
  return request.method === 'GET' && request.url.startsWith(self.location.origin);
}

// Fetch strategy:
// - HTML/CSS/JS/manifest => network first
// - other same-origin files => cache first
self.addEventListener('fetch', event => {
  const { request } = event;

  if (!isCacheableRequest(request)) return;

  if (isAppShellRequest(request)) {
    event.respondWith(
      fetch(request)
        .then(networkResponse => {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          return networkResponse;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || caches.match('./index.html');
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
