// ============================================
// PHASE 2: INDEXEDDB DATA MANAGEMENT
// ============================================

const DB_NAME = 'AidingMigraineDB';
const DB_VERSION = 3; // v3: drop unused syncQueue store and dead-field indexes
let db = null;
let useIndexedDB = true; // Flag to enable/disable IndexedDB

// IndexedDB Schema
const DB_STORES = {
    MIGRAINES: 'migraines',
    MEDICATIONS: 'medications',
    SETTINGS: 'settings',
    WEATHER: 'weather'
};

/**
 * Initialize IndexedDB
 */
async function initIndexedDB() {
    if (!window.indexedDB) {
console.warn('[WARNING] IndexedDB not supported, using localStorage');
useIndexedDB = false;
return false;
    }

    try {
db = await new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
        const database = event.target.result;

        // Migraines store with indexes on fields the live
        // data model actually has (startTime, deletedAt)
        if (!database.objectStoreNames.contains(DB_STORES.MIGRAINES)) {
            const migraineStore = database.createObjectStore(DB_STORES.MIGRAINES, {
                keyPath: 'id',
                autoIncrement: false
            });
            migraineStore.createIndex('startTime', 'startTime', { unique: false });
            migraineStore.createIndex('deletedAt', 'deletedAt', { unique: false });
            console.log('[SUCCESS] Created migraines object store');
        } else {
            // v3 upgrade: remove indexes declared on fields
            // that never existed on stored records
            const migraineStore = event.target.transaction.objectStore(DB_STORES.MIGRAINES);
            ['date', 'pain', 'isDeleted'].forEach(name => {
                if (migraineStore.indexNames.contains(name)) {
                    migraineStore.deleteIndex(name);
                }
            });
        }

        // v3 upgrade: drop the unused background-sync queue store
        if (database.objectStoreNames.contains('syncQueue')) {
            database.deleteObjectStore('syncQueue');
            console.log('[SUCCESS] Dropped unused syncQueue store');
        }

        // Medications store
        if (!database.objectStoreNames.contains(DB_STORES.MEDICATIONS)) {
            const medStore = database.createObjectStore(DB_STORES.MEDICATIONS, {
                keyPath: 'id',
                autoIncrement: true
            });
            medStore.createIndex('name', 'name', { unique: false });
            medStore.createIndex('type', 'type', { unique: false });
            console.log('[SUCCESS] Created medications object store');
        }

        // Settings store
        if (!database.objectStoreNames.contains(DB_STORES.SETTINGS)) {
            database.createObjectStore(DB_STORES.SETTINGS, {
                keyPath: 'key'
            });
            console.log('[SUCCESS] Created settings object store');
        }

        // Weather store (Phase 2 Refinements)
        if (!database.objectStoreNames.contains(DB_STORES.WEATHER)) {
            const weatherStore = database.createObjectStore(DB_STORES.WEATHER, {
                keyPath: 'key'
            });
            weatherStore.createIndex('timestamp', 'timestamp', { unique: false });
            console.log('[SUCCESS] Created weather object store');
        }
    };
});

console.log('[SUCCESS] IndexedDB initialized successfully');
return true;
    } catch (error) {
console.error('[ERROR] IndexedDB initialization failed:', error);
useIndexedDB = false;
return false;
    }
}

/**
 * Generic IndexedDB operations
 */
const IDB = {
    // Get a single item by key
    async get(storeName, key) {
if (!useIndexedDB || !db) return null;

return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(key);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
});
    },

    // Get all items from a store
    async getAll(storeName) {
if (!useIndexedDB || !db) return [];

return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
});
    },

    // Get all keys from a store
    async getAllKeys(storeName) {
if (!useIndexedDB || !db) return [];

return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAllKeys();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
});
    },

    // Put (add or update) an item
    async put(storeName, item) {
if (!useIndexedDB || !db) return false;

return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(item);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
});
    },

    // Add an item (fails if key exists)
    async add(storeName, item) {
if (!useIndexedDB || !db) return false;

return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.add(item);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
});
    },

    // Delete an item
    async delete(storeName, key) {
if (!useIndexedDB || !db) return false;

return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(key);

    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
});
    },

    // Clear entire store
    async clear(storeName) {
if (!useIndexedDB || !db) return false;

return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.clear();

    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
});
    },

    // Count items in store
    async count(storeName) {
if (!useIndexedDB || !db) return 0;

return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.count();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
});
    }
};

/**
 * Migrate data from localStorage to IndexedDB
 */
async function migrateToIndexedDB() {
    const migrated = localStorage.getItem('indexedDB_migrated');
    if (migrated === 'true') {
console.log('[SUCCESS] Already migrated to IndexedDB');
return;
    }

    if (!useIndexedDB || !db) {
console.log('[WARNING] IndexedDB not available, skipping migration');
return;
    }

    console.log('[RELOAD] Starting migration to IndexedDB...');

    try {
// Migrate migraines
const migrainesJSON = localStorage.getItem('migraines');
if (migrainesJSON) {
    const migrainesArray = JSON.parse(migrainesJSON);
    console.log(`📦 Migrating ${migrainesArray.length} migraines...`);

    for (const migraine of migrainesArray) {
        // Ensure each migraine has an ID
        if (!migraine.id) {
            migraine.id = migraine.date + '_' + migraine.startTime;
        }
        await IDB.put(DB_STORES.MIGRAINES, migraine);
    }
    console.log('[SUCCESS] Migraines migrated');
}

// Migrate active migraine
const activeMigraineJSON = localStorage.getItem('activeMigraine');
if (activeMigraineJSON) {
    const activeMigraine = JSON.parse(activeMigraineJSON);
    await IDB.put(DB_STORES.SETTINGS, {
        key: 'activeMigraine',
        value: activeMigraine
    });
    console.log('[SUCCESS] Active migraine migrated');
}

// Migrate user medications
const userMedsJSON = localStorage.getItem('userMedications');
if (userMedsJSON) {
    const userMeds = JSON.parse(userMedsJSON);
    console.log(`Medication Migrating ${userMeds.length} medications...`);

    for (const med of userMeds) {
        await IDB.add(DB_STORES.MEDICATIONS, med);
    }
    console.log('[SUCCESS] Medications migrated');
}

// Migrate weather data
const weatherJSON = localStorage.getItem('weatherData');
if (weatherJSON) {
    const weather = JSON.parse(weatherJSON);
    console.log('🌦️ Migrating weather data...');

    await IDB.put(DB_STORES.WEATHER, {
        key: 'weatherData',
        value: weather,
        timestamp: Date.now()
    });
    console.log('[SUCCESS] Weather data migrated');
}

// Mark migration as complete
localStorage.setItem('indexedDB_migrated', 'true');
console.log('[SUCCESS] Migration to IndexedDB complete!');

// Keep localStorage as backup for now (don't delete)
    } catch (error) {
console.error('[ERROR] Migration failed:', error);
localStorage.removeItem('indexedDB_migrated');
    }
}

// ============================================
// PHASE 2: STORAGE QUOTA MANAGEMENT
// ============================================

let storageQuota = {
    usage: 0,
    quota: 0,
    percentage: 0
};

async function checkStorageQuota() {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
try {
    const estimate = await navigator.storage.estimate();
    storageQuota = {
        usage: estimate.usage || 0,
        quota: estimate.quota || 0,
        percentage: estimate.quota ? Math.round((estimate.usage / estimate.quota) * 100) : 0
    };

    console.log(`Save Storage: ${formatBytes(storageQuota.usage)} / ${formatBytes(storageQuota.quota)} (${storageQuota.percentage}%)`);

    // Warn if storage is getting full
    if (storageQuota.percentage > 80) {
        showStorageWarning();
    }

    return storageQuota;
} catch (error) {
    console.error('[ERROR] Storage quota check failed:', error);
}
    }
    return storageQuota;
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function showStorageWarning() {
    showModal(
'Storage Almost Full',
`Your storage is ${storageQuota.percentage}% full. Consider exporting old data or enabling auto-archive.`
    );
}

/**
 * Archive old migraines (hides them from views; still included in JSON export)
 */
async function archiveOldMigraines(monthsOld = 12) {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - monthsOld);

    let archivedCount = 0;

    for (const migraine of migraines) {
const migraineDate = new Date(migraine.startTime);
if (migraineDate < cutoffDate && !migraine.deleted && !migraine.archived) {
    migraine.archived = true;
    migraine.archivedAt = new Date().toISOString();
    archivedCount++;
}
    }

    if (archivedCount > 0) {
await saveData();
    }

    console.log(`Archived ${archivedCount} migraines older than ${monthsOld} months`);
    return archivedCount;
}

// Initialize Phase 2 and app on DOMContentLoaded
document.addEventListener('DOMContentLoaded', async () => {
    // Phase 2: Initialize IndexedDB and data management
    updateLoadingProgress(0, 'Starting up...');

    updateLoadingProgress(2, 'Initializing database...');
    await initIndexedDB();

    updateLoadingProgress(5, 'Migrating data...');
    await migrateToIndexedDB();

    updateLoadingProgress(7, 'Checking storage...');
    await checkStorageQuota();

    // Initialize main app (now that IndexedDB is ready)
    await initApp();
});
