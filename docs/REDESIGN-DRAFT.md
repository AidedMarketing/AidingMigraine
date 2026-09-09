# Attack-first redesign — draft 1

## Product rule

During an attack, the app should ask for the smallest useful action and let the person leave. History, analysis, and setup belong in separate spaces. Optional features should earn their place in the primary flow.

## Review findings

The reviewed base is commit `cd2796407eb095a950dc1175984b5f1aba3ccc2e`.

1. **Competing actions on Today.** The main screen offered one-tap start alongside a full form, weather outlook, summary statistics, and a calendar. Five navigation destinations added further choices.
2. **Tracking could disappear after reopening.** The quick-start path stored `painLevel: null`, but `validateActiveMigraine` rejected null pain. It also silently rejected active records older than seven days. Valid timestamp-only and long-running records now survive validation.
3. **Feedback added work.** Starting, updating pain, and completing an attack opened extra confirmation dialogs. Completing an attack could launch a medication-effectiveness questionnaire.
4. **Features blocked the core path.** Chart.js and jsPDF were eagerly loaded even when someone only wanted to save a start time. The first visit opened a welcome/tour dialog. The screen wake lock defaulted on.
5. **Updates interrupted sessions.** Service worker activation and a timed update could reload an open form. New updates now wait for an explicit Update action.
6. **Maintenance was concentrated in one file.** The base `index.html` contained 16,095 lines. CI duplicated the local validators and installed global validation packages it did not use.
7. **Persistence feedback could be misleading.** Saves were not awaited on the core start/end paths; encrypted persistence could return false without surfacing a failure. A full localStorage mirror could also make a successful IndexedDB save look unsuccessful. These core paths now wait for a successful store and report failures.

## This draft

| Surface | Main job | Optional material |
| --- | --- | --- |
| Today, no attack | Start migraine, saving the time immediately | Start with details |
| Today, active attack | Update pain, log medication, end migraine | Symptoms, triggers, relief, start-time editing |
| History | Calendar and completed records | Existing detail/edit controls |
| More | Choose a task when ready | Insights, doctor visit, settings/backup, help |

The interface uses the existing warm-dark identity, flat surfaces, readable labels, large controls, and a three-item bottom navigation. The primary Today controls do not animate. Warm-light and high-contrast themes remain available.

Code is separated into a page shell, shared component styles, and scripts for tracking, feature logic, storage, device features, and updates. Charts and PDF generation load their pinned, integrity-checked libraries on demand. All newly extracted local runtime files are included in the offline shell cache. Existing data fields, storage keys, encryption format, import/export behavior, and advanced features are retained.

Superseded mockup and design plans moved to `docs/archive`. The README now describes the current source layout. CI uses the same local validators and regression suite, including the external scripts.

## Validation performed

- JavaScript syntax checks on individual files and the combined classic-script scope.
- PWA and security validators, including extracted application scripts.
- Static HTML nesting, unique IDs, primary navigation, and offline asset references.
- Ten Node regression tests: timestamp-only reload through IndexedDB and localStorage, duplicate starts, score/date validation, save failure recovery, localStorage quota fallback, encrypted success/failure routing, asset coverage, stale-mirror protection, and end-attack success/failure.

Storage and DOM boundaries in the regression tests use test doubles. They do not prove real-browser IndexedDB transactions, encryption round trips, service worker lifecycle, or mobile layout.

## Deliberate limits and remaining cleanup

- **Pain is still required at completion if it was never recorded.** Reports, import validation, and some averages currently assume numeric pain for completed records. A later change should allow “not recorded” throughout; substituting zero would corrupt the data.
- **More is a first reorganization.** Existing Insights, Care, and Settings content remains extensive. These need a second information-design pass after the primary logging direction is reviewed.
- **Shared globals remain.** `app.js` still contains substantial feature code. Further extraction should use explicit interfaces and data-contract tests, rather than removing code solely because it is out of view.
- **Legacy warnings remain.** The security scanner reports 30 inline event handlers, 93 dynamic HTML assignments, and 152 console statements. These are review items, not evidence that every assignment is vulnerable. No claim of a completed security audit is made.
- **Historical help pages need a follow-up copy pass.** The README and this guide describe the new navigation; older help pages may still describe the previous layout.
- **No live deployment or browser/device QA was performed.** This is a code review draft, not a production release.

## Acceptance check before release

Use a test browser profile and a backup of any real data. Check iPhone-sized and desktop layouts, all three themes, keyboard/screen-reader navigation, and 200% text sizing. Start with no score, close/reopen, add medication and pain, end, then review/edit history and export/import. Repeat offline after initial loading and with encryption enabled. Confirm updates wait for a deliberate action and previously recorded history remains intact.

The first product review question: **Can you open this while in pain, save what matters, and comfortably put the phone down?**
