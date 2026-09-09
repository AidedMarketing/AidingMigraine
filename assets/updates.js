let newWorker;

function showUpdateBanner() {
    const banner = document.getElementById('update-banner');
    const container = document.querySelector('.container');

    banner.style.display = 'block';
    container.classList.add('with-update-banner');


}

function hideUpdateBanner() {
    const banner = document.getElementById('update-banner');
    const container = document.querySelector('.container');

    banner.style.display = 'none';
    container.classList.remove('with-update-banner');
}

function updateApp() {
    if (newWorker) {
console.log('Active Updating app...');
// Send message to skip waiting
newWorker.postMessage({ type: 'SKIP_WAITING' });
    }
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
navigator.serviceWorker.register('./service-worker.js')
    .then(registration => {
        console.log('[SUCCESS] Service Worker registered:', registration.scope);

        // Immediately check for updates on load
        registration.update().then(() => {
            console.log('[SEARCH] Checked for updates');
        });

        // Check if there's already a waiting service worker
        if (registration.waiting) {
            newWorker = registration.waiting;
            showUpdateBanner();
        }

        // Check for updates every hour
        setInterval(() => {
            console.log('⏰ Hourly update check...');
            registration.update();
        }, 60 * 60 * 1000);

        // Listen for waiting service worker
        registration.addEventListener('updatefound', () => {
            console.log('📦 Update found!');
            const installingWorker = registration.installing;

            installingWorker.addEventListener('statechange', () => {
                console.log('Service worker state:', installingWorker.state);
                if (installingWorker.state === 'installed') {
                    if (navigator.serviceWorker.controller) {
                        // New update available
                        newWorker = installingWorker;
                        showUpdateBanner();
                    } else {
                        // First time installation
                        console.log('Service Worker installed for the first time');
                    }
                }
            });
        });
    })
    .catch(error => {
        console.error('[ERROR] Service Worker registration failed:', error);
    });

// Listen for service worker controller change
navigator.serviceWorker.addEventListener('controllerchange', () => {
    console.log('[RELOAD] New service worker activated, reloading page...');
    window.location.reload();
});

// Update button click handler
document.getElementById('update-btn').addEventListener('click', () => {
    updateApp();
});

// Dismiss button click handler
document.getElementById('dismiss-update-btn').addEventListener('click', () => {
    hideUpdateBanner();
});
    });
}
