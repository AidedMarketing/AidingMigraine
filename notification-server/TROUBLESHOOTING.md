# Notification Troubleshooting Guide

## Quick Diagnosis

If test notifications work but scheduled notifications don't, the issue is usually one of these:

### Common Issues:

1. **UTC time not calculated** (most common)
2. **Scheduler not running**
3. **Timezone mismatch**
4. **Notification preferences not saved correctly**

---

## Step 1: Run the Diagnostic Tool

```bash
cd notification-server
node debug-notifications.js
```

This will check:
- ✅ Environment variables
- ✅ Database subscriptions
- ✅ Notification preferences
- ✅ UTC time calculations
- ✅ Pending notifications
- ✅ Scheduler status

---

## Step 2: Check Server Logs

### Look for scheduler activity:

```bash
# If server is running, check console output
# You should see these messages every hour:
⏰ Hourly check at [timestamp]
📅 Checking for daily check-ins at UTC hour X...

# And every 15 minutes:
⏰ Checking for scheduled follow-ups...
⚡ Checking for active attack check-ins...
```

### If you DON'T see these messages:
- **Problem:** Scheduler isn't running
- **Fix:** Restart the server

---

## Step 3: Common Issues & Solutions

### Issue 1: UTC Time Not Calculated ⚠️  MOST COMMON

**Symptoms:**
- Test notifications work
- Server shows "No daily check-ins scheduled for this hour"
- Subscription has `time` but missing `utcTime` field

**Why this happens:**
The PWA needs to calculate what time your local time is in UTC. If this field is missing, the scheduler can't match your notification time.

**Fix:**
1. Open the PWA
2. Go to Settings → Notifications
3. Toggle notifications OFF
4. Toggle notifications ON
5. Grant permission
6. Set your notification time again
7. Save settings

This will recalculate the UTC time.

**Verify the fix:**
```bash
cd notification-server
node debug-notifications.js
```
Look for `UTC Time: XX:XX` under your subscription.

---

### Issue 2: Scheduler Not Running

**Symptoms:**
- No "⏰ Hourly check" messages in server logs
- Server appears to be running but silent

**Why this happens:**
- Server crashed and restarted without initializing scheduler
- `node-schedule` package not installed
- Error during scheduler initialization

**Fix:**
```bash
cd notification-server

# Check if node-schedule is installed
npm list node-schedule

# If not installed:
npm install node-schedule

# Restart server
npm start
```

**Verify the fix:**
Wait 1-2 minutes and check server logs for:
```
✅ Notification scheduler started
🕐 Initializing notification scheduler...
✅ Scheduler initialized
   - Hourly job for daily check-ins
   - Every 15 minutes for follow-ups and active check-ins
```

---

### Issue 3: Timezone Mismatch

**Symptoms:**
- Notifications come at wrong time
- UTC time is calculated but incorrect

**Why this happens:**
Browser timezone detection failed or user changed timezone.

**Fix:**
1. Open browser console (F12)
2. Check your timezone:
   ```javascript
   Intl.DateTimeFormat().resolvedOptions().timeZone
   ```
3. In PWA, re-save notification settings
4. Verify UTC time is correct:
   ```bash
   node debug-notifications.js
   ```

**Example:**
- You want notifications at 7:00 PM in New York (EST, UTC-5)
- UTC time should be: 00:00 (midnight UTC)
- If it shows 19:00 UTC, the timezone wasn't detected

---

### Issue 4: Server Time vs User Time

**Symptoms:**
- Notifications come 1 hour early/late
- Happens after daylight saving time changes

**Why this happens:**
Server and user might be in different timezones or handling DST differently.

**Fix:**
The notification system uses UTC internally, so this should rarely happen. But if it does:

1. Check server time:
   ```bash
   date -u
   ```
2. Should show UTC time
3. If not, your server timezone is misconfigured

4. In PWA settings, toggle notifications to recalculate UTC

---

### Issue 5: Daily Check-in Only Triggers on Certain Days

**Symptoms:**
- Notifications work some days but not others
- "Every other day" setting

**Why this happens:**
The frequency setting uses day-of-week calculation.

**Check:**
```bash
node debug-notifications.js
```
Look for "Frequency" field.

**Fix:**
If you want EVERY day:
1. Open PWA → Settings → Notifications
2. Change frequency to "Every day"
3. Save

---

### Issue 6: Follow-up Notifications Not Working

**Symptoms:**
- Daily check-ins work
- But no notifications after logging a migraine

**Why this happens:**
- Post-attack follow-up not enabled
- Or migraine wasn't logged properly
- Or follow-up already sent

**Check:**
```bash
node debug-notifications.js
```
Look at "Post-Attack Follow-up: Enabled" status.

**Fix:**
1. Enable post-attack follow-ups in PWA Settings
2. Set delay (2-4 hours)
3. Log a migraine in the PWA
4. Wait for the delay period
5. Check server logs for:
   ```
   ⏰ Checking for scheduled follow-ups...
   Found X follow-ups to send
   ```

---

### Issue 7: Active Attack Check-ins Not Working

**Symptoms:**
- You have an ongoing migraine
- No check-in notifications during attack

**Why this happens:**
- Active check-in not enabled
- Attack already ended
- Check-in already sent and waiting for next interval

**Fix:**
1. Enable active attack check-ins in Settings
2. Set interval (1-4 hours)
3. Start a migraine (record pain level)
4. Don't end the migraine yet
5. Wait for interval
6. Check server logs for:
   ```
   ⚡ Checking for active attack check-ins...
   Found X active check-ins to send
   ```

---

## Step 4: Manual Testing

### Test 1: Force a Daily Check-in

You can manually trigger the scheduler functions:

```bash
cd notification-server
node -e "
const { processDailyCheckIns } = require('./scheduler');
const now = new Date();
processDailyCheckIns(now.getUTCHours(), now.getDay());
"
```

This will check if any notifications should send NOW.

### Test 2: Check Database Directly

```bash
cd notification-server
cat data/subscriptions.json | python3 -m json.tool
```

Look for:
- `"endpoint"`: Should exist
- `"dailyCheckIn"`: Should have `"enabled": true`
- `"time"`: Should be set (e.g., "19:00")
- `"utcTime"`: Should be calculated (e.g., "00:00")
- `"timezone"`: Should be your timezone (e.g., "America/New_York")

If `utcTime` is missing, that's your problem!

---

## Step 5: Verify Notification Permissions

Sometimes the browser blocks notifications even though permission was granted:

### Chrome/Edge:
1. Go to `chrome://settings/content/notifications`
2. Check if your PWA domain is in "Allow"
3. If in "Block", remove it and re-enable in PWA

### Safari (iOS):
1. Must install PWA to home screen FIRST
2. THEN enable notifications from within installed PWA
3. Check Settings → Notifications → [App Name]
4. Ensure "Allow Notifications" is ON

### Firefox:
1. Go to `about:preferences#privacy`
2. Scroll to "Permissions" → "Notifications"
3. Check if your domain has permission

---

## Step 6: Check Network/Firewall

If server is deployed:

```bash
# Test server accessibility
curl https://your-notification-server.com/health

# Should return:
{"status":"ok","message":"Aiding Migraine Notification Server is running","timestamp":"..."}

# If this fails, your server is unreachable
```

**Common network issues:**
- Firewall blocking port 3000
- HTTPS certificate expired
- DNS not resolving
- Server crashed

---

## Step 7: Check VAPID Keys Match

**Symptoms:**
- Server shows "sent" but notifications never arrive
- Browser console shows subscription errors

**Fix:**
1. Check PWA's VAPID key (index.html line ~5929):
   ```javascript
   const VAPID_PUBLIC_KEY = 'BHVu...';
   ```

2. Check server's VAPID key (.env):
   ```
   VAPID_PUBLIC_KEY=BHVu...
   ```

3. **These MUST match exactly!**

4. If they don't match:
   - Update PWA with correct key
   - Or rotate credentials and update both

---

## Step 8: Check for Multiple Subscriptions

**Symptoms:**
- Some notifications arrive, others don't
- Duplicate notifications

**Why this happens:**
User enabled notifications on multiple devices/browsers.

**Check:**
```bash
node debug-notifications.js
```
Look at "Total subscriptions" count.

**Fix:**
If you see multiple subscriptions but only use one device:
1. Unsubscribe from old devices:
   - Open PWA on old device
   - Settings → Disable notifications
2. Or manually delete old subscriptions from database

---

## Emergency Fixes

### Nuclear Option 1: Reset All Notifications

```bash
cd notification-server

# Backup current data
cp data/subscriptions.json data/subscriptions.json.backup

# Clear subscriptions
echo '{"subscriptions": [], "followups": [], "activeCheckins": []}' > data/subscriptions.json

# Restart server
npm start
```

Then re-enable notifications in PWA.

### Nuclear Option 2: Regenerate Credentials

```bash
cd notification-server
./rotate-credentials.sh

# Follow the script's instructions to:
# 1. Update .env
# 2. Update PWA with new VAPID key
# 3. Restart server
# 4. Re-enable notifications in PWA
```

---

## Still Not Working?

If you've tried everything above and notifications still don't work:

### Collect Debug Information:

```bash
cd notification-server

# 1. Run diagnostics
node debug-notifications.js > debug-output.txt

# 2. Check server logs (last 100 lines)
tail -n 100 server.log >> debug-output.txt

# 3. Check database
cat data/subscriptions.json >> debug-output.txt

# 4. Send debug-output.txt when asking for help
```

### Common Final Causes:

1. **Browser bug** - Try different browser
2. **PWA not properly installed** - Reinstall to home screen
3. **Service worker issue** - Clear site data and reinstall
4. **OS blocking notifications** - Check system notification settings
5. **VPN/Proxy blocking push service** - Disable temporarily to test

---

## Checklist for Working Notifications

Use this to verify everything is set up correctly:

### Server Side:
- [ ] Node.js installed (v18+)
- [ ] Dependencies installed (`npm install`)
- [ ] `.env` file exists with all keys
- [ ] VAPID keys generated
- [ ] Admin API key set
- [ ] Server running (`npm start`)
- [ ] Health endpoint responds (`curl localhost:3000/health`)
- [ ] Scheduler initialized (check logs for "✅ Notification scheduler started")
- [ ] Hourly checks appearing in logs

### Client Side (PWA):
- [ ] PWA installed to home screen (iOS requirement)
- [ ] VAPID public key matches server
- [ ] Notifications enabled in Settings
- [ ] Notification permission granted in browser
- [ ] Time set for daily check-in
- [ ] Test notification works
- [ ] Subscription saved in database (`node debug-notifications.js`)
- [ ] UTC time calculated correctly

### Verification:
- [ ] Run `node debug-notifications.js` - no errors
- [ ] Wait for scheduled time
- [ ] Notification arrives!

---

## Understanding the Scheduler

The scheduler uses cron syntax:

```javascript
'0 * * * *'        // Every hour at :00
'*/15 * * * *'     // Every 15 minutes
```

**What this means:**
- At **:00** of every hour (12:00, 13:00, 14:00, etc.), the server checks for daily check-ins
- Every **15 minutes** (:00, :15, :30, :45), it checks for follow-ups and active check-ins

**Important:**
- Daily check-ins only trigger once per hour
- If your notification time is 19:30, it will actually send at 19:00 (next whole hour)
- This is by design for efficiency

---

## Useful Commands

```bash
# Check if server is running
ps aux | grep node

# Check server logs in real-time
tail -f /path/to/logs

# Test notification endpoint (requires API key)
curl -X POST http://localhost:3000/api/notifications/send-test \
  -H "Content-Type: application/json" \
  -d '{"subscription": {...}}'

# Check port 3000 is listening
netstat -tulpn | grep 3000

# Restart server with logging
npm start 2>&1 | tee server.log
```

---

## Logging Best Practices

To better track notification issues:

```bash
# Start server with timestamps
npm start | while IFS= read -r line; do echo "$(date '+%Y-%m-%d %H:%M:%S') $line"; done | tee -a notification-server.log
```

This will create a log file with timestamps for debugging.

---

## Need More Help?

1. **GitHub Issues:** https://github.com/AidedMarketing/AidingMigraine/issues
2. **Include debug output:** Run `node debug-notifications.js` and share output
3. **Include server logs:** Last 50-100 lines showing scheduler activity
4. **Include browser console:** Any errors when enabling notifications

---

**Last Updated:** 2026-01-22
**Version:** 2.0.0
