/**
 * Notification Scheduler
 *
 * Runs scheduled jobs to send notifications at appropriate times
 */

const schedule = require('node-schedule');
const {
    getSubscriptionsForDailyCheckIn,
    getFollowupsDueNow,
    markFollowupAsSent,
    getActiveCheckinsDueNow,
    markActiveCheckinAsSent,
    getSubscriptionByEndpoint,
    removeSubscription,
    pruneOldRecords,
    getSubscriptionsForPressureAlerts,
    updatePressureAlertState
} = require('./database');
const {
    sendWebPushNotification,
    createDailyCheckInPayload,
    createFollowUpPayload,
    createActiveCheckinPayload,
    createPressureAlertPayload
} = require('./push-notifications');
const {
    fetchPressureForecast,
    findStrongestPressureWindow,
    localDateKey,
    shouldSendPressureAlert
} = require('./pressure-alerts');

function initializeScheduler() {
    console.log('🕐 Initializing notification scheduler...');

    // Run every hour at :00 to check for scheduled notifications
    const hourlyJob = schedule.scheduleJob('0 * * * *', async () => {
        const now = new Date();
        const currentHour = now.getUTCHours();
        const currentDay = now.getUTCDay();

        console.log(`\n⏰ Hourly check at ${now.toLocaleString()}`);

        try {
            // Check for daily check-in notifications
            await processDailyCheckIns(currentHour, currentDay);

            // Check for scheduled follow-ups
            await processScheduledFollowUps();
        } catch (error) {
            console.error('❌ Error in scheduled job:', error);
        }
    });

    // Also check every 15 minutes for follow-ups and active check-ins (more responsive)
    const followupJob = schedule.scheduleJob('*/15 * * * *', async () => {
        try {
            await processScheduledFollowUps();
            await processActiveCheckins();
        } catch (error) {
            console.error('❌ Error in follow-up/active check-in check:', error);
        }
    });

    // Daily at 03:00 UTC: prune old sent/stale records so the data files
    // don't grow without bound.
    const pruneJob = schedule.scheduleJob('0 3 * * *', async () => {
        try {
            const removed = await pruneOldRecords(7);
            if (removed > 0) console.log(`🧹 Pruned ${removed} old notification record(s)`);
        } catch (error) {
            console.error('❌ Error in prune job:', error);
        }
    });

    // Every hour at :30: check pressure forecasts for users who opted in
    const pressureJob = schedule.scheduleJob('30 * * * *', async () => {
        try {
            await processPressureAlerts();
        } catch (error) {
            console.error('❌ Error in pressure alert check:', error);
        }
    });

    console.log('✅ Scheduler initialized');
    console.log('   - Hourly job for daily check-ins');
    console.log('   - Every 15 minutes for follow-ups and active check-ins');
    console.log('   - Hourly at :30 for pressure alerts');
    console.log('   - Daily prune of old notification records');

    return { hourlyJob, followupJob, pruneJob, pressureJob };
}

async function processPressureAlerts(now = new Date()) {
    const subscriptions = getSubscriptionsForPressureAlerts();

    if (subscriptions.length === 0) {
        return;
    }

    console.log(`🌡️ Checking pressure forecasts for ${subscriptions.length} user(s)...`);

    let sent = 0;
    let failed = 0;

    for (const subscription of subscriptions) {
        const pa = subscription.preferences.pressureAlerts;
        try {
            const hourly = await fetchPressureForecast(pa.latitude, pa.longitude);
            const alert = findStrongestPressureWindow(hourly, pa.thresholdHpa || 5, now);
            if (!alert) continue;

            const todayLocal = localDateKey(now, pa.timezone);
            if (!shouldSendPressureAlert(subscription.pressureAlertState, alert.eventKey, todayLocal)) {
                continue;
            }

            const payload = createPressureAlertPayload(alert);
            const result = await sendWebPushNotification(subscription, payload);

            if (result.success) {
                await updatePressureAlertState(subscription.endpoint, {
                    lastEventKey: alert.eventKey,
                    lastSentLocalDate: todayLocal,
                    lastSentAt: now.toISOString()
                });
                sent++;
                console.log(`   ✅ Pressure alert sent (${alert.direction} ${alert.rapidChange} hPa/6h)`);
            } else {
                failed++;
                if (result.error === 'subscription_expired') {
                    await removeSubscription(subscription.endpoint);
                    console.log('   🧹 Removed expired subscription');
                }
            }
        } catch (error) {
            console.error('   Error processing pressure alert:', error);
            failed++;
        }
    }

    if (sent > 0 || failed > 0) {
        console.log(`   ✅ Pressure alerts sent: ${sent}, Failed: ${failed}`);
    }
}

async function processDailyCheckIns(currentHour, currentDay) {
    const now = new Date();
    console.log(`📅 Checking for daily check-ins at UTC hour ${currentHour} (${now.toISOString()})...`);

    const subscriptions = getSubscriptionsForDailyCheckIn(currentHour, currentDay);

    if (subscriptions.length === 0) {
        console.log('   No daily check-ins scheduled for this hour');
        return;
    }

    console.log(`   Found ${subscriptions.length} users for daily check-in`);

    // Log timezone info for debugging
    subscriptions.forEach((sub, index) => {
        const timezone = sub.preferences.dailyCheckIn.timezone || 'Unknown';
        const localTime = sub.preferences.dailyCheckIn.time || 'Unknown';
        const utcTime = sub.preferences.dailyCheckIn.utcTime || 'Unknown';
        console.log(`   User ${index + 1}: ${localTime} (${timezone}) = ${utcTime} UTC`);
    });

    const payload = createDailyCheckInPayload();
    let sent = 0;
    let failed = 0;

    for (const subscription of subscriptions) {
        try {
            const result = await sendWebPushNotification(subscription, payload);
            if (result.success) {
                sent++;
            } else {
                failed++;
                if (result.error === 'subscription_expired') {
                    await removeSubscription(subscription.endpoint);
                    console.log('   🧹 Removed expired subscription');
                }
            }
        } catch (error) {
            console.error('   Error sending to subscription:', error);
            failed++;
        }
    }

    console.log(`   ✅ Daily check-ins sent: ${sent}, Failed: ${failed}`);
}

async function processScheduledFollowUps() {
    console.log('⏰ Checking for scheduled follow-ups...');

    const followups = getFollowupsDueNow();

    if (followups.length === 0) {
        console.log('   No follow-ups due at this time');
        return;
    }

    console.log(`   Found ${followups.length} follow-ups to send`);

    let sent = 0;
    let failed = 0;

    for (const followup of followups) {
        try {
            const subscription = getSubscriptionByEndpoint(followup.subscriptionEndpoint);

            if (!subscription) {
                console.log(`   Subscription not found for follow-up ${followup.id}`);
                await markFollowupAsSent(followup.id); // Mark as sent to avoid retrying
                failed++;
                continue;
            }

            const payload = createFollowUpPayload(followup.attackId);
            const result = await sendWebPushNotification(subscription, payload);

            if (result.success) {
                await markFollowupAsSent(followup.id);
                sent++;
                console.log(`   ✅ Follow-up sent for attack ${followup.attackId}`);
            } else {
                failed++;
                console.log(`   ❌ Failed to send follow-up for attack ${followup.attackId}`);
                if (result.error === 'subscription_expired') {
                    await removeSubscription(subscription.endpoint);
                    await markFollowupAsSent(followup.id); // don't retry a dead endpoint
                    console.log('   🧹 Removed expired subscription');
                }
            }
        } catch (error) {
            console.error(`   Error processing follow-up ${followup.id}:`, error);
            failed++;
        }
    }

    console.log(`   ✅ Follow-ups sent: ${sent}, Failed: ${failed}`);
}

async function processActiveCheckins() {
    console.log('⚡ Checking for active attack check-ins...');

    const checkins = getActiveCheckinsDueNow();

    if (checkins.length === 0) {
        console.log('   No active check-ins due at this time');
        return;
    }

    console.log(`   Found ${checkins.length} active check-ins to send`);

    let sent = 0;
    let failed = 0;

    for (const checkin of checkins) {
        try {
            const subscription = getSubscriptionByEndpoint(checkin.subscriptionEndpoint);

            if (!subscription) {
                console.log(`   Subscription not found for check-in ${checkin.id}`);
                await markActiveCheckinAsSent(checkin.id); // Mark as sent to avoid retrying
                failed++;
                continue;
            }

            const payload = createActiveCheckinPayload(checkin.attackId);
            const result = await sendWebPushNotification(subscription, payload);

            if (result.success) {
                await markActiveCheckinAsSent(checkin.id);
                sent++;
                console.log(`   ✅ Active check-in sent for attack ${checkin.attackId}`);
            } else {
                failed++;
                console.log(`   ❌ Failed to send active check-in for attack ${checkin.attackId}`);
                if (result.error === 'subscription_expired') {
                    await removeSubscription(subscription.endpoint);
                    await markActiveCheckinAsSent(checkin.id); // don't retry a dead endpoint
                    console.log('   🧹 Removed expired subscription');
                }
            }
        } catch (error) {
            console.error(`   Error processing active check-in ${checkin.id}:`, error);
            failed++;
        }
    }

    console.log(`   ✅ Active check-ins sent: ${sent}, Failed: ${failed}`);
}

module.exports = {
    initializeScheduler,
    processDailyCheckIns,
    processScheduledFollowUps,
    processActiveCheckins,
    processPressureAlerts
};
