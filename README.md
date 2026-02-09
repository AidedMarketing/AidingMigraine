# 🧠 Aiding Migraine

A Progressive Web App for tracking migraines, identifying patterns, and improving communication with healthcare providers.

**Built by someone who lives with migraines, for people who live with migraines.**

[![PWA](https://img.shields.io/badge/PWA-enabled-blueviolet)](https://web.dev/progressive-web-apps/)
[![Privacy First](https://img.shields.io/badge/Privacy-First-green)](./help/privacy.html)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/Version-4.0.0-blue)](./CHANGELOG.md)

[Live Demo](https://aidedmarketing.github.io/AidingMigraine/) | [Documentation](https://aidedmarketing.github.io/AidingMigraine/help/) | [Report Bug](https://github.com/AidedMarketing/AidingMigraine/issues) | [Changelog](./CHANGELOG.md)

---

## 🆕 What's New in v4.0.0

### Complete UI Redesign - Migraine-Friendly Interface

**A complete visual overhaul designed specifically for people experiencing migraines:**

- **Warm Dark Theme** - Eye-friendly warm tones (#1c1815) with soft green accents to reduce eye strain
- **Minimal Line Icons** - Replaced 122+ emoji with clean, minimal SVG icons for reduced visual clutter
- **Simplified Pain Scale** - Dropdown interface with patient-centered, non-prescriptive labels
- **Progressive Disclosure** - Collapsible sections hide optional details by default
- **3 Focused Themes** - Choose Warm Dark, Warm Light, or High Contrast mode
- **70% Less Visual Clutter** - Streamlined forms, consolidated buttons, cleaner interface
- **Professional Design** - Modern, accessible design that looks great and feels calm

### Previous Major Updates

**Phase 2: Enhanced Data Management (v3.1.0)**
- IndexedDB Storage for unlimited history
- Storage quota management and auto-archive
- Background sync for offline changes

**Phase 1: Advanced PWA Features (v3.0.0)**
- Screen wake lock, voice logging, biometric auth
- Auto-lock, offline indicators, custom install prompt

📖 **[Full Changelog](./CHANGELOG.md)** | **[Phase 1 Documentation](./PHASE_1_FEATURES.md)**

---

## ✨ Features

### Core Tracking
- 📅 **Visual calendar** with severity indicators
- 📊 **Multi-day migraine tracking** (clinically accurate: Mon-Wed = 3 days, not 1)
- 📈 **Analytics dashboard** with 4 research-backed charts
- 💾 **PDF export** for doctor visits with clinical interpretations
- 🌙 **Dark mode** support (automatic system theme detection)
- ✏️ **Entry editing** - Modify past entries without deleting
- 📥📤 **CSV import/export** for data portability

### Smart Notifications
- ⏰ **Daily check-in reminders** (customizable time, timezone-aware)
- 🔔 **Post-attack follow-ups** (2-4 hours after logging)
- 📱 **iOS-optimized** (requires home screen installation)
- 🌍 **Timezone conversion** ensures notifications arrive at correct local time
- 🚨 **Active attack check-ins** during ongoing migraines

### Medication Tracking (NEW in v2.0)
- 💊 **Comprehensive medication library** (200+ abortive & preventive medications)
- ⭐ **Effectiveness tracking** (5-star rating system)
- ⏱️ **Time to relief** monitoring
- 🔍 **Side effect tracking** (6 common side effects)
- 📊 **Medication analytics** - See which treatments work best
- 🧪 **Custom medications** - Track any treatment not in the library

### Machine Learning & Personalization (NEW in v2.0)
- 🧠 **Personal threshold learning** - App learns YOUR specific triggers
- 📈 **Adaptive sensitivity detection** - Discovers if you react to pressure drops, rises, or both
- 🎯 **Individual risk profiles** - Personalized warnings based on your history
- 📊 **Confidence scoring** - See how reliable predictions are (requires 5+ tracked migraines)
- ⚡ **Smart pattern detection** - Identifies your unique migraine patterns

### Weather Tracking
- 🌦️ **Barometric pressure correlation** (2-level tracking: 24h & 6h changes)
- 📍 **ZIP code-based weather data** (automatic weather API integration)
- 📊 **Automatic weather pattern analysis** with ML-powered insights
- 🎯 **Personalized weather triggers** - Learns which conditions affect YOU
- 🌡️ **Absolute pressure monitoring** - Low pressure storm system warnings
- 📉 **Direction sensitivity** - Tracks if you're sensitive to drops, rises, or both

### Privacy First
- 🔒 **All data stays on YOUR device** (local storage only)
- 🚫 **No tracking, no ads, no data collection**
- ✅ **Works completely offline**
- 💪 **No account required**
- 🔐 **Open source** for transparency
- 🛡️ **Enterprise-grade security** (XSS protection, rate limiting, authentication)

---

## 🚀 Getting Started

### Installation

#### iOS (iPhone/iPad)
1. Open in **Safari** (other browsers won't work for installation)
2. Tap Share → "Add to Home Screen"
3. Open from home screen icon (looks like a native app)
4. [Full iOS Setup Guide](https://aidedmarketing.github.io/AidingMigraine/help/notifications-ios.html)

#### Android/Desktop
- Works in any modern browser (Chrome, Edge, Firefox, Safari)
- Optional: Install for app-like experience
- Click "Install" button in browser address bar

### First Steps
1. Log your first migraine (or migraine-free day!)
2. Enable notifications in Settings
3. Check your analytics after a week
4. [Quick Start Guide](https://aidedmarketing.github.io/AidingMigraine/help/quick-start.html)

---

## 📊 Analytics Dashboard

Track what matters clinically:

| Chart | Purpose |
|-------|---------|
| **Frequency Trend** | Migraine days per month over time - tracks episodic (< 15 days) vs. chronic (≥ 15 days) classification |
| **Pain Level Distribution** | Breakdown of mild, moderate, severe attacks - assess treatment effectiveness |
| **Time of Day Patterns** | When migraines typically start (4-hour blocks) - identify triggers and medication timing |
| **Day of Week Patterns** | Which days you're most vulnerable - spot lifestyle and environmental factors |

[Understanding Your Analytics Guide](https://aidedmarketing.github.io/AidingMigraine/help/analytics.html)

---

## 🧪 Beta Testing

**We're looking for beta testers!**

Help us improve Aiding Migraine by testing and providing feedback.

### What we need:
- 5-10 people who experience migraines
- Mix of iOS and Android users
- Willing to use the app for 2 weeks
- Provide feedback on usability

### What you get:
- Early access to new features
- Direct input on development
- Help build something that helps the migraine community

**Interested?** [Open an issue](https://github.com/AidedMarketing/AidingMigraine/issues) or email support@aidingmigraine.com

---

## 💡 Why Another Migraine App?

Existing apps often:
- ❌ Require accounts and collect data
- ❌ Have confusing interfaces
- ❌ Lack clinical relevance
- ❌ Don't work offline
- ❌ Cost money or have paywalls

**Aiding Migraine is different:**
- ✅ Completely private (data never leaves your device)
- ✅ Simple, migraine-friendly design
- ✅ Clinically relevant analytics (based on ICHD-3 criteria)
- ✅ Free and open source
- ✅ Works offline

---

## 🛠️ Technical Details

**Built with:**
- Vanilla JavaScript (no heavy frameworks - fast & lightweight)
- Progressive Web App (PWA) standards
- Service Workers (offline support + update management)
- Web Push API (notifications via VAPID protocol)
- LocalStorage (data persistence, fully encrypted in browser)
- Chart.js 4.4.1 (analytics visualizations)
- DOMPurify 3.0.6 (XSS protection)

**Backend (Notification Server):**
- Node.js + Express (lightweight REST API)
- Web Push library (VAPID authentication)
- Helmet.js (security headers: CSP, HSTS, X-Frame-Options)
- express-rate-limit (DDoS protection)
- CORS whitelist (origin validation)
- API key authentication (admin endpoints)
- JSON file storage (easily upgradeable to PostgreSQL/MongoDB)

**Security Features:**
- ✅ XSS Protection (DOMPurify sanitization)
- ✅ Rate Limiting (100 req/15min general, 10 req/min sensitive endpoints)
- ✅ CORS Whitelist (configurable allowed origins)
- ✅ Input Validation (comprehensive endpoint validation)
- ✅ Security Headers (helmet.js: CSP, HSTS, X-Frame-Options)
- ✅ Path Traversal Protection (sandboxed file system)
- ✅ API Authentication (API keys for admin access)
- ✅ No secrets in git (automated credential rotation)

**Browser Support:**
| Browser | Support |
|---------|---------|
| Safari (iOS 16.4+) | ✅ Full support (install to home screen for notifications) |
| Chrome (Desktop/Android) | ✅ Full support |
| Edge (Desktop/Android) | ✅ Full support |
| Firefox (Desktop/Android) | ✅ Full support |
| Chrome (iOS) | ⚠️ Limited - can't install as PWA (Apple restriction) |

**Hosting:**
- **App:** GitHub Pages (static hosting, global CDN)
- **Notification Server:** Render.com / Heroku / Railway (Node.js hosting)

---

## 📖 Documentation

### User Documentation
- [📚 Help Center](https://aidedmarketing.github.io/AidingMigraine/help/) - All documentation in one place
- [🚀 Quick Start Guide](https://aidedmarketing.github.io/AidingMigraine/help/quick-start.html) - Get started in minutes
- [🔔 iOS Notification Setup](https://aidedmarketing.github.io/AidingMigraine/help/notifications-ios.html) - Detailed iOS setup and troubleshooting
- [📊 Analytics Guide](https://aidedmarketing.github.io/AidingMigraine/help/analytics.html) - Understanding your charts
- [💡 FAQ](https://aidedmarketing.github.io/AidingMigraine/help/faq.html) - Common questions and answers
- [🔒 Privacy Policy](https://aidedmarketing.github.io/AidingMigraine/help/privacy.html) - How we protect your data

### Technical Documentation
- [🧠 Machine Learning Features](./ML_FEATURES_DOCUMENTATION.md) - Personal threshold learning, pattern detection
- [💊 Medication Tracking](./MEDICATION_TRACKING_SPEC.md) - Medication library, effectiveness tracking
- [✏️ Entry Editing](./ENTRY_EDITING_SPEC.md) - Modify past migraine entries
- [📥 CSV Import/Export](./CSV_EXPORT_IMPORT_SPEC.md) - Data portability features
- [🔔 Notifications Setup](./NOTIFICATIONS_SETUP.md) - Server setup and configuration
- [🔐 Security Remediation](./SECURITY_REMEDIATION.md) - Comprehensive security audit & fixes
- [📦 Dependency Audit](./DEPENDENCY_AUDIT.md) - 55% dependency reduction analysis

---

## 🔐 Privacy & Security

### Enterprise-Grade Security (v2.0+)
- 🔒 **XSS Protection** - DOMPurify sanitization for all user input
- 🛡️ **Security Headers** - Helmet.js with CSP, HSTS, X-Frame-Options
- 🔑 **API Authentication** - Admin endpoints protected with API keys
- ⚡ **Rate Limiting** - Multi-tier protection against abuse (100 req/15min)
- 🚫 **CORS Whitelist** - Configurable allowed origins only
- ✅ **Input Validation** - Comprehensive validation on all endpoints
- 🔐 **Path Traversal Protection** - Sandboxed file system access

### What We Collect
- ✅ **Notification preferences only** (time, timezone, anonymous push token)
- ✅ Stored on our notification server (necessary for delivery)

### What We DON'T Collect
- ❌ **No migraine data** (stays on your device)
- ❌ **No personal information** (name, email, etc.)
- ❌ **No tracking or analytics**
- ❌ **No advertising IDs**
- ❌ **No location data** (beyond ZIP/postal code for weather)

### Your Rights
- **Access:** Your data is on your device, accessible anytime
- **Export:** PDF export available in Settings
- **Delete:** Clear all data anytime in Settings
- **Portability:** Export JSON backup for data migration

Full details in our [Privacy Policy](https://aidedmarketing.github.io/AidingMigraine/help/privacy.html).

---

## 🐛 Support

**Found a bug?**
[Open an issue](https://github.com/AidedMarketing/AidingMigraine/issues) with:
- What you were trying to do
- What happened instead
- Your device and browser
- Screenshots if possible

**Have a question?**
- Check the [FAQ](https://aidedmarketing.github.io/AidingMigraine/help/faq.html)
- Email: support@aidingmigraine.com

**Want to contribute?**
See [Contributing Guidelines](#contributing) below

---

## 🚧 Roadmap

**Current (v4.0.0):**
- ✅ **Migraine-friendly UI redesign** (warm themes, minimal icons, reduced clutter)
- ✅ Core tracking and calendar
- ✅ Analytics dashboard with 4 charts
- ✅ Notification system (timezone-aware)
- ✅ PDF export with clinical interpretations
- ✅ Seamless update system
- ✅ **3 theme options** (Warm Dark, Warm Light, High Contrast)
- ✅ **Weather tracking** with barometric pressure correlation
- ✅ **Active attack check-in notifications**
- ✅ **Motion sensitivity accessibility support**
- ✅ **Medication tracking** with effectiveness analysis
- ✅ **Machine learning & personalization** (personal thresholds, direction sensitivity)
- ✅ **Entry editing** (modify past entries)
- ✅ **CSV import/export** for data portability
- ✅ **Enterprise-grade security** (XSS protection, rate limiting, authentication)
- ✅ **IndexedDB storage** (unlimited history)
- ✅ **Advanced PWA features** (wake lock, voice logging, biometric auth)

**Coming Soon (v4.1.0):**
- 🔄 **Cloud sync via Google Drive** (optional, privacy-preserving)
- 📊 **Enhanced medication analytics** with comparative effectiveness charts
- 🎯 **Multi-trigger correlation** (weather + medication + lifestyle)
- 🔔 **Smart notification timing** based on your migraine patterns

**Long-term:**
- Multi-device sync (encrypted peer-to-peer)
- Wear OS / Apple Watch companion
- Symptom tracking enhancements
- Custom export templates
- Symptom pattern recognition (aura, prodrome detection)
- Community features (anonymous pattern sharing)

---

## 👥 Contributing

We welcome contributions from the community!

### Ways to Contribute

1. **Report Bugs**
   Open an [issue](https://github.com/AidedMarketing/AidingMigraine/issues) with detailed information

2. **Suggest Features**
   Share your ideas via [issues](https://github.com/AidedMarketing/AidingMigraine/issues) or email

3. **Improve Documentation**
   Help make our guides clearer - submit PRs for `/help/` pages

4. **Code Contributions**
   - Fork the repository
   - Create a feature branch (`git checkout -b feature/amazing-feature`)
   - Commit your changes (`git commit -m 'Add amazing feature'`)
   - Push to the branch (`git push origin feature/amazing-feature`)
   - Open a Pull Request

5. **Share Your Experience**
   Help others by sharing tips, workflows, or use cases

### Development Setup

```bash
# Clone the repository
git clone https://github.com/AidedMarketing/AidingMigraine.git
cd AidingMigraine

# Open in your browser
# No build process required - it's vanilla JavaScript!
open index.html

# For notification server development
cd notification-server
npm install
npm start
```

### Code Style
- Use meaningful variable names
- Comment complex logic
- Keep functions focused and small
- Maintain accessibility (ARIA labels, keyboard navigation)
- Test on both light and dark themes

---

## 📁 Project Structure

```
AidingMigraine/
├── index.html                      # Main PWA application (~8,500 lines)
├── service-worker.js               # Service worker (offline + notifications + URL validation)
├── manifest.json                   # PWA manifest (app metadata, icons, shortcuts)
├── .gitignore                      # Prevents secrets from being committed
├── icons/                          # App icons (PWA installable assets)
│   ├── favicon-*.png              # Various favicon sizes
│   ├── icon-*.png                 # PWA install icons (72px - 512px)
│   └── *-maskable.png             # Adaptive icons for Android
├── help/                           # Documentation pages
│   ├── index.html                 # Help center
│   ├── quick-start.html           # Getting started guide
│   ├── notifications-ios.html     # iOS notification setup
│   ├── analytics.html             # Analytics guide
│   ├── faq.html                   # Frequently asked questions
│   ├── privacy.html               # Privacy policy
│   └── styles.css                 # Shared documentation styles
├── notification-server/            # Push notification server (Node.js/Express)
│   ├── index.js                   # Express server with security middleware
│   ├── database.js                # Subscription storage (JSON/upgradeable)
│   ├── scheduler.js               # Notification scheduler (cron jobs)
│   ├── middleware/
│   │   └── auth.js                # Authentication & validation middleware
│   ├── routes/
│   │   ├── subscriptions.js       # Subscription management API
│   │   └── notifications.js       # Notification sending API
│   ├── .env.example               # Environment template (NEVER commit .env!)
│   ├── rotate-credentials.sh      # Automated credential rotation script
│   ├── package.json               # Dependencies & scripts
│   └── README.md                  # Notification server documentation
├── SECURITY_REMEDIATION.md         # Comprehensive security audit & fixes
├── SECURITY_COMPLETION_SUMMARY.md  # Security implementation summary
├── DEPENDENCY_AUDIT.md             # Dependency reduction analysis
├── ML_FEATURES_DOCUMENTATION.md    # Machine learning features documentation
├── MEDICATION_TRACKING_SPEC.md     # Medication tracking specification
├── ENTRY_EDITING_SPEC.md           # Entry editing specification
├── CSV_EXPORT_IMPORT_SPEC.md       # CSV import/export specification
├── NOTIFICATIONS_SETUP.md          # Notification setup guide
└── README.md                       # This file
```

---

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

Built with insights from:
- Migraine research and ICHD-3 clinical guidelines
- User experience testing with migraine sufferers
- Evidence-based notification timing studies
- Migraine community feedback

Special thanks to:
- Everyone who lives with migraines and continues to advocate for better tools
- The open-source community for amazing libraries like Chart.js
- Beta testers who provided invaluable feedback

---

## 📞 Contact

- **Email:** support@aidingmigraine.com
- **GitHub Issues:** [Report a problem](https://github.com/AidedMarketing/AidingMigraine/issues)
- **Website:** [aidedmarketing.github.io/AidingMigraine](https://aidedmarketing.github.io/AidingMigraine/)

---

## 💖 Support This Project

Aiding Migraine is completely free and always will be. If you find it helpful:

- ⭐ **Star this repository** to help others find it
- 📢 **Share with others** who might benefit
- 🐛 **Report bugs** to help us improve
- 💡 **Suggest features** based on your needs
- 🤝 **Contribute code or documentation**

---

<div align="center">

**Living with migraines is challenging. Tracking them shouldn't be.**

Made with 💜 by the migraine community, for the migraine community.

[Get Started](https://aidedmarketing.github.io/AidingMigraine/) • [Documentation](https://aidedmarketing.github.io/AidingMigraine/help/) • [Report Issue](https://github.com/AidedMarketing/AidingMigraine/issues)

</div>
