# CLAUDE.md — Aiding Migraine

## Project Overview

Aiding Migraine is a **privacy-first, offline-first Progressive Web App (PWA)** for migraine tracking and management. Users log migraines, track patterns, view analytics, manage medications, and export data for healthcare providers. All user data is stored locally on the device (IndexedDB/localStorage). An optional Node.js/Express notification server handles push notifications.

- **Version:** 5.10.0-beta.8
- **License:** MIT
- **Repository:** https://github.com/AidedMarketing/AidingMigraine

## Architecture

### Current architecture (5.10.0)

The attack-first redesign separates page markup in `index.html` from classic scripts in `assets/` and styles in `assets/components.css` and `assets/shell.css`. Preserve script order and shared global scope for now. `assets/tracking.js` owns the core attack lifecycle; `assets/app.js` holds shared feature logic; `assets/storage.js`, `assets/device.js`, and `assets/updates.js` retain their existing responsibilities. All local runtime assets must be precached in `service-worker.js`. Charts and PDFs load on demand. Shared theme tokens are in assets/tokens.css; theme.js runs in the head and interface.js controls insight presentation. See README.md and docs/INTERFACE-OVERHAUL.md for the current source map.

The older single-file descriptions below document the pre-redesign architecture. For new edits, use the split source layout above; do not restore the monolith.

### Previous frontend (Vanilla JS PWA)
- **Single-file app:** `index.html` (~14,800 lines) contains all HTML, CSS, and JavaScript inline
- **No build step:** Served as static files — no bundler, transpiler, or framework
- **Service worker:** `service-worker.js` handles offline caching and push notifications
- **PWA manifest:** `manifest.json` defines installable app metadata
- **External dependencies (CDN only):**
  - DOMPurify 3.0.6 (XSS protection, loaded with SRI integrity)
  - Chart.js 4.4.1 and jsPDF (analytics + PDF export; currently loaded eagerly in `<head>` — lazy-loading is a planned optimization)

### Backend (Optional Notification Server)
- Located in `notification-server/`
- Express.js server with Helmet, CORS, rate limiting
- JSON file-based storage (in `notification-server/data/`)
- Web Push API for delivering notifications
- Cron-based scheduling via node-schedule

## Directory Structure

```
AidingMigraine/
├── index.html                  # Main application (HTML + CSS + JS)
├── service-worker.js           # Offline caching, push notifications
├── manifest.json               # PWA configuration
├── package.json                # Root package (test scripts only, no deps)
├── icons/                      # PWA icons (16px–512px, maskable variants)
├── help/                       # User-facing documentation (HTML pages)
│   ├── index.html, quick-start.html, analytics.html, faq.html
│   ├── notifications-ios.html, privacy.html, styles.css
├── scripts/                    # Validation scripts
│   ├── validate-syntax.js      # HTML/JS syntax checking
│   ├── validate-pwa.js         # PWA requirement validation
│   └── validate-security.js    # Security issue detection
├── notification-server/        # Optional push notification backend
│   ├── index.js                # Express server entry point
│   ├── database.js             # JSON file persistence
│   ├── scheduler.js            # Cron-based notification scheduling
│   ├── push-notifications.js   # Web Push API integration
│   ├── middleware/auth.js      # API key auth & input validation
│   ├── routes/subscriptions.js # Subscription management endpoints
│   ├── routes/notifications.js # Notification scheduling endpoints
│   └── .env.example            # Environment variable template
├── .github/workflows/ci.yml   # GitHub Actions CI pipeline
├── CHANGELOG.md                # Version history
└── *.md                        # Various specification documents
```

## Development Commands

### Running Tests (from project root)

```bash
# Run all validation checks
npm test

# Individual checks
npm run test:syntax     # HTML structure + JS syntax validation
npm run test:pwa        # PWA manifest + service worker + requirements
npm run test:security   # Security issue detection (XSS, eval, innerHTML)
```

There is **no unit test framework** — tests are static analysis validators in `scripts/`. Always run `npm test` before committing to catch issues early.

### Notification Server (from `notification-server/`)

```bash
cd notification-server
npm install              # Install backend dependencies (first time only)
npm start                # Production server
npm run dev              # Development with auto-reload (nodemon)
```

Requires a `.env` file based on `.env.example` with VAPID keys and admin API key.

## CI/CD Pipeline

GitHub Actions (`.github/workflows/ci.yml`) runs on pushes to `main` and `claude/**` branches, and on all PRs to `main`.

**Checks performed:**
1. HTML structure validity (DOCTYPE, tags)
2. JavaScript syntax (service-worker.js + all inline script blocks)
3. PWA manifest validation (required fields, icons)
4. Service worker registration verification
5. PWA requirements (viewport, theme-color, manifest link)
6. Notification server config validation
7. Security best practices scan

All checks must pass. Node.js 20 is used in CI.

## Code Conventions

### Naming
- **JavaScript variables/functions:** camelCase (`userPreferences`, `processDailyCheckIns`)
- **Constants:** UPPER_SNAKE_CASE (`CACHE_NAME`, `ASSETS_TO_CACHE`)
- **CSS variables:** kebab-case (`--bg-primary`, `--accent-green`)
- **CSS classes:** kebab-case (`active-episode-card`, `stat-item`)

### Formatting
- 4-space indentation throughout
- CommonJS modules in the backend (`require`/`module.exports`)
- Markup in `index.html`; styles/scripts split across `assets/` (see architecture above)

### Frontend Architecture
- Multiple `.page` divs toggled via display (SPA-style page routing)
- IndexedDB as primary data store, localStorage as backup/fallback
- DOMPurify used for all user-input sanitization before DOM insertion
- Themes: tone (Dusk/Sage) × brightness (Light/Dim/Dark) via `data-tone`/`data-theme` attributes; shared tokens in `assets/tokens.css`

### Backend Architecture
- Express middleware stack: Helmet → CORS → rate limiting → body parsing → routes
- Rate limits: 100 req/15min general, 10 req/min for sensitive endpoints
- API authentication via `X-API-Key` header for admin endpoints
- Push endpoint domain whitelist (FCM, Firefox, Apple, Windows)

## Security Requirements

These are enforced by `scripts/validate-security.js` and CI:

- **No `eval()`** usage anywhere
- **No `document.write()`** usage
- **Sanitize all innerHTML** assignments with DOMPurify
- **SRI integrity attributes** on all external CDN scripts
- **No hardcoded credentials** — secrets go in `.env` (gitignored)
- **No inline event handlers** (use `addEventListener` instead)
- **HTTPS-only** push endpoints in production
- **Path traversal prevention** in backend file operations

## Data Storage

### Frontend (Browser)
- **IndexedDB:** Primary store for migraine entries, medications, settings, weather history
- **localStorage:** Settings, preferences, backward-compatible backup

### Backend (Notification Server)
- **JSON files** in `notification-server/data/` (gitignored):
  - `subscriptions.json` — push subscriptions with user preferences
  - `scheduled-followups.json` — post-attack notification queue
  - `scheduled-active-checkins.json` — during-attack check-in queue

## Key Files to Know

| File | Purpose |
|------|---------|
| `index.html` | Page markup + head bootstrap |
| `assets/app.js` | Main feature logic |
| `assets/*.css` | Tokens, shell, components |
| `service-worker.js` | Offline caching, push handling |
| `manifest.json` | PWA install configuration |
| `notification-server/index.js` | Backend server setup and middleware |
| `notification-server/database.js` | Data persistence layer |
| `notification-server/scheduler.js` | Cron-based notification scheduling |
| `scripts/validate-*.js` | Test/validation scripts |
| `.github/workflows/ci.yml` | CI pipeline definition |

## Important Patterns

### Modifying the Frontend
Markup lives in `index.html`; styles in `assets/tokens.css` (theme tokens), `assets/shell.css`, and `assets/components.css`; logic in `assets/app.js` plus `assets/theme.js`, `assets/tracking.js`, `assets/storage.js`, `assets/device.js`, `assets/updates.js`. Preserve script order and shared global scope. Always sanitize user input with `DOMPurify.sanitize()` before inserting into DOM.

### Adding Notification Features
1. Frontend subscribes via Push API and sends subscription to backend
2. Backend stores subscription in `subscriptions.json`
3. Scheduler checks at intervals (hourly for daily, every 15min for follow-ups)
4. Server sends push via `web-push` library
5. Service worker receives push event and displays notification

### Theming
- Themes are two tones (Dusk default, Sage) x three brightnesses (Light/Dim/Dark), plus a High contrast accessibility variant; definitions live in `assets/tokens.css`, selected via `data-tone` + `data-theme` attributes set by `assets/theme.js` from the `colorTheme` localStorage key (values like `dusk-dim`). `help/` pages load the same tokens + theme script.
- Chart colors come from per-theme `--chart-*` tokens - never hardcode chart colors in JS.

## Git Workflow

- **Main branch:** `main`
- **Feature branches:** `claude/**` pattern (triggers CI)
- **PRs:** Target `main`, require CI checks to pass
- Run `npm test` locally before pushing
