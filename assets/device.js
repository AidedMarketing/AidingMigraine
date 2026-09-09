// ============================================
// PHASE 1: SCREEN WAKE LOCK API
// ============================================

let wakeLock = null;
let wakeLockEnabled = localStorage.getItem('wakeLockEnabled') === 'true'; // Opt in; screen may rest during an attack

async function requestWakeLock() {
    if (!wakeLockEnabled || !('wakeLock' in navigator)) {
return;
    }

    try {
wakeLock = await navigator.wakeLock.request('screen');
console.log('[SUCCESS] Wake Lock activated');
showWakeLockIndicator();

wakeLock.addEventListener('release', () => {
    console.log('🔓 Wake Lock released');
    hideWakeLockIndicator();
});
    } catch (err) {
console.error('[ERROR] Wake Lock failed:', err);
    }
}

async function releaseWakeLock() {
    if (wakeLock !== null) {
await wakeLock.release();
wakeLock = null;
hideWakeLockIndicator();
    }
}

function showWakeLockIndicator() {
    const indicator = document.getElementById('wake-lock-indicator');
    if (indicator) {
indicator.style.display = 'flex';
    }
}

function hideWakeLockIndicator() {
    const indicator = document.getElementById('wake-lock-indicator');
    if (indicator) {
indicator.style.display = 'none';
    }
}

// Auto-request wake lock during active migraine
function handleActiveMigraineWakeLock() {
    if (activeMigraine) {
requestWakeLock();
    } else {
releaseWakeLock();
    }
}

// Re-acquire wake lock when visibility changes
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && activeMigraine && wakeLockEnabled) {
requestWakeLock();
    }
});

// ============================================
// PHASE 1: OFFLINE/ONLINE INDICATORS
// ============================================

let isOnline = navigator.onLine;
let onlineBannerTimeout = null;

function showOfflineBanner() {
    const banner = document.getElementById('status-banner');
    const container = document.querySelector('.container');

    banner.className = 'status-banner offline-banner';
    banner.textContent = 'You\'re offline - Changes will sync when you reconnect';
    banner.style.display = 'block';
    container.classList.add('with-status-banner');

    console.log('📴 App is offline');
}

function showOnlineBanner() {
    const banner = document.getElementById('status-banner');
    const container = document.querySelector('.container');

    banner.className = 'status-banner online-banner';
    banner.textContent = 'Back online - Data synced';
    banner.style.display = 'block';
    container.classList.add('with-status-banner');

    console.log('📶 App is online');

    // Auto-hide after 3 seconds
    if (onlineBannerTimeout) {
clearTimeout(onlineBannerTimeout);
    }
    onlineBannerTimeout = setTimeout(() => {
hideStatusBanner();
    }, 3000);
}

function hideStatusBanner() {
    const banner = document.getElementById('status-banner');
    const container = document.querySelector('.container');

    banner.style.display = 'none';
    container.classList.remove('with-status-banner');
}

window.addEventListener('online', () => {
    isOnline = true;
    showOnlineBanner();
});

window.addEventListener('offline', () => {
    isOnline = false;
    showOfflineBanner();
});

// Show offline banner on load if offline
if (!navigator.onLine) {
    setTimeout(() => showOfflineBanner(), 1000);
}

// ============================================
// PHASE 1: INSTALL PROMPT OPTIMIZATION
// ============================================

let deferredInstallPrompt = null;
let installPromptShown = localStorage.getItem('installPromptShown') === 'true';
let installPromptDismissed = localStorage.getItem('installPromptDismissed') === 'true';

window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the default install prompt
    e.preventDefault();
    deferredInstallPrompt = e;
    console.log('Install Install prompt available');

    // Show custom install prompt after user has logged 3 migraines
    if (currentPage === 'settings' && !activeMigraine && !installPromptShown && !installPromptDismissed && migraines.length >= 3) {
setTimeout(() => {
    showInstallPrompt();
}, 2000); // Show after 2 seconds
    }
});

function showInstallPrompt() {
    if (!deferredInstallPrompt) return;

    const prompt = document.getElementById('install-prompt');
    prompt.style.display = 'block';
    installPromptShown = true;
    localStorage.setItem('installPromptShown', 'true');
    console.log('Update Showing custom install prompt');
}

function hideInstallPrompt() {
    const prompt = document.getElementById('install-prompt');
    prompt.style.display = 'none';
}

// Install button handler
document.getElementById('install-btn')?.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;

    hideInstallPrompt();
    deferredInstallPrompt.prompt();

    const { outcome } = await deferredInstallPrompt.userChoice;
    console.log(`Install prompt outcome: ${outcome}`);

    deferredInstallPrompt = null;
});

// Dismiss button handler
document.getElementById('dismiss-install-btn')?.addEventListener('click', () => {
    hideInstallPrompt();
    installPromptDismissed = true;
    localStorage.setItem('installPromptDismissed', 'true');
    console.log('[ERROR] Install prompt dismissed');
});

// Listen for successful installation
window.addEventListener('appinstalled', () => {
    console.log('[SUCCESS] PWA installed successfully');
    hideInstallPrompt();
    deferredInstallPrompt = null;
});

// ============================================
// PHASE 1: BIOMETRIC AUTHENTICATION
// ============================================

let biometricAuthEnabled = localStorage.getItem('biometricAuthEnabled') === 'true';
let isAppLocked = false;

async function setupBiometricAuth() {
    // Check if Web Authentication API is supported
    if (!window.PublicKeyCredential) {
console.log('[ERROR] Web Authentication API not supported');
return false;
    }

    try {
// Check if platform authenticator is available
const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();

if (!available) {
    console.log('[ERROR] Platform authenticator not available');
    return false;
}

console.log('[SUCCESS] Biometric authentication available');
return true;
    } catch (err) {
console.error('[ERROR] Biometric auth check failed:', err);
return false;
    }
}

async function registerBiometric() {
    try {
const challenge = new Uint8Array(32);
crypto.getRandomValues(challenge);

const publicKeyOptions = {
    challenge: challenge,
    rp: {
        name: "Aiding Migraine",
        id: window.location.hostname
    },
    user: {
        id: new Uint8Array(16),
        name: "user@aidingmigraine.local",
        displayName: "Aiding Migraine User"
    },
    pubKeyCredParams: [
        { alg: -7, type: "public-key" }, // ES256
        { alg: -257, type: "public-key" } // RS256
    ],
    authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required"
    },
    timeout: 60000,
    attestation: "none"
};

const credential = await navigator.credentials.create({
    publicKey: publicKeyOptions
});

if (credential) {
    // Store credential ID
    localStorage.setItem('biometricCredentialId', btoa(String.fromCharCode(...new Uint8Array(credential.rawId))));
    localStorage.setItem('biometricAuthEnabled', 'true');
    biometricAuthEnabled = true;
    console.log('[SUCCESS] Biometric registered');
    return true;
}
    } catch (err) {
console.error('[ERROR] Biometric registration failed:', err);
return false;
    }
}

async function authenticateBiometric() {
    try {
const credentialId = localStorage.getItem('biometricCredentialId');
if (!credentialId) {
    return false;
}

const challenge = new Uint8Array(32);
crypto.getRandomValues(challenge);

const publicKeyOptions = {
    challenge: challenge,
    timeout: 60000,
    userVerification: "required",
    rpId: window.location.hostname
};

const assertion = await navigator.credentials.get({
    publicKey: publicKeyOptions
});

if (assertion) {
    console.log('[SUCCESS] Biometric authentication successful');
    return true;
}
    } catch (err) {
console.error('[ERROR] Biometric authentication failed:', err);
return false;
    }

    return false;
}

// Resolves the startup gate promise once the user unlocks.
let pendingUnlockResolve = null;

// Prepare the lock screen for passphrase (encryption) unlock.
function showLockForEncryption() {
    const input = document.getElementById('unlock-passphrase');
    const err = document.getElementById('unlock-error');
    const title = document.getElementById('lock-screen-title');
    const sub = document.getElementById('lock-screen-subtitle');
    if (title) title.textContent = 'Unlock your data';
    if (sub) sub.textContent = 'Enter your passphrase to decrypt your migraine data.';
    if (input) { input.style.display = 'block'; input.value = ''; setTimeout(() => input.focus(), 50); }
    if (err) { err.style.display = 'none'; err.textContent = ''; }
}

// Validate the entered passphrase; on success restore the key + unlock.
let unlockInProgress = false;
async function attemptEncryptionUnlock() {
    // Key derivation takes a moment; without a guard the passphrase
    // field's Enter handler could start several derivations at once.
    if (unlockInProgress) return false;
    unlockInProgress = true;
    const input = document.getElementById('unlock-passphrase');
    const err = document.getElementById('unlock-error');
    const btn = document.getElementById('unlock-btn');
    let key;
    try {
key = await withBusy(btn, 'Unlocking...', () => verifyPassphrase(input ? input.value : ''));
    } finally {
unlockInProgress = false;
    }
    if (!key) {
if (err) { err.textContent = 'Incorrect passphrase. Try again.'; err.style.display = 'block'; }
return false;
    }
    encMasterKey = key;
    encUnlocked = true;
    if (input) { input.value = ''; input.style.display = 'none'; }
    if (err) err.style.display = 'none';
    unlockApp();
    if (pendingUnlockResolve) { const r = pendingUnlockResolve; pendingUnlockResolve = null; r(); }
    return true;
}

// Startup gate: show the lock screen and block until unlocked.
function showEncryptionUnlockGate() {
    return new Promise(resolve => {
pendingUnlockResolve = resolve;
isAppLocked = true;
showLockForEncryption();
const lock = document.getElementById('lock-screen');
lock.style.display = 'flex';
openDialog(lock, { activate: false });
    });
}

function lockApp() {
    isAppLocked = true;
    // With encryption on, locking drops the key from memory so the data
    // is protected, and unlocking requires the passphrase again.
    if (encEnabled()) {
encMasterKey = null;
encUnlocked = false;
showLockForEncryption();
    }
    const lockEl = document.getElementById('lock-screen');
    lockEl.style.display = 'flex';
    openDialog(lockEl, { activate: false });
    console.log('Lock App locked');
}

function unlockApp() {
    isAppLocked = false;
    const lockScreen = document.getElementById('lock-screen');
    lockScreen.style.display = 'none';
    closeDialog(lockScreen, { deactivate: false });
    resetInactivityTimer();
}

// Unlock button handler
document.getElementById('unlock-btn')?.addEventListener('click', async () => {
    if (encEnabled()) {
await attemptEncryptionUnlock();
return;
    }
    if (biometricAuthEnabled) {
const authenticated = await authenticateBiometric();
if (authenticated) {
    unlockApp();
} else {
    showModal('Authentication Failed', 'Unable to verify your identity. Please try again.');
}
    } else {
unlockApp();
    }
});

// Enter key in the passphrase field submits the encryption unlock
document.getElementById('unlock-passphrase')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); attemptEncryptionUnlock(); }
});

// ============================================
// PHASE 1: AUTO-LOCK AFTER INACTIVITY
// ============================================

let inactivityTimeout = null;
let autoLockEnabled = localStorage.getItem('autoLockEnabled') !== 'false'; // Default true
let autoLockDelay = parseInt(localStorage.getItem('autoLockDelay') || '300000'); // Default 5 minutes

function resetInactivityTimer() {
    if (!autoLockEnabled || isAppLocked) {
return;
    }

    if (inactivityTimeout) {
clearTimeout(inactivityTimeout);
    }

    inactivityTimeout = setTimeout(() => {
// Least resistance during an attack: never auto-lock while an
// episode is in progress — re-arm the timer instead.
if (activeMigraine) { resetInactivityTimer(); return; }
lockApp();
    }, autoLockDelay);
}

function initializeAutoLock() {
    if (!autoLockEnabled) {
return;
    }

    // Track user activity
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];

    activityEvents.forEach(event => {
document.addEventListener(event, resetInactivityTimer, true);
    });

    resetInactivityTimer();
    console.log('[SUCCESS] Auto-lock initialized');
}

// ============================================
// PHASE 2: SETTINGS HANDLERS
// ============================================

async function initializePhase2Settings() {
    // Update storage quota display
    const quota = await checkStorageQuota();
    if (quota.quota > 0) {
document.getElementById('storage-percentage').textContent = `${quota.percentage}%`;
document.getElementById('storage-bar').style.width = `${quota.percentage}%`;
document.getElementById('storage-used').textContent = formatBytes(quota.usage);
document.getElementById('storage-total').textContent = formatBytes(quota.quota);

// Change color based on usage
const bar = document.getElementById('storage-bar');
if (quota.percentage > 80) {
    bar.style.background = 'var(--accent-red)';
    document.getElementById('storage-percentage').style.color = 'var(--accent-red)';
} else if (quota.percentage > 50) {
    bar.style.background = 'var(--pain-moderate)';
} else {
    bar.style.background = 'var(--accent-green)';
}
    }

    // Update IndexedDB status
    if (useIndexedDB && db) {
const count = await IDB.count(DB_STORES.MIGRAINES);
document.getElementById('indexeddb-status').textContent = ` Active - ${count} migraines stored`;
document.getElementById('indexeddb-status').style.color = 'var(--accent-green)';
document.getElementById('indexeddb-count').textContent = count;
    } else {
document.getElementById('indexeddb-status').textContent = 'Not supported - using localStorage';
document.getElementById('indexeddb-status').style.color = 'var(--accent-red)';
document.getElementById('indexeddb-count').textContent = migraines.length;
    }

    // Archive button handler
    const archiveBtn = document.getElementById('archive-old-btn');
    if (archiveBtn) {
archiveBtn.addEventListener('click', async () => {
    const confirmed = await confirmAction(
        'Archive older episodes',
        'Episodes older than 12 months will be moved out of your history. They stay on this device and are still included in exports.',
        { confirmText: 'Archive' }
    );
    if (confirmed) {
        archiveBtn.disabled = true;
        archiveBtn.textContent = 'Archiving...';

        const count = await archiveOldMigraines(12);

        archiveBtn.disabled = false;
        archiveBtn.textContent = 'Archive Now';

        showModal('Archived', `${count} migraines archived successfully.`);

        // Refresh displays
        await initializePhase2Settings();
        renderHistory();
    }
});
    }
}

// ============================================
// PHASE 1: SETTINGS HANDLERS
// ============================================

let phase1SettingsInitialized = false;
function initializePhase1Settings() {
    // Wake Lock toggle
    const wakeLockToggle = document.getElementById('wake-lock-toggle');
    if (wakeLockToggle) {
wakeLockToggle.checked = wakeLockEnabled;

// Only add event listener on first initialization
if (!phase1SettingsInitialized) {
    wakeLockToggle.addEventListener('change', (e) => {
        wakeLockEnabled = e.target.checked;
        localStorage.setItem('wakeLockEnabled', wakeLockEnabled);
        if (wakeLockEnabled && activeMigraine) {
            requestWakeLock();
        } else if (!wakeLockEnabled) {
            releaseWakeLock();
        }
        console.log(`Wake Lock ${wakeLockEnabled ? 'enabled' : 'disabled'}`);
    });
}
    }

    // Biometric toggle
    const biometricToggle = document.getElementById('biometric-toggle');
    const biometricStatus = document.getElementById('biometric-status');

    if (biometricToggle && biometricStatus) {
biometricToggle.checked = biometricAuthEnabled;

// Only add event listener on first initialization
if (!phase1SettingsInitialized) {
    // Check biometric availability
    setupBiometricAuth().then(available => {
        if (available) {
            biometricStatus.textContent = ' Biometric authentication available';
            biometricStatus.style.color = 'var(--accent-green)';

            biometricToggle.addEventListener('change', async (e) => {
                if (e.target.checked) {
                    const registered = await registerBiometric();
                    if (registered) {
                        biometricAuthEnabled = true;
                        biometricStatus.textContent = ' Biometric authentication enabled';
                        showModal('Screen Lock Enabled', 'The app now requires biometric unlock to open. Note: this is a screen lock - stored data is not encrypted.');
                    } else {
                        e.target.checked = false;
                        showModal('Setup Failed', 'Unable to register biometric authentication. Please try again.');
                    }
                } else {
                    biometricAuthEnabled = false;
                    localStorage.removeItem('biometricCredentialId');
                    localStorage.setItem('biometricAuthEnabled', 'false');
                    biometricStatus.textContent = 'Biometric authentication disabled';
                    showModal('Screen Lock Disabled', 'The app no longer asks for biometric unlock on open.');
                }
            });
        } else {
            biometricStatus.textContent = 'Not supported on this device/browser';
            biometricStatus.style.color = 'var(--accent-red)';
            biometricToggle.disabled = true;
        }
    });
}
    }

    // Auto-lock toggle and delay
    const autoLockToggle = document.getElementById('auto-lock-toggle');
    const autoLockDelaySelect = document.getElementById('auto-lock-delay');
    const autoLockSettings = document.getElementById('auto-lock-settings');

    if (autoLockToggle) {
autoLockToggle.checked = autoLockEnabled;

// Only add event listener on first initialization
if (!phase1SettingsInitialized) {
    autoLockToggle.addEventListener('change', (e) => {
        autoLockEnabled = e.target.checked;
        localStorage.setItem('autoLockEnabled', autoLockEnabled);
        autoLockSettings.style.display = autoLockEnabled ? 'block' : 'none';

        if (autoLockEnabled) {
            resetInactivityTimer();
        } else if (inactivityTimeout) {
            clearTimeout(inactivityTimeout);
        }

        console.log(`Auto-lock ${autoLockEnabled ? 'enabled' : 'disabled'}`);
    });
}
    }

    if (autoLockDelaySelect) {
autoLockDelaySelect.value = String(autoLockDelay);

// Only add event listener on first initialization
if (!phase1SettingsInitialized) {
    autoLockDelaySelect.addEventListener('change', (e) => {
        autoLockDelay = parseInt(e.target.value);
        localStorage.setItem('autoLockDelay', autoLockDelay);
        resetInactivityTimer();
        console.log(`Auto-lock delay set to ${autoLockDelay}ms`);
    });
}
    }

    // Show/hide auto-lock settings based on toggle
    if (autoLockSettings) {
autoLockSettings.style.display = autoLockEnabled ? 'block' : 'none';
    }

    // Mark as initialized after first run
    phase1SettingsInitialized = true;
}

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // Initialize Phase 1 features
    initializeAutoLock();
    setupBiometricAuth();

    // Initialize Phase 1 & 2 settings (after a short delay to ensure settings page is loaded)
    setTimeout(async () => {
initializePhase1Settings();
await initializePhase2Settings();
    }, 500);

    // Override activeMigraine state changes to manage wake lock
    const originalEndActiveMigraine = window.endActiveMigraine;

    if (typeof originalEndActiveMigraine === 'function') {
window.endActiveMigraine = function() {
    const result = originalEndActiveMigraine.apply(this, arguments);
    handleActiveMigraineWakeLock();
    return result;
};
    }

    console.log('[SUCCESS] Phase 1 features initialized');
});
