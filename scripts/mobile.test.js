// Run after installing Playwright: npm run test:mobile
// Test records live only in fresh, isolated browser contexts.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium, webkit } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const root = path.resolve(__dirname, '..');
let server, origin;
let networkUnavailable = false;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
async function startServer() {
    server = http.createServer((req, res) => {
        if (networkUnavailable) { req.socket.destroy(); return; }
        res.setHeader('Cache-Control', 'no-store');
        const url = new URL(req.url, 'http://localhost');
        const file = path.join(root, decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
        if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
        try { res.setHeader('Content-Type', types[path.extname(file)] || 'text/plain'); res.end(fs.readFileSync(file)); }
        catch { res.writeHead(404).end(); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${server.address().port}`;
}
async function ready(page) {
    await page.waitForFunction(() => document.querySelector('#app-loading-screen.hidden') && typeof showPage === 'function');
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    await page.waitForFunction(() => document.querySelector('#app-loading-screen.hidden'));
}
async function fits(page, label) {
    const result = await page.evaluate(() => {
        const targets = document.querySelectorAll('.page.active *, .app-topbar *, .modal.active *');
        return {
            width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
            outside: [...targets].filter(el => {
                const r = el.getBoundingClientRect();
                return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1);
            }).map(el => el.id || el.className).slice(0, 12)
        };
    });
    assert.ok(result.scrollWidth <= result.width, `${label}: page scrolls sideways`);
    assert.deepEqual(result.outside, [], `${label}: content exceeds the viewport`);
}
async function screenshot(page, name) {
    if (!process.env.MOBILE_SCREENSHOTS) return;
    fs.mkdirSync(process.env.MOBILE_SCREENSHOTS, { recursive: true });
    await page.screenshot({ path: path.join(process.env.MOBILE_SCREENSHOTS, `${name}.png`), fullPage: false });
}

test('mobile layouts, tracking, editing, themes and offline journal', { timeout: 240000 }, async t => {
    await startServer();
    try {
        for (const engine of [chromium, webkit].filter(engine => !process.env.MOBILE_ENGINE || process.env.MOBILE_ENGINE === engine.name())) {
            const browser = await engine.launch();
            try {
                for (const width of [320, 390, 430, 768, 1280].filter(width => !process.env.MOBILE_WIDTH || Number(process.env.MOBILE_WIDTH) === width)) {
                    await t.test(`${engine.name()} at ${width}px`, async () => {
                        const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: width < 768, timezoneId: 'America/New_York' });
                        const page = await context.newPage();
                        const errors = [];
                        page.on('pageerror', error => errors.push(error.message));
                        try {
                            await page.goto(origin); await ready(page);
                            if (width === 390) await page.evaluate(() => {
                                document.documentElement.style.setProperty('--safe-top', '59px');
                                document.documentElement.style.setProperty('--safe-bottom', '34px');
                            });
                            for (const screen of ['log', 'history', 'more', 'settings', 'analytics', 'care']) {
                                await page.evaluate(name => showPage(name), screen);
                                await page.locator('.page.active details').evaluateAll(nodes => nodes.forEach(node => { node.open = true; }));
                                await fits(page, screen);
                            }
                            await page.evaluate(() => showPage('log'));
                            await page.locator('#detailed-log').evaluate(node => { node.open = false; });
                            const settings = await page.locator('.settings-shortcut').boundingBox();
                            assert.ok(settings.y >= (width === 390 ? 59 : 0), 'Settings clears status bar');
                            const nav = await page.locator('.bottom-nav').boundingBox();
                            assert.ok(Math.abs(nav.y + nav.height - (width >= 900 ? 828 : 844)) <= 1, 'Navigation stays at bottom');
                            if (width === 390) await screenshot(page, `${engine.name()}-today`);
                            await page.locator('#start-attack-btn').click();
                            await page.locator('#active-episode-section').waitFor({ state: 'visible' });
                            await fits(page, 'active');
                            if (width === 390) {
                                await page.locator('.toast-dismiss').click();
                                await screenshot(page, `${engine.name()}-active`);
                            }
                            await page.locator('#update-pain-btn').click();
                            assert.equal(await page.locator('#confirm-pain-update').isDisabled(), true);
                            assert.equal(await page.locator('#toast-region .toast:not(.error)').count(), 0, 'Old success notices cannot obscure pain controls');
                            await page.locator('#modal [data-pain="6"]').click();
                            await page.locator('#modal [data-pain="8"]').click();
                            assert.equal(await page.locator('#modal [aria-pressed="true"]').count(), 1);
                            if (width === 390) await screenshot(page, `${engine.name()}-pain`);
                            await page.locator('#confirm-pain-update').click();
                            await page.locator('#quick-medication-btn').click();
                            await page.locator('#med-search').fill('Ibuprofen');
                            await page.getByRole('button', { name: /Ibuprofen/ }).click();
                            await page.locator('#med-dosage').selectOption('200mg');
                            await page.locator('#confirm-add-med').click();
                            await page.locator('#modal').waitFor({ state: 'hidden' });
                            await page.waitForFunction(() => activeMigraine.medications?.length === 1);
                            await page.reload(); await ready(page);
                            assert.equal(await page.evaluate(() => activeMigraine.painLevel), 8);
                            assert.equal(await page.evaluate(() => activeMigraine.medications[0].name), 'Ibuprofen');
                            await page.locator('#end-episode-btn').click();
                            await page.locator('#confirm-end').click();
                            await page.locator('#logging-section').waitFor({ state: 'visible' });
                            if (width === 390) await page.evaluate(async () => {
                                const start = new Date(Date.now() - 2 * 86400000);
                                start.setHours(23, 45, 20, 123);
                                migraines[0].startTime = start.toISOString();
                                migraines[0].endTime = new Date(+start + 3600000).toISOString();
                                migraines[0].duration = 3600;
                                await saveData();
                            });
                            const originalTimes = await page.evaluate(() => [migraines[0].startTime, migraines[0].endTime]);
                            await page.locator('#recent-entry').click();
                            await page.locator('.history-entry').click();
                            await page.getByRole('button', { name: 'Edit', exact: true }).click();
                            await fits(page, 'episode editor');
                            await page.locator('#edit-notes').fill('Browser regression record');
                            await page.locator('#save-edit-btn').click();
                            await page.locator('#modal').waitFor({ state: 'hidden' });
                            await page.waitForFunction(() => migraines[0].notes === 'Browser regression record');
                            assert.deepEqual(await page.evaluate(() => [migraines[0].startTime, migraines[0].endTime]), originalTimes, 'Editing notes preserves exact timestamps across local midnight');
                            if (width === 390) {
                                const downloadPromise = page.waitForEvent('download');
                                await page.evaluate(() => exportJSON());
                                const download = await downloadPromise;
                                const stream = await download.createReadStream();
                                const chunks = [];
                                for await (const chunk of stream) chunks.push(chunk);
                                const backup = JSON.parse(Buffer.concat(chunks).toString());
                                assert.equal(backup.migraines[0].notes, 'Browser regression record');
                                assert.equal(backup.migraines[0].medications[0].name, 'Ibuprofen');
                            }
                            await page.evaluate(() => { closeModal(); showPage('settings'); });
                            await page.locator('.settings-panel').first().evaluate(node => { node.open = true; });
                            for (const theme of ['warm-light', 'high-contrast', 'warm-dark']) {
                                await page.locator(`[data-theme="${theme}"].theme-btn`).click();
                                assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
                                const colors = await page.evaluate(() => ({ background: getComputedStyle(document.body).backgroundColor, ink: getComputedStyle(document.body).color }));
                                const expected = { 'warm-light': ['rgb(247, 244, 239)', 'rgb(49, 42, 64)'], 'warm-dark': ['rgb(28, 28, 39)', 'rgb(240, 237, 245)'], 'high-contrast': ['rgb(0, 0, 0)', 'rgb(255, 255, 255)'] }[theme];
                                assert.deepEqual([colors.background, colors.ink], expected, 'Legacy selectors cannot override the selected theme');
                            }
                            // WebKit's automated offline toggle aborts navigations before SW
                            // interception on macOS. Kill server connections to exercise its cache.
                            if (engine === chromium) await context.setOffline(true);
                            networkUnavailable = true;
                            await page.reload(); await ready(page);
                            assert.equal(await page.evaluate(() => typeof DOMPurify.sanitize), 'function', 'Sanitizer is available offline');
                            await page.evaluate(() => showPage('history'));
                            assert.equal(await page.locator('.history-entry').count(), 1, 'Offline history renders controls');
                            await page.locator('.history-entry').click();
                            assert.ok((await page.locator('#modal-body').innerText()).includes('Browser regression record'));
                            await page.evaluate(() => { closeModal(); showPage('log'); });
                            await page.locator('#start-attack-btn').click();
                            await page.locator('#end-episode-btn').click();
                            await page.locator('#modal [data-pain="0"]').click();
                            await page.locator('#modal [data-pain="3"]').click();
                            assert.equal(await page.locator('#end-pain-scale [aria-pressed="true"]').count(), 1);
                            await page.locator('#confirm-end').click();
                            await page.waitForFunction(() => migraines.length === 2);
                            assert.deepEqual(errors, []);
                        } catch (error) { console.error(error); throw error; } finally { networkUnavailable = false; await context.close(); }
                    });
                }
                await t.test(`${engine.name()} enlarged text, short screen and landscape`, async () => {
                    const context = await browser.newContext({ viewport: { width: 320, height: 740 }, isMobile: true });
                    const page = await context.newPage();
                    try {
                        await page.goto(origin); await ready(page);
                        await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
                        for (const screen of ['log', 'settings', 'history', 'more', 'care']) {
                            await page.evaluate(name => showPage(name), screen);
                            await page.locator('.page.active details').evaluateAll(nodes => nodes.forEach(node => { node.open = true; }));
                            await fits(page, `200% ${screen}`);
                        }
                        await page.evaluate(() => { showPage('log'); showUpdateBanner(); });
                        await page.waitForTimeout(100);
                        const banner = await page.locator('#update-banner').boundingBox();
                        const settings = await page.locator('.settings-shortcut').boundingBox();
                        assert.ok(settings.y >= banner.y + banner.height, 'Update notice does not cover Settings');
                        await page.evaluate(() => hideUpdateBanner());
                        await page.locator('#start-attack-btn').click();
                        await page.locator('#end-episode-btn').click();
                        await fits(page, '200% end dialog');
                        await page.locator('#modal [data-pain="6"]').click();
                        await page.locator('#confirm-end').click();
                        await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
                        for (const size of [{ width: 375, height: 667 }, { width: 844, height: 390 }]) {
                            await page.setViewportSize(size);
                            await page.locator('#start-attack-btn').click();
                            await page.locator('#quick-medication-btn').click();
                            await fits(page, 'short medication sheet');
                            const actions = await page.locator('#modal-actions').boundingBox();
                            assert.ok(actions.y + actions.height <= size.height + 1, 'Sheet actions are reachable');
                            await page.getByRole('button', { name: 'Cancel', exact: true }).click();
                            await page.locator('#end-episode-btn').click();
                            await page.locator('#modal [data-pain="4"]').click();
                            await page.locator('#confirm-end').click();
                        }
                    } catch (error) { console.error(error); throw error; } finally { networkUnavailable = false; await context.close(); }
                });
            } finally { await browser.close(); }
        }
    } finally { await new Promise(resolve => server.close(resolve)); }
});
