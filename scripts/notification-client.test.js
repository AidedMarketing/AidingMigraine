const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('assets/app.js', 'utf8');
function declaration(name) {
    const start = new RegExp('^async function ' + name + '\\(', 'm').exec(source).index;
    return source.slice(start, source.indexOf('\n}', start) + 2);
}

test('VAPID rotation unregisters the old pair and sends only subscription ownership credentials', async () => {
    for (const changed of [true, false]) {
        const calls = [], key = new Uint8Array(65).fill(2); key[0] = 4;
        const oldKey = changed ? new Uint8Array(65).fill(1) : key;
        const registration = { pushManager: {
            getSubscription: async () => ({ options: { applicationServerKey: oldKey },
                toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/example', keys: { auth: 'browser-auth', p256dh: 'browser-public-key' } }),
                unsubscribe: async () => calls.push('browser-unsubscribe') }),
            subscribe: async options => { calls.push('subscribe'); assert.deepEqual(options.applicationServerKey, key); return 'new-subscription'; }
        } };
        const ctx = vm.createContext({ Uint8Array, AbortSignal, urlBase64ToUint8Array: () => key,
            fetch: async (url, options) => {
                if (url.endsWith('/public-key')) return { ok: true, json: async () => ({ publicKey: 'public-key' }) };
                calls.push('server-unsubscribe');
                const body = JSON.parse(options.body);
                assert.deepEqual(body.keys, { auth: 'browser-auth', p256dh: 'browser-public-key' });
                assert.equal(options.headers['X-API-Key'], undefined);
                return { ok: true };
            }
        });
        vm.runInContext(declaration('removeServerSubscription') + '\n' + declaration('ensurePushSubscription'), ctx);
        assert.equal(await ctx.ensurePushSubscription(registration), 'new-subscription');
        assert.deepEqual(calls, changed ? ['server-unsubscribe', 'browser-unsubscribe', 'subscribe'] : ['subscribe']);
    }
});

test('failed encrypted-vault save preserves plaintext records when enabling encryption', async () => {
    let wiped = false;
    const values = new Map();
    const ctx = vm.createContext({ Uint8Array, encMeta: null, encMasterKey: null, encUnlocked: false,
        ENC_KDF_ITERATIONS: 1, ENC_VERIFIER_TEXT: 'verifier',
        crypto: { getRandomValues: array => array }, deriveKey: async () => 'key', encryptWithKey: async () => 'blob', bufToB64: () => 'salt',
        persistVault: async () => false, wipePlaintextStores: async () => { wiped = true; },
        localStorage: { removeItem: key => values.delete(key) }
    });
    ctx.saveEncMeta = () => values.set('encMeta', ctx.encMeta);
    vm.runInContext(declaration('enableEncryption'), ctx);
    await assert.rejects(ctx.enableEncryption('test-passphrase'), /could not be saved/);
    assert.equal(wiped, false);
    assert.equal(ctx.encMeta, null);
    assert.equal(values.has('encMeta'), false);
});

test('failed plaintext save while disabling encryption retains vault and unlock metadata', async () => {
    const originalMeta = { enabled: true }, values = new Map([['encMeta', originalMeta]]);
    let vaultRemoved = false;
    const ctx = vm.createContext({ encMeta: originalMeta, encMasterKey: 'key', encUnlocked: true,
        persistVault: async () => true, saveData: async () => { throw new Error('quota'); },
        saveCycleData() {}, saveAssessments() {}, saveMedicationLibrary() {}, wipePlaintextStores: async () => {},
        removeVault: async () => { vaultRemoved = true; }, localStorage: { removeItem: key => values.delete(key) }
    });
    ctx.saveEncMeta = () => values.set('encMeta', ctx.encMeta);
    vm.runInContext(declaration('disableEncryption'), ctx);
    await assert.rejects(ctx.disableEncryption(), /quota/);
    assert.equal(ctx.encMeta, originalMeta);
    assert.equal(values.get('encMeta'), originalMeta);
    assert.equal(vaultRemoved, false);
});
