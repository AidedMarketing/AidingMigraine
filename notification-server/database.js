const logger = require('./logger');
/**
 * Database module - Handles storage of user subscriptions and preferences
 *
 * For development: Uses JSON file storage
 * For production: Extend this to use PostgreSQL, MongoDB, or similar
 */

const fs = require('fs').promises;
const path = require('path');

// DATA_DIR is deployment configuration, never request input. Use a durable mount in production.
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));

// Secure path validation - prevents path traversal attacks
function validateDataPath(relativePath) {
    const dataDir = DATA_DIR;
    const fullPath = path.resolve(dataDir, relativePath);

    // Ensure the resolved path is within the data directory
    if (!fullPath.startsWith(dataDir + path.sep)) {
        throw new Error('Path traversal attack detected');
    }

    return fullPath;
}

// Secure database paths - all validated to stay within data directory
const DB_PATH = validateDataPath(
    process.env.DB_PATH ? path.basename(process.env.DB_PATH) : 'subscriptions.json'
);
const FOLLOWUPS_PATH = validateDataPath('scheduled-followups.json');
const ACTIVE_CHECKINS_PATH = validateDataPath('scheduled-active-checkins.json');

let subscriptions = [];
let scheduledFollowups = [];
let scheduledActiveCheckins = [];

async function initializeDatabase() {
    try {
        // Create data directory if it doesn't exist
        const dataDir = path.dirname(DB_PATH);
        await fs.mkdir(dataDir, { recursive: true });

        // Load existing subscriptions
        try {
            const data = await fs.readFile(DB_PATH, 'utf8');
            subscriptions = JSON.parse(data);
            logger.log(`Loaded ${subscriptions.length} subscriptions from database`);
        } catch (err) {
            if (err.code === 'ENOENT') {
                // File doesn't exist, create empty file
                await fs.writeFile(DB_PATH, JSON.stringify([], null, 2));
                logger.log('Created new subscriptions database');
            } else {
                throw err;
            }
        }

        // Load scheduled follow-ups
        try {
            const data = await fs.readFile(FOLLOWUPS_PATH, 'utf8');
            scheduledFollowups = JSON.parse(data);
            logger.log(`Loaded ${scheduledFollowups.length} scheduled follow-ups`);
        } catch (err) {
            if (err.code === 'ENOENT') {
                await fs.writeFile(FOLLOWUPS_PATH, JSON.stringify([], null, 2));
                logger.log('Created new follow-ups database');
            } else {
                throw err;
            }
        }

        // Load scheduled active attack check-ins
        try {
            const data = await fs.readFile(ACTIVE_CHECKINS_PATH, 'utf8');
            scheduledActiveCheckins = JSON.parse(data);
            logger.log(`Loaded ${scheduledActiveCheckins.length} scheduled active attack check-ins`);
        } catch (err) {
            if (err.code === 'ENOENT') {
                await fs.writeFile(ACTIVE_CHECKINS_PATH, JSON.stringify([], null, 2));
                logger.log('Created new active check-ins database');
            } else {
                throw err;
            }
        }
    } catch (error) {
        logger.error('Database initialization error:', error);
        throw error;
    }
}

// Writes are serialized through a single chain and performed atomically
// (temp file + rename) so concurrent requests can't interleave partial
// writes or clobber each other's snapshots.
let writeChain = Promise.resolve();

function queueWrite(task) {
    writeChain = writeChain.then(task, task);
    return writeChain;
}

async function writeAtomic(filePath, data) {
    const tmpPath = `${filePath}.tmp`;
    await fs.writeFile(tmpPath, JSON.stringify(data, null, 2));
    await fs.rename(tmpPath, filePath);
}

function saveSubscriptions() {
    return queueWrite(() => writeAtomic(DB_PATH, subscriptions));
}

function saveFollowups() {
    return queueWrite(() => writeAtomic(FOLLOWUPS_PATH, scheduledFollowups));
}

function saveActiveCheckins() {
    return queueWrite(() => writeAtomic(ACTIVE_CHECKINS_PATH, scheduledActiveCheckins));
}

// Subscription management
async function addSubscription(subscription) {
    // Remove existing subscription with same endpoint
    subscriptions = subscriptions.filter(s => s.endpoint !== subscription.endpoint);
    subscriptions.push({
        ...subscription,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    });
    await saveSubscriptions();
    return subscription;
}

async function removeSubscription(endpoint) {
    const initialLength = subscriptions.length;
    subscriptions = subscriptions.filter(s => s.endpoint !== endpoint);
    scheduledFollowups = scheduledFollowups.filter(f => f.subscriptionEndpoint !== endpoint);
    scheduledActiveCheckins = scheduledActiveCheckins.filter(c => c.subscriptionEndpoint !== endpoint);
    await Promise.all([saveSubscriptions(), saveFollowups(), saveActiveCheckins()]);
    return initialLength !== subscriptions.length;
}

async function updateSubscriptionPreferences(endpoint, preferences) {
    const subscription = subscriptions.find(s => s.endpoint === endpoint);
    if (subscription) {
        subscription.preferences = preferences;
        subscription.updatedAt = new Date().toISOString();
        await saveSubscriptions();
        return subscription;
    }
    return null;
}

function getSubscriptionByEndpoint(endpoint) {
    return subscriptions.find(s => s.endpoint === endpoint);
}

function getAllSubscriptions() {
    return subscriptions;
}

// Get users who should receive daily check-in at current hour
function getSubscriptionsForDailyCheckIn(currentHour, currentDay, now = new Date()) {
    return subscriptions.filter(sub => {
        const daily = sub.preferences?.dailyCheckIn;
        if (!daily?.enabled || daily.frequency === 'disabled') return false;
        let time = `${String(currentHour).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`;
        let date = now.toISOString().slice(0, 10);
        let target = daily.utcTime || (daily.utcHour !== undefined
            ? `${String(daily.utcHour).padStart(2, '0')}:${String(daily.utcMinutes || 0).padStart(2, '0')}` : daily.time);
        let weekday = currentDay;
        if (daily.timezone) {
            try {
                const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
                    timeZone: daily.timezone, year: 'numeric', month: '2-digit', day: '2-digit',
                    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
                }).formatToParts(now).map(p => [p.type, p.value]));
                time = `${parts.hour}:${parts.minute}`;
                date = `${parts.year}-${parts.month}-${parts.day}`;
                target = daily.time;
                weekday = new Date(date + 'T12:00:00Z').getUTCDay();
            } catch { return false; }
        }
        if (typeof target !== 'string' || time < target || sub.lastDailyCheckInDate === date) return false;
        if (daily.frequency === 'weekly' && weekday !== (daily.weekday ?? 0)) return false;
        if (daily.frequency === 'every-other-day' && Math.floor(Date.parse(date) / 86400000) % 2 !== 0) return false;
        sub.pendingDailyCheckInDate = date;
        return true;
    });
}

async function markDailyCheckInAsSent(endpoint) {
    const sub = getSubscriptionByEndpoint(endpoint);
    if (sub) {
        sub.lastDailyCheckInDate = sub.pendingDailyCheckInDate;
        delete sub.pendingDailyCheckInDate;
        await saveSubscriptions();
    }
}

// Scheduled follow-up management
async function addScheduledFollowup(followup) {
    scheduledFollowups.push({
        ...followup,
        createdAt: new Date().toISOString()
    });
    await saveFollowups();
    return followup;
}

function getFollowupsDueNow() {
    const now = new Date();
    const dueFollowups = scheduledFollowups.filter(f =>
        new Date(f.scheduledTime) <= now && !f.sent
    );
    return dueFollowups;
}

async function markFollowupAsSent(followupId) {
    const followup = scheduledFollowups.find(f => f.id === followupId);
    if (followup) {
        followup.sent = true;
        followup.sentAt = new Date().toISOString();
        await saveFollowups();
    }
}

// Active attack check-in management
async function addScheduledActiveCheckins(checkins) {
    const replaced = new Set(checkins.map(c => c.subscriptionEndpoint + '\0' + c.attackId));
    scheduledActiveCheckins = scheduledActiveCheckins.filter(c => c.sent || !replaced.has(c.subscriptionEndpoint + '\0' + c.attackId));
    scheduledActiveCheckins.push(...checkins.map(c => ({ ...c, createdAt: new Date().toISOString() })));
    await saveActiveCheckins();
    return checkins;
}

async function addScheduledActiveCheckin(checkin) {
    await addScheduledActiveCheckins([checkin]);
    return checkin;
}

function getActiveCheckinsDueNow() {
    const now = new Date();
    const dueCheckins = scheduledActiveCheckins.filter(c =>
        new Date(c.scheduledTime) <= now && !c.sent
    );
    return dueCheckins;
}

async function markActiveCheckinAsSent(checkinId) {
    const checkin = scheduledActiveCheckins.find(c => c.id === checkinId);
    if (checkin) {
        checkin.sent = true;
        checkin.sentAt = new Date().toISOString();
        await saveActiveCheckins();
    }
}

async function cancelActiveCheckin(attackId, subscriptionEndpoint, cancelSeries = false) {
    const initialLength = scheduledActiveCheckins.length;
    scheduledActiveCheckins = scheduledActiveCheckins.filter(c => {
        const exact = String(c.attackId) === String(attackId);
        const prefix = String(attackId) + '-';
        const series = cancelSeries && String(c.attackId).startsWith(prefix) && /^\d+$/.test(String(c.attackId).slice(prefix.length));
        return !(c.subscriptionEndpoint === subscriptionEndpoint && (exact || series));
    });
    await saveActiveCheckins();
    return initialLength !== scheduledActiveCheckins.length;
}

// Drop old records so the JSON files don't grow without bound: sent records
// older than the cutoff (by sentAt), and unsent records whose scheduledTime
// is more than the cutoff in the past (never delivered — subscription likely
// gone). Pending future records are always kept.
async function pruneOldRecords(maxAgeDays = 7) {
    const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
    const keep = (r) => {
        const ts = r.sent
            ? (r.sentAt ? new Date(r.sentAt).getTime() : 0)
            : (r.scheduledTime ? new Date(r.scheduledTime).getTime() : Date.now());
        return ts > cutoff;
    };
    const fBefore = scheduledFollowups.length;
    const cBefore = scheduledActiveCheckins.length;
    scheduledFollowups = scheduledFollowups.filter(keep);
    scheduledActiveCheckins = scheduledActiveCheckins.filter(keep);
    const removed = (fBefore - scheduledFollowups.length) + (cBefore - scheduledActiveCheckins.length);
    if (removed > 0) {
        await saveFollowups();
        await saveActiveCheckins();
    }
    return removed;
}

// Flush any queued atomic writes — used for graceful shutdown.
function flushWrites() {
    return writeChain;
}

module.exports = {
    initializeDatabase,
    addSubscription,
    removeSubscription,
    updateSubscriptionPreferences,
    getSubscriptionByEndpoint,
    getAllSubscriptions,
    getSubscriptionsForDailyCheckIn,
    markDailyCheckInAsSent,
    addScheduledFollowup,
    getFollowupsDueNow,
    markFollowupAsSent,
    addScheduledActiveCheckin,
    addScheduledActiveCheckins,
    getActiveCheckinsDueNow,
    markActiveCheckinAsSent,
    cancelActiveCheckin,
    pruneOldRecords,
    flushWrites
};
