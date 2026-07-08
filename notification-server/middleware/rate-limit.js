/**
 * Rate Limiting Middleware
 */

const rateLimit = require('express-rate-limit');

// General limiter applied to all routes
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later',
    standardHeaders: true,
    legacyHeaders: false
});

// Strict limiter for sensitive endpoints (scheduling, test sends, admin)
const strictLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // Limit each IP to 10 requests per minute
    message: 'Too many requests, please slow down',
    standardHeaders: true,
    legacyHeaders: false
});

module.exports = {
    limiter,
    strictLimiter
};
