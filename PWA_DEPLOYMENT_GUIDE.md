# Progressive Web App (PWA) Deployment Guide
## Aiding Migraine v2.0

**Last Updated:** 2026-01-22
**Status:** Production Ready

---

## Overview

This guide covers deploying the Aiding Migraine PWA frontend application. The PWA is a static web application that runs entirely in the browser with no server-side processing required.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Deployment Options](#deployment-options)
3. [Configuration](#configuration)
4. [Testing](#testing)
5. [App Store Deployment](#app-store-deployment)
6. [Troubleshooting](#troubleshooting)

---

## Quick Start

### Prerequisites
- No build process required - it's vanilla JavaScript!
- Any static web hosting service
- HTTPS required for PWA features (service workers, notifications)
- Notification server deployed separately (see [notification-server/README.md](./notification-server/README.md))

### Minimum Files Required
```
index.html                # Main application (~8,500 lines)
service-worker.js         # Service worker for offline support & notifications
manifest.json             # PWA manifest (app metadata)
icons/                    # All icon files (required for installation)
  ├── favicon-*.png
  ├── icon-*.png
  └── *-maskable.png
help/                     # Optional: Documentation pages
  ├── index.html
  ├── quick-start.html
  ├── notifications-ios.html
  └── ...
```

---

## Deployment Options

### Option 1: GitHub Pages (Recommended - Free)

**Perfect for:** Open source projects, personal use, free hosting

#### Setup Instructions

1. **Prepare Repository**
   ```bash
   # Ensure all required files are in repository root
   git add index.html service-worker.js manifest.json icons/ help/
   git commit -m "Prepare for GitHub Pages deployment"
   git push origin main
   ```

2. **Enable GitHub Pages**
   - Go to repository settings on GitHub
   - Navigate to **Pages** section
   - Under **Source**, select `main` branch
   - Click **Save**

3. **Configure Custom Domain (Optional)**
   - Add `CNAME` file with your domain:
     ```bash
     echo "your-domain.com" > CNAME
     git add CNAME
     git commit -m "Add custom domain"
     git push
     ```
   - Configure DNS:
     ```
     Type: CNAME
     Name: www (or @)
     Value: yourusername.github.io
     ```

4. **Update Notification Server URL**
   In `index.html` (around line 5900), update the notification server URL:
   ```javascript
   const NOTIFICATION_SERVER_URL = 'https://your-notification-server.com';
   ```

5. **Test Deployment**
   - Visit `https://yourusername.github.io/AidingMigraine/`
   - Verify PWA installs correctly
   - Test notifications work

**Advantages:**
- ✅ Free forever
- ✅ Automatic HTTPS
- ✅ Git-based deployment
- ✅ Custom domain support
- ✅ Global CDN (fast worldwide)

**Limitations:**
- Public repositories only (for free tier)
- 100GB/month bandwidth limit
- 1GB storage limit

---

### Option 2: Netlify (Free Tier Available)

**Perfect for:** Advanced features, serverless functions, form handling

#### Setup Instructions

1. **Install Netlify CLI**
   ```bash
   npm install -g netlify-cli
   ```

2. **Login to Netlify**
   ```bash
   netlify login
   ```

3. **Initialize Deployment**
   ```bash
   netlify init
   ```
   - Choose "Create & configure a new site"
   - Select team
   - Enter site name
   - Build command: (leave empty - no build needed)
   - Publish directory: `./` (root)

4. **Configure Environment**
   Create `netlify.toml` in repository root:
   ```toml
   [build]
     publish = "."
     command = ""

   [[headers]]
     for = "/*"
     [headers.values]
       X-Frame-Options = "DENY"
       X-Content-Type-Options = "nosniff"
       Referrer-Policy = "strict-origin-when-cross-origin"

   [[headers]]
     for = "/service-worker.js"
     [headers.values]
       Cache-Control = "public, max-age=0, must-revalidate"
       Service-Worker-Allowed = "/"

   [[redirects]]
     from = "/*"
     to = "/index.html"
     status = 200
     force = false
   ```

5. **Deploy**
   ```bash
   netlify deploy --prod
   ```

**Advantages:**
- ✅ Free tier (100GB/month bandwidth)
- ✅ Automatic HTTPS
- ✅ Continuous deployment from git
- ✅ Custom headers support
- ✅ Serverless functions (if needed)
- ✅ Form handling
- ✅ Analytics

---

### Option 3: Vercel (Free Tier Available)

**Perfect for:** Fast deployment, edge network, preview deployments

#### Setup Instructions

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Deploy**
   ```bash
   vercel
   ```
   - Follow prompts to set up project
   - Vercel will auto-detect it's a static site

3. **Configure (Optional)**
   Create `vercel.json`:
   ```json
   {
     "version": 2,
     "routes": [
       {
         "src": "/service-worker.js",
         "headers": {
           "Cache-Control": "public, max-age=0, must-revalidate",
           "Service-Worker-Allowed": "/"
         },
         "dest": "/service-worker.js"
       },
       {
         "src": "/(.*)",
         "headers": {
           "X-Frame-Options": "DENY",
           "X-Content-Type-Options": "nosniff"
         },
         "dest": "/$1"
       }
     ]
   }
   ```

**Advantages:**
- ✅ Free tier (100GB/month bandwidth)
- ✅ Automatic HTTPS
- ✅ Edge network (fast globally)
- ✅ Preview deployments for PRs
- ✅ Custom domains

---

### Option 4: Cloudflare Pages (Free)

**Perfect for:** Global CDN, DDoS protection, unlimited bandwidth

#### Setup Instructions

1. **Push to GitHub**
   ```bash
   git push origin main
   ```

2. **Connect Repository**
   - Go to [Cloudflare Pages](https://pages.cloudflare.com/)
   - Click "Create a project"
   - Connect your GitHub repository
   - Configure:
     - Build command: (leave empty)
     - Build output directory: `/`
     - Root directory: `/`

3. **Deploy**
   - Click "Save and Deploy"
   - Cloudflare will deploy automatically

**Advantages:**
- ✅ Unlimited bandwidth (free!)
- ✅ Global CDN
- ✅ DDoS protection
- ✅ Automatic HTTPS
- ✅ Custom domains

---

### Option 5: Self-Hosted (Apache/Nginx)

**Perfect for:** Full control, existing infrastructure, enterprise deployment

#### Nginx Configuration

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    # SSL Configuration (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;

    # Root directory
    root /var/www/aiding-migraine;
    index index.html;

    # Service Worker - No caching
    location = /service-worker.js {
        add_header Cache-Control "public, max-age=0, must-revalidate";
        add_header Service-Worker-Allowed "/";
        try_files $uri =404;
    }

    # Manifest - Short cache
    location = /manifest.json {
        add_header Cache-Control "public, max-age=3600";
        try_files $uri =404;
    }

    # Icons - Long cache
    location /icons/ {
        add_header Cache-Control "public, max-age=31536000, immutable";
        try_files $uri =404;
    }

    # Main app - Short cache (for updates)
    location = / {
        add_header Cache-Control "public, max-age=3600";
        try_files /index.html =404;
    }

    # All other files
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json application/xml;
}
```

#### Apache Configuration

```apache
<VirtualHost *:80>
    ServerName your-domain.com
    ServerAlias www.your-domain.com
    Redirect permanent / https://your-domain.com/
</VirtualHost>

<VirtualHost *:443>
    ServerName your-domain.com
    ServerAlias www.your-domain.com

    # SSL Configuration
    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/your-domain.com/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/your-domain.com/privkey.pem

    # Security Headers
    Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"
    Header always set X-Frame-Options "DENY"
    Header always set X-Content-Type-Options "nosniff"
    Header always set Referrer-Policy "strict-origin-when-cross-origin"

    DocumentRoot /var/www/aiding-migraine

    # Service Worker - No caching
    <Files "service-worker.js">
        Header set Cache-Control "public, max-age=0, must-revalidate"
        Header set Service-Worker-Allowed "/"
    </Files>

    # Icons - Long cache
    <Directory "/var/www/aiding-migraine/icons">
        Header set Cache-Control "public, max-age=31536000, immutable"
    </Directory>

    # Enable compression
    <IfModule mod_deflate.c>
        AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css text/javascript application/javascript application/json
    </IfModule>

    # Fallback to index.html for client-side routing
    <Directory /var/www/aiding-migraine>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted

        RewriteEngine On
        RewriteBase /
        RewriteRule ^index\.html$ - [L]
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteRule . /index.html [L]
    </Directory>
</VirtualHost>
```

---

## Configuration

### Required: Update Notification Server URL

Before deploying, update the notification server URL in `index.html`:

**Find (around line 5900):**
```javascript
const NOTIFICATION_SERVER_URL = 'http://localhost:3000';
```

**Replace with your production notification server:**
```javascript
const NOTIFICATION_SERVER_URL = 'https://your-notification-server.com';
```

### Required: Update VAPID Public Key

After rotating credentials on the notification server, update the VAPID public key:

**Find (around line 5929):**
```javascript
const VAPID_PUBLIC_KEY = 'BHVugOyMNYtN5lftKJrKO10dSl7XPSGB1fWJ2eRrfAhnx-dtqY44AllB0tiTUnZaouhvzZdRADqf4C6MVW4oKdM';
```

**Replace with your VAPID public key from notification server setup.**

### Optional: Update Manifest

Edit `manifest.json` to customize:
```json
{
  "name": "Aiding Migraine",
  "short_name": "AidMigraine",
  "description": "Track and manage your migraine symptoms with ease",
  "start_url": "./",
  "display": "standalone",
  "background_color": "#1a1d24",
  "theme_color": "#7ba68a",
  ...
}
```

### Optional: Custom Icons

Replace icons in `/icons/` directory:
- `favicon-16x16.png` - Browser favicon
- `icon-72x72.png` through `icon-512x512.png` - PWA installation icons
- `icon-192x192-maskable.png`, `icon-512x512-maskable.png` - Android adaptive icons
- `apple-touch-icon.png` - iOS home screen icon

**Icon Requirements:**
- PNG format
- Transparent background for maskable icons
- Minimum 512x512 for largest icon
- Follow [PWA icon guidelines](https://web.dev/maskable-icon/)

---

## Testing

### Pre-Deployment Testing

1. **Local Testing**
   ```bash
   # Serve locally with Python
   python3 -m http.server 8080

   # Or with Node.js
   npx http-server -p 8080

   # Visit http://localhost:8080
   ```

2. **HTTPS Testing (Required for PWA features)**
   ```bash
   # Use ngrok for HTTPS tunnel
   ngrok http 8080

   # Visit the https:// URL provided by ngrok
   ```

3. **PWA Installation Test**
   - Open in Chrome/Edge: Look for install button in address bar
   - Open in Safari (iOS): Share → Add to Home Screen
   - Verify icon appears on home screen
   - Launch from home screen (should open standalone, not in browser)

4. **Offline Test**
   - Install PWA
   - Open browser DevTools → Application → Service Workers
   - Check "Offline" mode
   - Reload page - should work offline
   - Navigate between pages - should work offline

5. **Notification Test**
   - Install PWA
   - Go to Settings
   - Enable notifications
   - Verify notification permission requested
   - Wait for scheduled notification or use test notification feature

### Post-Deployment Testing

1. **Lighthouse Audit**
   ```bash
   # Install Lighthouse
   npm install -g lighthouse

   # Run audit
   lighthouse https://your-domain.com --view
   ```

   **Target Scores:**
   - Performance: 90+
   - Accessibility: 95+
   - Best Practices: 95+
   - SEO: 90+
   - PWA: 100

2. **PWA Checklist**
   - ✅ Installs on mobile (iOS & Android)
   - ✅ Installs on desktop (Chrome, Edge)
   - ✅ Works offline
   - ✅ Service worker registers successfully
   - ✅ Manifest is valid
   - ✅ Icons display correctly
   - ✅ Splash screen appears on launch (mobile)
   - ✅ Notifications work (if notification server deployed)
   - ✅ Updates automatically when new version deployed

3. **Cross-Browser Testing**
   - Chrome (Desktop & Android) ✅
   - Safari (Desktop & iOS) ✅
   - Edge (Desktop) ✅
   - Firefox (Desktop & Android) ✅

4. **Security Headers Test**
   ```bash
   curl -I https://your-domain.com
   ```

   **Expected Headers:**
   - `Strict-Transport-Security: max-age=31536000`
   - `X-Frame-Options: DENY`
   - `X-Content-Type-Options: nosniff`
   - `Content-Security-Policy: ...`

---

## App Store Deployment

### iOS App Store (Using PWA Builder)

#### Option 1: PWA Builder (Recommended)

1. **Generate iOS App**
   - Go to [PWA Builder](https://www.pwabuilder.com/)
   - Enter your PWA URL: `https://your-domain.com`
   - Click "Start"
   - Review analysis
   - Click "Package for Stores" → "iOS"
   - Download generated Xcode project

2. **Configure in Xcode**
   - Open `.xcodeproj` file
   - Update app metadata:
     - App name
     - Bundle identifier
     - Version number
     - Icons (use PWA icons)
   - Test in simulator
   - Archive for distribution

3. **Submit to App Store**
   - Create App Store Connect listing
   - Upload archive via Xcode
   - Complete App Store listing:
     - Screenshots (capture from PWA)
     - Description
     - Keywords: migraine, headache, health tracker, symptom diary
     - Category: Health & Fitness
   - Submit for review

#### Option 2: Capacitor (More Control)

```bash
# Install Capacitor
npm install @capacitor/core @capacitor/cli
npx cap init

# Add iOS platform
npx cap add ios

# Copy web assets
npx cap copy ios

# Open in Xcode
npx cap open ios
```

**Advantages of Capacitor:**
- More native features (camera, calendar, etc.)
- Better performance
- More control over native code

**Disadvantages:**
- More complex setup
- Requires Xcode knowledge
- More maintenance

---

### Google Play Store (Using Trusted Web Activity)

#### Option 1: PWA Builder (Easiest)

1. **Generate Android App**
   - Go to [PWA Builder](https://www.pwabuilder.com/)
   - Enter your PWA URL
   - Click "Package for Stores" → "Android"
   - Download APK/AAB bundle

2. **Configure**
   - Update package name
   - Add icons
   - Set version code
   - Configure signing keys

3. **Submit to Play Store**
   - Create Play Console listing
   - Upload AAB file
   - Complete listing:
     - Screenshots
     - Description
     - Category: Health & Fitness
   - Submit for review

#### Option 2: Manual TWA Setup

```bash
# Clone TWA template
git clone https://github.com/GoogleChromeLabs/svgomg-twa.git
cd svgomg-twa

# Update configuration
# Edit build.gradle:
def twaManifest = [
    applicationId: "com.aidingmigraine.pwa",
    hostName: "your-domain.com",
    launchUrl: "/",
    name: "Aiding Migraine",
    themeColor: "#7ba68a",
    backgroundColor: "#1a1d24",
    enableNotifications: true
]

# Generate signing key
keytool -genkey -v -keystore my-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias my-key-alias

# Build APK
./gradlew assembleRelease

# Upload to Play Store
```

---

### Microsoft Store (Windows)

1. **Use PWA Builder**
   - Go to PWA Builder
   - Select "Windows" platform
   - Download MSIX package

2. **Submit to Microsoft Store**
   - Create developer account
   - Upload MSIX
   - Complete listing
   - Submit for review

---

## Troubleshooting

### Service Worker Not Registering

**Symptoms:**
- Offline mode doesn't work
- Update mechanism fails
- Notifications don't work

**Solutions:**
1. Verify HTTPS is enabled (required for service workers)
2. Check browser console for errors
3. Verify service worker file is at root: `/service-worker.js`
4. Check `Cache-Control` headers (should be `max-age=0` for service worker)
5. Clear browser cache and reload

### PWA Not Installing

**Symptoms:**
- No install button in browser
- "Add to Home Screen" not available

**Solutions:**
1. **Check HTTPS:** PWA requires HTTPS (except localhost)
2. **Verify Manifest:**
   ```bash
   # Check manifest.json is accessible
   curl https://your-domain.com/manifest.json
   ```
3. **Check Icons:** Ensure icons exist and are correct sizes
4. **Service Worker:** Must be registered successfully
5. **iOS Specific:**
   - Must use Safari (not Chrome on iOS)
   - Must have `apple-touch-icon` meta tag

### Notifications Not Working

**Solutions:**
1. **Check Notification Server:** Verify it's deployed and accessible
2. **Check VAPID Key:** Ensure it matches between PWA and server
3. **Check Permissions:** Browser must grant notification permission
4. **iOS Requirements:**
   - Must install PWA to home screen FIRST
   - Then enable notifications from within installed PWA
   - Will not work in Safari browser
5. **Test Notification Server:**
   ```bash
   curl https://your-notification-server.com/health
   ```

### App Not Updating

**Symptoms:**
- Users see old version after deployment
- Changes not appearing

**Solutions:**
1. **Check Service Worker Update:**
   - Service worker checks for updates every 24 hours
   - Force update: DevTools → Application → Service Workers → "Update"
2. **Clear Cache:**
   ```javascript
   // In browser console:
   caches.keys().then(keys => Promise.all(keys.map(key => caches.delete(key))))
   ```
3. **Version Manifest:**
   - Update `version` in service worker
   - Change will trigger update

### Icons Not Displaying

**Solutions:**
1. Verify icon paths in `manifest.json`
2. Check icons exist at specified paths
3. Verify icon sizes match manifest declarations
4. Use PNG format (not SVG for most icons)
5. Check browser console for 404 errors

### CORS Errors with Notification Server

**Symptoms:**
```
Access to fetch at 'https://notification-server.com/api/...' from origin 'https://your-domain.com' has been blocked by CORS policy
```

**Solutions:**
1. Update notification server `ALLOWED_ORIGINS`:
   ```env
   ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com
   ```
2. Restart notification server
3. Clear browser cache

---

## Performance Optimization

### 1. Enable Compression

**Gzip/Brotli compression can reduce file sizes by 70-80%:**

```nginx
# Nginx
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css text/xml text/javascript application/javascript application/json;

# Enable Brotli (if available)
brotli on;
brotli_types text/plain text/css text/xml text/javascript application/javascript application/json;
```

### 2. Cache Static Assets

```nginx
# Icons - Cache for 1 year (immutable)
location /icons/ {
    add_header Cache-Control "public, max-age=31536000, immutable";
}

# Service Worker - No cache
location = /service-worker.js {
    add_header Cache-Control "public, max-age=0, must-revalidate";
}

# HTML - Short cache
location = /index.html {
    add_header Cache-Control "public, max-age=3600";
}
```

### 3. Optimize Icons

```bash
# Install imagemin
npm install -g imagemin-cli imagemin-pngquant

# Optimize all icons
imagemin icons/*.png --out-dir=icons-optimized --plugin=pngquant
```

### 4. Use CDN

For global users, use a CDN:
- Cloudflare (free tier available)
- AWS CloudFront
- Fastly
- Akamai

---

## Continuous Deployment

### GitHub Actions (Automated)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy PWA

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./
          exclude_assets: '.github,notification-server,*.md'
```

---

## Security Checklist

Before deploying to production:

- [ ] HTTPS enabled (required)
- [ ] Security headers configured (CSP, HSTS, X-Frame-Options)
- [ ] Notification server URL updated to production
- [ ] VAPID public key updated
- [ ] Service worker caching configured correctly
- [ ] No secrets in code (check with git history)
- [ ] DOMPurify library loaded (XSS protection)
- [ ] Test with Lighthouse security audit
- [ ] CORS configured on notification server
- [ ] Admin API key set on notification server

---

## Support

**Issues?**
- Check [troubleshooting section](#troubleshooting)
- Open issue on [GitHub](https://github.com/AidedMarketing/AidingMigraine/issues)
- Email: support@aidingmigraine.com

**Documentation:**
- [Main README](./README.md)
- [Notification Server README](./notification-server/README.md)
- [Security Documentation](./SECURITY_REMEDIATION.md)

---

## License

MIT License - See [LICENSE](./LICENSE) file

---

**Last Updated:** 2026-01-22
**Version:** 2.0.0
