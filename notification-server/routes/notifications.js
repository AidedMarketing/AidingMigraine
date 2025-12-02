/**
 * Notification Routes
 */

const express = require('express');
const router = express.Router();
const { addScheduledFollowup } = require('../database');
const { sendWebPushNotification } = require('../fcm');

/**
 * POST /api/notifications/schedule-followup
 * Schedule a post-attack follow-up notification
 */
router.post('/schedule-followup', async (req, res) => {
    try {
        const { attackId, followUpTime, subscriptionEndpoint } = req.body;

        if (!attackId || !followUpTime || !subscriptionEndpoint) {
            return res.status(400).json({
                error: 'attackId, followUpTime, and subscriptionEndpoint are required'
            });
        }

        const followup = {
            id: `followup-${attackId}-${Date.now()}`,
            attackId,
            scheduledTime: followUpTime,
            subscriptionEndpoint,
            sent: false
        };

        const result = addScheduledFollowup(followup);

        res.status(201).json({
            success: true,
            message: 'Follow-up notification scheduled successfully',
            followup: result
        });
    } catch (error) {
        console.error('Schedule follow-up error:', error);
        res.status(500).json({
            error: 'Failed to schedule follow-up',
            message: error.message
        });
    }
});

/**
 * POST /api/notifications/send-test
 * Send a test notification (for debugging)
 */
router.post('/send-test', async (req, res) => {
    try {
        const { subscription } = req.body;

        if (!subscription || !subscription.endpoint) {
            return res.status(400).json({
                error: 'Invalid subscription data'
            });
        }

        const payload = {
            title: 'Aiding Migraine - Test',
            body: 'This is a test notification from the server',
            icon: './icons/icon-192x192.png',
            badge: './icons/icon-72x72.png',
            tag: 'test',
            url: './',
            type: 'test'
        };

        const result = await sendWebPushNotification(subscription, payload);

        if (result.success) {
            res.json({
                success: true,
                message: 'Test notification sent successfully'
            });
        } else {
            res.status(500).json({
                error: 'Failed to send test notification',
                details: result.error
            });
        }
    } catch (error) {
        console.error('Send test error:', error);
        res.status(500).json({
            error: 'Failed to send test notification',
            message: error.message
        });
    }
});

module.exports = router;
