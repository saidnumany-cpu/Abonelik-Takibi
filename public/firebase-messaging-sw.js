self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch (error) {
    data = {};
  }

  const title =
    data?.notification?.title ||
    data?.title ||
    "Abonelik Takip";

  const body =
    data?.notification?.body ||
    data?.body ||
    "Yeni bildirimin var.";

  const options = {
    body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: {
      url: "/"
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    self.clients.openWindow("/")
  );
});
