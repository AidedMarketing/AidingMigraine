# Changelog

All notable changes to Aiding Migraine will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [5.0.0] - 2026-07-09

### Added — Real At-Rest Encryption (P3)

- **Optional "Encrypt my data"** (Settings, off by default) now provides **genuine at-rest encryption** — not just a screen overlay. Your health data (episodes, active episode, cycle data, assessments, medications) is encrypted on the device with **AES-256-GCM**, using a key derived from your passphrase via **PBKDF2-SHA256** (WebCrypto). The key lives only in memory while unlocked and is never written to disk or sent anywhere.
- **Zero-knowledge**: no backdoor. A forgotten passphrase means the data cannot be recovered — the app warns you up front and nudges you to keep an unencrypted JSON backup.
- **Low-friction, attack-aware**: you unlock once per session, and the app **never auto-locks while an episode is active**, so one-tap attack logging stays instant mid-attack. Auto-lock otherwise drops the key and re-requires the passphrase.
- Enable, disable (writes your data back as plaintext), and change-passphrase (re-encrypts) flows included, with clear warnings.
- The existing biometric "screen lock" copy now points to this feature for real encryption.

### Changed

- Version bumped to 5.0.0 to reflect the new encrypted storage capability.

## [4.10.0] - 2026-07-09

### Added — Menstrual / Hormonal Cycle Tracking (P2)

- **Optional menstrual cycle tracking** (off by default, opt-in from Settings). When enabled, a **Cycle card on the Care page** lets you log period start dates and shows your current cycle day and an estimated next-period date derived from your average cycle length.
- **Menstrual-migraine pattern**: the app compares how often your migraines fall in the perimenstrual window (ICHD-3 day −2 to +3 around your period) against what you'd expect by chance, and gives an honest verdict — menstrually-related, some association, or no strong link — mirroring the trigger × weather analysis.
- A subtle **"Cycle day N · next period in ~M days"** line appears on the Today screen when tracking is enabled.
- The menstrual-migraine summary is included in the **PDF doctor report**, and your cycle data rides along in JSON backups.
- **Privacy**: period dates are stored **on your device only and are never sent anywhere** — the pattern is computed locally. Nothing changes on the log form, and the whole feature stays hidden unless you opt in.

## [4.9.0] - 2026-07-09

### Added — Head-Pain Location Map & Pain Quality (P2)

- **Mark where the pain is on an interactive head map** — tap zones on front and back head diagrams (forehead, temples, behind the eyes, crown, sides, back of head, neck). The app derives **laterality** (left / right / bilateral / central) automatically for your doctor report.
- **Record what the pain feels like** — Pulsating/throbbing, Pressing/tight, Stabbing/sharp, Burning, or Dull ache — from a quick chip multi-select. Both are core descriptors clinicians use to classify migraine.
- Both live in the log form's collapsed Optional Details (so first-time users aren't crowded) and are **editable on any past episode**. History cards and calendar day-details show location + laterality and quality; **Episode Details renders a read-only head map** highlighting the affected zones.
- New **"Common pain locations"** and **"Pain quality"** analytics cards rank each over the selected range.
- Exports: per-episode location (with laterality) and quality lines plus a "Common Pain Locations" summary in the **PDF doctor report**; `Pain Location` and `Pain Quality` columns in CSV export/import; JSON carries them automatically.
- The head map is keyboard-accessible (Tab to a zone, Enter/Space to toggle) and imported values are filtered against the controlled lists.

## [4.8.0] - 2026-07-09

### Added — Prodrome & Postdrome Phase Tracking (P2)

- **Log warning signs before an attack (prodrome)** — excessive yawning, food cravings, mood changes, neck stiffness, difficulty concentrating, and more — from a quick chip list inside the log form's Optional Details. Recognizing these early signs is one of the most useful things a tracker can surface.
- **Log after-effects (postdrome)** — the "migraine hangover" of fatigue, brain fog, neck stiffness, and lingering sensitivity — right in the End-Episode screen, at the natural moment.
- Both phases are **editable on any past episode** (History and calendar edit flows) and shown in History cards, Episode Details, and calendar day details, ordered before → during → after for a clear phase timeline.
- New **"Common warning signs"** and **"Common after-effects"** analytics cards rank each phase's frequency over the selected range.
- Exports: per-episode warning-signs and after-effects lines plus summaries in the **PDF doctor report**; `Prodrome` and `Postdrome` columns in CSV export/import; JSON carries them automatically.
- Imported values are filtered against the controlled lists. Plain-language labels keep it approachable — the new fields sit in optional/secondary surfaces so first-time users aren't overwhelmed.

## [4.7.0] - 2026-07-09

### Added — Triggers × Weather Correlation (P2)

- **A new "Triggers × weather" analytics card** cross-tabulates the triggers you log against the **measured** barometric pressure recorded on each episode — so a self-reported trigger like "Weather change" can be checked against the actual barometer instead of taken at face value.
- Each weather-tracked episode is classed as a **pressure-change day** when its recorded 6-hour or 24-hour change crossed your threshold. The card ranks every trigger by the share of its episodes that fell on pressure-change days and flags the ones above your personal baseline.
- An honest **"Weather-change check"** verdict compares your "Weather change" logs to baseline and tells you plainly whether the barometer looks like a real trigger for you, doesn't line up, or is inconclusive so far.
- The card stays hidden until weather tracking is on and there are enough weather-tracked, triggered episodes to say something meaningful.

## [4.6.0] - 2026-07-09

### Added — Today's Outlook Risk Card (P2-4)

- **A "Today's outlook" card at the top of the Today page** surfaces the weather risk signals the app already computes but never displayed: a **0–10 daily risk score** shown as a colored meter with a plain-language label (Low/Moderate/Elevated/High), the current **pressure trend** and 24-hour change, and the most imminent **upcoming forecast alerts** with a recommendation.
- When your **personal prediction model** is active (it turns on only after enough logged history and weather data, and only when it beats a baseline), the card also shows its estimated **chance of a migraine day today** — clearly framed as a learned pattern, not a diagnosis.
- The card stays hidden unless weather tracking is on and has a current reading, and it refreshes automatically on every weather update.

## [4.5.0] - 2026-07-09

### Added — One-tap Attack Mode (P2-5)

- **"Start attack now" button** at the top of the log card starts tracking an episode with a single tap — no fields required. Built for the moment an attack begins and screen time needs to stay short.
- Weather is captured automatically at onset; pain, symptoms, triggers, and relief can be added anytime from the active-episode card as the attack develops.
- Pain is left **unset** rather than defaulted to a number, so in-progress episodes never pollute your pain averages. A pain level (0–10) is required only when you end the episode, so every completed record still carries a real value.
- Starting attack mode while an episode is already active shows the existing "end or clear" prompt.

## [4.4.0] - 2026-07-08

### Added — MIDAS & HIT-6 Disability Assessments (P2-3)

- **Take the MIDAS and HIT-6 questionnaires** in-app from a new "Disability assessments" card on the Care page. These are the standard instruments clinicians use to gauge migraine burden.
- **MIDAS** (5 questions about days lost/limited over 3 months) produces a score and Grade I–IV; **HIT-6** (6 impact questions) produces a score and impact band.
- The Care card shows your latest score and grade for each; results are stored locally, included in JSON backups (and restored on import), and added to the **PDF doctor report** so your clinician sees them.

## [4.3.0] - 2026-07-08

### Added — Trigger Tracking (P2-2)

- **Log possible triggers** on each migraine from a controlled list (stress, poor/too much sleep, skipped meal, dehydration, alcohol, caffeine and withdrawal, chocolate, aged cheese, MSG/processed food, bright light, loud noise, strong smells, screen time, physical exertion, hormonal/menstrual, weather change, travel) via a quick chip multi-select.
- Triggers are adjustable during an active attack, editable on any past episode (History and calendar edit flows), and shown in History cards, Episode Details, and calendar day details.
- New **"Common Triggers"** analytics card ranks trigger frequency over the selected range.
- Exports: per-episode triggers + a "Common Triggers" summary in the PDF doctor report; a `Triggers` column in CSV export/import; JSON carries them automatically.
- Imported trigger values are filtered against the controlled list.

### Changed

- Refactored the symptom/trigger chip UI and analytics into shared, option-agnostic helpers.
- Synced in-app version strings to the current release (they had lagged at 4.1.0).

## [4.2.0] - 2026-07-08

### Added — Symptom & Aura Tracking (P2-1)

- **Log associated symptoms and aura** on each migraine from a controlled, ICHD-3-aligned list: nausea, vomiting, light/sound/smell sensitivity, visual/sensory/speech aura, neck pain, dizziness, blurred vision, and fatigue. Captured as a quick chip multi-select on the log form.
- **Adjust symptoms during an active attack** from the active-episode card as they develop.
- **Edit symptoms** on any past episode from both the History and calendar edit flows.
- **Symptoms everywhere they matter**: shown in History cards, the Episode Details view, and calendar day details; a new **"Common Symptoms"** analytics card ranks symptom frequency over the selected range.
- **Clinician exports**: symptoms appear per-episode in the PDF doctor report plus a "Common Symptoms" summary; a new `Symptoms` column in CSV export (and CSV import maps it back); JSON export/import carry symptoms automatically.
- Imported symptom values are filtered against the controlled list, so import can't inject arbitrary content through this field.

## [4.1.0] - 2026-07-07

### Sprint: Critical Fixes (see SPRINT_PLAN.md for the full audit)

#### Fixed — Data Integrity
- **Deleted data no longer resurrects**: hard deletes (permanent delete, empty trash, purge, Clear All Data) now actually remove records from IndexedDB; previously every deleted episode returned on reload
- **Pain level 0 is preserved**: 0-pain active episodes were wiped on reload and rejected on re-import
- **CSV round-trips preserve timestamps**: the export mixed the UTC date with local times, shifting episodes by a day on re-import for most timezones
- **Archive Old Data works**: it compared against a field that never existed and had never archived anything; archived entries are hidden from views but included in JSON exports
- **Migraine-day counts fixed** for entries with a duration but no end time (seconds were treated as minutes, inflating spans 60x)
- Auto-lock delay setting no longer throws; weather settings migration persists instead of re-running every launch; JSON exports stamp the real app version

#### Fixed — Security
- Untracked 97 leftover `git filter-repo` artifact files
- Push endpoint allowlist now runs on `/subscribe` (was silently skipped — SSRF vector); `send-test` requires the admin API key; rate limiting works behind Render's proxy and sensitive endpoints use the strict limiter
- DOMPurify no longer allowlists `onclick`/`onchange`; all modal content is sanitized; converted the riskiest inline-handler generators to delegated listeners; CSV exports neutralize spreadsheet formula injection
- Notification server: scheduler survives malformed records; JSON writes are awaited, serialized, and atomic

#### Fixed — Analytics honesty
- Medication-overuse warnings follow clinical (ICHD-3) class-specific thresholds (10 days for triptans/combinations/opioids, 15 for simple analgesics)
- Weather correlation is compared against your baseline migraine rate (relative risk) instead of a raw conditional probability
- "All Time" range spans from your first entry, not 1970; 24h pressure change is marked unknown after tracking gaps; risk-model features are normalized and the model only enables with real predictive skill

#### Removed
- **Background sync stub**: logged "synced" then deleted queued data without sending it anywhere
- **Voice logging**: called functions that didn't exist and threw on every command (a rebuilt version is in the backlog)
- Write-only `scheduledNotifications` local storage that grew without bound

#### Changed
- Privacy copy now accurately describes the two opt-in network features (weather → Open-Meteo/Nominatim; notifications → project server) instead of claiming nothing ever leaves the device
- Biometric lock is described as a screen lock (it does not encrypt stored data)
- PDF doctor report: long notes paginate correctly; section headers cleaned up

## [4.0.0] - 2026-02-09

### Major UI Redesign - Migraine-Friendly Interface

**Complete visual redesign focused on reducing visual strain and improving accessibility for migraine sufferers.**

#### Added

**Warm Dark Theme**
- **Eye-friendly color palette**: Warm dark backgrounds (#1c1815) with soft green accents (#8fb394)
- **Reduced blue light exposure**: Warm tones throughout to minimize eye strain
- **High contrast mode**: Additional theme option for enhanced visibility
- **Theme selector**: Choose between Warm Dark, Warm Light, and High Contrast

**Minimal Line Icons**
- **SVG icon system**: Replaced all emoji with clean, minimal Feather-style icons
- **Consistent visual language**: 2px stroke width, 24x24 viewBox throughout
- **Better accessibility**: Icons paired with clear text labels
- **Reduced visual clutter**: 70% reduction in visual noise

**Simplified Pain Scale**
- **Dropdown interface**: Converted 11-button pain scale to clean dropdown
- **Patient-centered labels**: Non-prescriptive descriptors (e.g., "Distressing" instead of medical advice)
- **Faster logging**: Reduced clicks and visual overwhelm
- **Clinical accuracy**: Maintains Numeric Rating Scale (NRS) standards

**Progressive Disclosure**
- **Collapsible sections**: Hide optional details by default
- **Optional Details**: Triggers, symptoms, weather grouped in expandable section
- **Cleaner main form**: Focus on essential information first
- **Reduced cognitive load**: Show only what's needed

#### Changed

**Navigation Icons**
- Log page: Edit icon → Clean line edit icon
- History page: Clock icon → Archive/history icon
- Calendar page: Calendar icon → Calendar grid icon
- Analytics page: Chart icon → Trending chart icon
- Settings page: Gear icon → Settings icon

**Form Styling**
- **Stronger borders**: Increased from 1px to 2px for better visibility
- **Clear focus states**: 3px accent-colored focus rings
- **Better spacing**: Increased padding and margins for easier interaction
- **Rounded corners**: Consistent 8px border radius throughout

**Settings Organization**
- Removed "Phase 1" development terminology
- Renamed to "Privacy & Accessibility"
- Added icons to all settings sections
- Cleaner visual hierarchy

**Button Consolidation**
- Reduced excessive button count throughout app
- Combined similar actions
- Removed redundant options
- Streamlined user flows

#### Removed
- **All emoji usage**: 122+ emoji replaced with icons or removed
- **Visual clutter**: Status tags ([SUCCESS], [ERROR], etc.) in user-facing UI
- **Excessive theme options**: Reduced from 6 to 3 focused themes
- **Prescriptive pain labels**: Removed medical advice language from pain scale
- **"Phase 1" terminology**: Removed development language from user interface

### Technical Changes
- Version: 3.3.7 → 4.0.0
- Service worker: Updated cache strategy for new assets
- CSS custom properties: New theming system with warm color palette
- Icon system: Inline SVG with consistent styling
- Form UX: Improved accessibility and keyboard navigation

### Migration Notes
- **No data changes**: All existing data remains intact
- **Automatic update**: Service worker handles cache updates
- **Theme persistence**: User theme preference saved in localStorage
- **Backward compatible**: All existing features work as before

### Design Research
- Patient-centered pain assessment best practices
- Migraine-friendly color theory (warm tones, reduced blue light)
- Progressive disclosure UI patterns
- WCAG accessibility standards
- Minimal icon design (Feather icon system)

### Impact
- **70% reduction** in visual clutter
- **Faster logging**: Streamlined pain scale and collapsible sections
- **Better accessibility**: High contrast mode, clear focus states
- **Reduced eye strain**: Warm color palette, minimal interface
- **Professional appearance**: Clean, modern design language

---

## [3.2.3] - 2026-02-01

### Fixed - Aggressive Update Strategy to Fix Caching Issues

#### The Problem
Even with v3.2.2 deployed, users were still seeing old cached versions due to service worker cache-first strategy.

#### The Solution - Three-Pronged Approach

**1. Network-First for HTML Files**
- Changed service worker to network-first for HTML, cache-first for assets
- Ensures users always get latest HTML on reload

**2. Auto-Update Without User Interaction**
- Update banner now auto-triggers after 2 seconds
- Automatic reload when new service worker activates

**3. Aggressive Service Worker Activation**
- Service workers now call `skipWaiting()` immediately after install
- No waiting for tabs to close

### Changed
- Service worker caching strategy: Cache-first → Network-first (HTML only)
- Update behavior: Manual → Automatic (2-second delay)
- Service worker activation: Waiting → Immediate
- Service worker version: 3.2.2 → 3.2.3
- App version: 3.2.2 → 3.2.3

### User Actions to Get This Update
**On Desktop**: Hard refresh (Ctrl+Shift+R / Cmd+Shift+R)
**On Mobile**: Close all tabs and reopen, or clear browser cache
**After this update**: All future updates will auto-apply!

---

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
