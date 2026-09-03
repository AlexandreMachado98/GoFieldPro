// Service Worker for GoField Pro PWA
// Build-Timestamp: 1787920722959
const CACHE_NAME = 'gofield-pro-build-1788470204484';
const OFFLINE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/version.json',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png'
];

// Install: Pre-cache core shell and activate immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(OFFLINE_URLS).catch((err) => {
        console.warn('SW pre-cache non-fatal warning:', err);
      });
    })
  );
});

// Activate: Immediately claim clients and delete ALL previous outdated caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME && !key.startsWith('geofield_offline_tiles')) {
            console.log('[SW] Purgando cache antigo:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Listen for explicit SKIP_WAITING or CHECK_VERSION commands from client
self.addEventListener('message', (event) => {
  if (event.data && (event.data.type === 'SKIP_WAITING' || event.data === 'SKIP_WAITING')) {
    self.skipWaiting();
  }
});

// Fetch Interception with Network-First for HTML/Version and Cache-First for Hashed Assets
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Ignore chrome extension & non-http schemes
  if (url.protocol.startsWith('chrome-extension') || !url.protocol.startsWith('http')) return;

  // Firebase/Firestore/Google Auth/APIs should never be cached by SW
  if (
    url.hostname.includes('firebase') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('firestore') ||
    url.hostname.includes('identitytoolkit') ||
    url.hostname.includes('asaas')
  ) {
    return;
  }

  // Version.json & SW itself: Always Network ONLY with no-store
  if (url.pathname === '/version.json' || url.pathname === '/sw.js') {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).catch(() => {
        return caches.match('/version.json') || new Response(JSON.stringify({ version: 'offline' }));
      })
    );
    return;
  }

  // Navigation & HTML (index.html): Network-First with offline cache fallback
  if (event.request.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-cache' })
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const resClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match('/index.html') || caches.match('/');
        })
    );
    return;
  }

  // Static Assets (Hashed JS, CSS, Images, Fonts): Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const resClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
          }
          return networkResponse;
        })
        .catch(() => {});

      return cachedResponse || fetchPromise;
    })
  );
});
