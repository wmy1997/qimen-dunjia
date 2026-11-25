// 六爻 · 奇门排盘 Service Worker —— 离线缓存应用壳（仅 http(s)/localhost 生效，file:// 不注册）
// 版本号每次发布必须递增：它决定缓存目录名，也是“是否已更新”的判据
var CACHE = 'qimen-v20';
var ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './rules.js',
  './liuyao.js',
  './vendor/liuyao.min.js',
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

self.addEventListener('message', function (e) {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
  if (e.data === 'VERSION' && e.source) e.source.postMessage({ type: 'VERSION', version: CACHE });
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 跨域（如 API）直接走网络

  // 页面导航：网络优先，保证一打开就是最新版；离线时回落缓存
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function (resp) {
        if (resp && resp.status === 200) {
          var clone = resp.clone();
          caches.open(CACHE).then(function (c) { c.put('./index.html', clone); });
        }
        return resp;
      }).catch(function () {
        return caches.match('./index.html').then(function (hit) {
          return hit || caches.match('./');
        });
      })
    );
    return;
  }

  // 静态资源：缓存优先 + 后台静默更新（下次打开即新）
  e.respondWith(
    caches.match(req).then(function (hit) {
      var net = fetch(req).then(function (resp) {
        if (resp && resp.status === 200) {
          var clone = resp.clone();
          caches.open(CACHE).then(function (c) { c.put(req, clone); });
        }
        return resp;
      }).catch(function () { return hit; });
      return hit || net;
    })
  );
});
