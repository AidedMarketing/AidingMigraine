# Changelog

All notable changes to Aiding Migraine will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.2.2] - 2026-02-01

### Fixed - Critical Data Loading Bug

#### The Issue
- **Stats showing zero**: Dashboard displayed 0 episodes even when data existed
- **Calendar not loading**: Calendar showed "-" for migraine days
- **Root Cause**: v3.2.1's `loadData()` function returned early if IndexedDB existed, even when it contained no data, preventing localStorage fallback

#### The Fix
- **Smart Fallback**: `loadData()` now only returns early if IndexedDB actually contains data
- **Defensive Loading**: Added `dataLoaded` flag to track if data was successfully loaded from IndexedDB
- **localStorage Rescue**: Falls back to localStorage if IndexedDB is empty or unavailable
- **Enhanced Logging**: Added console messages to track data loading source and status

### Changed
- Service worker version: 3.2.1 → 3.2.2
- App version: 3.2.1 → 3.2.2

### Technical Details
**Before (v3.2.1)**:
```javascript
if (useIndexedDB && db) {
    // Load from IndexedDB
    return; // ❌ Returns even if no data found!
}
// localStorage code never reached
```

**After (v3.2.2)**:
```javascript
if (useIndexedDB && db) {
    // Load from IndexedDB
    if (dataLoaded) {
        return; // ✅ Only return if data was actually found
    }
}
// Falls back to localStorage if IndexedDB was empty
```

### Impact
- Users who had data in localStorage can now access it again
- Stats and calendar will display correctly
- No data loss - existing data is preserved

---

## [3.2.1] - 2026-02-01

### Fixed - Critical Bug Fixes

#### Data Loading Issues
- **Stats Display**: Fixed broken stats on dashboard - `loadData()` now correctly loads from IndexedDB
- **Data Persistence**: Updated `saveData()` to save to IndexedDB with localStorage backup
- **Migration**: Ensured data loaded from IndexedDB after migration completes

#### Async Initialization Issues
- **Notifications**: Fixed notification system by making `initializeNotifications()` async and awaiting `updateNotificationUI()`
- **Weather Tracking**: Fixed weather location input visibility by properly awaiting `initWeatherTracking()`
- **Initialization Order**: Refactored app initialization to ensure IndexedDB is ready before loading data

#### Code Improvements
- Created `initApp()` function for proper initialization flow
- Combined DOMContentLoaded handlers to ensure correct initialization order: IndexedDB → Migration → Data Load → UI Setup
- Removed duplicate `initializeNotifications()` call that could cause conflicts

### Changed
- Service worker version: 3.2.0 → 3.2.1
- App version: 3.2.0 → 3.2.1

### Technical Notes
- **Root Cause**: Phase 2 migration to IndexedDB introduced async functions that weren't being awaited, causing race conditions
- **Impact**: Users with migrated data couldn't see their stats, notifications failed to initialize, and weather location input wasn't accessible
- **Solution**: Proper async/await flow ensures IndexedDB operations complete before UI initialization

---

## [3.1.0] - 2026-01-30

### Added - Phase 2: Enhanced Data Management

#### IndexedDB Storage
- **Unlimited Migraine History**: Migrated from localStorage (5-10MB limit) to IndexedDB (unlimited storage)
- **Automatic Migration**: Seamless migration from localStorage to IndexedDB on first load
- **Dual Storage**: Maintains localStorage as backup during transition
- **Indexed Queries**: Fast lookups by date, pain level, and deletion status
- **Object Stores**: Separate stores for migraines, medications, settings, and sync queue

#### Storage Management
- **Storage Quota Monitoring**: Real-time display of storage usage with visual progress bar
- **Storage Warnings**: Automatic alerts when storage exceeds 80% capacity
- **Auto-Archive**: Archive migraines older than 12 months to save space
- **Soft Deletes**: 30-day trash retention before permanent deletion
- **Formatting Utilities**: Human-readable storage sizes (Bytes, KB, MB, GB)

#### Background Sync API
- **Offline Queue**: Queues data changes when offline for later synchronization
- **Automatic Retry**: Up to 3 retry attempts for failed sync operations
- **Service Worker Integration**: Background sync handler in service worker
- **Online Detection**: Automatically processes queue when connection restored
- **Queue Status**: Real-time display of pending sync items

#### Settings UI
- **Phase 2 Settings Section**: New dedicated section for data management features
- **Storage Quota Display**: Visual progress bar showing storage usage
- **IndexedDB Status**: Shows number of migraines stored in IndexedDB
- **Background Sync Status**: Displays sync support and queue count
- **Archive Button**: One-click archiving of old data

### Changed
- Service worker version: 3.0.0 → 3.1.0
- App version displayed in settings: 1.6.0 → 3.1.0
- Improved data persistence layer with IndexedDB fallback

### Technical Details
- Database name: `AidingMigraineDB`
- Database version: 1
- Object stores: `migraines`, `medications`, `settings`, `syncQueue`
- Browser support: Chrome/Edge 23+, Firefox 10+, Safari 10+, all modern mobile browsers

---

## [3.0.0] - 2026-01-30

### Added - Phase 1: Advanced PWA Features

#### Screen Wake Lock API
- **Keep Screen Awake**: Prevents screen from dimming during active migraine episodes
- **Auto-activation**: Automatically engages when migraine episode starts
- **Visual Indicator**: On-screen badge showing "Screen staying awake"
- **Settings Control**: Toggle to enable/disable wake lock
- **Visibility Handling**: Re-acquires lock when returning to app
- **Browser Support**: Chrome/Edge 84+, Safari 16.4+

#### Offline/Online Status Indicators
- **Offline Banner**: Orange banner with "You're offline" message
- **Online Banner**: Green "Back online" confirmation (auto-hides after 3s)
- **Persistent Offline Indicator**: Remains visible while offline
- **Layout Adjustment**: Content automatically shifts to accommodate banners

#### Custom Install Prompt
- **Smart Triggering**: Shows after user logs 3 migraines
- **Custom Design**: Branded UI matching app aesthetic
- **Install/Dismiss Actions**: User choice with preference tracking
- **Prevention of Browser Default**: Captures `beforeinstallprompt` event
- **Installation Detection**: Listens for `appinstalled` event

#### Web Speech API (Voice Logging)
- **Hands-free Logging**: Voice commands for accessibility
- **Supported Commands**:
  - "Log migraine pain level [1-10]"
  - "Start episode" / "End episode"
  - "Show history" / "Show calendar" / "Show analytics"
- **Floating Microphone Button**: Always accessible voice input
- **Real-time Transcript**: Live display of recognized speech
- **Visual Feedback**: Pulsing red animation while listening
- **Browser Support**: Chrome, Edge, Safari (webkit prefix)

#### Biometric Authentication
- **Web Authentication API**: Fingerprint, Face ID, Windows Hello support
- **Device Detection**: Checks platform authenticator availability
- **Registration Flow**: Simple one-time setup process
- **Lock Screen**: Clean UI requiring biometric unlock
- **Settings Control**: Toggle and status indicator
- **Browser Support**: Chrome 67+, Edge 18+, Safari 13+

#### Auto-Lock After Inactivity
- **Configurable Delays**: 1, 3, 5 (default), 10, or 30 minutes
- **Activity Tracking**: Monitors mouse, keyboard, touch, scroll events
- **Lock Screen**: Displays when inactivity timeout reached
- **Biometric Integration**: Works with or without biometric auth
- **Reset on Activity**: Timer resets with any user interaction

### Changed
- Service worker version: 2.0.0 → 3.0.0
- App version: 1.6.0 → 3.0.0
- Added new settings section: "Phase 1: Advanced Features"

### UI/UX Improvements
- Floating voice button (bottom right, 60px circle)
- Wake lock indicator badge
- Status banners with slide-down animation
- Install prompt with slide-up animation
- Lock screen with centered unlock button
- Reduced motion support for all animations

---

## [2.0.0] - 2025

### Added
- **Push Notifications**: Server-based push notification system
- **Notification Types**: Daily check-ins, post-attack follow-ups, active attack reminders
- **Notification Server**: Node.js/Express server with VAPID authentication
- **Scheduler**: Automated notification scheduling with timezone support
- **Security**: Rate limiting, CORS, input sanitization, admin API key
- **API Endpoints**: Subscribe, unsubscribe, update preferences, schedule notifications

### Security
- Helmet.js security headers (CSP, HSTS, X-Frame-Options)
- Rate limiting (100 req/15min, 10 req/min for sensitive endpoints)
- CORS whitelist
- Request body size limits (10KB)
- Path traversal protection

---

## [1.6.0] - 2025

### Added
- **Week 3 Polish**: UI refinements and accessibility improvements
- **Reduced Motion Support**: Respects `prefers-reduced-motion` for accessibility
- **Theme System**: Auto, dark, and light themes
- **Help Documentation**: Comprehensive guides and FAQ

### Changed
- Visual polish and animation improvements
- Better mobile responsiveness

---

## [1.5.0] - 2025

### Added
- **Medication Library**: Pre-populated database of common migraine medications
- **Medication Tracking**: Log medications taken during episodes
- **Effectiveness Rating**: Rate medication effectiveness (1-5 stars)
- **Time to Relief**: Track how long medications take to work
- **Side Effects**: Log medication side effects
- **Custom Medications**: Add user-defined medications to library

### Features
- 40+ pre-populated medications (triptans, NSAIDs, CGRP, preventive)
- Dosage and formulation tracking
- Medication search with autocomplete
- Medication effectiveness analytics

---

## [1.0.0] - 2025

### Added - Initial Release
- **Core Logging**: Log migraine episodes with pain level (1-10)
- **Active Episodes**: Track ongoing migraines with duration timer
- **Pain Scale**: Interactive 1-10 pain level selector
- **Triggers**: Log migraine triggers (stress, food, weather, sleep, etc.)
- **Symptoms**: Track associated symptoms
- **Relief Methods**: Log what helps (medication, rest, ice, etc.)
- **Notes**: Add free-text notes to episodes

#### History & Analytics
- **Episode History**: Chronological list of all logged migraines
- **Calendar View**: Visual calendar showing migraine days
- **Statistics**: Total episodes, average pain, frequency
- **Trends**: Monthly comparison and patterns

#### Data Management
- **Local Storage**: All data stored locally on device
- **Export**: JSON and CSV export options
- **PDF Reports**: Generate doctor-friendly PDF reports
- **Import**: Restore from JSON backup

#### PWA Features
- **Offline Support**: Full functionality without internet
- **Service Worker**: Cache-first strategy for instant loading
- **Manifest**: Installable as standalone app
- **Icons**: Full icon set including maskable icons
- **App Shortcuts**: Quick "Log Migraine" shortcut

#### UI/UX
- **Dark Theme**: Eye-friendly dark mode
- **Responsive Design**: Works on all screen sizes
- **Bottom Navigation**: Easy thumb-reach navigation
- **Animations**: Smooth page transitions
- **Accessibility**: Keyboard navigation, ARIA labels

---

## Browser Support

### Phase 2 Features (v3.1.0)
| Feature | Chrome/Edge | Firefox | Safari | iOS Safari |
|---------|-------------|---------|--------|------------|
| IndexedDB | ✅ 23+ | ✅ 10+ | ✅ 10+ | ✅ 10+ |
| Storage API | ✅ 48+ | ✅ 51+ | ✅ 15.2+ | ✅ 15.2+ |
| Background Sync | ✅ 49+ | ❌ | ❌ | ❌ |

### Phase 1 Features (v3.0.0)
| Feature | Chrome/Edge | Firefox | Safari | iOS Safari |
|---------|-------------|---------|--------|------------|
| Wake Lock | ✅ 84+ | ❌ | ✅ 16.4+ | ✅ 16.4+ |
| Web Speech | ✅ 25+ | ❌ | ✅ 14.1+ | ✅ 14.1+ |
| Web Authentication | ✅ 67+ | ✅ 60+ | ✅ 13+ | ✅ 13+ |
| Install Prompt | ✅ 68+ | ❌ | ❌ | ❌ |

### Core Features (v1.0.0+)
| Feature | Chrome/Edge | Firefox | Safari | iOS Safari |
|---------|-------------|---------|--------|------------|
| Service Worker | ✅ 40+ | ✅ 44+ | ✅ 11.1+ | ✅ 11.3+ |
| PWA Install | ✅ 40+ | ✅ 44+ | ✅ 11.1+ | ✅ 11.3+ |
| localStorage | ✅ All | ✅ All | ✅ All | ✅ All |

---

## Upgrade Notes

### Upgrading to 3.1.0
- **Automatic Migration**: First load will migrate localStorage data to IndexedDB
- **No Data Loss**: localStorage is kept as backup during migration
- **Performance**: Expect faster load times with large migraine histories
- **Storage**: Check Settings → Phase 2 to view storage quota

### Upgrading to 3.0.0
- **Feature Detection**: New features gracefully degrade on unsupported browsers
- **Settings**: New "Phase 1: Advanced Features" section in Settings
- **Permissions**: Biometric auth requires one-time setup if desired
- **Wake Lock**: Automatically enabled for active episodes (can be disabled in settings)

---

## Links

- **Repository**: https://github.com/AidedMarketing/AidingMigraine
- **Issues**: https://github.com/AidedMarketing/AidingMigraine/issues
- **Documentation**: /help/index.html

---

## License

Built with care for migraine sufferers.

© 2025-2026 Aiding Migraine
