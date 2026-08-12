/* ══════════════════════════  The Counter — service worker  ══════════════════════════
   Offline-first. Precache the app shell; cache-first for same-origin assets so the
   whole app (and later the bundled OCR engine) runs with no signal in the store. */
const CACHE = "counter-v4";

const SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./scan.js",
  "./lib/ocr.js",
  "./lib/cloud.js",
  "./manifest.webmanifest",
  "./fonts/bebas-neue-400.woff2",
  "./fonts/libre-franklin-400.woff2",
  "./fonts/libre-franklin-600.woff2",
  "./fonts/libre-franklin-700.woff2",
  "./fonts/libre-franklin-800.woff2",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // resilient precache: a single missing optional file must not fail install
    await Promise.allSettled(SHELL.map(u => cache.add(new Request(u, { cache: "reload" }))));
    self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if(req.method !== "GET") return;
  const url = new URL(req.url);
  if(url.origin !== self.location.origin) return; // let cross-origin pass through

  event.respondWith((async () => {
    const cached = await caches.match(req, { ignoreSearch: false });
    if(cached) return cached;
    try{
      const res = await fetch(req);
      // runtime-cache successful same-origin GETs (fonts, ocr assets, etc.)
      if(res && res.status === 200 && res.type === "basic"){
        const cache = await caches.open(CACHE);
        cache.put(req, res.clone());
      }
      return res;
    }catch(e){
      // offline navigation fallback → app shell
      if(req.mode === "navigate"){
        const shell = await caches.match("./index.html");
        if(shell) return shell;
      }
      throw e;
    }
  })());
});
