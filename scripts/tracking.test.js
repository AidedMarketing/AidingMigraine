const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { html, scripts } = require('./frontend-source');
const app = fs.readFileSync('assets/app.js', 'utf8');
const tracking = fs.readFileSync('assets/tracking.js', 'utf8');

function declaration(source, name) {
    const match = new RegExp('^(?:async )?function ' + name + '\\(', 'm').exec(source);
    assert.ok(match, name);
    return source.slice(match.index, source.indexOf('\n}', match.index) + 2);
}
function harness({ indexed = false, storageFails = false, encrypted = false, vaultSaved = true } = {}) {
    const storage = new Map();
    const records = { migraines: new Map(), settings: new Map() };
    const nodes = new Map();
    const notices = [];
    const context = vm.createContext({
        console: { log() {}, warn() {}, error() {} }, Date, structuredClone,
        migraines: [], activeMigraine: null, useIndexedDB: indexed, db: indexed ? {} : null,
        encEnabled: () => encrypted, persistVault: async () => vaultSaved,
        DB_STORES: { MIGRAINES: 'migraines', SETTINGS: 'settings' },
        IDB: {
            getAllKeys: async store => [...records[store].keys()],
            getAll: async store => [...records[store].values()].map(structuredClone),
            get: async (store, key) => structuredClone(records[store].get(key)),
            put: async (store, value) => records[store].set(value.key ?? value.id, structuredClone(value)),
            delete: async (store, key) => records[store].delete(key),
        },
        localStorage: {
            getItem: key => storage.get(key) ?? null,
            setItem: (key, value) => { if (storageFails) throw new Error('quota'); storage.set(key, value); },
            removeItem: key => { if (storageFails) throw new Error('quota'); storage.delete(key); },
        },
        document: { getElementById: id => {
            if (!nodes.has(id)) nodes.set(id, { disabled: false, open: false, focus() {} });
            return nodes.get(id);
        } },
        startDurationTracking() {}, checkActiveMigraine() {}, updateDashboard() {}, renderCalendar() {},
        scheduleActiveAttackCheckIn() {}, schedulePostAttackFollowUp() {}, getCurrentWeatherForEntry: () => null,
        showToast: message => notices.push(message), showActiveEpisodeConflict: () => notices.push('conflict'),
    });
    for (const name of ['validateActiveMigraine', 'saveData', 'loadData']) vm.runInContext(declaration(app, name), context);
    for (const name of ['beginAttack', 'startAttackMode']) vm.runInContext(declaration(tracking, name), context);
    return { context, storage, records, nodes, notices };
}

test('one-tap start survives reopening with unknown pain in both storage paths', async () => {
    for (const indexed of [false, true]) {
        const { context: c, notices } = harness({ indexed });
        await c.startAttackMode();
        const id = c.activeMigraine.id;
        assert.equal(c.activeMigraine.painLevel, null);
        c.activeMigraine = null;
        await c.loadData();
        assert.equal(c.activeMigraine.id, id);
        assert.equal(c.activeMigraine.painLevel, null);
        assert.equal(notices.length, 1);
    }
});
test('duplicate start cannot replace an in-progress attack', async () => {
    const { context: c } = harness();
    await c.startAttackMode();
    const original = c.activeMigraine;
    await c.startAttackMode();
    assert.equal(c.activeMigraine, original);
});
test('unknown pain, zero pain and long-running attacks remain valid; invalid dates/scores do not', () => {
    const { context: c } = harness();
    const entry = { id: 1, startTime: '2020-01-01T12:00:00Z', painLevel: null };
    assert.equal(c.validateActiveMigraine(entry), true);
    assert.equal(c.validateActiveMigraine({ ...entry, painLevel: 0 }), true);
    for (const painLevel of [-1, 11, 'bad', 2.5]) assert.equal(c.validateActiveMigraine({ ...entry, painLevel }), false);
    assert.equal(c.validateActiveMigraine({ ...entry, startTime: 'invalid' }), false);
});
test('failed start restores controls and reports failure instead of claiming success', async () => {
    const { context: c, nodes, notices } = harness({ storageFails: true });
    await c.startAttackMode();
    assert.equal(c.activeMigraine, null);
    assert.equal(nodes.get('start-attack-btn').disabled, false);
    assert.match(notices[0], /Could not save/);
});
test('IndexedDB success is sufficient when the optional localStorage mirror is full', async () => {
    const { context: c } = harness({ indexed: true, storageFails: true });
    await c.startAttackMode();
    const id = c.activeMigraine.id;
    c.activeMigraine = null;
    await c.loadData();
    assert.equal(c.activeMigraine.id, id);
});
test('encrypted persistence failure never becomes a success toast or plaintext write', async () => {
    const { context: c, storage, notices } = harness({ encrypted: true, vaultSaved: false });
    await c.startAttackMode();
    assert.equal(c.activeMigraine, null);
    assert.equal(storage.size, 0);
    assert.match(notices[0], /Could not save/);
});
test('encrypted success uses the vault without writing a plaintext mirror', async () => {
    const { context: c, storage } = harness({ encrypted: true });
    await c.startAttackMode();
    assert.ok(c.activeMigraine);
    assert.equal(storage.size, 0);
});
test('split scripts compile together and every local runtime asset is precached', () => {
    new vm.Script(scripts.map(file => fs.readFileSync(file, 'utf8')).join('\n'));
    const sw = fs.readFileSync('service-worker.js', 'utf8');
    for (const file of [...scripts, './assets/components.css', './assets/shell.css']) {
        assert.ok(fs.existsSync(file), file);
        assert.ok(sw.includes("'" + file + "'"), 'Missing offline asset ' + file);
    }
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
    assert.equal(new Set(ids).size, ids.length, 'Duplicate HTML IDs');
    assert.equal((html.match(/class="nav-btn(?: active)?"/g) || []).length, 3);
});

test('an empty primary database does not resurrect records from an outdated mirror', async () => {
    const { context: c, storage } = harness({ indexed: true });
    storage.set('migraines', JSON.stringify([{ id: 9, painLevel: 5 }]));
    storage.set('activeMigraine', JSON.stringify({ id: 8, startTime: new Date().toISOString(), painLevel: 5 }));
    await c.loadData();
    assert.equal(c.migraines.length, 0);
    assert.equal(c.activeMigraine, null);
});

test('ending an attack saves before confirming, and restores the active record on failure', async () => {
    for (const storageFails of [false, true]) {
        const { context: c, nodes, notices } = harness({ storageFails });
        const callbacks = {};
        c.activeMigraine = { id: 1, startTime: new Date().toISOString(), painLevel: 4, painHistory: [], status: 'active' };
        const before = structuredClone(c.activeMigraine);
        for (const id of ['modal', 'modal-body', 'modal-actions', 'modal-title', 'confirm-end', 'end-notes', 'attack-details', 'start-attack-btn']) {
            nodes.set(id, { style: {}, value: '', focus() {}, addEventListener: (event, callback) => { callbacks[id] = callback; } });
        }
        Object.assign(c, {
            POSTDROME_KEYS: new Set(), renderPostdromeChips() {}, bindPostdromeChips() {}, openDialog() {},
            closeModal() {}, cancelActiveAttackCheckIn() {}, stopDurationTracking() {}, renderHistory() {},
        });
        vm.runInContext(declaration(tracking, 'endActiveMigraine'), c);
        c.endActiveMigraine();
        assert.match(nodes.get('modal-body').innerHTML, /<details[^>]*><summary>Add recovery details/);
        await callbacks['confirm-end']();
        if (storageFails) {
            assert.equal(c.activeMigraine.id, before.id);
            assert.equal(c.activeMigraine.status, 'active');
            assert.equal(c.migraines.length, 0);
            assert.match(notices.at(-1), /Could not save/);
        } else {
            assert.equal(c.activeMigraine, null);
            assert.equal(c.migraines.length, 1);
            assert.equal(c.migraines[0].status, 'completed');
            assert.match(notices.at(-1), /saved to History/);
        }
    }
});
