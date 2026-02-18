// Путь: frontend/public/service-worker.js
// Назначение: "анти-PWA" service worker, чтобы он попадал в build при сборке.
//             Нужен для предотвращения "залипания" старых версий фронта у пользователей.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch (e) {}

    try {
      await self.registration.unregister();
    } catch (e) {}

    try {
      await self.clients.claim();
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of clients) {
        try { c.navigate(c.url); } catch (e) {}
      }
    } catch (e) {}
  })());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
