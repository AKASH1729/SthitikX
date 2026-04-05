/* ===============================
   GEO TRACK PWA SERVICE WORKER
   =============================== */

const CACHE_NAME = 'geotrack-v1';

// Core files (keep minimal to avoid break issues)
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

/* ===============================
   INSTALL
   =============================== */
self.addEventListener('install', (event) => {
  console.log('✅ SW Installed');

  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

/* ===============================
   ACTIVATE
   =============================== */
self.addEventListener('activate', (event) => {
  console.log('✅ SW Activated');

  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    })
  );

  self.clients.claim();
});

/* ===============================
   FETCH (CACHE + NETWORK)
   =============================== */
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // 🚫 Skip non-GET requests
  if (request.method !== 'GET') return;

  // 🚫 Skip API calls (always network)
  if (request.url.includes('/api/')) {
    event.respondWith(fetch(request));
    return;
  }

  // ✅ Cache-first + update cache
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request)
        .then((response) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, response.clone());
            return response;
          });
        })
        .catch(() => {
          // Optional fallback (offline page if needed)
          return caches.match('/index.html');
        });
    })
  );
});

/* ===============================
   BACKGROUND SYNC
   =============================== */
self.addEventListener('sync', (event) => {
  if (event.tag === 'location-sync') {
    console.log('🔄 Background Sync Triggered');
    event.waitUntil(syncPendingLocations());
  }
});

async function syncPendingLocations() {
  try {
    // TODO: Replace with IndexedDB logic
    console.log('📡 Syncing stored locations...');

    // Example placeholder
    // const locations = await getLocationsFromDB();
    // await fetch('/api/location', { method: 'POST', body: JSON.stringify(locations) });

  } catch (err) {
    console.error('❌ Sync failed:', err);
  }
}

/* ===============================
   PUSH NOTIFICATIONS
   =============================== */
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};

  const options = {
    body: data.body || 'New notification',
    icon: '/icons/icon-192.png',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/',
    },
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'GeoTrack Alert', options)
  );
});

/* ===============================
   NOTIFICATION CLICK
   =============================== */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === event.notification.data.url && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow(event.notification.data.url);
    })
  );
});