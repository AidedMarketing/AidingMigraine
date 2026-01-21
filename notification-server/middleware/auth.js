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

    // If no admin key is set, deny access in production
    if (!adminKey) {
        console.error('⚠️  ADMIN_API_KEY not set in environment variables');
        if (process.env.NODE_ENV === 'production') {
            return res.status(503).json({
                error: 'Service unavailable',
                message: 'Admin authentication not configured'
            });
        } else {
            console.warn('⚠️  Running without admin authentication in development mode');
            return next(); // Allow in development if key not set
        }
    }

    // Check if API key matches
    if (!apiKey || apiKey !== adminKey) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Invalid or missing API key'
        });
    }

    next();
}

/**
 * Validate subscription endpoint format
 * Prevents injection attacks via malformed endpoints
 */
function validateEndpoint(req, res, next) {
    // Support both 'endpoint' and 'subscriptionEndpoint' field names
    const endpoint = req.body.endpoint || req.body.subscriptionEndpoint;

    if (!endpoint) {
        return next(); // Let route handler deal with missing endpoint
    }

    // Validate endpoint is a proper URL
    try {
        const url = new URL(endpoint);

        // Must be HTTPS in production
        if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
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
                const regex = new RegExp('^' + domain.replace('*', '.*') + '$');
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

    if (!preferences) {
        return next();
    }

    // Validate dailyCheckIn.time if present
    if (preferences.dailyCheckIn && preferences.dailyCheckIn.time) {
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
    if (preferences.dailyCheckIn && preferences.dailyCheckIn.frequency) {
        const validFrequencies = ['daily', 'weekly', 'disabled'];
        if (!validFrequencies.includes(preferences.dailyCheckIn.frequency)) {
            return res.status(400).json({
                error: 'Invalid preferences',
                message: 'dailyCheckIn.frequency must be one of: daily, weekly, disabled'
            });
        }
    }

    // Validate postAttackFollowUp.delayHours
    if (preferences.postAttackFollowUp && preferences.postAttackFollowUp.delayHours !== undefined) {
        const hours = Number(preferences.postAttackFollowUp.delayHours);
        if (isNaN(hours) || hours < 0 || hours > 168) { // Max 1 week
            return res.status(400).json({
                error: 'Invalid preferences',
                message: 'postAttackFollowUp.delayHours must be between 0 and 168'
            });
        }
        preferences.postAttackFollowUp.delayHours = hours;
    }

    next();
}

module.exports = {
    requireAdminAuth,
    validateEndpoint,
    validateTimeFormat,
    validatePreferences
};
