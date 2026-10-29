/* Service worker do app Micro no Controle: funciona sem internet.
   Rede primeiro (para pegar atualizações), cópia guardada quando estiver offline. */
var CACHE = 'mnc-app-v1';
var ARQUIVOS = ['./', './index.html', './app.js', './pix.js', './ifood.js', './vendor/qrcode.js', '../auditoria-maquininha/motor.js', './manifest.webmanifest', './icone-192.png', './icone-512.png', '../img/favicon.svg'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ARQUIVOS); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  var mesmo = url.origin === self.location.origin;
  var fonte = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname) || /cdnjs\.cloudflare\.com$/.test(url.hostname);
  if (!mesmo && !fonte) return;
  e.respondWith(
    fetch(req).then(function (res) {
      if (res && (res.ok || res.type === 'opaque')) { var copia = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copia); }); }
      return res;
    }).catch(function () {
      return caches.match(req, { ignoreSearch: true }).then(function (r) { return r || (req.mode === 'navigate' ? caches.match('./index.html') : undefined); });
    })
  );
});
