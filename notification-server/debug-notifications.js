#!/usr/bin/env node
/**
 * Notification Debugging Tool
 *
 * This script helps diagnose why scheduled notifications aren't working.
 * Run this to check your notification server configuration and subscription data.
 */

require('dotenv').config();
const { getAllSubscriptions, getFollowupsDueNow, getActiveCheckinsDueNow } = require('./database');

console.log('🔍 Aiding Migraine Notification Debugger\n');
console.log('=' .repeat(60));

// Check 1: Environment Variables
console.log('\n1️⃣  CHECKING ENVIRONMENT VARIABLES');
console.log('=' .repeat(60));

const requiredVars = [
    'VAPID_PUBLIC_KEY',
    'VAPID_PRIVATE_KEY',
    'VAPID_SUBJECT'
];

let envIssues = 0;
requiredVars.forEach(varName => {
    const value = process.env[varName];
    if (!value) {
        console.log(`❌ ${varName}: NOT SET`);
        envIssues++;
    } else {
        console.log(`✅ ${varName}: Set (${value.substring(0, 20)}...)`);
    }
});

if (envIssues > 0) {
    console.log(`\n⚠️  ${envIssues} environment variable(s) missing!`);
    console.log('Run: ./rotate-credentials.sh to generate credentials');
}

// Check 2: Database initialization
console.log('\n2️⃣  CHECKING DATABASE');
console.log('=' .repeat(60));

let subscriptions = [];
try {
    const { initializeDatabase } = require('./database');
    initializeDatabase();
    subscriptions = getAllSubscriptions();
    console.log(`✅ Database accessible`);
    console.log(`📊 Total subscriptions: ${subscriptions.length}`);
} catch (error) {
    console.log(`❌ Database error: ${error.message}`);
}

// Check 3: Subscription Details
if (subscriptions.length === 0) {
    console.log('\n⚠️  NO SUBSCRIPTIONS FOUND');
    console.log('=' .repeat(60));
    console.log('This means no users have enabled notifications in the PWA.');
    console.log('\nTo fix:');
    console.log('1. Open the PWA in your browser');
    console.log('2. Go to Settings');
    console.log('3. Enable "Push Notifications"');
    console.log('4. Grant notification permission when prompted');
} else {
    console.log('\n3️⃣  SUBSCRIPTION DETAILS');
    console.log('=' .repeat(60));

    subscriptions.forEach((sub, index) => {
        console.log(`\nSubscription ${index + 1}:`);
        console.log(`  Endpoint: ${sub.endpoint.substring(0, 50)}...`);

        // Daily Check-in
        const daily = sub.preferences?.dailyCheckIn;
        if (daily) {
            console.log(`  📅 Daily Check-in:`);
            console.log(`     Enabled: ${daily.enabled ? '✅' : '❌'}`);
            if (daily.enabled) {
                console.log(`     Time: ${daily.time || 'NOT SET'}`);
                console.log(`     Timezone: ${daily.timezone || 'NOT SET'}`);
                console.log(`     UTC Time: ${daily.utcTime || 'NOT CALCULATED'}`);
                console.log(`     Frequency: ${daily.frequency || 'daily'}`);

                // Check if UTC time is calculated
                if (!daily.utcTime) {
                    console.log(`     ⚠️  UTC time not calculated - notifications won't send!`);
                }
            }
        } else {
            console.log(`  📅 Daily Check-in: NOT CONFIGURED`);
        }

        // Post-Attack Follow-up
        const followup = sub.preferences?.postAttackFollowUp;
        if (followup) {
            console.log(`  ⏰ Post-Attack Follow-up:`);
            console.log(`     Enabled: ${followup.enabled ? '✅' : '❌'}`);
            if (followup.enabled) {
                console.log(`     Delay: ${followup.delayHours || 2} hours`);
            }
        } else {
            console.log(`  ⏰ Post-Attack Follow-up: NOT CONFIGURED`);
        }

        // Active Attack Check-in
        const active = sub.preferences?.activeCheckin;
        if (active) {
            console.log(`  ⚡ Active Attack Check-in:`);
            console.log(`     Enabled: ${active.enabled ? '✅' : '❌'}`);
            if (active.enabled) {
                console.log(`     Delay: ${active.delayHours || 2} hours`);
            }
        } else {
            console.log(`  ⚡ Active Attack Check-in: NOT CONFIGURED`);
        }
    });
}

// Check 4: Current Time and Next Scheduled Notifications
console.log('\n4️⃣  CURRENT TIME & SCHEDULE');
console.log('=' .repeat(60));

const now = new Date();
console.log(`Server Time (UTC): ${now.toISOString()}`);
console.log(`Server Time (Local): ${now.toLocaleString()}`);
console.log(`Current UTC Hour: ${now.getUTCHours()}`);
console.log(`Current Day of Week: ${now.getDay()} (0=Sunday, 6=Saturday)`);

// Check if any daily notifications should trigger now
console.log('\n📅 Checking daily check-ins for current hour...');
let foundForCurrentHour = false;
subscriptions.forEach((sub, index) => {
    const daily = sub.preferences?.dailyCheckIn;
    if (daily?.enabled && daily.utcTime) {
        const [hour, minute] = daily.utcTime.split(':').map(Number);
        if (hour === now.getUTCHours()) {
            console.log(`  ✅ Subscription ${index + 1} should trigger at ${daily.utcTime} UTC`);
            foundForCurrentHour = true;
        }
    }
});
if (!foundForCurrentHour) {
    console.log(`  No daily check-ins scheduled for hour ${now.getUTCHours()}`);
}

// Check 5: Pending Follow-ups
console.log('\n5️⃣  PENDING NOTIFICATIONS');
console.log('=' .repeat(60));

try {
    const followups = getFollowupsDueNow();
    console.log(`⏰ Follow-ups due now: ${followups.length}`);
    if (followups.length > 0) {
        followups.forEach((f, i) => {
            console.log(`  ${i + 1}. Attack ID: ${f.attackId}, Due: ${new Date(f.followUpTime).toLocaleString()}`);
        });
    }
} catch (error) {
    console.log(`⚠️  Could not check follow-ups: ${error.message}`);
}

try {
    const checkins = getActiveCheckinsDueNow();
    console.log(`⚡ Active check-ins due now: ${checkins.length}`);
    if (checkins.length > 0) {
        checkins.forEach((c, i) => {
            console.log(`  ${i + 1}. Attack ID: ${c.attackId}, Next: ${new Date(c.nextCheckInTime).toLocaleString()}`);
        });
    }
} catch (error) {
    console.log(`⚠️  Could not check active check-ins: ${error.message}`);
}

// Check 6: Scheduler Status
console.log('\n6️⃣  SCHEDULER STATUS');
console.log('=' .repeat(60));
console.log('Cron jobs should run:');
console.log('  - Every hour at :00 - Daily check-ins');
console.log('  - Every 15 minutes - Follow-ups & Active check-ins');
console.log('\nTo verify scheduler is running, check server logs for:');
console.log('  "⏰ Hourly check at..."');
console.log('  "⏰ Checking for scheduled follow-ups..."');

// Summary & Recommendations
console.log('\n' + '='.repeat(60));
console.log('📋 SUMMARY & RECOMMENDATIONS');
console.log('=' .repeat(60));

const issues = [];
const recommendations = [];

if (envIssues > 0) {
    issues.push('Missing environment variables');
    recommendations.push('Run ./rotate-credentials.sh to generate credentials');
}

if (subscriptions.length === 0) {
    issues.push('No subscriptions found');
    recommendations.push('Enable notifications in PWA Settings');
} else {
    // Check if any have daily check-ins enabled
    const dailyEnabled = subscriptions.filter(s => s.preferences?.dailyCheckIn?.enabled);
    if (dailyEnabled.length === 0) {
        issues.push('No users have daily check-ins enabled');
        recommendations.push('Enable daily check-in notifications in PWA Settings');
    } else {
        // Check if UTC times are calculated
        const missingUTC = dailyEnabled.filter(s => !s.preferences?.dailyCheckIn?.utcTime);
        if (missingUTC.length > 0) {
            issues.push(`${missingUTC.length} subscription(s) missing UTC time calculation`);
            recommendations.push('This is a bug in the PWA - UTC time should be calculated when saving preferences');
            recommendations.push('Quick fix: Re-save notification settings in PWA to recalculate UTC time');
        }
    }
}

if (issues.length === 0) {
    console.log('✅ No issues found! Scheduler should be working correctly.');
    console.log('\nIf notifications still aren\'t coming through:');
    console.log('1. Check server logs: tail -f notification-server/logs/*.log');
    console.log('2. Verify server is running: curl http://localhost:3000/health');
    console.log('3. Wait for next scheduled time (check times above)');
    console.log('4. Check browser notification permissions are granted');
} else {
    console.log('❌ Issues Found:');
    issues.forEach((issue, i) => {
        console.log(`  ${i + 1}. ${issue}`);
    });

    console.log('\n💡 Recommendations:');
    recommendations.forEach((rec, i) => {
        console.log(`  ${i + 1}. ${rec}`);
    });
}

console.log('\n' + '='.repeat(60));
console.log('🔧 Quick Fixes:');
console.log('=' .repeat(60));
console.log('1. Restart notification server:');
console.log('   cd notification-server && npm start');
console.log('\n2. Re-enable notifications in PWA:');
console.log('   Open PWA → Settings → Toggle notifications OFF then ON');
console.log('\n3. Manual test notification:');
console.log('   In PWA Settings, click "Test Notification"');
console.log('\n4. Check server logs:');
console.log('   Look for "⏰ Hourly check" messages every hour');

console.log('\n' + '='.repeat(60));
