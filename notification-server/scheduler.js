const logger = require('./logger');
/**
 * Notification Scheduler
 *
 * Runs scheduled jobs to send notifications at appropriate times
 */

const schedule = require('node-schedule');
const {
    getSubscriptionsForDailyCheckIn,
    markDailyCheckInAsSent,
    getFollowupsDueNow,
    markFollowupAsSent,
    getActiveCheckinsDueNow,
    markActiveCheckinAsSent,
    getSubscriptionByEndpoint,
    removeSubscription,
    pruneOldRecords
} = require('./database');
const {
    sendWebPushNotification,
    createDailyCheckInPayload,
    createFollowUpPayload,
    createActiveCheckinPayload
} = require('./push-notifications');

function initializeScheduler() {
    logger.log('🕐 Initializing notification scheduler...');

    // A single non-overlapping tick honors minute precision and catches up persisted queues.
    let running = false;
    const tick = async () => {
        if (running) return;
        running = true;
        try {
            const now = new Date();
            await processDailyCheckIns(now.getUTCHours(), now.getUTCDay());
            await processScheduledFollowUps();
            await processActiveCheckins();
        } catch { logger.error('Scheduler tick failed'); }
        finally { running = false; }
    };
    const reminderJob = schedule.scheduleJob('* * * * *', tick);
    void tick();

    // Daily at 03:00 UTC: prune old sent/stale records so the data files
    // don't grow without bound.
    const pruneJob = schedule.scheduleJob('0 3 * * *', async () => {
        try {
            const removed = await pruneOldRecords(7);
            if (removed > 0) logger.log(`🧹 Pruned ${removed} old notification record(s)`);
        } catch (error) {
            logger.error('❌ Error in prune job:', error);
        }
    });

    logger.log('✅ Scheduler initialized');
    logger.log('   - Minute checks for reminders');
    logger.log('   - Daily prune of old notification records');

    return { reminderJob, pruneJob };
}

async function processDailyCheckIns(currentHour, currentDay) {
    const now = new Date();
    logger.log(`📅 Checking for daily check-ins at UTC hour ${currentHour} (${now.toISOString()})...`);

    const subscriptions = getSubscriptionsForDailyCheckIn(currentHour, currentDay);

    if (subscriptions.length === 0) {
        logger.log('   No daily check-ins scheduled for this hour');
        return;
    }

    logger.log(`   Found ${subscriptions.length} users for daily check-in`);

    // Log timezone info for debugging
    subscriptions.forEach((sub, index) => {
        const timezone = sub.preferences.dailyCheckIn.timezone || 'Unknown';
        const localTime = sub.preferences.dailyCheckIn.time || 'Unknown';
        const utcTime = sub.preferences.dailyCheckIn.utcTime || 'Unknown';
        logger.log(`   User ${index + 1}: ${localTime} (${timezone}) = ${utcTime} UTC`);
    });

    const payload = createDailyCheckInPayload();
    let sent = 0;
    let failed = 0;

    for (const subscription of subscriptions) {
        try {
            const result = await sendWebPushNotification(subscription, payload);
            if (result.success) {
                await markDailyCheckInAsSent(subscription.endpoint);
                sent++;
            } else {
                failed++;
                if (result.error === 'subscription_expired') {
                    await removeSubscription(subscription.endpoint);
                    logger.log('   🧹 Removed expired subscription');
                }
            }
        } catch (error) {
            logger.error('   Error sending to subscription:', error);
            failed++;
        }
    }

    logger.log(`   ✅ Daily check-ins sent: ${sent}, Failed: ${failed}`);
}

async function processScheduledFollowUps() {
    logger.log('⏰ Checking for scheduled follow-ups...');

    const followups = getFollowupsDueNow();

    if (followups.length === 0) {
        logger.log('   No follow-ups due at this time');
        return;
    }

    logger.log(`   Found ${followups.length} follow-ups to send`);

    let sent = 0;
    let failed = 0;

    for (const followup of followups) {
        try {
            const subscription = getSubscriptionByEndpoint(followup.subscriptionEndpoint);

            if (!subscription) {
                logger.log(`   Subscription not found for follow-up ${followup.id}`);
                await markFollowupAsSent(followup.id); // Mark as sent to avoid retrying
                failed++;
                continue;
            }

            const payload = createFollowUpPayload(followup.attackId);
            const result = await sendWebPushNotification(subscription, payload);

            if (result.success) {
                await markFollowupAsSent(followup.id);
                sent++;
                logger.log(`   ✅ Follow-up sent for attack ${followup.attackId}`);
            } else {
                failed++;
                logger.log(`   ❌ Failed to send follow-up for attack ${followup.attackId}`);
                if (result.error === 'subscription_expired') {
                    await removeSubscription(subscription.endpoint);
                    await markFollowupAsSent(followup.id); // don't retry a dead endpoint
                    logger.log('   🧹 Removed expired subscription');
                }
            }
        } catch (error) {
            logger.error(`   Error processing follow-up ${followup.id}:`, error);
            failed++;
        }
    }

    logger.log(`   ✅ Follow-ups sent: ${sent}, Failed: ${failed}`);
}

async function processActiveCheckins() {
    logger.log('⚡ Checking for active attack check-ins...');

    const checkins = getActiveCheckinsDueNow();

    if (checkins.length === 0) {
        logger.log('   No active check-ins due at this time');
        return;
    }

    logger.log(`   Found ${checkins.length} active check-ins to send`);

    let sent = 0;
    let failed = 0;

    for (const checkin of checkins) {
        try {
            const subscription = getSubscriptionByEndpoint(checkin.subscriptionEndpoint);

            if (!subscription) {
                logger.log(`   Subscription not found for check-in ${checkin.id}`);
                await markActiveCheckinAsSent(checkin.id); // Mark as sent to avoid retrying
                failed++;
                continue;
            }

            const payload = createActiveCheckinPayload(checkin.attackId);
            const result = await sendWebPushNotification(subscription, payload);

            if (result.success) {
                await markActiveCheckinAsSent(checkin.id);
                sent++;
                logger.log(`   ✅ Active check-in sent for attack ${checkin.attackId}`);
            } else {
                failed++;
                logger.log(`   ❌ Failed to send active check-in for attack ${checkin.attackId}`);
                if (result.error === 'subscription_expired') {
                    await removeSubscription(subscription.endpoint);
                    await markActiveCheckinAsSent(checkin.id); // don't retry a dead endpoint
                    logger.log('   🧹 Removed expired subscription');
                }
            }
        } catch (error) {
            logger.error(`   Error processing active check-in ${checkin.id}:`, error);
            failed++;
        }
    }

    logger.log(`   ✅ Active check-ins sent: ${sent}, Failed: ${failed}`);
}

module.exports = {
    initializeScheduler,
    processDailyCheckIns,
    processScheduledFollowUps,
    processActiveCheckins
};
