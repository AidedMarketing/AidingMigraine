# Aiding Migraine - Notification Server

**Version:** 2.0.0
**Status:** Production Ready with Enterprise-Grade Security

Push notification server for the Aiding Migraine PWA. Handles scheduled daily check-ins, post-attack follow-ups, and active attack check-ins.

## Features

### Core Notifications
- ✅ Daily check-in notifications (user-configurable time)
- ✅ Post-attack follow-up notifications (2-4 hours after attack logged)
- ✅ Active attack check-in notifications (regular check-ins during ongoing migraines)
- ✅ Web Push Protocol with VAPID authentication (no Firebase dependency!)
- ✅ Timezone-aware scheduling (accurate delivery worldwide)
- ✅ Persistent storage (JSON file for development, easily extendable to databases)

### Security Features (NEW in v2.0)
- 🔐 **API Key Authentication** - Admin endpoints protected
- 🛡️ **Security Headers** - Helmet.js with CSP, HSTS, X-Frame-Options
- ⚡ **Rate Limiting** - Multi-tier protection (100 req/15min, 10 req/min strict)
- 🚫 **CORS Whitelist** - Configurable allowed origins only
- ✅ **Input Validation** - Comprehensive endpoint validation
- 🔒 **Path Traversal Protection** - Sandboxed file system access
- 🔑 **Automated Credential Rotation** - Built-in rotation script
- 📊 **Production-Ready Logging** - Environment-based error handling

## Prerequisites

1. **Node.js** (v18 or higher recommended)
2. **VAPID Keys** for Web Push (no Firebase required!)
3. **Admin API Key** (auto-generated during setup)

## Setup Instructions

### 1. Install Dependencies

```bash
cd notification-server
npm install
```

### 2. Generate VAPID Keys & Admin API Key

**Option A: Automated (Recommended)**

Use the built-in credential rotation script:
```bash
cd notification-server
./rotate-credentials.sh
```

This will:
- Generate new VAPID keys automatically
- Generate a secure Admin API key
- Create a `.env` file template
- Provide step-by-step instructions

**Option B: Manual**

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

### 3. Configure Environment Variables

Create a `.env` file in the `notification-server` directory:

```bash
cp .env.example .env
```

Or create manually with these values:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# VAPID Keys for Web Push (from npx web-push generate-vapid-keys)
VAPID_SUBJECT=mailto:your-email@example.com
VAPID_PUBLIC_KEY=BHVugOyMNYtN5lftKJrKO10dSl7XPSGB1fWJ2eRrfAhnx-dtqY44AllB0tiTUnZaouhvzZdRADqf4C6MVW4oKdM
VAPID_PRIVATE_KEY=6F-ixbgK_2sEpZ-HsxXvgebLoOe2Fk03tWOvZfiDUe0

# Admin API Key (from node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
ADMIN_API_KEY=a5b2c4013eea5f05c33e706360fc97872ede64a07cc0c005142fdd240c4ed8c3

# CORS Allowed Origins (comma-separated)
ALLOWED_ORIGINS=http://localhost:8080,http://127.0.0.1:8080

# Database Configuration
DB_TYPE=json
DB_PATH=./data/subscriptions.json
```

**Important Security Notes:**
- ⚠️ **NEVER commit your `.env` file to git** (already in `.gitignore`)
- 🔑 Replace all placeholder values with actual credentials from step 2
- 🔒 Keep your Admin API key secret (required for admin endpoints)
- 🌍 Update `ALLOWED_ORIGINS` for production deployment
- 🔐 Set `NODE_ENV=production` when deploying to production

### 4. Update PWA with VAPID Public Key

You need to add the VAPID public key to your PWA so it can subscribe to push notifications.

In `index.html`, find the line with `VAPID_PUBLIC_KEY` (around line 5929):

```javascript
const VAPID_PUBLIC_KEY = 'YOUR_VAPID_PUBLIC_KEY_HERE';
```

Replace with your VAPID public key from step 2.

**That's it!** The PWA already has all the necessary subscription code built-in.

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

## Security Features

### Authentication
- **Admin Endpoints:** Protected with API key authentication (`x-api-key` header)
- **Public Endpoints:** Rate limited but no authentication required

### Rate Limiting
- **General:** 100 requests per 15 minutes per IP
- **Strict (sensitive endpoints):** 10 requests per minute per IP
- Automatically blocks excessive requests with 429 status

### Security Headers (Helmet.js)
- **Content-Security-Policy (CSP):** Prevents XSS attacks
- **HTTP Strict Transport Security (HSTS):** Forces HTTPS
- **X-Frame-Options:** Prevents clickjacking
- **X-Content-Type-Options:** Prevents MIME sniffing

### Input Validation
- **Endpoint URLs:** HTTPS required in production, domain whitelist
- **Time Format:** Validated with regex (HH:MM)
- **Preferences:** Type and range validation
- **Request Size:** Limited to 10KB

### CORS Protection
- Whitelist-based origin validation
- Configurable via `ALLOWED_ORIGINS` environment variable
- Blocks requests from unauthorized domains

## API Endpoints

### Health Check

```
GET /health
```

Returns server status and version.

**Authentication:** None required
**Rate Limit:** General (100/15min)

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

## Production Deployment

### Pre-Deployment Checklist

#### 1. Security (CRITICAL)
- [ ] **Run credential rotation** - `./rotate-credentials.sh`
- [ ] **Update .env with production values**
  - Set `NODE_ENV=production`
  - Update `ALLOWED_ORIGINS` to production domains (e.g., `https://yourdomain.com`)
  - Use new VAPID keys (never reuse development keys!)
  - Use new Admin API key
- [ ] **Update PWA with new VAPID public key** (in `index.html`)
- [ ] **Verify .env is in .gitignore** (never commit secrets!)

#### 2. Infrastructure
- [ ] **Enable HTTPS** (required for Web Push)
- [ ] **Configure reverse proxy** (nginx/Apache)
- [ ] **Set up SSL/TLS certificates** (Let's Encrypt recommended)
- [ ] **Configure firewall** (only allow ports 80, 443)

#### 3. Monitoring & Logging
- [ ] **Set up error logging** (consider Sentry, LogRocket)
- [ ] **Configure uptime monitoring** (UptimeRobot, Pingdom)
- [ ] **Enable rate limit alerts**
- [ ] **Monitor failed authentication attempts**

### Deployment Options

#### Option 1: Render.com (Recommended - Free Tier Available)
```bash
# 1. Create account at render.com
# 2. Connect your GitHub repository
# 3. Create a new Web Service
# 4. Configure:
#    - Build Command: cd notification-server && npm install
#    - Start Command: cd notification-server && npm start
#    - Environment: Node
# 5. Add environment variables from .env (via Render dashboard)
# 6. Deploy!
```

**Advantages:**
- Free tier available
- Automatic HTTPS
- Git-based deployment
- Built-in monitoring

#### Option 2: Railway.app
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project
cd notification-server
railway init

# Add environment variables
railway variables set VAPID_PUBLIC_KEY=...
railway variables set VAPID_PRIVATE_KEY=...
railway variables set ADMIN_API_KEY=...
railway variables set ALLOWED_ORIGINS=...
railway variables set NODE_ENV=production

# Deploy
railway up
```

#### Option 3: Heroku
```bash
# Create Heroku app
heroku create aiding-migraine-notifications

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set VAPID_PUBLIC_KEY=...
heroku config:set VAPID_PRIVATE_KEY=...
heroku config:set VAPID_SUBJECT=mailto:your-email@example.com
heroku config:set ADMIN_API_KEY=...
heroku config:set ALLOWED_ORIGINS=https://yourdomain.com

# Deploy
git push heroku main

# Check logs
heroku logs --tail
```

#### Option 4: Self-Hosted (VPS/Dedicated Server)
```bash
# On your server (Ubuntu/Debian example):

# 1. Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. Clone repository
git clone https://github.com/yourusername/AidingMigraine.git
cd AidingMigraine/notification-server

# 3. Install dependencies
npm install --production

# 4. Set up environment variables
nano .env
# (paste your production .env values)

# 5. Install PM2 (process manager)
sudo npm install -g pm2

# 6. Start server with PM2
pm2 start index.js --name aiding-migraine-notifications

# 7. Configure PM2 to start on boot
pm2 startup
pm2 save

# 8. Set up nginx reverse proxy (see nginx config below)
sudo apt-get install nginx
sudo nano /etc/nginx/sites-available/aiding-migraine
```

**Nginx Configuration Example:**
```nginx
server {
    listen 80;
    server_name notifications.yourdomain.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name notifications.yourdomain.com;

    # SSL Configuration (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/notifications.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/notifications.yourdomain.com/privkey.pem;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Post-Deployment Verification

1. **Test Health Endpoint**
   ```bash
   curl https://your-notification-server.com/health
   # Should return: {"status":"ok","uptime":...}
   ```

2. **Test CORS Protection**
   ```bash
   curl -H "Origin: https://malicious-site.com" https://your-notification-server.com/health
   # Should be blocked or return CORS error
   ```

3. **Test Rate Limiting**
   ```bash
   # Send 101 requests rapidly
   for i in {1..101}; do curl https://your-notification-server.com/health; done
   # Request 101 should return 429 (Too Many Requests)
   ```

4. **Test Admin Authentication**
   ```bash
   # Without API key (should fail)
   curl https://your-notification-server.com/api/subscriptions
   # Should return 401 Unauthorized

   # With API key (should succeed)
   curl -H "x-api-key: your-admin-api-key" https://your-notification-server.com/api/subscriptions
   # Should return subscription list
   ```

5. **Test Push Notifications**
   - Install PWA on test device
   - Enable notifications
   - Wait for scheduled notification or send test notification
   - Verify notification arrives

### Database Migration (Production)

For production, consider migrating from JSON to a proper database:

**PostgreSQL Example:**
```bash
# Install PostgreSQL client
npm install pg

# Update database.js to use PostgreSQL
# Create subscriptions table:
CREATE TABLE subscriptions (
    endpoint VARCHAR(512) PRIMARY KEY,
    keys JSONB NOT NULL,
    preferences JSONB NOT NULL,
    timezone VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**MongoDB Example:**
```bash
# Install MongoDB client
npm install mongodb

# Update database.js to use MongoDB
# No schema required - uses same JSON structure
```

### Monitoring & Maintenance

**Set up monitoring for:**
- Server uptime
- API response times
- Error rates
- Rate limit violations
- Failed authentication attempts
- Notification delivery success rate

**Regular maintenance:**
- Review logs weekly
- Rotate credentials every 90 days
- Update dependencies monthly (`npm audit`)
- Back up subscription database daily
- Monitor server resources (CPU, RAM, disk)

## License

MIT
