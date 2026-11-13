// Abonelik Takip – tek service worker (önbellek + push bildirimleri)
// Sürümü değiştirince eski önbellekler otomatik silinir.
const CACHE = "abonelik-takip-v2";
const PRECACHE = [
  "/",
  "/manifest.json",
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
  "/favicon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Firebase, Google girişi vb. dış istekler ve API'ye hiç dokunma
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  // Sayfa açılışları: önce ağ (her zaman güncel sürüm), çevrimdışıysa önbellek
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put("/", copy));
          return response;
        })
        .catch(() => caches.match("/"))
    );
    return;
  }

  // Derlenmiş dosyalar (/assets/*) ve ikonlar: önce önbellek, yoksa ağdan alıp sakla
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok && (url.pathname.startsWith("/assets/") || PRECACHE.includes(url.pathname))) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
    )
  );
});

self.addEventListener("push", (event) => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const notification = data.notification || {};
  const customData = data.data || {};

  const title = notification.title || customData.title || data.title || "Abonelik Takip";
  const body = notification.body || customData.body || data.body || "Yeni bildirimin var.";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icon-192.png",
      badge: "/badge-96.png",
      tag: "abonelik-takip-reminder",
      renotify: true,
      requireInteraction: true,
      data: {
        url: customData.url || "/",
      },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsArr) => {
      for (const client of clientsArr) {
        if ("focus" in client) return client.focus();
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
