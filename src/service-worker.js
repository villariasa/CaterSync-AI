import { build, files, prerendered, version } from '$service-worker';

const CACHE_NAME = `catersync-offline-${version}`;
const SW_VERSION = '1.3.7';

const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
  ...build,
  ...files,
  ...prerendered
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (event.request.url.startsWith('chrome-extension://') || event.request.url.includes('/api/')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // If a page request fails (offline client navigation / reload), serve cached root index.html
          if (event.request.mode === 'navigate' || (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html'))) {
            return caches.match('/').then((res) => {
              if (res) return res;
              return caches.match('/index.html');
            });
          }
        });
      })
  );
});

// Push notifications receiver event listener
self.addEventListener('push', (event) => {
  let data = { title: 'CaterSync-AI System Notification', body: 'New operations alert triggered.' };
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'CaterSync-AI Alert', body: event.data.text() };
    }
  }

  const options = {
    body: data.body,
    icon: '/icon-192.png',
    badge: '/favicon.svg',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// On click handler to open target tab
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'update' || event.notification.tag === 'catersync-update') {
    self.skipWaiting();
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const targetUrl = event.notification.data ? event.notification.data.url : '/';
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// Listener for background timed notifications when tab is closed
self.addEventListener('message', (event) => {
  if (event.data) {
    if (event.data.type === 'SKIP_WAITING' || event.data.action === 'skip_waiting') {
      self.skipWaiting();
    }
    if (event.data.type === 'GET_VERSION' && event.source) {
      event.source.postMessage({ type: 'VERSION_RESPONSE', version: SW_VERSION });
    }
    if (event.data.action === 'schedule_test_notification') {
      const { delay, title, body } = event.data;
      setTimeout(() => {
        self.registration.showNotification(title, {
          body,
          icon: '/icon-192.png',
          badge: '/favicon.svg',
          vibrate: [100, 50, 100],
          data: { url: '/' }
        });
      }, delay);
    }
  }
});
