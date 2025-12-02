/**
 * Aiding Migraine - Push Notification Server
 *
 * This server handles push notifications for the Aiding Migraine PWA.
 * It manages user subscriptions, schedules notifications, and sends push messages.
 */

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { initializeScheduler } = require('./scheduler');
const { initializeDatabase } = require('./database');
const subscriptionRoutes = require('./routes/subscriptions');
const notificationRoutes = require('./routes/notifications');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Aiding Migraine Notification Server is running',
        timestamp: new Date().toISOString()
    });
});

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
