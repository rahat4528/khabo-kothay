const CACHE_NAME = 'khabo-kothay-v1.3';
const APP_SHELL = [
  '/',
  '/index.html',
  '/download.html',
  '/css/theme.css',
  '/css/style.css',
  '/css/download.css',
  '/js/theme-init.js',
  '/js/app.js',
  '/js/api.js',
  '/js/escape.js',
  '/js/filter-ui.js',
  '/js/group-planner.js',
  '/js/i18n.js',
  '/js/map.js',
  '/js/meal-estimator.js',
  '/js/mealtime-ui.js',
  '/js/mood-ui.js',
  '/js/state.js',
  '/js/storage.js',
  '/js/taste-ui.js',
  '/js/ui.js',
  '/js/download-page.js',
  '/favicon.svg',
  '/favicon-192.png',
  '/favicon-512.png',
  '/manifest.webmanifest'
];

// Only these API responses are kept for offline use. Caching every GET (photos, weather
// per coordinate, admin/bandit data) grew the cache without bound.
const CACHEABLE_API = new Set(['/api/config']);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((k) => {
          if (k !== CACHE_NAME) {
            return caches.delete(k);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Network-first for everything: users always get the current app shell when online
// (cache-first kept serving old JS until CACHE_NAME was bumped), with the cache as the
// offline fallback.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const isApi = url.origin === self.location.origin && url.pathname.startsWith('/api/');
  const shouldCache = !isApi || CACHEABLE_API.has(url.pathname);

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && shouldCache) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (!isApi) return Response.error();
        return new Response(
          JSON.stringify({
            error: 'Offline mode',
            message: 'You are currently offline. Please check your internet connection or use cached places.'
          }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      })
  );
});
