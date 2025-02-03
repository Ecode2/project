// public/service-worker.js
self.addEventListener('install', (event) => {
    console.log('Service Worker installing.');
  });
  
self.addEventListener('activate', (event) => {
    console.log('Service Worker activated.');
  });

self.addEventListener('push', (event) => {
    const options = {
      body: event.data.text(),
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge.png',
      vibrate: [100, 50, 100]
    };
  
    event.waitUntil(
      self.registration.showNotification('BookVerse', options)
    );
  });

  
  // Cache all pages (Network First)
  workbox.routing.registerRoute(
    ({ request }) => request.mode === 'navigate',
    new workbox.strategies.NetworkFirst({
      cacheName: 'pages-cache',
      networkTimeoutSeconds: 10,
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 50,
          maxAgeSeconds: 24 * 60 * 60,
        }),
      ],
    })
  );
  
  // Cache static assets (Cache First)
  workbox.routing.registerRoute(
    ({ request }) =>
      ['style', 'script', 'image'].includes(request.destination),
    new workbox.strategies.CacheFirst({
      cacheName: 'static-assets-cache',
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 100,
          maxAgeSeconds: 7 * 24 * 60 * 60,
        }),
      ],
    })
  );
  