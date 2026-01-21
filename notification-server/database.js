/**
 * Database module - Handles storage of user subscriptions and preferences
 *
 * For development: Uses JSON file storage
 * For production: Extend this to use PostgreSQL, MongoDB, or similar
 */

const fs = require('fs').promises;
const path = require('path');

// Secure path validation - prevents path traversal attacks
function validateDataPath(relativePath) {
    const dataDir = path.resolve(__dirname, 'data');
    const fullPath = path.resolve(dataDir, relativePath);

    // Ensure the resolved path is within the data directory
    if (!fullPath.startsWith(dataDir)) {
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
            console.log(`Loaded ${subscriptions.length} subscriptions from database`);
        } catch (err) {
            if (err.code === 'ENOENT') {
                // File doesn't exist, create empty file
                await fs.writeFile(DB_PATH, JSON.stringify([], null, 2));
                console.log('Created new subscriptions database');
            } else {
                throw err;
            }
        }

        // Load scheduled follow-ups
        try {
            const data = await fs.readFile(FOLLOWUPS_PATH, 'utf8');
            scheduledFollowups = JSON.parse(data);
            console.log(`Loaded ${scheduledFollowups.length} scheduled follow-ups`);
        } catch (err) {
            if (err.code === 'ENOENT') {
                await fs.writeFile(FOLLOWUPS_PATH, JSON.stringify([], null, 2));
                console.log('Created new follow-ups database');
            } else {
                throw err;
            }
        }

        // Load scheduled active attack check-ins
        try {
            const data = await fs.readFile(ACTIVE_CHECKINS_PATH, 'utf8');
            scheduledActiveCheckins = JSON.parse(data);
            console.log(`Loaded ${scheduledActiveCheckins.length} scheduled active attack check-ins`);
        } catch (err) {
            if (err.code === 'ENOENT') {
                await fs.writeFile(ACTIVE_CHECKINS_PATH, JSON.stringify([], null, 2));
                console.log('Created new active check-ins database');
            } else {
                throw err;
            }
        }
    } catch (error) {
        console.error('Database initialization error:', error);
        throw error;
    }
}

async function saveSubscriptions() {
    await fs.writeFile(DB_PATH, JSON.stringify(subscriptions, null, 2));
}

async function saveFollowups() {
    await fs.writeFile(FOLLOWUPS_PATH, JSON.stringify(scheduledFollowups, null, 2));
}

async function saveActiveCheckins() {
    await fs.writeFile(ACTIVE_CHECKINS_PATH, JSON.stringify(scheduledActiveCheckins, null, 2));
}

// Subscription management
function addSubscription(subscription) {
    // Remove existing subscription with same endpoint
    subscriptions = subscriptions.filter(s => s.endpoint !== subscription.endpoint);
    subscriptions.push({
        ...subscription,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    });
    saveSubscriptions();
    return subscription;
}

function removeSubscription(endpoint) {
    const initialLength = subscriptions.length;
    subscriptions = subscriptions.filter(s => s.endpoint !== endpoint);
    saveSubscriptions();
    return initialLength !== subscriptions.length;
}

function updateSubscriptionPreferences(endpoint, preferences) {
    const subscription = subscriptions.find(s => s.endpoint === endpoint);
    if (subscription) {
        subscription.preferences = preferences;
        subscription.updatedAt = new Date().toISOString();
        saveSubscriptions();
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
function getSubscriptionsForDailyCheckIn(currentHour, currentDay) {
    return subscriptions.filter(sub => {
        if (!sub.preferences || !sub.preferences.dailyCheckIn.enabled) {
            return false;
        }

        // Use UTC hour if available (new implementation with timezone support)
        // Fall back to parsing time string for backwards compatibility
        let targetHour;
        if (sub.preferences.dailyCheckIn.utcHour !== undefined) {
            targetHour = sub.preferences.dailyCheckIn.utcHour;
        } else {
            // Backwards compatibility: assume time is in UTC if no utcHour field
            const [hour, minute] = sub.preferences.dailyCheckIn.time.split(':').map(Number);
            targetHour = hour;
        }

        // Check if it's the right hour (currentHour is in UTC)
        if (targetHour !== currentHour) {
            return false;
        }

        // Check frequency
        if (sub.preferences.dailyCheckIn.frequency === 'every-other-day') {
            // Simple implementation: check if day number is even/odd
            const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
            return dayOfYear % 2 === 0;
        }

        return true; // Daily
    });
}

// Scheduled follow-up management
function addScheduledFollowup(followup) {
    scheduledFollowups.push({
        ...followup,
        createdAt: new Date().toISOString()
    });
    saveFollowups();
    return followup;
}

function getFollowupsDueNow() {
    const now = new Date();
    const dueFollowups = scheduledFollowups.filter(f =>
        new Date(f.scheduledTime) <= now && !f.sent
    );
    return dueFollowups;
}

function markFollowupAsSent(followupId) {
    const followup = scheduledFollowups.find(f => f.id === followupId);
    if (followup) {
        followup.sent = true;
        followup.sentAt = new Date().toISOString();
        saveFollowups();
    }
}

// Active attack check-in management
function addScheduledActiveCheckin(checkin) {
    scheduledActiveCheckins.push({
        ...checkin,
        createdAt: new Date().toISOString()
    });
    saveActiveCheckins();
    return checkin;
}

function getActiveCheckinsDueNow() {
    const now = new Date();
    const dueCheckins = scheduledActiveCheckins.filter(c =>
        new Date(c.scheduledTime) <= now && !c.sent
    );
    return dueCheckins;
}

function markActiveCheckinAsSent(checkinId) {
    const checkin = scheduledActiveCheckins.find(c => c.id === checkinId);
    if (checkin) {
        checkin.sent = true;
        checkin.sentAt = new Date().toISOString();
        saveActiveCheckins();
    }
}

function cancelActiveCheckin(attackId) {
    const initialLength = scheduledActiveCheckins.length;
    scheduledActiveCheckins = scheduledActiveCheckins.filter(c => c.attackId !== attackId);
    saveActiveCheckins();
    return initialLength !== scheduledActiveCheckins.length;
}

module.exports = {
    initializeDatabase,
    addSubscription,
    removeSubscription,
    updateSubscriptionPreferences,
    getSubscriptionByEndpoint,
    getAllSubscriptions,
    getSubscriptionsForDailyCheckIn,
    addScheduledFollowup,
    getFollowupsDueNow,
    markFollowupAsSent,
    addScheduledActiveCheckin,
    getActiveCheckinsDueNow,
    markActiveCheckinAsSent,
    cancelActiveCheckin
};
