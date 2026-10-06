const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

process.env.NODE_ENV = 'production';
process.env.ADMIN_API_KEY = 'test-admin-credential';
let server, origin, database, directory, client = 1;
const prefs = { dailyCheckIn: { enabled: false, time: '19:30', frequency: 'daily' } };
function subscription(name) {
    const ec = crypto.createECDH('prime256v1'); ec.generateKeys();
    return { endpoint: `https://fcm.googleapis.com/fcm/send/test-${name}`, keys: {
        p256dh: ec.getPublicKey().toString('base64url'), auth: crypto.randomBytes(16).toString('base64url')
    } };
}
async function request(route, body, extra = {}) {
    const response = await fetch(origin + route, {
        method: body ? 'POST' : 'GET',
        headers: { 'Content-Type': 'application/json', Origin: 'https://aidedmarketing.github.io',
            'X-Forwarded-For': `192.0.2.${client++}`, ...extra },
        body: body ? JSON.stringify(body) : undefined
    });
    return { status: response.status, body: await response.json().catch(() => null) };
}
before(async () => {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'migraine-security-'));
    process.env.DATA_DIR = directory;
    database = require('../database');
    await database.initializeDatabase();
    const { app } = require('../index');
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    origin = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
    await new Promise(resolve => server.close(resolve));
    await database.flushWrites();
    await fs.rm(directory, { recursive: true, force: true });
});

test('public routes cannot enumerate, overwrite, schedule, or cancel another subscription', async () => {
    const a = subscription('a'), b = subscription('b');
    for (const sub of [a, b]) {
        const result = await request('/api/subscriptions/subscribe', { subscription: sub, preferences: prefs });
        assert.equal(result.status, 201);
        assert.ok(!JSON.stringify(result.body).includes(sub.keys.auth), 'Responses omit browser credentials');
    }
    assert.equal((await request('/api/subscriptions')).status, 401);
    const conflicting = await request('/api/subscriptions/subscribe', { subscription: { ...b, keys: a.keys }, preferences: prefs });
    assert.equal(conflicting.status, 201);
    assert.deepEqual(conflicting.body, { success: true, message: 'Subscription created successfully', subscription: { endpoint: b.endpoint } });
    assert.deepEqual(database.getSubscriptionByEndpoint(b.endpoint).keys, b.keys, 'A generic enrollment acknowledgment cannot overwrite a subscriber');
    const wrong = await request('/api/subscriptions/update-preferences', { endpoint: b.endpoint, keys: a.keys, preferences: prefs });
    const unknown = await request('/api/subscriptions/update-preferences', { endpoint: subscription('missing').endpoint, keys: a.keys, preferences: prefs });
    assert.deepEqual(wrong, unknown, 'Unknown subscriptions are indistinguishable from invalid ownership');
    const checkInTime = new Date(Date.now() + 3600000).toISOString();
    for (const sub of [a, b]) assert.equal((await request('/api/notifications/schedule-active-checkin', {
        attackId: 'same-attack', checkInTime, subscriptionEndpoint: sub.endpoint, keys: sub.keys
    })).status, 201);
    assert.equal((await request('/api/notifications/cancel-active-checkin', {
        attackId: 'same-attack', subscriptionEndpoint: b.endpoint, keys: a.keys
    })).status, 401);
    assert.equal((await request('/api/notifications/cancel-active-checkin', {
        attackId: 'same-attack', subscriptionEndpoint: a.endpoint, keys: a.keys
    })).status, 200);
    const records = JSON.parse(await fs.readFile(path.join(directory, 'scheduled-active-checkins.json')));
    assert.equal(records.length, 1);
    assert.equal(records[0].subscriptionEndpoint, b.endpoint);
    assert.equal((await request('/api/subscriptions/unsubscribe', { endpoint: b.endpoint, keys: b.keys })).status, 200);
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(directory, 'scheduled-active-checkins.json'))), []);
});

test('CORS, endpoint restrictions, schedule validation and admin authentication fail closed', async () => {
    assert.equal((await request('/api/subscriptions', undefined, { Origin: 'https://untrusted.example' })).status, 403);
    const security = require('../middleware/security');
    for (const origin of ['*', 'https://aidedmarketing.github.io/AidingMigraine', 'http://localhost:8080']) {
        assert.throws(() => security.allowedOrigins({ NODE_ENV: 'production', ALLOWED_ORIGINS: origin }));
    }
    const sub = subscription('validation');
    assert.equal((await request('/api/subscriptions/subscribe', { subscription: { ...sub, endpoint: 'http://fcm.googleapis.com/x' } })).status, 400);
    assert.equal((await request('/api/subscriptions/subscribe', { subscription: { ...sub, endpoint: 'https://fcm.googleapis.com.evil.example/x' } })).status, 400);
    await request('/api/subscriptions/subscribe', { subscription: sub, preferences: prefs });
    process.env.VAPID_PUBLIC_KEY = sub.keys.p256dh;
    assert.deepEqual((await request('/api/public-key')).body, { publicKey: sub.keys.p256dh });
    assert.equal((await request('/api/notifications/schedule-followup', { attackId: 'a', followUpTime: 'invalid', subscriptionEndpoint: sub.endpoint, keys: sub.keys })).status, 400);
    assert.equal((await request('/api/subscriptions/update-preferences', { endpoint: sub.endpoint, keys: sub.keys, preferences: { dailyCheckIn: { utcMinutes: 60 } } })).status, 400);
    assert.equal((await request('/api/subscriptions', undefined, { 'X-API-Key': process.env.ADMIN_API_KEY })).status, 200);
    const key = process.env.ADMIN_API_KEY;
    delete process.env.ADMIN_API_KEY;
    assert.equal((await request('/api/subscriptions')).status, 503);
    process.env.ADMIN_API_KEY = key;
});

test('daily reminders honor local minutes, DST, disabled frequency and persisted deduplication', async () => {
    const sub = subscription('daily');
    await database.addSubscription({ ...sub, preferences: { dailyCheckIn: { enabled: true, time: '19:30', timezone: 'America/New_York', frequency: 'daily' } } });
    const due = iso => { const now = new Date(iso); return database.getSubscriptionsForDailyCheckIn(now.getUTCHours(), now.getUTCDay(), now).filter(s => s.endpoint === sub.endpoint); };
    assert.equal(due('2030-07-01T23:29:00Z').length, 0);
    assert.equal(due('2030-07-01T23:30:00Z').length, 1);
    await database.markDailyCheckInAsSent(sub.endpoint);
    assert.equal(due('2030-07-01T23:31:00Z').length, 0);
    assert.equal(due('2030-12-02T00:29:00Z').length, 0);
    assert.equal(due('2030-12-02T00:30:00Z').length, 1);
    await database.updateSubscriptionPreferences(sub.endpoint, { dailyCheckIn: { enabled: true, time: '00:00', frequency: 'disabled' } });
    assert.equal(due('2030-12-02T00:30:00Z').length, 0);
});

test('sensitive routes enforce per-IP rate limits', async () => {
    let response;
    for (let i = 0; i < 11; i++) response = await request('/api/subscriptions', undefined, { 'X-Forwarded-For': '198.51.100.10' });
    assert.equal(response.status, 429);
});

test('a 12-reminder series schedules and cancels in single requests below the rate limit', async () => {
    const sub = subscription('series');
    await request('/api/subscriptions/subscribe', { subscription: sub, preferences: prefs });
    const body = { attackId: 'series-attack', subscriptionEndpoint: sub.endpoint, keys: sub.keys };
    const checkIns = Array.from({ length: 12 }, (_, i) => new Date(Date.now() + (i + 1) * 7200000).toISOString());
    assert.equal((await request('/api/notifications/schedule-active-checkin', { ...body, checkIns })).status, 201);
    const records = JSON.parse(await fs.readFile(path.join(directory, 'scheduled-active-checkins.json')));
    assert.equal(records.filter(c => c.subscriptionEndpoint === sub.endpoint).length, 12);
    assert.equal((await request('/api/notifications/cancel-active-checkin', { ...body, cancelSeries: true })).status, 200);
    assert.equal(JSON.parse(await fs.readFile(path.join(directory, 'scheduled-active-checkins.json'))).filter(c => c.subscriptionEndpoint === sub.endpoint).length, 0);
});
