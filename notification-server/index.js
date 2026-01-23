/**
 * Aiding Migraine - Push Notification Server
 *
 * This server handles push notifications for the Aiding Migraine PWA.
 * It manages user subscriptions, schedules notifications, and sends push messages.
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { initializeScheduler } = require('./scheduler');
const { initializeDatabase } = require('./database');
const subscriptionRoutes = require('./routes/subscriptions');
const notificationRoutes = require('./routes/notifications');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS Configuration - Whitelist specific origins
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:8080,http://127.0.0.1:8080')
    .split(',')
    .map(origin => origin.trim());

const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests) in development
        if (!origin && process.env.NODE_ENV === 'development') {
            return callback(null, true);
        }
        if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200
};

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

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later',
    standardHeaders: true,
    legacyHeaders: false
});

const strictLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // Limit each IP to 10 requests per minute for sensitive endpoints
    message: 'Too many requests, please slow down'
});

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
        version: '2.0.0',
        status: 'running',
        endpoints: {
            health: '/health',
            subscriptions: '/api/subscriptions',
            notifications: '/api/notifications'
        }
    });
});

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '10kb' })); // Limit request body size to 10KB
app.use(limiter);

// Routes
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/notifications', notificationRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Initialize database and scheduler
async function startServer() {
    try {
        await initializeDatabase();
        console.log('✅ Database initialized');

        initializeScheduler();
        console.log('✅ Notification scheduler started');

        app.listen(PORT, () => {
            console.log(`🚀 Notification server running on port ${PORT}`);
            console.log(`📡 Health check: http://localhost:${PORT}/health`);
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

startServer();
