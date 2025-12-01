# Aiding Migraine

A comprehensive Progressive Web App (PWA) for tracking and managing migraine attacks, featuring intelligent notification reminders.

## Features

- 📝 **Track Migraine Episodes** - Log pain levels, medications, and symptoms
- 📊 **Visual History** - Review past episodes with calendar view
- 📅 **Calendar Integration** - See migraine patterns over time
- 🔔 **Smart Notifications** - Daily check-ins and post-attack follow-ups
- 📱 **Works Offline** - Full PWA functionality, install to home screen
- 🔒 **Privacy First** - All data stored locally on your device
- 🌓 **Dark/Light Themes** - Comfortable viewing in any lighting
- 💾 **Export & Backup** - Export data as JSON or PDF for doctor visits

## New: Push Notification System ✨

The app now includes a comprehensive notification system to help you stay on top of your migraine tracking:

- **Daily Check-in Reminders** (default 7 PM, customizable)
- **Post-Attack Follow-ups** (2-4 hours after logging an attack)
- **iOS Compatible** (works when installed to home screen)
- **Full User Control** (customize times, frequency, enable/disable)

**[→ See Notification Setup Guide](NOTIFICATIONS_SETUP.md)**

## Quick Start

1. **Use the PWA**: Open `index.html` in a modern browser
2. **Install to Home Screen**: For best experience and notifications
3. **Enable Notifications**: Go to Settings → Notifications (optional)

## Notification Server Setup (Optional)

For push notifications to work, you need to run the notification server:

```bash
cd notification-server
npm install
# Configure .env (see NOTIFICATIONS_SETUP.md)
npm start
```

**See detailed setup instructions:** [NOTIFICATIONS_SETUP.md](NOTIFICATIONS_SETUP.md)

## Browser Compatibility

- ✅ Chrome/Edge (Desktop & Mobile)
- ✅ Firefox (Desktop & Mobile)
- ✅ Safari (Desktop & iOS - requires installation for notifications)

## Privacy

All migraine data is stored **locally on your device**. No data is sent to any server except:
- Push notification subscription (when you enable notifications)
- Notification preferences (to schedule reminders)

You can export backups anytime and delete all data from Settings.

## Development

This PWA was developed by Claude AI as a comprehensive migraine tracking solution.

## Project Structure

```
AidingMigraine/
├── index.html              # Main PWA application
├── service-worker.js       # Service worker with push handlers
├── manifest.json           # PWA manifest
├── icons/                  # App icons
├── notification-server/    # Push notification server
│   ├── index.js           # Express server
│   ├── database.js        # Subscription storage
│   ├── fcm.js             # Firebase Cloud Messaging
│   ├── scheduler.js       # Notification scheduler
│   ├── routes/            # API endpoints
│   └── README.md          # Server documentation
└── NOTIFICATIONS_SETUP.md # Setup guide
```

## License

MIT
