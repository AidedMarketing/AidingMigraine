# Aiding Migraine - Notification Server

Push notification server for the Aiding Migraine PWA. Handles scheduled daily check-ins, post-attack follow-ups, and active attack check-ins.

## Features

- ✅ Daily check-in notifications (user-configurable time)
- ✅ Post-attack follow-up notifications (2-4 hours after attack logged)
- ✅ Active attack check-in notifications (regular check-ins during ongoing migraines)
- ✅ Web Push Protocol with VAPID authentication
- ✅ Firebase Cloud Messaging (FCM) integration
- ✅ Timezone-aware scheduling
- ✅ Persistent storage (JSON file for development, easily extendable to databases)

## Prerequisites

1. **Node.js** (v14 or higher)
2. **Firebase Project** with Cloud Messaging enabled
3. **VAPID Keys** for Web Push

## Setup Instructions

### 1. Install Dependencies

```bash
cd notification-server
npm install
```

### 2. Configure Firebase Cloud Messaging

#### Step 2.1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or select an existing project
3. Follow the setup wizard

#### Step 2.2: Enable Cloud Messaging

1. In Firebase Console, go to **Project Settings** (gear icon)
2. Navigate to **Cloud Messaging** tab
3. Note your **Server Key** (you won't need this for Web Push, but good to have)

#### Step 2.3: Generate Service Account Key

1. In Firebase Console, go to **Project Settings** > **Service Accounts**
2. Click **Generate New Private Key**
3. Save the JSON file as `firebase-service-account.json` (DO NOT commit this!)
4. Extract the following values for your `.env`:
   - `project_id`
   - `private_key`
   - `client_email`

### 3. Generate VAPID Keys

VAPID (Voluntary Application Server Identification) keys are required for Web Push.

```bash
npx web-push generate-vapid-keys
```

This will output:
```
=======================================
Public Key:
BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U
Private Key:
UUxI4O8DildjgE6hHXAovpkQQPdKfPrNccGwdJO7dUU
=======================================
```

Copy these keys to your `.env` file.

### 4. Configure Environment Variables

Create a `.env` file in the `notification-server` directory:

```bash
cp .env.example .env
```

Edit `.env` with your actual values:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Firebase Cloud Messaging
FIREBASE_PROJECT_ID=your-project-id-here
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key from firebase-service-account.json\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com

# VAPID Keys (from npx web-push generate-vapid-keys)
VAPID_PUBLIC_KEY=BEl62iUYgUivxIkv69yViEuiBIa...
VAPID_PRIVATE_KEY=UUxI4O8DildjgE6hHXAovpkQQP...
VAPID_SUBJECT=mailto:your-email@example.com

# Database
DB_TYPE=json
DB_PATH=./data/subscriptions.json
```

**Important Notes:**
- Replace all placeholder values with your actual credentials
- The `FIREBASE_PRIVATE_KEY` should include the full key with `\n` for line breaks
- Keep your `.env` file secure and never commit it to version control

### 5. Update PWA with VAPID Public Key

You need to add the VAPID public key to your PWA so it can subscribe to push notifications.

In `index.html`, update the `enableNotifications` function:

```javascript
async function enableNotifications() {
    try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            alert('Notification permission denied.');
            return;
        }

        const registration = await navigator.serviceWorker.ready;

        // Subscribe to push notifications with VAPID public key
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array('YOUR_VAPID_PUBLIC_KEY_HERE')
        });

        // Send subscription to server
        await fetch('http://localhost:3000/api/subscriptions/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                subscription: subscription,
                preferences: {
                    dailyCheckIn: {
                        enabled: notificationPreferences.dailyCheckIn.enabled,
                        time: notificationPreferences.dailyCheckIn.time,
                        frequency: notificationPreferences.dailyCheckIn.frequency
                    },
                    postAttackFollowUp: {
                        enabled: notificationPreferences.postAttackFollowUp.enabled,
                        delayHours: notificationPreferences.postAttackFollowUp.delayHours
                    }
                }
            })
        });

        notificationPreferences.enabled = true;
        notificationPreferences.pushSubscription = subscription;
        localStorage.setItem('notificationPreferences', JSON.stringify(notificationPreferences));

        alert('✅ Notifications enabled successfully!');
        updateNotificationUI();

    } catch (error) {
        console.error('Error enabling notifications:', error);
        alert('Failed to enable notifications.');
    }
}

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\\-/g, '+')
        .replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}
```

## Running the Server

### Development Mode (with auto-restart)

```bash
npm run dev
```

### Production Mode

```bash
npm start
```

The server will start on port 3000 (or the port specified in `.env`).

## API Endpoints

### Health Check

```
GET /health
```

Returns server status.

### Subscribe to Notifications

```
POST /api/subscriptions/subscribe
Content-Type: application/json

{
  "subscription": {
    "endpoint": "https://fcm.googleapis.com/fcm/send/...",
    "keys": {
      "p256dh": "...",
      "auth": "..."
    }
  },
  "preferences": {
    "dailyCheckIn": {
      "enabled": true,
      "time": "19:00",
      "frequency": "daily"
    },
    "postAttackFollowUp": {
      "enabled": true,
      "delayHours": 2
    }
  }
}
```

### Unsubscribe

```
POST /api/subscriptions/unsubscribe
Content-Type: application/json

{
  "endpoint": "https://fcm.googleapis.com/fcm/send/..."
}
```

### Update Preferences

```
POST /api/subscriptions/update-preferences
Content-Type: application/json

{
  "endpoint": "https://fcm.googleapis.com/fcm/send/...",
  "preferences": {
    "dailyCheckIn": {
      "enabled": true,
      "time": "20:00",
      "frequency": "daily"
    }
  }
}
```

### Schedule Follow-up

```
POST /api/notifications/schedule-followup
Content-Type: application/json

{
  "attackId": "1234567890",
  "followUpTime": "2024-12-01T20:30:00Z",
  "subscriptionEndpoint": "https://fcm.googleapis.com/fcm/send/..."
}
```

### Send Test Notification

```
POST /api/notifications/send-test
Content-Type: application/json

{
  "subscription": {
    "endpoint": "https://fcm.googleapis.com/fcm/send/...",
    "keys": {
      "p256dh": "...",
      "auth": "..."
    }
  }
}
```

## Scheduler

The notification scheduler runs automatically when the server starts:

- **Hourly Job**: Checks for daily check-in notifications (runs at :00 of each hour)
- **15-Minute Job**: Checks for scheduled follow-up notifications (runs every 15 minutes)

## Data Storage

In development mode, data is stored in JSON files:
- `./data/subscriptions.json` - User subscriptions and preferences
- `./data/scheduled-followups.json` - Scheduled follow-up notifications

For production, extend `database.js` to use PostgreSQL, MongoDB, or your preferred database.

## iOS Considerations

**Critical:** On iOS, PWA notifications ONLY work when:
1. The app is installed to the home screen (not in Safari browser)
2. The user grants notification permission from within the installed PWA

The PWA automatically detects iOS and shows installation instructions if needed.

## Troubleshooting

### Notifications not being received

1. **Check server logs**: Ensure scheduler is running and notifications are being sent
2. **Verify VAPID keys**: Make sure they match between server and PWA
3. **Check subscription**: Verify the subscription exists in `data/subscriptions.json`
4. **iOS**: Ensure PWA is installed to home screen
5. **Browser**: Check notification permission in browser settings

### FCM initialization fails

- Verify Firebase credentials in `.env`
- Ensure private key has proper `\n` line breaks
- Check Firebase project has Cloud Messaging enabled

### Subscription expired errors

- These are normal when users uninstall the PWA or clear browser data
- The server automatically handles these and should remove invalid subscriptions

## Security Considerations

**For Production:**
1. Add authentication to API endpoints
2. Use HTTPS for all communication
3. Store credentials in secure environment variables or secrets manager
4. Implement rate limiting
5. Add input validation and sanitization
6. Use a proper database with backups
7. Monitor for suspicious activity

## Deployment

For production deployment, consider:
- **Hosting**: Deploy to Heroku, AWS, Google Cloud, or similar
- **Database**: Migrate from JSON to PostgreSQL/MongoDB
- **Process Manager**: Use PM2 or similar to keep server running
- **Logging**: Implement proper logging (Winston, Bunyan)
- **Monitoring**: Set up alerts for errors and downtime

Example deployment to Heroku:
```bash
heroku create aiding-migraine-notifications
heroku config:set FIREBASE_PROJECT_ID=...
heroku config:set VAPID_PUBLIC_KEY=...
# ... set all environment variables
git push heroku main
```

## License

MIT
