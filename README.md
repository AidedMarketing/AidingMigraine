# 🧠 Aiding Migraine

A Progressive Web App for tracking migraines, identifying patterns, and improving communication with healthcare providers.

**Built by someone who lives with migraines, for people who live with migraines.**

[![PWA](https://img.shields.io/badge/PWA-enabled-blueviolet)](https://web.dev/progressive-web-apps/)
[![Privacy First](https://img.shields.io/badge/Privacy-First-green)](./help/privacy.html)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[Live Demo](https://aidedmarketing.github.io/AidingMigraine/) | [Documentation](https://aidedmarketing.github.io/AidingMigraine/help/) | [Report Bug](https://github.com/AidedMarketing/AidingMigraine/issues)

---

## ✨ Features

### Core Tracking
- 📅 **Visual calendar** with severity indicators
- 📊 **Multi-day migraine tracking** (clinically accurate: Mon-Wed = 3 days, not 1)
- 📈 **Analytics dashboard** with 4 research-backed charts
- 💾 **PDF export** for doctor visits with clinical interpretations
- 🌙 **Dark mode** support (automatic system theme detection)

### Smart Notifications
- ⏰ **Daily check-in reminders** (customizable time, timezone-aware)
- 🔔 **Post-attack follow-ups** (2-4 hours after logging)
- 📱 **iOS-optimized** (requires home screen installation)
- 🌍 **Timezone conversion** ensures notifications arrive at correct local time

### Privacy First
- 🔒 **All data stays on YOUR device** (local storage only)
- 🚫 **No tracking, no ads, no data collection**
- ✅ **Works completely offline**
- 💪 **No account required**
- 🔐 **Open source** for transparency

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
- Vanilla JavaScript (no heavy frameworks)
- Progressive Web App (PWA) standards
- Service Workers (offline support + update management)
- Web Push API (notifications)
- LocalStorage (data persistence)
- Firebase Cloud Messaging (notification delivery)
- Chart.js 4.4.1 (analytics visualizations)

**Browser Support:**
| Browser | Support |
|---------|---------|
| Safari (iOS 16.4+) | ✅ Full support (install to home screen for notifications) |
| Chrome (Desktop/Android) | ✅ Full support |
| Edge (Desktop/Android) | ✅ Full support |
| Firefox (Desktop/Android) | ✅ Full support |
| Chrome (iOS) | ⚠️ Limited - can't install as PWA |

**Hosting:**
- **App:** GitHub Pages (static hosting)
- **Notification Server:** Render.com (free tier)

---

## 📖 Documentation

Complete documentation available:

- [📚 Help Center](https://aidedmarketing.github.io/AidingMigraine/help/) - All documentation in one place
- [🚀 Quick Start Guide](https://aidedmarketing.github.io/AidingMigraine/help/quick-start.html) - Get started in minutes
- [🔔 iOS Notification Setup](https://aidedmarketing.github.io/AidingMigraine/help/notifications-ios.html) - Detailed iOS setup and troubleshooting
- [📊 Analytics Guide](https://aidedmarketing.github.io/AidingMigraine/help/analytics.html) - Understanding your charts
- [💡 FAQ](https://aidedmarketing.github.io/AidingMigraine/help/faq.html) - Common questions and answers
- [🔒 Privacy Policy](https://aidedmarketing.github.io/AidingMigraine/help/privacy.html) - How we protect your data

---

## 🔐 Privacy & Security

### What We Collect
- ✅ **Notification preferences only** (time, timezone, anonymous push token)
- ✅ Stored on our notification server (necessary for delivery)

### What We DON'T Collect
- ❌ **No migraine data** (stays on your device)
- ❌ **No personal information** (name, email, etc.)
- ❌ **No tracking or analytics**
- ❌ **No advertising IDs**
- ❌ **No location data** (beyond timezone)

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

**Current (v1.5.1):**
- ✅ Core tracking and calendar
- ✅ Analytics dashboard with 4 charts
- ✅ Notification system (timezone-aware)
- ✅ PDF export with clinical interpretations
- ✅ Seamless update system
- ✅ Dark mode support

**Coming Soon (v1.6.0):**
- 🔄 **Cloud sync via Google Drive** (optional, privacy-preserving)
- 💊 **Medication tracking improvements**
- 🎯 **Trigger pattern detection**
- 🌦️ **Weather integration** (for weather-sensitive migraines)
- ✏️ **Entry editing** (fix mistakes without deleting)
- 📥 **CSV import/export**

**Long-term:**
- Multi-device sync
- Wear OS / Apple Watch companion
- Symptom tracking enhancements
- Custom export templates
- Community features

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
├── index.html              # Main PWA application
├── service-worker.js       # Service worker (offline + notifications)
├── manifest.json           # PWA manifest
├── icons/                  # App icons
├── help/                   # Documentation pages
│   ├── index.html         # Help center
│   ├── quick-start.html   # Getting started guide
│   ├── notifications-ios.html  # iOS notification setup
│   ├── analytics.html     # Analytics guide
│   ├── faq.html          # Frequently asked questions
│   ├── privacy.html      # Privacy policy
│   └── styles.css        # Shared documentation styles
├── notification-server/    # Push notification server
│   ├── index.js          # Express server
│   ├── database.js       # Subscription storage
│   ├── fcm.js            # Firebase Cloud Messaging
│   ├── scheduler.js      # Notification scheduler
│   └── routes/           # API endpoints
└── README.md             # This file
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
