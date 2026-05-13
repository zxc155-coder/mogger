/* MOGGER offline service worker — network-first for HTML, cache-first for assets */
const CACHE = 'mogger-v18';
const ASSETS = [
  './',
  './index.html',
  './sw.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

function isHTMLRequest(req){
  if (req.mode === 'navigate') return true;
  const a = req.headers.get('accept') || '';
  return a.includes('text/html');
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const sameOrigin = new URL(req.url).origin === self.location.origin;

  // Network-first for HTML so deploys land immediately on reload
  if (isHTMLRequest(req)) {
    e.respondWith(
      fetch(req).then((res) => {
        if (res && res.ok && sameOrigin) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => caches.match(req).then((c) => c || caches.match('./index.html')))
    );
    return;
  }

  // Stale-while-revalidate for everything else
  e.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok && sameOrigin) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached || caches.match('./index.html'));
      return cached || network;
    })
  );
});
