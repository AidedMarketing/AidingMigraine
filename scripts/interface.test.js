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
