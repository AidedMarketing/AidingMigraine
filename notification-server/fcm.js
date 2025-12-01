/**
 * Firebase Cloud Messaging integration
 *
 * This module handles sending push notifications via FCM and Web Push
 */

const admin = require('firebase-admin');
const webPush = require('web-push');

let fcmInitialized = false;

function initializeFCM() {
    if (fcmInitialized) return;

    try {
        // Initialize Firebase Admin SDK
        const serviceAccount = {
            projectId: process.env.FIREBASE_PROJECT_ID,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL
        };

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });

        console.log('✅ Firebase Admin SDK initialized');

        // Configure Web Push VAPID details
        webPush.setVapidDetails(
            process.env.VAPID_SUBJECT,
            process.env.VAPID_PUBLIC_KEY,
            process.env.VAPID_PRIVATE_KEY
        );

        console.log('✅ Web Push VAPID configured');

        fcmInitialized = true;
    } catch (error) {
        console.error('❌ FCM initialization failed:', error);
        throw error;
    }
}

/**
 * Send a push notification using Web Push Protocol
 * @param {Object} subscription - Push subscription object
 * @param {Object} payload - Notification payload
 */
async function sendWebPushNotification(subscription, payload) {
    if (!fcmInitialized) {
        initializeFCM();
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

module.exports = {
    initializeFCM,
    sendWebPushNotification,
    sendBulkNotifications,
    createDailyCheckInPayload,
    createFollowUpPayload
};
