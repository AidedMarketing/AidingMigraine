// Aiding Migraine - Service Worker
// Version 2.0.0 - Render Notification Server Integration

const CACHE_NAME = 'aiding-migraine-v2.0.0';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    './icons/favicon-16x16.png',
    './icons/favicon-32x32.png',
    './icons/apple-touch-icon.png',
    './icons/icon-192x192.png',
    './icons/icon-192x192-maskable.png',
    './icons/icon-384x384.png',
    './icons/icon-512x512.png',
    './icons/icon-512x512-maskable.png',
    './help/index.html',
    './help/quick-start.html',
    './help/notifications-ios.html',
    './help/analytics.html',
    './help/faq.html',
    './help/privacy.html',
    './help/styles.css'
];

// Install event - cache assets
self.addEventListener('install', (event) => {
    console.log('Service Worker: Installing new version...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Service Worker: Caching app shell');
                return cache.addAll(ASSETS_TO_CACHE);
            })
            // Don't automatically skip waiting - let the user choose when to update
    );
});

// Listen for skip waiting message from app
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        console.log('Service Worker: Skip waiting requested by app');
        self.skipWaiting();
    }
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activating...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('Service Worker: Clearing old cache', cache);
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Return cached version or fetch from network
                return response || fetch(event.request)
                    .then((fetchResponse) => {
                        // Clone the response
                        const responseToCache = fetchResponse.clone();

                        // Cache the new resource
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(event.request, responseToCache);
                            });

                        return fetchResponse;
                    });
            })
            .catch(() => {
                // Return offline page if available
                return caches.match('./index.html');
            })
    );
});

// ============================================
// PUSH NOTIFICATION HANDLERS
// ============================================

// Listen for push events from the server
self.addEventListener('push', (event) => {
    console.log('Push notification received:', event);

    let data = {
        title: 'Aiding Migraine',
        body: 'You have a new notification',
        icon: './icons/icon-192x192.png',
        badge: './icons/icon-72x72.png',
        tag: 'default',
        url: './',
        type: 'general'
    };

    // Parse push data if available
    if (event.data) {
        try {
            const pushData = event.data.json();
            // Security: Validate and sanitize incoming data
            data = {
                ...data,
                title: String(pushData.title || data.title).substring(0, 100),
                body: String(pushData.body || data.body).substring(0, 500),
                icon: String(pushData.icon || data.icon),
                badge: String(pushData.badge || data.badge),
                tag: String(pushData.tag || data.tag),
                url: String(pushData.url || data.url),
                type: String(pushData.type || data.type),
                attackId: pushData.attackId
            };
        } catch (e) {
            console.error('Error parsing push data:', e);
        }
    }

    const options = {
        body: data.body,
        icon: data.icon,
        badge: data.badge,
        tag: data.tag,
        requireInteraction: true,
        vibrate: [200, 100, 200],
        data: {
            url: data.url, // Will be validated in notificationclick handler
            type: data.type,
            attackId: data.attackId
        },
        actions: []
    };

    // Add actions based on notification type
    if (data.type === 'daily-checkin') {
        options.actions = [
            { action: 'log', title: 'Log Now' },
            { action: 'dismiss', title: 'Dismiss' }
        ];
    } else if (data.type === 'post-attack-followup') {
        options.actions = [
            { action: 'update', title: 'Update Status' },
            { action: 'dismiss', title: 'Later' }
        ];
    }

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    console.log('Notification clicked:', event);

    event.notification.close();

    const notificationData = event.notification.data;
    let urlToOpen = notificationData.url || './';

    // Security: Validate URL to prevent XSS and malicious redirects
    function validateUrl(url) {
        try {
            // Only allow relative URLs starting with ./ or /
            if (url.startsWith('./') || url.startsWith('/')) {
                // Prevent javascript:, data:, and other dangerous schemes
                if (url.toLowerCase().includes('javascript:') ||
                    url.toLowerCase().includes('data:') ||
                    url.toLowerCase().includes('vbscript:')) {
                    return './'; // Default to safe URL
                }
                return url;
            }
            // For absolute URLs, only allow same origin
            const parsedUrl = new URL(url, self.location.origin);
            if (parsedUrl.origin === self.location.origin) {
                return parsedUrl.pathname + parsedUrl.search + parsedUrl.hash;
            }
            // Reject all other URLs
            return './';
        } catch (e) {
            // Invalid URL, return safe default
            return './';
        }
    }

    // Validate and sanitize the URL
    urlToOpen = validateUrl(urlToOpen);

    // Handle action buttons
    if (event.action === 'log') {
        urlToOpen = './?action=log';
    } else if (event.action === 'update' && notificationData.attackId) {
        // Sanitize attackId to prevent injection
        const sanitizedId = encodeURIComponent(String(notificationData.attackId || ''));
        urlToOpen = `./?action=update&attackId=${sanitizedId}`;
    } else if (event.action === 'dismiss') {
        return;
    }

    // Open or focus the PWA
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // Check if PWA is already open
                for (let i = 0; i < clientList.length; i++) {
                    const client = clientList[i];
                    if (client.url.includes(self.registration.scope) && 'focus' in client) {
                        // Navigate to the URL and focus the window
                        client.navigate(urlToOpen);
                        return client.focus();
                    }
                }
                // If not open, open a new window
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
    );
});
