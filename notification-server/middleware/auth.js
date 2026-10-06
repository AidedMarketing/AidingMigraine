const { equalSecret, isRetiredCredential } = require('./security');
const { getSubscriptionByEndpoint } = require('../database');

/**
 * Authentication Middleware
 */

/**
 * Admin API Key Authentication
 * Checks for X-API-Key header matching ADMIN_API_KEY from environment
 */
function requireAdminAuth(req, res, next) {
    const apiKey = req.headers['x-api-key'];
    const adminKey = process.env.ADMIN_API_KEY;

    if (!adminKey || isRetiredCredential('admin', adminKey)) {
        return res.status(503).json({ error: 'Admin authentication unavailable' });
    }
    if (!equalSecret(apiKey, adminKey)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    next();
}

/**
 * Validate subscription endpoint format
 * Prevents injection attacks via malformed endpoints
 */
function validateEndpoint(req, res, next) {
    // Support 'endpoint', 'subscriptionEndpoint', and nested 'subscription.endpoint' field names
    const endpoint = req.body.endpoint ||
        req.body.subscriptionEndpoint ||
        (req.body.subscription && req.body.subscription.endpoint);

    if (typeof endpoint !== 'string' || endpoint.length > 4096) return res.status(400).json({ error: 'Invalid endpoint' });

    // Validate endpoint is a proper URL
    try {
        const url = new URL(endpoint);

        // Must be HTTPS in production
        if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || url.hash) {
            return res.status(400).json({
                error: 'Invalid endpoint',
                message: 'Subscription endpoints must use HTTPS in production'
            });
        }

        // Must be from valid push service domains
        const validDomains = [
            'fcm.googleapis.com',
            'updates.push.services.mozilla.com',
            'web.push.apple.com',
            'wns2-*.notify.windows.com',
            'android.googleapis.com'
        ];

        const isValidDomain = validDomains.some(domain => {
            if (domain.includes('*')) {
                const pattern = domain
                    .split('*')
                    .map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
                    .join('[a-z0-9-]*');
                const regex = new RegExp('^' + pattern + '$', 'i');
                return regex.test(url.hostname);
            }
            return url.hostname === domain;
        });

        if (!isValidDomain) {
            return res.status(400).json({
                error: 'Invalid endpoint',
                message: 'Subscription endpoint must be from a valid push service'
            });
        }

        next();
    } catch (error) {
        return res.status(400).json({
            error: 'Invalid endpoint',
            message: 'Endpoint must be a valid URL'
        });
    }
}

/**
 * Sanitize time input to prevent injection
 * Validates HH:MM format
 */
function validateTimeFormat(timeString) {
    if (!timeString) return null;

    const timeRegex = /^([0-1][0-9]|2[0-3]):([0-5][0-9])$/;
    if (!timeRegex.test(timeString)) {
        return null;
    }

    return timeString;
}

/**
 * Validate preferences object
 */
function validatePreferences(req, res, next) {
    const { preferences } = req.body;

    if (preferences === undefined) return next();
    if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences)) return res.status(400).json({ error: 'Invalid preferences' });
    for (const key of ['dailyCheckIn', 'postAttackFollowUp']) {
        const value = preferences[key];
        if (value !== undefined && (!value || typeof value !== 'object' || Array.isArray(value) || (value.enabled !== undefined && typeof value.enabled !== 'boolean'))) return res.status(400).json({ error: 'Invalid preferences' });
    }
    if (preferences.dailyCheckIn) {
        const daily = preferences.dailyCheckIn;
        for (const [field, max] of [['utcHour', 23], ['utcMinutes', 59]]) {
            if (daily[field] !== undefined && (!Number.isInteger(daily[field]) || daily[field] < 0 || daily[field] > max)) return res.status(400).json({ error: 'Invalid reminder time' });
        }
        if (daily.weekday !== undefined && (!Number.isInteger(daily.weekday) || daily.weekday < 0 || daily.weekday > 6)) return res.status(400).json({ error: 'Invalid weekday' });
        if (daily.timezone !== undefined) {
            if (typeof daily.timezone !== 'string' || daily.timezone.length > 100) return res.status(400).json({ error: 'Invalid timezone' });
            try { new Intl.DateTimeFormat('en', { timeZone: daily.timezone }).format(); }
            catch { return res.status(400).json({ error: 'Invalid timezone' }); }
        }
    }

    // Validate dailyCheckIn.time if present
    if (preferences.dailyCheckIn && preferences.dailyCheckIn.time !== undefined) {
        const validTime = validateTimeFormat(preferences.dailyCheckIn.time);
        if (!validTime) {
            return res.status(400).json({
                error: 'Invalid preferences',
                message: 'dailyCheckIn.time must be in HH:MM format (24-hour)'
            });
        }
        preferences.dailyCheckIn.time = validTime;
    }

    // Validate dailyCheckIn.frequency
    if (preferences.dailyCheckIn && preferences.dailyCheckIn.frequency !== undefined) {
        const validFrequencies = ['daily', 'every-other-day', 'weekly', 'disabled'];
        if (!validFrequencies.includes(preferences.dailyCheckIn.frequency)) {
            return res.status(400).json({
                error: 'Invalid preferences',
                message: 'dailyCheckIn.frequency must be one of: daily, every-other-day, weekly, disabled'
            });
        }
    }

    // Validate postAttackFollowUp.delayHours
    if (preferences.postAttackFollowUp && preferences.postAttackFollowUp.delayHours !== undefined) {
        const hours = Number(preferences.postAttackFollowUp.delayHours);
        if (!Number.isFinite(hours) || hours < 0 || hours > 168) { // Max 1 week
            return res.status(400).json({
                error: 'Invalid preferences',
                message: 'postAttackFollowUp.delayHours must be between 0 and 168'
            });
        }
        preferences.postAttackFollowUp.delayHours = hours;
    }

    next();
}

// Mutating an existing subscription requires possession of BOTH browser keys.
// Every unknown endpoint and key mismatch returns the same response.
function requireSubscriptionAuth(req, res, next) {
    const endpoint = req.body.endpoint || req.body.subscriptionEndpoint || req.body.subscription?.endpoint;
    const subscription = getSubscriptionByEndpoint(endpoint);
    const keys = req.body.keys || req.body.subscription?.keys;
    if (!subscription || !equalSecret(keys?.auth, subscription.keys?.auth) ||
        !equalSecret(keys?.p256dh, subscription.keys?.p256dh)) {
        return res.status(401).json({ error: 'Invalid subscription credentials' });
    }
    req.pushSubscription = subscription;
    next();
}

function protectExistingSubscription(req, res, next) {
    const subscription = getSubscriptionByEndpoint(req.body.subscription?.endpoint);
    const keys = req.body.subscription?.keys;
    if (subscription && (!equalSecret(keys?.auth, subscription.keys?.auth) || !equalSecret(keys?.p256dh, subscription.keys?.p256dh))) {
        // A public enrollment request must not act as an endpoint-existence oracle.
        // Acknowledge identically without modifying someone else's subscription.
        return res.status(201).json({ success: true, message: 'Subscription created successfully', subscription: { endpoint: req.body.subscription.endpoint } });
    }
    next();
}

function validateSubscriptionKeys(req, res, next) {
    const keys = req.body.subscription?.keys;
    const valid = (value, bytes) => typeof value === 'string' && /^[A-Za-z0-9_-]+={0,2}$/.test(value) && Buffer.from(value, 'base64url').length === bytes;
    if (!valid(keys?.auth, 16) || !valid(keys?.p256dh, 65) || Buffer.from(keys.p256dh, 'base64url')[0] !== 4) {
        return res.status(400).json({ error: 'Invalid subscription keys' });
    }
    next();
}

module.exports = {
    requireAdminAuth,
    requireSubscriptionAuth,
    protectExistingSubscription,
    validateSubscriptionKeys,
    validateEndpoint,
    validateTimeFormat,
    validatePreferences
};
