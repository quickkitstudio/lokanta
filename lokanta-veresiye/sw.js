// Uygulamalar için basit servis çalışanı:
// her zaman önce internetten en güncel dosyayı alır, internet yoksa son kopyayı açar.
// Bildirime dokunulunca ilgili uygulamayı açar.
const ONBELLEK = 'veresiye-v2';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(
  caches.keys()
    .then(l => Promise.all(l.filter(a => a !== ONBELLEK).map(a => caches.delete(a))))
    .then(() => self.clients.claim())
));

self.addEventListener('fetch', e => {
  const istek = e.request;
  if (istek.method !== 'GET' || new URL(istek.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(istek)
      .then(yanit => {
        if (yanit.ok) {
          const kopya = yanit.clone();
          caches.open(ONBELLEK).then(c => c.put(istek, kopya));
        }
        return yanit;
      })
      .catch(() => caches.match(istek, { ignoreSearch: true }))
  );
});

// Bildirime dokunulduğunda: açık pencere varsa öne getir, yoksa yeni pencere aç
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const veri = e.notification.data || {};
  const hedef = new URL(veri.url || './', self.registration.scope);
  const sayfa = hedef.pathname.replace(/\/index\.html$/, '/');
  e.waitUntil((async () => {
    const pencereler = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const p of pencereler) {
      const yol = new URL(p.url).pathname.replace(/\/index\.html$/, '/');
      if (yol === sayfa) {
        if (veri.hedef) p.postMessage({ hedef: veri.hedef });
        return p.focus();
      }
    }
    return self.clients.openWindow(hedef.href);
  })());
});
