/**
 * Database module - Handles storage of user subscriptions and preferences
 *
 * For development: Uses JSON file storage
 * For production: Extend this to use PostgreSQL, MongoDB, or similar
 */

const fs = require('fs').promises;
const path = require('path');

const DB_PATH = process.env.DB_PATH || './data/subscriptions.json';
const FOLLOWUPS_PATH = './data/scheduled-followups.json';

let subscriptions = [];
let scheduledFollowups = [];

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

        const [hour, minute] = sub.preferences.dailyCheckIn.time.split(':').map(Number);

        // Check if it's the right hour
        if (hour !== currentHour) {
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
    markFollowupAsSent
};
