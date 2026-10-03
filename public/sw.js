const CACHE = 'commonhour-v1.0.0';
const ASSETS = ['./', './index.html', './css/styles.css', './js/app.js', './js/time.js',
  './js/zones.js', './js/storage.js', './js/export.js', './manifest.webmanifest',
  './icons/favicon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png'];
const assetURLs = new Set(ASSETS.map(path => new URL(path, self.location).href));
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('commonhour-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  const normalized = new URL(event.request.url); normalized.search = ''; normalized.hash = '';
  if (!assetURLs.has(normalized.href)) return;
  // Network-first ensures fresh code. The complete versioned cache is the offline fallback.
  event.respondWith(fetch(event.request).catch(async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(normalized.href);
    return cached || new Response('Reconnect to load this file.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  }));
});
