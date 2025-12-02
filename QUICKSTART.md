# Quick Start Guide: Firebase & VAPID Setup

This guide walks you through setting up Firebase and VAPID keys for the Aiding Migraine notification system.

## What You'll Need

- ☐ A Google account
- ☐ Terminal/Command Prompt access
- ☐ Text editor
- ☐ 15-20 minutes

## Step-by-Step Setup

### Part 1: Generate VAPID Keys (5 minutes)

VAPID keys authenticate your server when sending push notifications.

#### 1.1 Open Terminal

Navigate to your project's notification-server directory:

```bash
cd notification-server
```

#### 1.2 Generate Keys

Run this command:

```bash
npx web-push generate-vapid-keys
```

You'll see output like:

```
=======================================

Public Key:
BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U

Private Key:
UUxI4O8DildjgE6hHXAovpkQQPdKfPrNccGwdJO7dUU

=======================================
```

#### 1.3 Save These Keys

**COPY BOTH KEYS** to a temporary text file. You'll need them shortly.

---

### Part 2: Set Up Firebase (10 minutes)

#### 2.1 Go to Firebase Console

1. Open: **https://console.firebase.google.com/**
2. Sign in with your Google account
3. You'll see the Firebase homepage

#### 2.2 Create Project

1. Click **"Add project"** (or "Create a project")
2. **Project name:** Enter `aiding-migraine` (or any name you prefer)
3. Click **"Continue"**

#### 2.3 Disable Analytics (Optional)

1. Toggle OFF "Enable Google Analytics"
   - We don't need it for notifications
2. Click **"Create project"**
3. Wait 30-60 seconds
4. Click **"Continue"**

You're now in your Firebase project! 🎉

#### 2.4 Get Project ID

1. Click the **⚙️ gear icon** (top-left, next to "Project Overview")
2. Click **"Project settings"**
3. You'll see **"Project ID"** - it looks like: `aiding-migraine-abc123`
4. **Copy this** - save it to your text file

#### 2.5 Generate Service Account Key

This is the most important step!

1. At the top of Project Settings, click the **"Service accounts"** tab
2. You'll see a section titled **"Firebase Admin SDK"**
3. Make sure **"Node.js"** is selected (should be by default)
4. Click **"Generate new private key"** button
5. A popup appears: **"Generate new private key?"**
6. Click **"Generate key"**
7. A JSON file downloads: `aiding-migraine-abc123-firebase-adminsdk-xxxxx.json`

**⚠️ IMPORTANT:** This file contains secrets! Keep it secure! Never commit to git!

#### 2.6 Extract Credentials from JSON

1. Open the downloaded JSON file in a text editor
2. Find these three values:

```json
{
  "project_id": "aiding-migraine-abc123",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@aiding-migraine-abc123.iam.gserviceaccount.com"
}
```

3. **Copy these three values** to your text file:
   - `project_id`
   - `private_key` (the ENTIRE string, including `-----BEGIN...` and `\n` characters)
   - `client_email`

---

### Part 3: Configure Server (5 minutes)

#### 3.1 Create .env File

In your terminal (still in `notification-server` directory):

```bash
cp .env.example .env
```

#### 3.2 Edit .env File

Open `notification-server/.env` in your text editor and fill in the values:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Firebase Cloud Messaging
FIREBASE_PROJECT_ID=aiding-migraine-abc123
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@aiding-migraine-abc123.iam.gserviceaccount.com

# VAPID Keys (from Part 1)
VAPID_PUBLIC_KEY=BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U
VAPID_PRIVATE_KEY=UUxI4O8DildjgE6hHXAovpkQQPdKfPrNccGwdJO7dUU
VAPID_SUBJECT=mailto:your-email@example.com

# Database
DB_TYPE=json
DB_PATH=./data/subscriptions.json
```

**Replace:**
- `FIREBASE_PROJECT_ID` → Your project_id
- `FIREBASE_PRIVATE_KEY` → Your private_key (keep quotes and `\n` characters!)
- `FIREBASE_CLIENT_EMAIL` → Your client_email
- `VAPID_PUBLIC_KEY` → Public key from Part 1
- `VAPID_PRIVATE_KEY` → Private key from Part 1
- `VAPID_SUBJECT` → Your email (e.g., `mailto:you@gmail.com`)

**⚠️ Important Notes:**
- Keep `FIREBASE_PRIVATE_KEY` in quotes: `"-----BEGIN...-----END-----\n"`
- Don't remove the `\n` characters - they're important!
- The private key should be one long line

#### 3.3 Save the File

Save `.env` - Your server is now configured!

---

### Part 4: Configure PWA (2 minutes)

#### 4.1 Open index.html

Open `index.html` in your text editor.

#### 4.2 Find the VAPID_PUBLIC_KEY Line

Search for: `VAPID_PUBLIC_KEY`

You'll find around line 3530:

```javascript
const VAPID_PUBLIC_KEY = 'YOUR_VAPID_PUBLIC_KEY_HERE';
```

#### 4.3 Replace with Your Public Key

Change it to:

```javascript
const VAPID_PUBLIC_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
```

(Use YOUR public key from Part 1)

#### 4.4 Save the File

Save `index.html` - Your PWA is now configured!

---

### Part 5: Test Everything! (5 minutes)

#### 5.1 Install Dependencies

```bash
cd notification-server
npm install
```

Wait for dependencies to install...

#### 5.2 Start the Server

```bash
npm start
```

You should see:

```
✅ Database initialized
✅ Notification scheduler started
🚀 Notification server running on port 3000
📡 Health check: http://localhost:3000/health
```

If you see errors, double-check your `.env` file!

#### 5.3 Test Health Endpoint

Open a new terminal and run:

```bash
curl http://localhost:3000/health
```

You should see:

```json
{
  "status": "ok",
  "message": "Aiding Migraine Notification Server is running",
  "timestamp": "2024-12-01T..."
}
```

✅ Server is working!

#### 5.4 Test the PWA

1. Open `index.html` in Chrome/Firefox/Safari
2. Go to **Settings** → **Notifications**
3. Click **"Enable Notifications"**
4. Grant permission when prompted
5. You should see: **"✅ Notifications enabled!"**

#### 5.5 Test Notification

1. In Settings → Notifications
2. Click **"Send Test Notification"**
3. You should receive a notification immediately!

#### 5.6 Test Server Push

1. In your PWA, go to browser console (F12)
2. Run this command to get your subscription:

```javascript
navigator.serviceWorker.ready.then(reg => {
    reg.pushManager.getSubscription().then(sub => {
        console.log(JSON.stringify(sub, null, 2));
    });
});
```

3. Copy the output
4. In a new terminal, send a test push:

```bash
curl -X POST http://localhost:3000/api/notifications/send-test \
  -H "Content-Type: application/json" \
  -d '{
    "subscription": PASTE_YOUR_SUBSCRIPTION_HERE
  }'
```

You should receive a notification from the server! 🎉

---

## Troubleshooting

### "Error: Invalid Firebase credentials"

- Check your `.env` file
- Make sure `FIREBASE_PRIVATE_KEY` has quotes and `\n` characters
- Verify you copied the entire private key

### "Error: Invalid VAPID keys"

- Make sure you copied the keys correctly
- No extra spaces or line breaks
- Public key goes in both `.env` and `index.html`

### "Notifications enabled (local only)"

- You forgot to update `VAPID_PUBLIC_KEY` in `index.html`
- Change line 3530 from `'YOUR_VAPID_PUBLIC_KEY_HERE'` to your actual key

### Server won't start

- Run `npm install` first
- Check for typos in `.env`
- Make sure port 3000 isn't already in use

### No notifications received

- Check server is running: `curl http://localhost:3000/health`
- Check browser console for errors
- Try "Send Test Notification" first (local test)
- Verify notification permission is granted in browser settings

---

## What's Next?

### Schedule Your First Daily Check-in

1. In PWA Settings → Notifications
2. Set "Daily Check-in" time to 1 minute from now
3. Wait for the notification! (Server checks every hour at :00)

### Test Post-Attack Follow-up

1. Log a migraine attack in the PWA
2. Set "Follow-up delay" to 2 hours
3. Wait 2 hours
4. You'll receive a follow-up notification!

### Production Deployment

When you're ready to deploy:

1. Deploy the server to Heroku/AWS/Google Cloud
2. Update `SERVER_URL` in `index.html` (line 3549 and 3678, 3725)
3. Set `NODE_ENV=production` in server
4. Use a real database (PostgreSQL/MongoDB)
5. Set up HTTPS
6. Add authentication to API endpoints

---

## Summary Checklist

- ✅ Generated VAPID keys
- ✅ Created Firebase project
- ✅ Downloaded service account JSON
- ✅ Configured `.env` file
- ✅ Updated `VAPID_PUBLIC_KEY` in `index.html`
- ✅ Installed dependencies
- ✅ Started server successfully
- ✅ Tested health endpoint
- ✅ Enabled notifications in PWA
- ✅ Received test notification

**Congratulations! Your notification system is fully configured! 🎉**

---

## Need Help?

- Check the main [NOTIFICATIONS_SETUP.md](NOTIFICATIONS_SETUP.md) for detailed docs
- Review server logs for errors
- Check browser console (F12) for client-side errors
- Verify all values in `.env` are correct
- Make sure Firebase project has Cloud Messaging enabled

## Files You Modified

- `notification-server/.env` (created from .env.example)
- `index.html` (line 3530: VAPID_PUBLIC_KEY)

**Never commit `.env` to git!** It's already in `.gitignore`.
