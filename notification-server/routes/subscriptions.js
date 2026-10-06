const logger = require('../logger');
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
const {
    requireAdminAuth,
    requireSubscriptionAuth,
    protectExistingSubscription,
    validateSubscriptionKeys,
    validateEndpoint,
    validatePreferences
} = require('../middleware/auth');
const { strictLimiter } = require('../middleware/rate-limit');

/**
 * POST /api/subscriptions/subscribe
 * Subscribe a user to push notifications
 */
router.post('/subscribe', strictLimiter, validateEndpoint, validateSubscriptionKeys, protectExistingSubscription, validatePreferences, async (req, res) => {
    try {
        const { subscription, preferences } = req.body;

        if (!subscription || !subscription.endpoint) {
            return res.status(400).json({
                error: 'Invalid subscription data'
            });
        }

        if (!subscription.keys ||
            typeof subscription.keys.p256dh !== 'string' || !subscription.keys.p256dh ||
            typeof subscription.keys.auth !== 'string' || !subscription.keys.auth) {
            return res.status(400).json({
                error: 'Invalid subscription data',
                message: 'subscription.keys.p256dh and subscription.keys.auth are required'
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

        const result = await addSubscription(newSubscription);

        res.status(201).json({
            success: true,
            message: 'Subscription created successfully',
            subscription: { endpoint: result.endpoint }
        });
    } catch (error) {
        logger.error('Subscribe error:', error);
        res.status(500).json({
            error: 'Failed to create subscription'
        });
    }
});

/**
 * POST /api/subscriptions/unsubscribe
 * Unsubscribe a user from push notifications
 */
router.post('/unsubscribe', strictLimiter, validateEndpoint, requireSubscriptionAuth, async (req, res) => {
    try {
        const { endpoint } = req.body;

        if (!endpoint) {
            return res.status(400).json({
                error: 'Endpoint is required'
            });
        }

        const removed = await removeSubscription(endpoint);

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
        logger.error('Unsubscribe error:', error);
        res.status(500).json({
            error: 'Failed to remove subscription'
        });
    }
});

/**
 * POST /api/subscriptions/update-preferences
 * Update user notification preferences
 */
router.post('/update-preferences', strictLimiter, validateEndpoint, requireSubscriptionAuth, validatePreferences, async (req, res) => {
    try {
        const { endpoint, preferences } = req.body;

        if (!endpoint || !preferences) {
            return res.status(400).json({
                error: 'Endpoint and preferences are required'
            });
        }

        const updated = await updateSubscriptionPreferences(endpoint, preferences);

        if (updated) {
            res.json({
                success: true,
                message: 'Preferences updated successfully',
                subscription: { endpoint: updated.endpoint }
            });
        } else {
            res.status(404).json({
                error: 'Subscription not found'
            });
        }
    } catch (error) {
        logger.error('Update preferences error:', error);
        res.status(500).json({
            error: 'Failed to update preferences'
        });
    }
});

/**
 * GET /api/subscriptions
 * Get all subscriptions (admin only - requires API key)
 */
router.get('/', strictLimiter, requireAdminAuth, async (req, res) => {
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
        logger.error('Get subscriptions error:', error);
        res.status(500).json({
            error: 'Failed to get subscriptions'
        });
    }
});

module.exports = router;
