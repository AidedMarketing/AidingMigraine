/**
 * Subscription Management Routes
 */

const express = require('express');
const router = express.Router();
const {
    addSubscription,
    removeSubscription,
    updateSubscriptionPreferences,
    getSubscriptionByEndpoint,
    getAllSubscriptions
} = require('../database');

/**
 * POST /api/subscriptions/subscribe
 * Subscribe a user to push notifications
 */
router.post('/subscribe', async (req, res) => {
    try {
        const { subscription, preferences } = req.body;

        if (!subscription || !subscription.endpoint) {
            return res.status(400).json({
                error: 'Invalid subscription data'
            });
        }

        const newSubscription = {
            endpoint: subscription.endpoint,
            keys: subscription.keys,
            preferences: preferences || {
                dailyCheckIn: {
                    enabled: true,
                    time: '19:00',
                    frequency: 'daily'
                },
                postAttackFollowUp: {
                    enabled: true,
                    delayHours: 2
                }
            }
        };

        const result = addSubscription(newSubscription);

        res.status(201).json({
            success: true,
            message: 'Subscription created successfully',
            subscription: result
        });
    } catch (error) {
        console.error('Subscribe error:', error);
        res.status(500).json({
            error: 'Failed to create subscription',
            message: error.message
        });
    }
});

/**
 * POST /api/subscriptions/unsubscribe
 * Unsubscribe a user from push notifications
 */
router.post('/unsubscribe', async (req, res) => {
    try {
        const { endpoint } = req.body;

        if (!endpoint) {
            return res.status(400).json({
                error: 'Endpoint is required'
            });
        }

        const removed = removeSubscription(endpoint);

        if (removed) {
            res.json({
                success: true,
                message: 'Subscription removed successfully'
            });
        } else {
            res.status(404).json({
                error: 'Subscription not found'
            });
        }
    } catch (error) {
        console.error('Unsubscribe error:', error);
        res.status(500).json({
            error: 'Failed to remove subscription',
            message: error.message
        });
    }
});

/**
 * POST /api/subscriptions/update-preferences
 * Update user notification preferences
 */
router.post('/update-preferences', async (req, res) => {
    try {
        const { endpoint, preferences } = req.body;

        if (!endpoint || !preferences) {
            return res.status(400).json({
                error: 'Endpoint and preferences are required'
            });
        }

        const updated = updateSubscriptionPreferences(endpoint, preferences);

        if (updated) {
            res.json({
                success: true,
                message: 'Preferences updated successfully',
                subscription: updated
            });
        } else {
            res.status(404).json({
                error: 'Subscription not found'
            });
        }
    } catch (error) {
        console.error('Update preferences error:', error);
        res.status(500).json({
            error: 'Failed to update preferences',
            message: error.message
        });
    }
});

/**
 * GET /api/subscriptions
 * Get all subscriptions (admin only - add auth in production)
 */
router.get('/', async (req, res) => {
    try {
        const subscriptions = getAllSubscriptions();
        res.json({
            success: true,
            count: subscriptions.length,
            subscriptions: subscriptions.map(s => ({
                endpoint: s.endpoint,
                preferences: s.preferences,
                createdAt: s.createdAt,
                updatedAt: s.updatedAt
            }))
        });
    } catch (error) {
        console.error('Get subscriptions error:', error);
        res.status(500).json({
            error: 'Failed to get subscriptions',
            message: error.message
        });
    }
});

module.exports = router;
