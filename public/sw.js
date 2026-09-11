/* Detailing Sanctuary Central - service worker (offline cache + push). Plain JS, no build step. */
const VERSION = "dsc-v1";
const STATIC_CACHE = `${VERSION}-static`;
const PAGE_CACHE = `${VERSION}-pages`;
const API_CACHE = `${VERSION}-api`;
const IMG_CACHE = `${VERSION}-img`;

const PRECACHE = ["/offline", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/badge-96.png"];
const CACHED_APIS = ["/api/schedule", "/api/weather", "/api/pricing", "/api/gallery", "/api/status", "/api/stock"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => Promise.allSettled(PRECACHE.map((u) => cache.add(u))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(request, cacheName, fallbackPath) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    if (res && res.ok && !res.redirected) cache.put(request, res.clone());
    return res;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (fallbackPath) {
      const fb = await caches.match(fallbackPath);
      if (fb) return fb;
    }
    throw err;
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res && res.ok) cache.put(request, res.clone());
  return res;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.origin !== self.location.origin) {
    // Gallery images from Supabase storage.
    if (req.destination === "image") event.respondWith(cacheFirst(req, IMG_CACHE));
    return;
  }

  if (url.pathname.startsWith("/api/auth") || url.pathname.startsWith("/api/cron")) return;

  if (req.mode === "navigate") {
    event.respondWith(networkFirst(req, PAGE_CACHE, "/offline"));
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    if (CACHED_APIS.includes(url.pathname)) event.respondWith(networkFirst(req, API_CACHE));
    return;
  }

  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/demo/") ||
    req.destination === "image" ||
    req.destination === "font"
  ) {
    event.respondWith(cacheFirst(req, STATIC_CACHE));
  }
});

/* Push: FCM delivers { notification?, data?, fcmOptions? } as JSON. We always show something. */
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { data: { title: "DS Central", body: event.data ? event.data.text() : "" } };
  }
  const n = payload.notification || {};
  const d = payload.data || {};
  const title = n.title || d.title || "DS Central";
  const body = n.body || d.body || "";
  const url = d.url || (payload.fcmOptions && payload.fcmOptions.link) || "/";
  const tag = d.tag || "dsc";
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      tag,
      renotify: true,
      vibrate: [200, 100, 200],
      requireInteraction: tag === "rain-alert",
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});
