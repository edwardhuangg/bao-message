// Minimal service worker: enables installability; network-first, no caching
// of API/auth traffic. Offline support can grow in a later phase.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
