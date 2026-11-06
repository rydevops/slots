// Gem Royale service worker. VERSION is set by tools/bump-version.js; changing it renames the offline cache.
const VERSION = '1.6.0';
const CACHE = 'gem-royale-' + VERSION;
const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/style.css?v=' + VERSION,
  'js/engine.js?v=' + VERSION,
  'js/update.js?v=' + VERSION,
  'js/app.js?v=' + VERSION,
  'assets/machine-0.webp?v=' + VERSION,
  'assets/machine-1.webp?v=' + VERSION,
  'assets/machine-2.webp?v=' + VERSION,
  'assets/machine-3.webp?v=' + VERSION,
  'assets/gems.webp',
  'assets/bg.jpg',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
];
['settings', 'info', 'sound', 'spin', 'minus', 'plus', 'full'].forEach(n => SHELL.push(`assets/btn/${n}.webp`));
[0, 1, 2, 3].forEach(i => SHELL.push(`assets/start/bg-${i}.webp?v=${VERSION}`, `assets/start/title-${i}.webp?v=${VERSION}`));

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
