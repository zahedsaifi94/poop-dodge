const CACHE_NAME = 'poop-dodge-v2';
const PRECACHE_ASSETS = [
  '/',
  '/manifest.json',
  '/icon.svg',
  '/apple-touch-icon.png',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/sounds/bird.mp3',
];

function isDevModuleRequest(url) {
  return (
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/@') ||
    url.pathname.startsWith('/node_modules/') ||
    url.searchParams.has('t') ||
    url.searchParams.has('v') ||
    url.searchParams.has('import')
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .catch(() => undefined)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then(async (keys) => {
        const oldKeys = keys.filter((k) => k !== CACHE_NAME);
        await Promise.all(oldKeys.map((k) => caches.delete(k)));
        await self.clients.claim();
        if (oldKeys.length > 0) {
          const windowClients = await self.clients.matchAll({ type: 'window' });
          for (const client of windowClients) {
            if ('navigate' in client) {
              client.navigate(client.url).catch(() => undefined);
            }
          }
        }
      })
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isDevModuleRequest(url)) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, clone)).catch(() => undefined);
          return res;
        })
        .catch(() => caches.match('/') || caches.match(request))
    );
    return;
  }

  // Network-first so app updates always appear immediately while preserving offline fallback
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, clone)).catch(() => undefined);
        }
        return res;
      })
      .catch(() => caches.match(request))
  );
});
