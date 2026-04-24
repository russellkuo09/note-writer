// Flowers for Fighters — Service Worker v3
// Strategy:
//   - HTML pages (navigations): NETWORK ONLY — never cache, always fetch fresh
//     so deploys are picked up immediately on next visit.
//   - Next.js static chunks (/_next/static/): cache-first — these have
//     content-hashed filenames so they are safe to cache forever.
//   - Everything else: network only (API, Supabase, etc.)

const STATIC_CACHE = 'fff-static-v3'

self.addEventListener('install', (event) => {
  // No pre-caching of HTML — skip waiting so the new SW activates immediately
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  // Delete all old caches (v1, v2, and any other names)
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== STATIC_CACHE)
          .map((name) => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  const url = new URL(event.request.url)

  // ── Next.js immutable static assets: cache-first ──────────────────────────
  // These filenames contain a content hash (e.g. /_next/static/chunks/abc123.js)
  // so it is safe to serve them from cache indefinitely.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) =>
        cache.match(event.request).then((cached) => {
          if (cached) return cached
          return fetch(event.request).then((response) => {
            if (response.ok) cache.put(event.request, response.clone())
            return response
          })
        })
      )
    )
    return
  }

  // ── Everything else (HTML pages, API, Supabase): network only ─────────────
  // Never cache HTML — always fetch from network so updates land immediately.
})
