const CACHE = "abonelik-takip-v1";
self.addEventListener("install", e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(["/","/index.html","/manifest.json","/icon.svg"]))));
self.addEventListener("fetch", e => e.respondWith(caches.match(e.request).then(c => c || fetch(e.request))));
