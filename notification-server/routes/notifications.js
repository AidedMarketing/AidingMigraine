const logger = require('../logger');
/**
 * Notification Routes
 */

const express = require('express');
const router = express.Router();
const {
    addScheduledFollowup,
    addScheduledActiveCheckin,
    addScheduledActiveCheckins,
    cancelActiveCheckin
} = require('../database');
const { sendWebPushNotification } = require('../push-notifications');
const { requireAdminAuth, requireSubscriptionAuth, validateEndpoint } = require('../middleware/auth');
const { validateSchedule } = require('../middleware/security');
const crypto = require('node:crypto');
const subscriptionRecordId = (endpoint, attackId) => crypto.createHash('sha256').update(endpoint + '\0' + attackId).digest('hex');
const { strictLimiter } = require('../middleware/rate-limit');

/**
 * POST /api/notifications/schedule-followup
 * Schedule a post-attack follow-up notification
 */
router.post('/schedule-followup', strictLimiter, validateEndpoint, requireSubscriptionAuth, validateSchedule, async (req, res) => {
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

        const result = await addScheduledFollowup(followup);

        res.status(201).json({
            success: true,
            message: 'Follow-up notification scheduled successfully',
            followup: { id: result.id }
        });
    } catch (error) {
        logger.error('Schedule follow-up error:', error);
        res.status(500).json({
            error: 'Failed to schedule follow-up'
        });
    }
});

/**
 * POST /api/notifications/send-test
 * Send a test notification (admin only - for debugging)
 */
router.post('/send-test', strictLimiter, requireAdminAuth, requireSubscriptionAuth, validateEndpoint, async (req, res) => {
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
                details: 'Push delivery failed'
            });
        }
    } catch (error) {
        logger.error('Send test error:', error);
        res.status(500).json({
            error: 'Failed to send test notification'
        });
    }
});

/**
 * POST /api/notifications/schedule-active-checkin
 * Schedule an active attack check-in notification
 */
router.post('/schedule-active-checkin', strictLimiter, validateEndpoint, requireSubscriptionAuth, validateSchedule, async (req, res) => {
    try {
        const { attackId, checkInTime, subscriptionEndpoint, checkIns } = req.body;
        if (checkIns !== undefined) {
            const validTime = time => typeof time === 'string' && Number.isFinite(Date.parse(time)) && Date.parse(time) >= Date.now() - 60000 && Date.parse(time) <= Date.now() + 7 * 86400000;
            if (!Array.isArray(checkIns) || checkIns.length < 1 || checkIns.length > 24 || !checkIns.every(validTime)) {
                return res.status(400).json({ error: 'Invalid check-in series' });
            }
            const records = checkIns.map((time, i) => ({
                id: `active-checkin-${subscriptionRecordId(subscriptionEndpoint, `${attackId}-${i + 1}`)}`,
                attackId: `${attackId}-${i + 1}`, scheduledTime: time, subscriptionEndpoint, sent: false
            }));
            await addScheduledActiveCheckins(records);
            return res.status(201).json({ success: true, message: 'Active check-in series scheduled successfully' });
        }

        if (!attackId || !checkInTime || !subscriptionEndpoint) {
            return res.status(400).json({
                error: 'attackId, checkInTime, and subscriptionEndpoint are required'
            });
        }

        const checkin = {
            id: `active-checkin-${subscriptionRecordId(subscriptionEndpoint, attackId)}`,
            attackId,
            scheduledTime: checkInTime,
            subscriptionEndpoint,
            sent: false
        };

        const result = await addScheduledActiveCheckin(checkin);

        res.status(201).json({
            success: true,
            message: 'Active attack check-in scheduled successfully',
            checkin: { id: result.id }
        });
    } catch (error) {
        logger.error('Schedule active check-in error:', error);
        res.status(500).json({
            error: 'Failed to schedule active attack check-in'
        });
    }
});

/**
 * POST /api/notifications/cancel-active-checkin
 * Cancel an active attack check-in notification
 */
router.post('/cancel-active-checkin', strictLimiter, validateEndpoint, requireSubscriptionAuth, validateSchedule, async (req, res) => {
    try {
        const { attackId, subscriptionEndpoint } = req.body;

        if (!attackId || !subscriptionEndpoint) {
            return res.status(400).json({
                error: 'attackId and subscriptionEndpoint are required'
            });
        }

        const canceled = await cancelActiveCheckin(attackId, subscriptionEndpoint, req.body.cancelSeries === true);

        if (canceled) {
            res.json({
                success: true,
                message: 'Active attack check-in canceled successfully'
            });
        } else {
            res.status(404).json({
                success: false,
                message: 'No active check-in found for this attack'
            });
        }
    } catch (error) {
        logger.error('Cancel active check-in error:', error);
        res.status(500).json({
            error: 'Failed to cancel active attack check-in'
        });
    }
});

module.exports = router;
