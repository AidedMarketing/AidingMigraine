# Mobile journal rebuild — 5.10.0 draft 1

This pass starts from merged PR #108 (5d740d6). The primary user is opening the installed iPhone Home Screen app, often during a migraine. The brief is to keep logging immediate while making every supporting screen feel like the same product.

## Product and design decisions

- **Today:** a quiet ink/lavender journal, one clear Start migraine action, optional details below, and a link to the latest completed entry. Start still requires no form.
- **During an attack:** saved state and elapsed time first; separated pain and medication actions; one full-width End migraine action. Details remain available without dominating the screen.
- **History:** saved entries are the first destination. The calendar expands when needed, so a full month grid does not push the journal off the first screen. The last-entry summary uses the latest date, including imported/out-of-order records.
- **Navigation:** Today, History, More stay at the bottom. A labeled Settings shortcut is available in the shared header. Main screens use consistent content widths, spacing, type, and surfaces.
- **Sheets:** mobile dialogs sit at the bottom, with independently scrolling content and reachable action buttons. The underlying page is inert and its scroll position is restored after dismissal. Keyboard viewport changes resize the sheet.
- **Appearance:** muted lavender over ink, warm paper with plum accents, and the existing high-contrast option. Theme choices and data keys remain compatible with existing installations. No decorative animation during logging.
- **Useful restraint:** keep optional tools, reports, weather, questionnaires, encryption, and backups available. Do not add streaks, motivational pressure, account creation, or extra required logging fields.

Design references: [Apple accessibility guidance](https://developer.apple.com/design/human-interface-guidelines/accessibility/), [W3C reflow at 320 CSS pixels](https://www.w3.org/WAI/WCAG21/Understanding/reflow.html), and [WCAG target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html). This is design guidance, not a claim of full WCAG certification.

## Review findings and corrections

| Finding | Result |
| --- | --- |
| Old service worker fetched HTML from the network but CSS/JS from cache. An installed PWA could mix two releases. | HTML and assets now come from the same installed cache. Versioned resource URLs also bypass stale legacy-worker entries during the transition. A new worker still waits for the user to apply it; first installation does not interrupt the open page with a reload. |
| `.modal.active` from the old component stylesheet outranked the newer mobile `.modal` rule. | The mobile selector now targets the active sheet directly. |
| Legacy desktop body padding, nav orientation, and top-position rules were inherited by the new shell. | The shell explicitly owns body padding, navigation geometry, and mobile/desktop positioning. |
| Older theme selectors were more specific than the new token selectors, leaving mixed palettes. | The shared token layer now wins for all three themes; computed foreground/background colors are tested. Theme changes do not interpolate through unreadable colors. |
| Settings appeared only in the Today header, as an unlabeled icon. | Shared header with visible Settings label, consistent hit area, and safe-area spacing. It is also available under More. |
| Banner spacing used fixed offsets that did not match wrapped or enlarged text. | ResizeObserver reserves measured banner heights. Banners cannot overlap each other or cover the shared header. |
| Success toast could overlap pain controls after opening a dialog. | Clear old success notices on entry; sheet feedback participates in the sheet layout. |
| Edit form forced 11 pain buttons into one row and used a second internal scrolling region. | Shared wrapping pain grid and one scrolling sheet body; date/time fields wrap independently. |
| Medication search results were clickable divs. | Native buttons and labeled custom fields support keyboard and assistive navigation. |
| Medication and record edits dismissed before persistence completed. | Await saving, prevent repeated submissions, and roll back in-memory changes on failure. |
| Edit date used the UTC day while time used local time. Notes-only edits also truncated seconds. | Local date fields and unchanged exact timestamps are preserved, including attacks spanning midnight and short attacks. |
| End-pain selection could leave multiple buttons marked pressed. | A single explicit selection is reflected in both appearance and accessibility state. |
| Offline dynamic UI depended on a CDN sanitizer. Its fallback escaped entire fragments. | Vendor and precache DOMPurify 3.4.15 with its license. Core rendering no longer requires the CDN. |
| Background dialogs were not inert; the diagnostics dialog was inside main content. | Inert background, body scroll locking, restored focus, and diagnostics moved outside the inert main. |
| Offline update checks could reject without a handler. | Failed background update checks defer quietly while the installed journal remains usable. |

## Validation performed

All 16 tracking/interface regression tests pass, including persistence failure, local dates, encryption/storage contracts, and installed-release coherence. Syntax, PWA, and security validators pass; the security checker still reports existing inline-handler/dynamic-HTML maintenance warnings.

The new `scripts/mobile.test.js` exercises **12 browser scenarios**: Chromium and WebKit at 320, 390, 430, 768, and 1280px, plus enlarged-text/short-screen/landscape checks in each engine. It covers:

- Main screens and expanded settings/forms without horizontal overflow.
- A simulated 59px top inset and 34px bottom inset, plus navigation positioning.
- Start, pain selection, medication search and save, reload, end, history, and edit.
- Real JSON download and verification of the saved medication and notes.
- Exact timestamps preserved when editing a record spanning local midnight.
- Three appearance options; 200% text; 375×667 and 844×390 viewports.
- Offline history controls, sanitizer availability, and starting/completing an attack without a network.
- Runtime JavaScript errors, feedback overlap, and sheet action reachability.

Chromium uses browser offline mode. Playwright WebKit on this Mac reports an internal navigation error when its offline toggle is enabled; its outage checks instead shut down all server responses (with HTTP caching disabled), then verify that the installed service worker reloads and operates. This verifies cached operation but does not reproduce iOS airplane mode. WebKit emulation is not a physical iPhone or a full installed-PWA simulator.

GitHub Actions now runs the browser suite as well as the existing checks. Reproduce with:

```sh
npm test
npm install --no-save --package-lock=false playwright@1.62.1
npx playwright install chromium webkit
npm run test:mobile
```

Optional screenshot output: `MOBILE_SCREENSHOTS=tmp/mobile npm run test:mobile`.

## Release and remaining review

This is a draft for review, not a production deployment. On a physical iPhone, validate launch from the Home Screen, status-bar and home-indicator clearance, the software keyboard, rotation, VoiceOver, and applying an update while a record is open. Back up existing records before device release testing; do not delete/reinstall the PWA to apply this update.

Existing completed-record validation still requires a real pain score. Making this optional needs a separate coordinated change to imports, reports, and analytics so missing pain is never counted as zero. Chart/PDF libraries still load on demand; JSON/CSV and the journal remain the offline paths. Optional push/weather services, real biometric hardware, and complete real-device encryption flows were not integration-tested in this pass. The large shared app script remains a maintenance constraint; extracting it wholesale would add migration risk without improving the immediate mobile experience.
