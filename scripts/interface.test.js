const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const app = fs.readFileSync('assets/app.js', 'utf8');
function declaration(source, name) {
    const start = new RegExp('^(?:async )?function ' + name + '\\(', 'm').exec(source).index;
    return source.slice(start, source.indexOf('\n}', start) + 2);
}
test('history journal sorts by date, escapes record identifiers, and retains a details action', () => {
    const list = { dataset: {}, addEventListener() {}, innerHTML: '' };
    const ctx = vm.createContext({ document: { getElementById: () => list },
        getActiveMigraines: () => [
            { id: 'old" onclick="bad', startTime: '2025-01-01T12:00:00Z', duration: 60, painLevel: 2 },
            { id: 'new', startTime: '2026-01-02T12:00:00Z', duration: 120, painLevel: 5 }],
        safeHTML: html => html, formatDate: date => date.toISOString(), formatTime: () => '12:00', formatDuration: () => '2m',
    });
    vm.runInContext(declaration(app, 'safeText') + '\n' + declaration(app, 'renderHistory'), ctx);
    ctx.renderHistory();
    assert.ok(list.innerHTML.indexOf('data-id="new"') < list.innerHTML.indexOf('data-id="old'));
    assert.ok(list.innerHTML.includes('data-action="view"'));
    assert.ok(!list.innerHTML.includes('onclick="bad'));
    assert.ok(list.innerHTML.includes('old&quot; onclick=&quot;bad'));
});
test('insight categories expose only the selected panel, including empty-category messaging', () => {
    let entries = [{}];
    const tabs = {};
    const panels = ['overview', 'symptoms', 'treatment', 'weather'].map(key => {
        const grid = { children: [{ style: { display: key === 'overview' ? '' : 'none' } }] };
        const message = {};
        return { id: 'insight-' + key, grid, message, querySelector: selector => selector === '.insight-grid' ? grid : message };
    });
    const ctx = vm.createContext({ getActiveMigraines: () => entries,
        document: { addEventListener() {}, querySelector: () => tabs, querySelectorAll: () => panels } });
    vm.runInContext(fs.readFileSync('assets/interface.js', 'utf8'), ctx);
    ctx.refreshInsightSections();
    assert.equal(panels[0].hidden, false);
    assert.equal(panels[1].hidden, true);
    vm.runInContext("selectedInsight = 'symptoms'", ctx);
    ctx.refreshInsightSections();
    assert.equal(panels[0].hidden, true);
    assert.equal(panels[1].hidden, false);
    assert.equal(panels[1].message.hidden, false);
    entries = [];
    ctx.refreshInsightSections();
    assert.ok(panels.every(panel => panel.hidden));
    assert.equal(tabs.hidden, true);
});
test('theme bootstrap honors saved choices and provides a safe default with unavailable storage', () => {
    for (const [saved, expected] of [['warm-light','warm-light'],['dark','warm-dark'],['high-contrast','high-contrast'],['unknown','warm-dark']]) {
        let actual;
        const ctx = vm.createContext({ localStorage: { getItem: () => saved }, document: { documentElement: { setAttribute: (_, value) => { actual = value; } } }, window: { addEventListener() {} } });
        vm.runInContext(fs.readFileSync('assets/theme.js','utf8'), ctx);
        assert.equal(actual, expected);
    }
    let actual;
    const ctx = vm.createContext({ localStorage: { getItem: () => { throw Error('blocked'); } }, document: { documentElement: { setAttribute: (_, value) => { actual = value; } } }, window: { addEventListener() {} } });
    vm.runInContext(fs.readFileSync('assets/theme.js','utf8'), ctx);
    assert.equal(actual, 'warm-dark');
});

test('medication waits for persistence and rolls back a failed save', async () => {
    for (const fails of [false, true]) {
        const list = [], notices = [];
        const button = { disabled: false };
        let finish, closed = false;
        const persistence = new Promise((resolve, reject) => { finish = () => fails ? reject(Error('full')) : resolve(); });
        const ctx = vm.createContext({ Date, document: { getElementById: () => button },
            medicationPickerContext: { getList: () => list, onChange: () => persistence },
            renderMedicationsList() {}, closeModal() { closed = true; }, showToast: text => notices.push(text) });
        vm.runInContext(declaration(app, 'addMedicationToEpisode'), ctx);
        const saving = ctx.addMedicationToEpisode({ name: 'Test medication' });
        assert.equal(button.disabled, true);
        assert.equal(closed, false, 'Do not dismiss the sheet before storage completes');
        finish(); await saving;
        assert.equal(list.length, fails ? 0 : 1);
        assert.equal(closed, !fails);
        assert.match(notices.at(-1), fails ? /Could not save/ : /saved/);
    }
});

test('date input formatting uses the local calendar day, not the UTC day', () => {
    const ctx = vm.createContext({});
    vm.runInContext(declaration(app, 'localInputDate'), ctx);
    const previous = process.env.TZ;
    process.env.TZ = 'America/New_York';
    try {
        for (const [iso, expected] of [['2026-09-10T02:15:00Z', '2026-09-09'], ['2026-01-01T02:15:00Z', '2025-12-31'], ['2026-03-08T06:30:00Z', '2026-03-08']]) {
            assert.equal(ctx.localInputDate(new Date(iso)), expected);
        }
    } finally {
        if (previous === undefined) delete process.env.TZ;
        else process.env.TZ = previous;
    }
});

test('the service worker serves a matching installed release even when the network changes', async () => {
    const handlers = {};
    let networkCalls = 0, pending;
    const cache = { match: async (request, options) => {
        assert.equal(options.ignoreSearch, true);
        return new Response('installed release');
    } };
    const ctx = vm.createContext({ URL, Response, console,
        self: { location: { origin: 'https://example.test' }, registration: { scope: 'https://example.test/app/' }, addEventListener: (name, fn) => { handlers[name] = fn; } },
        caches: { open: async () => cache }, fetch: async () => { networkCalls++; return new Response('new release'); }
    });
    vm.runInContext(fs.readFileSync('service-worker.js', 'utf8'), ctx);
    for (const url of ['https://example.test/app/', 'https://example.test/app/assets/app.js?v=release']) {
        handlers.fetch({ request: new Request(url), respondWith: promise => { pending = promise; } });
        assert.equal(await (await pending).text(), 'installed release');
    }
    assert.equal(networkCalls, 0, 'HTML cannot advance independently of the installed CSS/JS');
});
