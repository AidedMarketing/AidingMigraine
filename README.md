# Aiding Migraine

A private, device-local migraine tracker. Start an attack with one tap and add details when you can.

**5.10.0 draft 1 — mobile journal rebuild.** This branch is a review draft. The existing [published app](https://aidedmarketing.github.io/AidingMigraine/) changes only after release.

## The core experience

- **Today:** start a migraine without filling in a form. During an attack, update pain, log medication, or end the migraine. Other details and relief methods are tucked away.
- **History:** calendar and past attacks, including editing.
- **More:** insights, doctor-visit reports, settings, backups, and help.

No account is required. Records stay in IndexedDB with a localStorage fallback on the current browser/device. Optional passphrase encryption protects the health-data vault. Optional weather and push notifications use external services; see [Privacy](help/privacy.html).

The app can log offline after its shell has been cached. Chart and PDF libraries load on demand and may need a connection; CSV and JSON export remain available. Make regular backups: browser storage is not cross-device sync or a backup service.

## Development

Vanilla HTML, CSS, and JavaScript; no frontend dependency install or build step.

```sh
python3 -m http.server 8000
# Open http://localhost:8000
npm test
```

The optional notification server has its own setup in [notification-server/README.md](notification-server/README.md).

## Source layout

| File | Responsibility |
| --- | --- |
| `index.html` | Page markup and ordered script entrypoints |
| `assets/shell.css` | Responsive layouts, journal, settings groups, and dialogs |
| `assets/tokens.css` | Shared color and type tokens for all three themes |
| `assets/theme.js` | Apply the selected theme before first paint, including Help |
| `assets/interface.js` | Insight category visibility and chart resizing |
| `assets/components.css` | Shared component styles and three themes |
| `assets/tracking.js` | Start, update, end, active state, relief, and dashboard summaries |
| `assets/app.js` | Shared state, feature logic, navigation, exports, analytics, and optional library loading |
| `assets/storage.js` | IndexedDB adapter, migration, quotas, and startup |
| `assets/device.js` | Optional device capabilities and settings |
| `assets/updates.js` | Service worker registration and explicit update controls |
| `service-worker.js` | Offline shell caching and push handling |
| `scripts/` | Syntax, PWA, security, and tracking regression checks |
| `docs/REDESIGN-DRAFT.md` | Review findings, implemented changes, and remaining work |
| `docs/archive/` | Superseded design proposals and mockup |

Scripts remain ordered classic scripts with a shared global scope. Extraction reduces the single-file maintenance burden; it is not yet a complete conversion to isolated modules. No storage keys or database version changed in this draft.

## Review and release

Read [the mobile review and browser validation](docs/MOBILE-REBUILD.md) for this pass. It includes the installed-PWA cache correction, layout findings, screenshots workflow, and device-testing limits. `npm run test:mobile` runs Chromium/WebKit after installing the Playwright test tools documented there.

Read [the interface review](docs/INTERFACE-OVERHAUL.md) for this design pass and [the foundation review](docs/REDESIGN-DRAFT.md) for the earlier structural cleanup. In particular, completed episodes still require a pain score under the existing report/import contract. Making that optional needs a coordinated change to analytics and data validation.

Run `npm test` before committing. GitHub Actions runs the same checks on pull requests. Static checks are not a substitute for device testing; this draft still needs physical-iPhone, assistive-technology, and real-device encryption review before merging. Browser layout and offline scenarios are now covered by the automated mobile suite.

[Help](help/index.html) · [Issues](https://github.com/AidedMarketing/AidingMigraine/issues) · [License](LICENSE)
