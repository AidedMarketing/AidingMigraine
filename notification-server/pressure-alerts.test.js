// Run with: npm test (in notification-server/) — node --test pressure-alerts.test.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
    findStrongestPressureWindow,
    findStrongestPressureDrift,
    localDateKey,
    shouldSendPressureAlert,
    shouldSendPressureDrift,
    fetchPressureForecast
} = require('./pressure-alerts');

const NOW = new Date('2026-11-13T12:00:00.000Z');

// Build an hourly series starting 1h before NOW; pressuresAt(hourOffset)
// gives the pressure for the point `hourOffset` hours after NOW.
function series(hours, pressuresAt) {
    return Array.from({ length: hours }, (_, i) => {
        const offset = i - 1; // first point is NOW - 1h
        return {
            time: new Date(NOW.getTime() + offset * 3600000).toISOString(),
            pressure: pressuresAt(offset)
        };
    });
}

test('finds a dropping window that meets the threshold', () => {
    // Steady 1015, then a 7 hPa drop spread over hours +2..+8
    const hourly = series(30, h => (h < 2 ? 1015 : Math.max(1008, 1015 - (h - 1))));
    const result = findStrongestPressureWindow(hourly, 5, NOW);
    assert.ok(result);
    assert.equal(result.direction, 'drop');
    assert.ok(result.rapidChange >= 5);
    assert.ok(result.hoursUntil >= 0 && result.hoursUntil <= 24);
    assert.equal(result.eventKey, result.startTime);
});

test('finds a rising window and reports direction rise', () => {
    const hourly = series(30, h => (h < 3 ? 1005 : Math.min(1012, 1005 + (h - 2))));
    const result = findStrongestPressureWindow(hourly, 5, NOW);
    assert.ok(result);
    assert.equal(result.direction, 'rise');
    assert.ok(result.totalChange > 0);
});

test('returns null when the change stays below the threshold', () => {
    const hourly = series(30, h => 1012 + Math.sin(h / 3)); // ±1 hPa wobble
    assert.equal(findStrongestPressureWindow(hourly, 5, NOW), null);
});

test('ignores windows that start in the past', () => {
    // Big drop entirely before NOW
    const hourly = series(30, h => (h < -1 ? 1020 : 1010));
    assert.equal(findStrongestPressureWindow(hourly, 5, NOW), null);
});

test('ignores windows starting beyond the 24h lookahead', () => {
    const hourly = series(60, h => (h < 30 ? 1015 : Math.max(1005, 1015 - (h - 29))));
    assert.equal(findStrongestPressureWindow(hourly, 5, NOW), null);
});

test('returns null for short or invalid input', () => {
    assert.equal(findStrongestPressureWindow([], 5, NOW), null);
    assert.equal(findStrongestPressureWindow(series(3, () => 1010), 5, NOW), null);
    assert.equal(findStrongestPressureWindow(null, 5, NOW), null);
    assert.equal(findStrongestPressureWindow(series(30, () => 1010), 0, NOW), null);
});

test('localDateKey respects the timezone', () => {
    const date = new Date('2026-11-13T02:30:00.000Z'); // Nov 12, 21:30 in New York
    assert.equal(localDateKey(date, 'America/New_York'), '2026-11-12');
    assert.equal(localDateKey(date, 'UTC'), '2026-11-13');
    assert.equal(localDateKey(date, 'Not/AZone'), '2026-11-13'); // falls back to UTC
});

test('shouldSendPressureAlert dedupes by event and by local day', () => {
    assert.equal(shouldSendPressureAlert(undefined, 'evt1', '2026-11-13'), true);
    assert.equal(shouldSendPressureAlert({}, 'evt1', '2026-11-13'), true);
    // Same event again — never re-fire
    assert.equal(shouldSendPressureAlert(
        { lastEventKey: 'evt1', lastSentLocalDate: '2026-11-12' }, 'evt1', '2026-11-13'), false);
    // Different event but already alerted today — one per day max
    assert.equal(shouldSendPressureAlert(
        { lastEventKey: 'evt0', lastSentLocalDate: '2026-11-13' }, 'evt1', '2026-11-13'), false);
    // Different event on a new day — allowed
    assert.equal(shouldSendPressureAlert(
        { lastEventKey: 'evt0', lastSentLocalDate: '2026-11-12' }, 'evt1', '2026-11-13'), true);
});

test('drift: finds a slow 24h decline that no 6h window catches', () => {
    // Steady -0.3 hPa/hour: 1.8 hPa per 6h window (below a 5 threshold),
    // but 7.2 hPa across 24h — the slow-front case.
    const hourly = series(50, h => 1015 - 0.3 * (h + 1));
    assert.equal(findStrongestPressureWindow(hourly, 5, NOW), null);
    const result = findStrongestPressureDrift(hourly, 5, NOW);
    assert.ok(result);
    assert.equal(result.direction, 'drop');
    assert.equal(result.driftChange, 7.2);
    assert.ok(result.hoursUntil >= 0 && result.hoursUntil <= 24);
    assert.equal(result.eventKey, result.startTime);
});

test('drift: reports a rising drift with direction rise', () => {
    const hourly = series(50, h => 1005 + 0.3 * (h + 1));
    const result = findStrongestPressureDrift(hourly, 5, NOW);
    assert.ok(result);
    assert.equal(result.direction, 'rise');
    assert.ok(result.totalChange > 0);
});

test('drift: returns null when the 24h change stays below the threshold', () => {
    const hourly = series(50, h => 1012 + Math.sin(h / 3)); // ±1 hPa wobble
    assert.equal(findStrongestPressureDrift(hourly, 5, NOW), null);
});

test('drift: ignores spans starting beyond the 24h lookahead', () => {
    // Flat until hour +49, then a steep fall no in-lookahead start can span
    const hourly = series(60, h => (h < 49 ? 1015 : 1015 - (h - 48)));
    assert.equal(findStrongestPressureDrift(hourly, 5, NOW), null);
});

test('drift: returns null for short or invalid input', () => {
    assert.equal(findStrongestPressureDrift([], 5, NOW), null);
    assert.equal(findStrongestPressureDrift(series(10, () => 1010), 5, NOW), null);
    assert.equal(findStrongestPressureDrift(null, 5, NOW), null);
    assert.equal(findStrongestPressureDrift(series(50, () => 1010), 0, NOW), null);
});

test('shouldSendPressureDrift dedupes by drift event and local day, independent of rapid state', () => {
    assert.equal(shouldSendPressureDrift(undefined, 'evt1', '2026-11-13'), true);
    assert.equal(shouldSendPressureDrift({}, 'evt1', '2026-11-13'), true);
    // Same drift event again — never re-fire
    assert.equal(shouldSendPressureDrift(
        { lastDriftEventKey: 'evt1', lastDriftSentLocalDate: '2026-11-12' }, 'evt1', '2026-11-13'), false);
    // Different drift event but a drift already went out today
    assert.equal(shouldSendPressureDrift(
        { lastDriftEventKey: 'evt0', lastDriftSentLocalDate: '2026-11-13' }, 'evt1', '2026-11-13'), false);
    // Different drift event on a new day — allowed
    assert.equal(shouldSendPressureDrift(
        { lastDriftEventKey: 'evt0', lastDriftSentLocalDate: '2026-11-12' }, 'evt1', '2026-11-13'), true);
    // A rapid alert sent today does not consume the drift allowance
    assert.equal(shouldSendPressureDrift(
        { lastEventKey: 'rapid1', lastSentLocalDate: '2026-11-13' }, 'evt1', '2026-11-13'), true);
});

test('fetchPressureForecast maps unixtime + pressure arrays', async () => {
    const fakeFetch = async url => {
        assert.match(url, /api\.open-meteo\.com/);
        assert.match(url, /timeformat=unixtime/);
        return {
            ok: true,
            json: async () => ({
                hourly: {
                    time: [1794535200, 1794538800],
                    surface_pressure: [1013.24, 1011.75]
                }
            })
        };
    };
    const result = await fetchPressureForecast(25.76, -80.19, fakeFetch);
    assert.equal(result.length, 2);
    assert.equal(result[0].pressure, 1013.2);
    assert.equal(result[1].pressure, 1011.8);
    assert.equal(result[0].time, new Date(1794535200 * 1000).toISOString());
});
