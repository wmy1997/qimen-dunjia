// 奇门排盘 Service Worker —— 离线缓存应用壳（仅 http(s)/localhost 生效，file:// 不注册）
var CACHE = 'qimen-v8';
var ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './rules.js',
  './vendor/3meta.min.js',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(function (hit) {
      if (hit) return hit;
      return fetch(e.request).then(function (resp) {
        var url = new URL(e.request.url);
        if (resp && resp.status === 200 && url.origin === self.location.origin) {
          var clone = resp.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, clone); });
        }
        return resp;
      });
    })
  );
});
