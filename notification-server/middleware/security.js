const crypto = require('node:crypto');
const retired = require('../retired-credentials.json');

function equalSecret(actual, expected) {
    if (typeof actual !== 'string' || typeof expected !== 'string' || !actual || !expected) return false;
    const digest = value => crypto.createHash('sha256').update(value).digest();
    return crypto.timingSafeEqual(digest(actual), digest(expected));
}

function isRetiredCredential(kind, value) {
    return typeof value === 'string' && retired[kind].includes(crypto.createHash('sha256').update(value).digest('hex'));
}

function allowedOrigins(env = process.env) {
    const defaults = env.NODE_ENV === 'development'
        ? 'http://localhost:8080,http://127.0.0.1:8080'
        : 'https://aidedmarketing.github.io';
    const origins = (env.ALLOWED_ORIGINS || defaults).split(',').map(value => value.trim()).filter(Boolean);
    if (!origins.length) throw new Error('At least one allowed origin is required');
    for (const origin of origins) {
        const url = new URL(origin);
        if (url.origin !== origin || url.username || url.password ||
            (url.protocol !== 'https:' && !(env.NODE_ENV === 'development' && url.protocol === 'http:'))) {
            throw new Error('ALLOWED_ORIGINS must contain exact HTTPS origins (HTTP is development-only)');
        }
    }
    return origins;
}

function corsOptions(env = process.env) {
    const origins = allowedOrigins(env);
    return {
        origin(origin, callback) {
            // CLI administration is authenticated by the routes; CORS is not authentication.
            if (!origin || origins.includes(origin)) return callback(null, true);
            const error = new Error('Origin not allowed');
            error.status = 403;
            callback(error);
        },
        methods: ['GET', 'POST', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'X-API-Key'],
        credentials: false
    };
}

function validateSchedule(req, res, next) {
    const { attackId } = req.body;
    const time = req.body.followUpTime ?? req.body.checkInTime;
    if (!['string', 'number'].includes(typeof attackId) || !/^[A-Za-z0-9_-]{1,128}$/.test(String(attackId))) {
        return res.status(400).json({ error: 'Invalid attack identifier' });
    }
    if (time !== undefined) {
        const timestamp = typeof time === 'string' ? Date.parse(time) : NaN;
        if (!Number.isFinite(timestamp) || timestamp < Date.now() - 60000 || timestamp > Date.now() + 7 * 86400000) {
            return res.status(400).json({ error: 'Schedule must be within the next seven days' });
        }
    }
    next();
}

function checkCredentials(env = process.env) {
    if (isRetiredCredential('admin', env.ADMIN_API_KEY) || isRetiredCredential('vapid', env.VAPID_PRIVATE_KEY)) {
        throw new Error('Published credentials must be rotated before starting this server');
    }
}

module.exports = { equalSecret, isRetiredCredential, corsOptions, allowedOrigins, validateSchedule, checkCredentials };
