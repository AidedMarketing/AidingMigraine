const logger = require('./logger');
/**
 * Aiding Migraine - Push Notification Server
 *
 * This server handles push notifications for the Aiding Migraine PWA.
 * It manages user subscriptions, schedules notifications, and sends push messages.
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config({ quiet: true });

const { initializeScheduler } = require('./scheduler');
const { initializeDatabase, flushWrites } = require('./database');
const { limiter } = require('./middleware/rate-limit');
const subscriptionRoutes = require('./routes/subscriptions');
const notificationRoutes = require('./routes/notifications');

const { corsOptions, checkCredentials } = require('./middleware/security');
checkCredentials();
const app = express();
const PORT = process.env.PORT || 3000;

// Behind a single reverse proxy (Render) - required for express-rate-limit
// to key limits off the real client IP instead of the proxy's IP
app.set('trust proxy', 1);

// Security Headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"]
        }
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
}));

// Health check endpoint (before CORS to allow public access)
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Aiding Migraine Notification Server is running',
        timestamp: new Date().toISOString()
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        name: 'Aiding Migraine Notification Server',
        version: '5.1.0',
        status: 'running',
        endpoints: {
            health: '/health',
            subscriptions: '/api/subscriptions',
            notifications: '/api/notifications'
        }
    });
});

// Middleware
app.use(cors(corsOptions()));
app.use(express.json({ limit: '10kb' })); // Limit request body size to 10KB
app.use(limiter);

// The VAPID public key is public by design; private keys are never returned.
app.get('/api/public-key', (req, res) => {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    res.set('Cache-Control', 'no-store');
    if (!publicKey) return res.status(503).json({ error: 'Push notifications not configured' });
    res.json({ publicKey });
});

// Routes
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/notifications', notificationRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    logger.error('Error:', err);
    res.status(err.status || 500).json({
        error: err.status === 403 ? 'Origin not allowed' : 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Cancel scheduled jobs, stop accepting connections, flush pending writes,
// then exit — so a deploy/restart can't truncate a data file mid-write.
function setupGracefulShutdown(server, jobs) {
    let shuttingDown = false;
    const shutdown = async (signal) => {
        if (shuttingDown) return;
        shuttingDown = true;
        logger.log(`\n${signal} received — shutting down gracefully...`);
        try {
            Object.values(jobs || {}).forEach(job => { if (job && job.cancel) job.cancel(); });
            await new Promise(resolve => server.close(resolve));
            await flushWrites();
            logger.log('✅ Clean shutdown complete');
            process.exit(0);
        } catch (error) {
            logger.error('❌ Error during shutdown:', error);
            process.exit(1);
        }
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
}

// Initialize database and scheduler
async function startServer() {
    try {
        await initializeDatabase();
        logger.log('✅ Database initialized');

        const jobs = initializeScheduler();
        logger.log('✅ Notification scheduler started');

        const server = app.listen(PORT, () => {
            logger.log(`🚀 Notification server running on port ${PORT}`);
            logger.log(`📡 Health check: http://localhost:${PORT}/health`);
        });

        setupGracefulShutdown(server, jobs);
    } catch (error) {
        logger.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

if (require.main === module) startServer();
module.exports = { app, startServer };
