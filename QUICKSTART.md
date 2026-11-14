# Quick Start Guide: VAPID Setup

This guide walks you through setting up VAPID keys for the Aiding Migraine notification system. (No Firebase: the server uses Web Push with VAPID only.)

## What You'll Need

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
<redacted — rotated out; set in Render only>

=======================================
```

#### 1.3 Save These Keys

**COPY BOTH KEYS** to a temporary text file. You'll need them shortly.

---

### Part 2: Configure Server (5 minutes)### Part 3: Configure Server (5 minutes)

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

# VAPID Keys for Web Push (Generate with: npx web-push generate-vapid-keys)
VAPID_SUBJECT=mailto:your-email@example.com
VAPID_PUBLIC_KEY=your_vapid_public_key_here
VAPID_PRIVATE_KEY=your_vapid_private_key_here

# Admin API Key (Generate a secure random key)
# Used to protect admin endpoints like GET /api/subscriptions
ADMIN_API_KEY=<redacted>

# CORS Allowed Origins (comma-separated)
ALLOWED_ORIGINS=http://localhost:8080,http://127.0.0.1:8080,https://your-domain.com

# Database Path (optional - defaults to subscriptions.json within data directory)
# DB_PATH=subscriptions.json
```

**Replace:**
- `VAPID_PUBLIC_KEY` → Public key from Part 1
- `VAPID_PRIVATE_KEY` → Private key from Part 1
- `VAPID_SUBJECT` → Your email (e.g., `mailto:you@gmail.com`)
- `ADMIN_API_KEY` → A secure random key you generate

**⚠️ Important Notes:**
- Keep `VAPID_PRIVATE_KEY` secret - never commit it to git.
- The server's VAPID public key must match the public key in the app (see Part 3).

#### 3.3 Save the File

Save `.env` - Your server is now configured!

---

### Part 3: Configure PWA (2 minutes)

The PWA already carries the matching VAPID public key in `assets/app.js` - there is nothing to configure for a normal setup. Only change it if you rotate keys: search `assets/app.js` for `VAPID_PUBLIC_KEY` and replace the value with your new public key.

### Part 4: Test Everything! (5 minutes)

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

### "Error: Push sends fail / server fails to start"

- Verify `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` in `.env` form a matching pair, and that the public key matches the one in `assets/app.js`
- Check `VAPID_SUBJECT` is a valid `mailto:` address

### "Error: Invalid VAPID keys"

- Make sure you copied the keys correctly
- No extra spaces or line breaks
- Public key goes in both `.env` and `assets/app.js`

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
2. The production server URL is already set in `assets/app.js`. To point the app at a different notification server, search `assets/app.js` for `aiding-migraine-notifications.onrender.com` and replace every occurrence
3. Set `NODE_ENV=production` in server
4. Use a real database (PostgreSQL/MongoDB)
5. Set up HTTPS
6. Add authentication to API endpoints

---

## Summary Checklist

- ✅ Generated VAPID keys
- ✅ Configured `.env` file
- ✅ Confirmed `VAPID_PUBLIC_KEY` in `assets/app.js` matches the server
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
- Make sure the server's VAPID key pair matches the public key in `assets/app.js`

## Files You Modified

- `notification-server/.env` (created from .env.example)
- `assets/app.js` (VAPID_PUBLIC_KEY - only if you rotated keys)

**Never commit `.env` to git!** It's already in `.gitignore`.
