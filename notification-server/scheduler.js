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
    getSubscriptionByEndpoint
} = require('./database');
const {
    sendWebPushNotification,
    createDailyCheckInPayload,
    createFollowUpPayload,
    createActiveCheckinPayload
} = require('./fcm');

function initializeScheduler() {
    console.log('🕐 Initializing notification scheduler...');

    // Run every hour at :00 to check for scheduled notifications
    const hourlyJob = schedule.scheduleJob('0 * * * *', async () => {
        const now = new Date();
        const currentHour = now.getHours();
        const currentDay = now.getDay();

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

    console.log('✅ Scheduler initialized');
    console.log('   - Hourly job for daily check-ins');
    console.log('   - Every 15 minutes for follow-ups and active check-ins');

    return { hourlyJob, followupJob };
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
                markFollowupAsSent(followup.id); // Mark as sent to avoid retrying
                failed++;
                continue;
            }

            const payload = createFollowUpPayload(followup.attackId);
            const result = await sendWebPushNotification(subscription, payload);

            if (result.success) {
                markFollowupAsSent(followup.id);
                sent++;
                console.log(`   ✅ Follow-up sent for attack ${followup.attackId}`);
            } else {
                failed++;
                console.log(`   ❌ Failed to send follow-up for attack ${followup.attackId}`);
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
                markActiveCheckinAsSent(checkin.id); // Mark as sent to avoid retrying
                failed++;
                continue;
            }

            const payload = createActiveCheckinPayload(checkin.attackId);
            const result = await sendWebPushNotification(subscription, payload);

            if (result.success) {
                markActiveCheckinAsSent(checkin.id);
                sent++;
                console.log(`   ✅ Active check-in sent for attack ${checkin.attackId}`);
            } else {
                failed++;
                console.log(`   ❌ Failed to send active check-in for attack ${checkin.attackId}`);
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
    processActiveCheckins
};
