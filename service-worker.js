const CACHE = 'gomba-overdrive-v0.9.13';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './game.js',
  './phaser-fx.js',
  './manifest.json',
  './assets/gomba-mascot.png',
  './assets/ui/cabinet-skin.jpg',
  './assets/reference/v09/03_cabinet_skin_production.png',
  './assets/vendor/phaser.min.js',
  './assets/vendor/gsap.min.js',
  './assets/vo/nice.mp3',
  './assets/vo/great.mp3',
  './assets/vo/amazing.mp3',
  './assets/vo/excellent.mp3',
  './assets/vo/unstoppable.mp3',
  './assets/vo/overdrive.mp3'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE).map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const request = event.request;
  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;
  const freshFirst = request.mode === 'navigate' || (sameOrigin && ['document', 'script', 'style'].includes(request.destination));

  if (freshFirst) {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then(cached => cached || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(request, copy));
        return response;
      });
    })
  );
});
