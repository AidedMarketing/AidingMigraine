# Render Notification Server Setup Guide

## 🎯 Your Render Server Details

**Service URL:** `https://aiding-migraine-notifications.onrender.com`
**Server ID:** `srv-d4n4oca4d50c73f64s00`
**Outbound IPs:** 74.220.50.0/24, 74.220.58.0/24
**App Domain:** `https://aidedmarketing.github.io/AidingMigraine/`

---

## ⚙️ Environment Variables Configuration

Add these environment variables to your Render service dashboard:

### 1. Go to Render Dashboard
- Navigate to: https://dashboard.render.com
- Select your service: `srv-d4n4oca4d50c73f64s00`
- Click on "Environment" in the left sidebar

### 2. Add These Environment Variables

```env
PORT=3000
NODE_ENV=production
VAPID_SUBJECT=mailto:your-email@example.com
VAPID_PUBLIC_KEY=BKGl5RP_08pVrtXyh08ot_AdICyshiLpiOBLYr1eLRXQFP_pcqGqZOxoMMfPm_09ecr_EKgwqmE5Hac0Lb0G1WU
VAPID_PRIVATE_KEY=5jqvwodA2zyK3z819NNc40wxDmmUQL-q5RQJ8EPvQvY
ADMIN_API_KEY=178815e58e1adf23a73954672a8409cc1f31db0d56d18d1e65a9f3096fd195a1
ALLOWED_ORIGINS=https://aidedmarketing.github.io,https://aidedmarketing.github.io/AidingMigraine
```

### 3. Important Notes

- **VAPID_SUBJECT**: Replace `your-email@example.com` with your actual email address
- **VAPID_PUBLIC_KEY**: Already updated in your app (index.html:5930)
- **VAPID_PRIVATE_KEY**: Keep this secret! Never commit to git
- **ADMIN_API_KEY**: Secure random key for admin endpoints
- **ALLOWED_ORIGINS**: Your GitHub Pages domains for CORS

---

## 🚀 Deployment Steps

1. **Add environment variables** in Render dashboard (see above)
2. **Deploy/Restart** your Render service
3. **Verify** the server is running at: `https://aiding-migraine-notifications.onrender.com/health`
4. **Test notifications** in your app

---

## 🧪 Testing Your Setup

### 1. Check Server Health
Visit: `https://aiding-migraine-notifications.onrender.com/health`

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-23T..."
}
```

### 2. Test Notifications in App
1. Open: `https://aidedmarketing.github.io/AidingMigraine/`
2. Go to Settings
3. Enable "Daily Check-In Notifications"
4. Grant browser permission when prompted
5. Check browser console for any errors

### 3. Send Test Notification
You can send a test notification using the API:

```bash
curl -X POST https://aiding-migraine-notifications.onrender.com/api/notifications/send-test \
  -H "Content-Type: application/json" \
  -d '{
    "subscription": {YOUR_SUBSCRIPTION_OBJECT}
  }'
```

---

## 🔐 Security Checklist

- ✅ VAPID keys generated securely
- ✅ Admin API key is random and secure (32 bytes)
- ✅ CORS restricted to your domain only
- ✅ Environment variables stored in Render (not in code)
- ✅ NODE_ENV set to production
- ⚠️ Update VAPID_SUBJECT with your real email

---

## 📊 What Each Variable Does

| Variable | Purpose |
|----------|---------|
| `PORT` | Server port (Render uses 3000 by default) |
| `NODE_ENV` | Environment mode (production for live server) |
| `VAPID_SUBJECT` | Contact email for push service providers |
| `VAPID_PUBLIC_KEY` | Public key for browser push subscriptions |
| `VAPID_PRIVATE_KEY` | Private key for signing push messages |
| `ADMIN_API_KEY` | Authentication for admin endpoints |
| `ALLOWED_ORIGINS` | Domains allowed to make API requests |

---

## 🛠️ Troubleshooting

### Notifications not working?

1. **Check browser console** for errors
2. **Verify CORS**: Ensure `ALLOWED_ORIGINS` includes your domain
3. **Check server logs** in Render dashboard
4. **Test server health** endpoint
5. **Verify permissions**: Browser must allow notifications

### Common Issues

**"Failed to subscribe"**
- Check VAPID keys match (public in app, private on server)
- Verify ALLOWED_ORIGINS includes your domain

**"Network error"**
- Server may not be running - check Render dashboard
- Check server URL is correct in app

**"Permission denied"**
- User must grant browser notification permission
- HTTPS required for push notifications

---

## 📝 Next Steps

1. ✅ Update `VAPID_SUBJECT` with your actual email
2. ✅ Deploy to Render with environment variables
3. ✅ Test notifications from your app
4. ✅ Monitor Render logs for any issues

---

## 🔄 Generated Keys Info

**Keys Generated:** 2026-01-23
**App Updated:** Yes (index.html:5930)
**Status:** Ready for deployment

**Security Note:** Store these credentials securely! Never commit `.env` files or share private keys publicly.
