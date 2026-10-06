const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium, webkit } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const root = path.resolve(__dirname, '..');

test('CSP, sanitization, legacy health-data migration, encryption and offline security assets', { timeout: 90000 }, async () => {
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
    const server = http.createServer((req, res) => {
        const url = new URL(req.url, 'http://localhost');
        const file = path.join(root, decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
        if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
        try { res.setHeader('Content-Type', types[path.extname(file)] || 'text/plain'); res.end(fs.readFileSync(file)); }
        catch { res.writeHead(404).end(); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
        for (const engine of [chromium, webkit].filter(e => !process.env.MOBILE_ENGINE || e.name() === process.env.MOBILE_ENGINE)) {
            const browser = await engine.launch(process.env.MOBILE_BROWSER_PATH && engine.name() === 'chromium' ? { executablePath: process.env.MOBILE_BROWSER_PATH } : {});
            try {
                const context = await browser.newContext();
                await context.addInitScript(() => {
                    if (localStorage.getItem('security-test-seeded')) return;
                    localStorage.setItem('security-test-seeded', 'true');
                    localStorage.setItem('migraines', JSON.stringify([{ id: 'legacy', startTime: '2026-01-01T10:00:00Z', endTime: '2026-01-01T11:00:00Z', painLevel: 4, duration: 60, notes: '<img src=x onerror="window.compromised=1">' }]));
                    localStorage.setItem('cycleData', JSON.stringify({ enabled: true, periods: [{ startDate: '2026-01-01' }] }));
                    localStorage.setItem('assessments', JSON.stringify([]));
                    localStorage.setItem('userMedications', JSON.stringify([{ id: 'med', name: 'Test medicine', type: 'abortive', dosages: [], forms: [] }]));
                });
                const page = await context.newPage();
                const errors = [];
                page.on('pageerror', error => errors.push(error.message));
                await page.goto(`http://127.0.0.1:${server.address().port}`);
                await page.waitForFunction(() => document.querySelector('#app-loading-screen.hidden'));
                const migrated = await page.evaluate(async () => {
                    return {
                        local: ['migraines', 'activeMigraine', 'cycleData', 'assessments', 'userMedications'].filter(k => localStorage.getItem(k) !== null),
                        records: (await IDB.getAll(DB_STORES.MIGRAINES)).length,
                        medicines: (await IDB.get(DB_STORES.SETTINGS, 'userMedications')).value.length,
                        cycle: cycleData.enabled
                    };
                });
                assert.deepEqual(migrated, { local: [], records: 1, medicines: 1, cycle: true });
                const sanitized = await page.evaluate(() => {
                    const node = document.createElement('div');
                    node.innerHTML = safeHTML('<img src=x onerror="window.compromised=1"><script>window.compromised=1</script><a href="javascript:alert(1)">link</a><button onclick="window.compromised=1">click</button>');
                    return { scripts: node.querySelectorAll('script,img,[onclick],[onerror]').length, javascriptURL: !!node.querySelector('a[href]') };
                });
                assert.deepEqual(sanitized, { scripts: 0, javascriptURL: false });
                await page.evaluate(() => {
                    window.cspViolations = [];
                    document.addEventListener('securitypolicyviolation', e => window.cspViolations.push(e.effectiveDirective));
                    const button = document.createElement('button');
                    button.setAttribute('onclick', 'window.compromised=1'); document.body.append(button); button.click(); button.remove();
                    const script = document.createElement('script'); script.textContent = 'window.compromised=1'; document.body.append(script); script.remove();
                    showDebugModal();
                });
                await page.locator('[data-ui-action="close-debug"]').click();
                await page.waitForFunction(() => window.cspViolations.length >= 2);
                assert.equal(await page.evaluate(() => !!window.compromised), false);
                await page.evaluate(() => showAddMedicationModal());
                await page.locator('#med-picker-cancel').click();
                await page.evaluate(() => { migraines[0].deleted = true; migraines[0].deletedAt = new Date().toISOString(); viewTrash(); });
                await page.locator('[data-ui-action="close-modal"]').click();
                await page.evaluate(async () => { await enableEncryption('regression-only-passphrase'); });
                await page.evaluate(async () => {
                    await navigator.serviceWorker.ready;
                    const cache = await caches.open((await caches.keys()).find(k => k.startsWith('aiding-migraine-')));
                    for (const asset of ['logger.js', 'actions.js', 'health-storage.js']) {
                        if (!await cache.match('./assets/' + asset)) throw new Error('Security asset missing offline: ' + asset);
                    }
                });
                const encrypted = await page.evaluate(async () => ({
                    plaintextRecords: (await IDB.getAll(DB_STORES.MIGRAINES)).length,
                    plaintextMedications: (await IDB.getAll(DB_STORES.MEDICATIONS)).length,
                    plaintextSettings: (await Promise.all(['activeMigraine', 'cycleData', 'assessments', 'userMedications'].map(k => IDB.get(DB_STORES.SETTINGS, k)))).filter(Boolean).length,
                    encryptedVault: !!localStorage.getItem('encVault'),
                    localPlaintext: ['migraines', 'cycleData', 'assessments', 'userMedications'].filter(k => localStorage.getItem(k))
                }));
                assert.deepEqual(encrypted, { plaintextRecords: 0, plaintextMedications: 0, plaintextSettings: 0, encryptedVault: true, localPlaintext: [] });
                assert.deepEqual(errors, []);
                await context.close();
            } finally { await browser.close(); }
        }
    } finally { await new Promise(resolve => server.close(resolve)); }
});
