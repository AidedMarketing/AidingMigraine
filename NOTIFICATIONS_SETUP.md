# Aiding Migraine - Notification System Setup Guide

Complete guide to setting up the PWA notification system for migraine tracking.

## Overview

The Aiding Migraine PWA now includes a comprehensive notification system that sends:
1. **Daily Check-in Reminders** - Prompt users to log their daily migraine status (default: 7 PM)
2. **Post-Attack Follow-ups** - Check in 2-4 hours after a migraine attack is logged
3. **Active Attack Check-ins** - Regular check-ins during ongoing migraines to monitor pain levels and relief needs

## Architecture

```
┌─────────────────┐
│   PWA (Client)  │
│  - index.html   │
│  - service-     │
│    worker.js    │
└────────┬────────┘
         │
         │ Web Push
         │ Protocol
         │
┌────────▼────────────┐
│ Notification Server │
│  - Node.js/Express  │
│  - Web Push (VAPID) │
│  - Scheduler (cron) │
└─────────────────────┘
```

## Why Server-Side Push is Required

**Critical Understanding:** PWAs cannot reliably send scheduled notifications without a server.

- ❌ **setTimeout** in service workers is unreliable (workers terminate)
- ❌ **Notification Triggers API** never made it to production
- ❌ **Periodic Background Sync** only works in Chrome/Edge, not Safari
- ✅ **Server-based Push** is the industry standard and works across all platforms

## Quick Start

### 1. Client-Side (PWA) - Already Implemented

The PWA includes:
- ✅ Notification settings UI in Settings page
- ✅ Permission request flow with iOS detection
- ✅ Service worker push handlers
- ✅ Deep linking for notification actions
- ✅ Test notification feature

**What Users See:**
1. Navigate to More → Settings & backup → Reminders
2. Click "Enable Notifications" (triggers permission request)
3. Configure daily check-in time and frequency
4. Configure post-attack follow-up delay
5. Configure active attack check-in interval
6. Test with "Send Test Notification" button

### 2. Server-Side Setup

See [`notification-server/README.md`](notification-server/README.md) for detailed instructions.

**Quick Steps:**
1. Install dependencies: `cd notification-server && npm install`
2. Generate VAPID keys: `npx web-push generate-vapid-keys`
3. Configure `.env` file with credentials
4. Start server: `npm start`

## No Firebase Required

The shipped server uses Web Push with VAPID only - there is no Firebase project, service account, or FCM configuration to set up. (Push *transport* to Chrome/Android devices passes through Google's push service, but that requires no project or credentials.)

## VAPID Keys Setup

VAPID (Voluntary Application Server Identification) authenticates your server to push services.

### Generate Keys

```bash
npx web-push generate-vapid-keys
```

Output:
```
=======================================
Public Key:
BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U

Private Key:
<redacted — rotated out; set in Render only>
=======================================
```

### Add to Configuration

**Server (.env):**
```env
VAPID_PUBLIC_KEY=BEl62iUYgUivxIkv69yViEuiBIa...
VAPID_PRIVATE_KEY=UUxI4O8DildjgE6hHXAovpkQQP...
VAPID_SUBJECT=mailto:your-email@example.com
```

**PWA (assets/app.js):** Already implemented - the Reminders panel's Enable Notifications flow requests permission, subscribes with the VAPID public key defined in `assets/app.js`, and posts the subscription and preferences to the production notification server. Nothing to paste. If you rotate VAPID keys, update the `VAPID_PUBLIC_KEY` constant in `assets/app.js` to match the server's public key.

## iOS Considerations

### Critical Requirements for iOS

**Notifications ONLY work on iOS when:**
1. ✅ PWA is installed to home screen
2. ✅ Permission requested from installed PWA (not Safari browser)
3. ✅ User grants notification permission

**The PWA automatically handles this:**
- Detects if running on iOS
- Checks if installed (`display-mode: standalone`)
- Shows installation instructions if needed
- Only requests permission after installation

### Installation Instructions for iOS Users

1. Open Safari and navigate to the PWA
2. Tap the **Share** button (square with arrow)
3. Scroll down and tap **"Add to Home Screen"**
4. Tap **"Add"** in the top right
5. Open the app from your home screen (NOT Safari)
6. Go to Settings → Notifications
7. Tap "Enable Notifications"

## Testing the Notification System

### 1. Test Local Notifications (No Server Required)

The PWA includes a test button that sends a local notification:

1. Navigate to More → Settings & backup → Reminders
2. Click "Enable Notifications" and grant permission
3. Click "Send Test Notification"
4. You should receive a notification immediately

This tests:
- ✅ Browser notification permission
- ✅ Service worker notification display
- ✅ Notification click handling

### 2. Test Server Push (Requires Server Running)

**Terminal 1: Start the server**
```bash
cd notification-server
npm start
```

**Terminal 2: Test API**
```bash
# Test health endpoint
curl http://localhost:3000/health

# Send a test push notification
curl -X POST http://localhost:3000/api/notifications/send-test \
  -H "Content-Type: application/json" \
  -d '{
    "subscription": {
      "endpoint": "YOUR_SUBSCRIPTION_ENDPOINT",
      "keys": {
        "p256dh": "YOUR_P256DH_KEY",
        "auth": "YOUR_AUTH_KEY"
      }
    }
  }'
```

Get the subscription details from your browser console:
```javascript
navigator.serviceWorker.ready.then(reg => {
    reg.pushManager.getSubscription().then(sub => {
        console.log(JSON.stringify(sub));
    });
});
```

### 3. Test Scheduled Notifications

**Daily Check-in:**
1. In PWA, set daily check-in time to 1 minute from now
2. Wait for the server's hourly job to run
3. Or manually trigger in scheduler.js

**Post-Attack Follow-up:**
1. Log a migraine attack in the PWA
2. Server receives the schedule request
3. After configured delay (2 hours default), notification sends

**Active Attack Check-in:**
1. Log a migraine attack in the PWA (attack becomes "active")
2. Server receives the schedule request
3. Notification sends at configured interval (e.g., every 4 hours)
4. Check-in automatically cancels when attack is marked as ended

## Deployment Checklist

### Development
- [x] PWA notification UI implemented
- [x] Service worker push handlers added
- [x] Server structure created
- [x] Web Push (VAPID) integration complete
- [x] Scheduler implemented
- [x] API endpoints created
- [x] Documentation complete

### Production Ready
- [ ] Update server URL in PWA (from localhost to production)
- [ ] Generate production VAPID keys
- [ ] Deploy notification server to hosting platform
- [ ] Set up proper database (PostgreSQL/MongoDB)
- [ ] Add authentication to API endpoints
- [ ] Configure HTTPS
- [ ] Set up monitoring and logging
- [ ] Test on iOS devices
- [ ] Test on Android devices
- [ ] Test on desktop browsers

## Troubleshooting

### "Notifications not supported on this browser"
- Use Chrome, Firefox, Safari, or Edge
- iOS: Must use Safari (installed PWA)

### "Please install app to home screen" (iOS)
- Follow installation instructions above
- Verify running in standalone mode, not Safari browser

### "Notifications blocked - Check browser settings"
- User previously denied permission
- Go to browser settings → Site settings → Notifications
- Unblock the site and try again

### Notifications enabled but not receiving them
1. Check server is running: `curl http://localhost:3000/health`
2. Verify subscription exists in server database
3. Check server logs for errors
4. Verify VAPID keys match between server and PWA
5. Test with "Send Test Notification" first

### "Subscription expired" errors
- Normal when user uninstalls PWA or clears browser data
- Server should automatically remove invalid subscriptions

## Privacy & Data

**What data is stored:**
- Push subscription endpoint (URL to push service)
- Notification preferences (time, frequency, enabled status)
- Scheduled notification metadata (attack ID, scheduled time)
- Pressure-alert data (only for users with weather tracking + notifications on): location coordinates and pressure-alert threshold, plus the last pressure alert sent (to enforce at most one per day)

**What data is NOT stored:**
- Migraine attack details (stays on device only)
- Personal health information
- User identity (subscriptions are anonymous)

**User control:**
- Users can disable notifications anytime
- Users can unsubscribe (removes all server data)
- Users can adjust notification preferences

## Support

For issues or questions:
1. Check this documentation
2. Review server logs
3. Test with local notifications first
4. Verify VAPID configuration (public key in the app must match the server's key pair)
5. Check browser console for errors

## Next Steps

**Implemented Features:**
- ✅ Daily check-in reminders
- ✅ Post-attack follow-ups
- ✅ Active attack check-ins
- ✅ Timezone-aware scheduling
- ✅ iOS and Android support

**Phase 2 Features (Future):**
- Medication reminders (daily preventive meds)
- Pattern recognition alerts (e.g., "You've had 3 attacks this week")
- Weekly/monthly summary notifications
- Customizable notification messages
- Multiple notification schedules
- Integration with calendar events

## Resources

- [Web Push Protocol](https://developers.google.com/web/fundamentals/push-notifications)
- [VAPID Specification](https://datatracker.ietf.org/doc/html/rfc8292)
- [MDN: Notifications API](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API)
- [iOS PWA Guide](https://developer.apple.com/documentation/webkit/safari_web_extensions)
