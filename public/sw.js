// install infrared as a pwa
const cachename = 'infrared-cache-v0.1.5'

const cachefiles = [
  '/',
  '/beta',
  '/offline.html',
  '/manifest.json',
  '/favicon.ico',
  '/script.js',
  '/style/style.css',
  'https://pikid71.me/infraredassets/',
]

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(cachename).then((cache) => {
            return cache.addAll(cachefiles)
        })
    )
    event.skipWaiting()
})

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== cachename) {
                        return caches.delete(cacheName)
                    }
                })
            )
        })
    )
    event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(() => {
                return caches.open(cachename).then((cache) => {
                    return cache.match('/offline.html')
                })
            })
        )
    } else {
        event.respondWith(
            caches.match(event.request).then((response) => {
                return response || fetch(event.request)
            })
        )
    }
})