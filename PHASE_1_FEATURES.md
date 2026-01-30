# Phase 1: Advanced PWA Features

Comprehensive documentation for Phase 1 features added in version 3.0.0.

---

## Table of Contents

1. [Screen Wake Lock](#screen-wake-lock)
2. [Offline/Online Status Indicators](#offlineonline-status-indicators)
3. [Custom Install Prompt](#custom-install-prompt)
4. [Web Speech API (Voice Logging)](#web-speech-api-voice-logging)
5. [Biometric Authentication](#biometric-authentication)
6. [Auto-Lock After Inactivity](#auto-lock-after-inactivity)
7. [Browser Compatibility](#browser-compatibility)
8. [Settings & Configuration](#settings--configuration)

---

## Screen Wake Lock

### Overview
Prevents your screen from dimming or locking during active migraine episodes - essential when users are experiencing visual disturbances or severe pain.

### How It Works
1. **Automatic Activation**: Wake lock engages when you start an active migraine episode
2. **Visual Indicator**: A badge appears (bottom right) showing "Screen staying awake"
3. **Automatic Release**: Lock releases when episode ends
4. **Visibility Handling**: Re-acquires lock when you return to the app

### Use Cases
- Viewing breathing exercises during an attack
- Tracking symptom changes without touching the screen
- Following guided meditation or relaxation techniques
- Preventing interruptions during active logging

### Settings
Navigate to **Settings → Phase 1: Advanced Features → Keep Screen Awake**

- **Toggle**: Enable/disable wake lock
- **Default**: Enabled
- **Persistence**: Setting saved to localStorage

### Browser Support
- ✅ Chrome/Edge 84+
- ✅ Safari 16.4+
- ❌ Firefox (not supported)

### Technical Details
```javascript
// Request wake lock
await navigator.wakeLock.request('screen');

// Release wake lock
await wakeLock.release();

// Auto re-acquire on visibility change
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && activeMigraine) {
        requestWakeLock();
    }
});
```

### Privacy & Battery
- **Battery Impact**: Minimal - same as viewing any page
- **Privacy**: No data collected or transmitted
- **User Control**: Can be disabled in settings at any time

---

## Offline/Online Status Indicators

### Overview
Clear visual feedback about your internet connection status, helping you understand when the app is working offline.

### Features

#### Offline Banner
- **Appearance**: Orange banner at top of screen
- **Message**: "⚠️ You're offline - Changes will sync when you reconnect"
- **Behavior**: Remains visible until connection restored
- **Layout**: Automatically pushes content down (no overlap)

#### Online Banner
- **Appearance**: Green banner at top of screen
- **Message**: "✓ Back online - Data synced"
- **Behavior**: Auto-hides after 3 seconds
- **Visual**: Smooth slide-down animation

### Use Cases
- Understanding why notifications aren't sending
- Confidence that offline changes are saved locally
- Knowing when sync has completed
- Troubleshooting connection issues

### Technical Details
```javascript
// Listen for online/offline events
window.addEventListener('online', showOnlineBanner);
window.addEventListener('offline', showOfflineBanner);

// Check on load
if (!navigator.onLine) {
    showOfflineBanner();
}
```

### Accessibility
- **Reduced Motion**: Respects `prefers-reduced-motion` setting
- **Color Contrast**: WCAG AA compliant
- **Screen Readers**: Announces status changes

---

## Custom Install Prompt

### Overview
Encourages users to install the app with a custom, branded prompt that appears at the optimal moment.

### Smart Triggering
The install prompt shows automatically after you've logged **3 migraines**, demonstrating engagement with the app.

### Features
- **Custom Design**: Matches app branding and aesthetics
- **Icon**: 📱 phone icon
- **Title**: "Install Aiding Migraine"
- **Description**: "Get quick access and track migraines offline"
- **Actions**: "Install" or "Not Now"

### User Flow
1. Log 3 migraines
2. Wait 2 seconds (non-intrusive timing)
3. Prompt slides up from bottom
4. Choose "Install" or "Not Now"
5. If dismissed, won't show again

### Why Install?
- **Faster Access**: Launch from home screen like a native app
- **Offline First**: Full functionality without internet
- **No Browser Bar**: Cleaner, fullscreen experience
- **Push Notifications**: Enable background notifications (where supported)
- **Storage Priority**: More persistent storage allocation

### Installation Methods

#### Desktop (Chrome/Edge)
1. Click "Install" in custom prompt, OR
2. Click install icon in address bar, OR
3. Menu → Install Aiding Migraine

#### iOS (Safari)
1. Tap Share button
2. Scroll down → "Add to Home Screen"
3. Tap "Add"
4. Open from home screen

#### Android (Chrome)
1. Tap "Install" in custom prompt, OR
2. Menu → "Add to Home Screen"

### Settings Storage
```javascript
localStorage.setItem('installPromptShown', 'true');
localStorage.setItem('installPromptDismissed', 'true');
```

### Browser Support
- ✅ Chrome/Edge 68+ (Desktop & Android)
- ❌ Safari (uses manual install only)
- ❌ Firefox (uses manual install only)

---

## Web Speech API (Voice Logging)

### Overview
Hands-free migraine logging using voice commands - essential for accessibility when experiencing visual disturbances, severe pain, or motor difficulties.

### Voice Commands

#### Log Migraine
- **"Log migraine pain level [1-10]"**
  - Example: "Log migraine pain level 7"
  - Auto-fills pain scale
  - Prompts to add details and save

#### Episode Control
- **"Start episode"** - Begins active migraine tracking
- **"End episode"** - Completes active episode

#### Navigation
- **"Show history"** - Navigate to History page
- **"Show calendar"** - Navigate to Calendar page
- **"Show analytics"** - Navigate to Analytics page

### UI Elements

#### Floating Microphone Button
- **Location**: Bottom right, above navigation
- **Size**: 60px circular button
- **Icon**: 🎤 microphone
- **States**:
  - Idle: Green background
  - Listening: Red background with pulse animation
- **Always Visible**: Except when voice not supported

#### Voice Feedback Panel
- **Location**: Above microphone button
- **Content**:
  - "Listening..." status
  - Real-time transcript in green
- **Visibility**: Only shown while listening

### How to Use
1. **Tap** microphone button
2. **Speak** command clearly
3. **Wait** for recognition (transcript appears)
4. **Confirm** action in modal/navigation

### Tips for Best Results
- **Environment**: Quiet room preferred
- **Clarity**: Speak clearly and at normal pace
- **Commands**: Use exact phrases listed above
- **Language**: Currently English only (en-US)

### Accessibility Benefits
- **Visual Impairment**: Log without seeing screen
- **Motor Difficulties**: No fine motor control needed
- **Severe Pain**: Minimal interaction required
- **Cognitive Load**: Speak instead of type

### Browser Support
- ✅ Chrome/Edge 25+ (excellent)
- ✅ Safari 14.1+ (with webkit prefix)
- ❌ Firefox (not supported)

### Technical Details
```javascript
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();

recognition.continuous = false; // One command at a time
recognition.interimResults = true; // Show progress
recognition.lang = 'en-US';

recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    processVoiceCommand(transcript);
};
```

### Privacy
- **Local Processing**: All recognition happens on your device
- **No Cloud**: Voice data never sent to servers
- **No Recording**: Audio not saved or stored
- **Permission**: Requires microphone permission

---

## Biometric Authentication

### Overview
Secure your sensitive health data using fingerprint, Face ID, Touch ID, or Windows Hello.

### Supported Methods
- **Fingerprint** (Android, Windows)
- **Face ID** (iPhone X+, iPad Pro)
- **Touch ID** (MacBook Pro, iPad)
- **Windows Hello** (Windows 10+)
- **PIN/Pattern** (fallback on some devices)

### Setup Process
1. Navigate to **Settings → Phase 1 → Biometric Lock**
2. Toggle "Enable"
3. Complete device authentication
4. Credential stored locally (never sent to server)

### Security Features
- **Web Authentication API (WebAuthn)**: Industry-standard security
- **Platform Authenticator**: Uses device's built-in security
- **Private Key**: Stored in secure hardware (TPM/Secure Enclave)
- **No Passwords**: Biometric only
- **Local Storage**: Credential ID saved in localStorage

### Lock Screen
When app is locked:
- **Full-screen overlay**: Prevents data viewing
- **Icon**: 🔒 lock icon
- **Title**: "App Locked"
- **Message**: "Unlock to access your migraine data"
- **Button**: "Unlock" (triggers biometric prompt)

### Unlock Flow
1. Tap "Unlock" button
2. Device prompts for biometric/PIN
3. Authenticate
4. Lock screen dismisses
5. Inactivity timer resets

### Failed Authentication
- **Retry**: Can attempt multiple times
- **Fallback**: Device handles fallback (PIN, password)
- **No Lockout**: App doesn't lock you out (device handles that)

### Browser Support
- ✅ Chrome 67+
- ✅ Edge 18+
- ✅ Safari 13+
- ✅ Firefox 60+

### Technical Details
```javascript
// Registration
const publicKeyOptions = {
    challenge: crypto.getRandomValues(new Uint8Array(32)),
    rp: { name: "Aiding Migraine", id: window.location.hostname },
    user: {
        id: new Uint8Array(16),
        name: "user@aidingmigraine.local",
        displayName: "Aiding Migraine User"
    },
    pubKeyCredParams: [
        { alg: -7, type: "public-key" }, // ES256
        { alg: -257, type: "public-key" } // RS256
    ],
    authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required"
    }
};

const credential = await navigator.credentials.create({ publicKey: publicKeyOptions });
```

### Privacy
- **Local Only**: Biometric data never leaves your device
- **No Server**: No server-side authentication
- **Optional**: Can use app without biometric lock
- **Revocable**: Disable anytime in settings

---

## Auto-Lock After Inactivity

### Overview
Automatically locks the app after a period of inactivity to protect your privacy.

### Configurable Delays
- 1 minute
- 3 minutes
- **5 minutes (default)**
- 10 minutes
- 30 minutes

### Activity Detection
The timer resets when you:
- Move the mouse
- Press a key
- Tap the screen
- Scroll
- Click

### Settings
Navigate to **Settings → Phase 1 → Auto-Lock**

- **Toggle**: Enable/disable auto-lock
- **Delay Selector**: Choose timeout period
- **Default**: Enabled with 5-minute delay

### Behavior

#### When Locked
- Full-screen lock screen appears
- App content completely hidden
- "Unlock" button displayed
- If biometric enabled: prompts for biometric
- If biometric disabled: simple unlock

#### Unlock Methods
1. **With Biometric**: Fingerprint/Face ID required
2. **Without Biometric**: Simple "Unlock" button tap

### Use Cases
- **Shared Devices**: Lock when others might use device
- **Privacy**: Auto-protect if you forget to close app
- **Work/Public**: Additional security in public spaces
- **Healthcare Compliance**: HIPAA-friendly privacy protection

### Timer Management
```javascript
let inactivityTimeout;
const autoLockDelay = 300000; // 5 minutes

function resetInactivityTimer() {
    clearTimeout(inactivityTimeout);
    inactivityTimeout = setTimeout(lockApp, autoLockDelay);
}

// Activity events
['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']
    .forEach(event => {
        document.addEventListener(event, resetInactivityTimer, true);
    });
```

### Privacy & Security
- **Local Only**: No server communication
- **No Tracking**: Activity not logged or analyzed
- **User Control**: Fully optional feature
- **Persistent**: Setting survives page reloads

---

## Browser Compatibility

### Feature Support Matrix

| Feature | Chrome/Edge | Firefox | Safari | iOS Safari | Notes |
|---------|-------------|---------|--------|------------|-------|
| **Wake Lock** | ✅ 84+ | ❌ | ✅ 16.4+ | ✅ 16.4+ | iOS support since Sept 2022 |
| **Web Speech** | ✅ 25+ | ❌ | ✅ 14.1+ | ✅ 14.1+ | webkit prefix on Safari |
| **Web Authentication** | ✅ 67+ | ✅ 60+ | ✅ 13+ | ✅ 13+ | Full support all modern browsers |
| **Install Prompt** | ✅ 68+ | ❌ | ❌ | ❌ | Chromium-based only |
| **Online/Offline** | ✅ All | ✅ All | ✅ All | ✅ All | Universal support |
| **Auto-Lock** | ✅ All | ✅ All | ✅ All | ✅ All | Universal support |

### Graceful Degradation

All features detect browser support and gracefully degrade:

```javascript
// Wake Lock
if ('wakeLock' in navigator) {
    // Feature available
} else {
    console.log('Wake lock not supported');
}

// Web Speech
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
    // Feature available
} else {
    // Hide voice button, show message in settings
}

// Web Authentication
if (window.PublicKeyCredential) {
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    if (available) {
        // Feature available
    }
}
```

### Progressive Enhancement

- **Core App**: Works on all browsers (including IE11 with localStorage)
- **Phase 1 Features**: Additional enhancements on supported browsers
- **No Breaking**: Unsupported features don't break the app
- **Clear Status**: Settings show which features are available

---

## Settings & Configuration

### Accessing Settings
**Settings → Phase 1: Advanced Features**

### Available Controls

#### 1. Keep Screen Awake (Wake Lock)
- **Toggle Switch**: On/Off
- **Default**: On
- **Description**: "Prevents screen from dimming during active migraine episodes"
- **Storage**: `localStorage.wakeLockEnabled`

#### 2. Voice Logging
- **Display Only**: Shows availability status
- **Status Messages**:
  - ✅ "Available - Voice button shown on screen"
  - ❌ "Not supported on this browser"
- **No Configuration**: Voice button auto-shows if supported

#### 3. Biometric Lock
- **Toggle Switch**: On/Off
- **Default**: Off
- **Setup**: Enabling triggers registration flow
- **Status Display**: Shows device compatibility
- **Storage**: `localStorage.biometricAuthEnabled`, `localStorage.biometricCredentialId`

#### 4. Auto-Lock
- **Toggle Switch**: On/Off
- **Default**: On
- **Delay Selector**: Dropdown with time options
- **Default Delay**: 5 minutes
- **Storage**: `localStorage.autoLockEnabled`, `localStorage.autoLockDelay`

### Reset Settings

To reset Phase 1 settings to defaults:
1. Open browser DevTools (F12)
2. Go to Console tab
3. Run:
```javascript
localStorage.removeItem('wakeLockEnabled');
localStorage.removeItem('biometricAuthEnabled');
localStorage.removeItem('biometricCredentialId');
localStorage.removeItem('autoLockEnabled');
localStorage.removeItem('autoLockDelay');
localStorage.removeItem('installPromptShown');
localStorage.removeItem('installPromptDismissed');
location.reload();
```

### Data Storage

All Phase 1 settings stored in localStorage:

```javascript
{
    "wakeLockEnabled": "true",
    "biometricAuthEnabled": "false",
    "biometricCredentialId": "[base64-encoded-credential]",
    "autoLockEnabled": "true",
    "autoLockDelay": "300000",
    "installPromptShown": "true",
    "installPromptDismissed": "false"
}
```

---

## Troubleshooting

### Wake Lock Not Working
**Symptoms**: Screen still dims during episodes

**Solutions**:
1. Check browser version (need Chrome 84+, Safari 16.4+)
2. Verify setting is enabled in Settings
3. Ensure device isn't in battery saver mode
4. Try closing/reopening app
5. Check console for errors (F12 → Console)

### Voice Commands Not Recognized
**Symptoms**: Commands don't trigger actions

**Solutions**:
1. Speak clearly and at normal pace
2. Use exact command phrases (see list above)
3. Check microphone permission
4. Try in quiet environment
5. Verify browser supports Web Speech (Chrome/Safari only)
6. Check microphone works in other apps

### Biometric Setup Fails
**Symptoms**: Can't enable biometric lock

**Solutions**:
1. Verify device has biometric hardware
2. Check biometric is set up in device settings
3. Grant permission when browser prompts
4. Try incognito/private browsing (some browsers)
5. Update browser to latest version
6. Check console for specific error

### Auto-Lock Not Triggering
**Symptoms**: App doesn't lock after inactivity

**Solutions**:
1. Verify setting is enabled
2. Check delay setting (may be set to 30 minutes)
3. Ensure you're not continuously active (mouse movements count)
4. Reload app
5. Check if focus is on app (background tabs may behave differently)

### Install Prompt Not Showing
**Symptoms**: Never see install prompt

**Solutions**:
1. Log at least 3 migraines
2. Use Chrome/Edge browser
3. Check if already installed (won't show if installed)
4. Clear site data and try again
5. Check if previously dismissed (stored in localStorage)

---

## FAQ

### Q: Do Phase 1 features work offline?
**A**: Yes! All features work offline except:
- Initial biometric registration (needs connection for security libraries)
- Install prompt (requires connection to download assets)

### Q: Will voice commands use my data plan?
**A**: No. All voice recognition happens locally on your device. No data sent to cloud.

### Q: Is biometric data sent to a server?
**A**: Never. Biometric data never leaves your device. Only a credential ID is stored locally.

### Q: Can I use voice without installing the app?
**A**: Yes. Voice works in browser or installed app.

### Q: What happens if my biometric fails?
**A**: Device will offer fallback (PIN, password, or pattern) based on your device settings.

### Q: Does wake lock drain battery?
**A**: Minimal impact - same as viewing any page. Screen staying on uses more battery than screen off, but wake lock itself adds negligible overhead.

### Q: Can I export my settings?
**A**: Settings are stored in localStorage. Use Settings → Export → JSON to backup all data including settings.

### Q: Will future browsers support these features?
**A**: Likely yes. These are web standards with growing adoption. Firefox is working on Wake Lock and Web Speech support.

---

## Feedback & Support

### Report Issues
GitHub: https://github.com/AidedMarketing/AidingMigraine/issues

### Feature Requests
Create an issue with label `feature-request`

### Documentation
Help docs: Open app → Settings → Help & Resources

---

## What's Next?

### Phase 2 (Current): Enhanced Data Management
- IndexedDB for unlimited storage
- Background Sync for offline changes
- Storage quota management
- Auto-archive old data

### Phase 3 (Planned): Platform & Discovery
- App store submissions (Microsoft Store, Google Play)
- Onboarding flow for new users
- Badging API for notification indicators
- Analytics for usage insights

### Phase 4 (Future): Advanced Features
- Geolocation + weather integration
- Machine learning pattern detection
- Device integration (Bluetooth health devices)
- Desktop-specific features

---

## Credits

Built with care for migraine sufferers using:
- **Web Wake Lock API** (W3C Standard)
- **Web Speech API** (W3C Community Group)
- **Web Authentication API** (W3C Recommendation)
- **beforeinstallprompt** (Chromium Extension)

© 2025-2026 Aiding Migraine
