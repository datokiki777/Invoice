// SW VERSION 4.3
const CACHE_NAME = 'invoice-pwa-v4.4';

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

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      await cache.addAll(APP_SHELL);
    })
  );
  // no skipWaiting here on purpose
});

self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();

      await Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      );

      await self.clients.claim();
    })()
  );
});

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

self.addEventListener('fetch', event => {
  const { request } = event;

  if (!isCacheableRequest(request)) return;

  if (isAppShellRequest(request)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async cache => {
        const cached = await cache.match(request);
        if (cached) return cached;

        try {
          const networkResponse = await fetch(request);
          return networkResponse;
        } catch (err) {
          if (request.mode === 'navigate') {
            const fallbackIndex = await cache.match('./index.html');
            if (fallbackIndex) return fallbackIndex;
          }
          throw err;
        }
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(async cached => {
      if (cached) return cached;

      const networkResponse = await fetch(request);

      if (networkResponse && networkResponse.status === 200) {
        const copy = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
      }

      return networkResponse;
    })
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
