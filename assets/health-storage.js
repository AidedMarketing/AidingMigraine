// Health settings use IndexedDB first; plaintext localStorage is a fallback.
let healthWrites = Promise.resolve();

async function readHealthSetting(key) {
    if (useIndexedDB && db) {
        try {
            const stored = await IDB.get(DB_STORES.SETTINGS, key);
            if (stored) {
                try { localStorage.removeItem(key); } catch {}
                return JSON.stringify(stored.value);
            }
            const legacy = localStorage.getItem(key);
            if (legacy) {
                await IDB.put(DB_STORES.SETTINGS, { key, value: JSON.parse(legacy) });
                localStorage.removeItem(key);
                return legacy;
            }
            return null;
        } catch { /* Keep existing data readable if the primary store fails. */ }
    }
    return localStorage.getItem(key);
}

function saveHealthSetting(key, value) {
    const snapshot = structuredClone(value);
    const save = async () => {
        if (useIndexedDB && db) {
            try {
                await IDB.put(DB_STORES.SETTINGS, { key, value: snapshot });
                try { localStorage.removeItem(key); } catch {}
                return true;
            } catch { /* Preserve the offline fallback. */ }
        }
        try {
            localStorage.setItem(key, JSON.stringify(snapshot));
            return true;
        } catch {
            showToast('Changes could not be saved. Export your data and check device storage.', { type: 'error' });
            return false;
        }
    };
    healthWrites = healthWrites.then(save, save);
    return healthWrites;
}
