/**
 * Push Notification Service
 *
 * This module handles sending push notifications via Web Push Protocol
 */

const webPush = require('web-push');

let pushInitialized = false;

function initializePushService() {
    if (pushInitialized) return;

    try {
        // Configure Web Push VAPID details
        webPush.setVapidDetails(
            process.env.VAPID_SUBJECT,
            process.env.VAPID_PUBLIC_KEY,
            process.env.VAPID_PRIVATE_KEY
        );

        console.log('✅ Web Push VAPID configured');

        pushInitialized = true;
    } catch (error) {
        console.error('❌ Web Push initialization failed:', error);
        throw error;
    }
}

/**
 * Send a push notification using Web Push Protocol
 * @param {Object} subscription - Push subscription object
 * @param {Object} payload - Notification payload
 */
async function sendWebPushNotification(subscription, payload) {
    if (!pushInitialized) {
        initializePushService();
    }

    try {
        const pushSubscription = {
            endpoint: subscription.endpoint,
            keys: subscription.keys
        };

        const notificationPayload = JSON.stringify(payload);

        const result = await webPush.sendNotification(pushSubscription, notificationPayload);

        console.log('✅ Web push notification sent successfully');
        return { success: true, result };
    } catch (error) {
        console.error('❌ Web push notification failed:', error);

        // Handle subscription errors
        if (error.statusCode === 410 || error.statusCode === 404) {
            console.log('Subscription is no longer valid, should be removed');
            return { success: false, error: 'subscription_expired' };
        }

        return { success: false, error: error.message };
    }
}

/**
 * Send notification to multiple subscriptions
 * @param {Array} subscriptions - Array of push subscriptions
 * @param {Object} payload - Notification payload
 */
async function sendBulkNotifications(subscriptions, payload) {
    const results = await Promise.allSettled(
        subscriptions.map(sub => sendWebPushNotification(sub, payload))
    );

    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.length - successful;

    return { total: results.length, successful, failed, results };
}

/**
 * Create notification payload for daily check-in
 */
function createDailyCheckInPayload() {
    return {
        title: 'Aiding Migraine',
        body: 'How was your day? Log your migraine status',
        icon: './icons/icon-192x192.png',
        badge: './icons/icon-72x72.png',
        tag: 'daily-checkin',
        url: './?action=log',
        type: 'daily-checkin'
    };
}

/**
 * Create notification payload for post-attack follow-up
 */
function createFollowUpPayload(attackId) {
    return {
        title: 'Aiding Migraine',
        body: 'How are you feeling now? Update your status',
        icon: './icons/icon-192x192.png',
        badge: './icons/icon-72x72.png',
        tag: `followup-${attackId}`,
        url: `./?action=update&attackId=${attackId}`,
        type: 'post-attack-followup',
        attackId: attackId
    };
}

/**
 * Create notification payload for active attack check-in
 */
function createActiveCheckinPayload(attackId) {
    return {
        title: 'Aiding Migraine',
        body: 'How is your migraine? Update your pain level or add relief methods',
        icon: './icons/icon-192x192.png',
        badge: './icons/icon-72x72.png',
        tag: `active-checkin-${attackId}`,
        url: './?action=active-checkin',
        type: 'active-attack-checkin',
        attackId: attackId
    };
}

module.exports = {
    initializePushService,
    sendWebPushNotification,
    sendBulkNotifications,
    createDailyCheckInPayload,
    createFollowUpPayload,
    createActiveCheckinPayload
};
