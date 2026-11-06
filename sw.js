// Gem Royale service worker. __BUILD__ is replaced at deploy time.
const VERSION = '__BUILD__';
const CACHE = 'gem-royale-' + VERSION;
const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/style.css?v=' + VERSION,
  'js/engine.js?v=' + VERSION,
  'js/update.js?v=' + VERSION,
  'js/app.js?v=' + VERSION,
  'assets/machine.jpg?v=' + VERSION,
  'assets/gems.webp',
  'assets/bg.jpg',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' }))))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // Version file: always straight from the network.
  if (url.pathname.endsWith('/version.json')) return;

  // Pages: network first (revalidated), fall back to cached shell when offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' })
        .then(res => { putCopy('./', res); return res; })
        .catch(() => caches.match('./').then(r => r || caches.match('index.html')))
    );
    return;
  }

  // Everything else: network first with revalidation, cache fallback.
  event.respondWith(
    fetch(req, { cache: 'no-cache' })
      .then(res => { putCopy(req, res); return res; })
      .catch(() => caches.match(req))
  );
});

function putCopy(key, res) {
  if (!res || !res.ok || res.type === 'opaque') return;
  const copy = res.clone();
  caches.open(CACHE).then(c => c.put(key, copy)).catch(() => {});
}
