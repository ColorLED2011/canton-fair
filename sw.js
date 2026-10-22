var CACHE = 'canton-v9';
var FILES = ['./', './index.html', './manifest.webmanifest', './jsqr.min.js', './icon-192.png', './icon-512.png', './icon-512-maskable.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return Promise.all(FILES.map(function (f) {
        return fetch(f, { cache: 'reload' }).then(function (r) { if (r && r.ok) return c.put(f, r); }).catch(function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.map(function (k) { return k === CACHE ? null : caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function fresh(req) {
  return fetch(req).then(function (res) {
    if (res && res.ok) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(req, copy); });
    }
    return res;
  });
}

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var url = new URL(e.request.url);
  var isShell = e.request.mode === 'navigate' || /\.(html|webmanifest|js)$/.test(url.pathname) || url.pathname.slice(-1) === '/';
  if (isShell) {
    // network first: the newest version wins, cache is the offline fallback
    e.respondWith(fresh(e.request).catch(function () {
      return caches.match(e.request, { ignoreSearch: true }).then(function (hit) {
        return hit || caches.match('./index.html');
      });
    }));
    return;
  }
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(function (hit) {
      return hit || fresh(e.request).catch(function () { return caches.match('./index.html'); });
    })
  );
});
