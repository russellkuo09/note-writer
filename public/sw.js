// Flowers for Fighters — Service Worker
// Enables offline note drafting and PWA installability

const CACHE_NAME = 'fff-notes-v1'
const OFFLINE_FALLBACK = '/'

// Assets to cache on install
const PRECACHE_ASSETS = [
  '/',
  '/impact',
  '/manifest.json',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  // Only cache GET requests
  if (event.request.method !== 'GET') return

  // Don't cache API calls or Supabase requests
  const url = new URL(event.request.url)
  if (
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('supabase') ||
    url.hostname.includes('anthropic')
  ) {
    return
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached
      return fetch(event.request)
        .then((response) => {
          // Cache successful navigation requests
          if (response.ok && event.request.mode === 'navigate') {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
          }
          return response
        })
        .catch(() => {
          // Offline fallback for navigation
          if (event.request.mode === 'navigate') {
            return caches.match(OFFLINE_FALLBACK)
          }
        })
    })
  )
})
