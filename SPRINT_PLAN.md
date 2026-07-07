# Aiding Migraine — Full App Review & Sprint Plan

**Date:** 2026-07-07 · **App version audited:** 4.0.0 · **Scope:** full codebase (index.html, service-worker.js, manifest.json, notification-server/, scripts/, CI, docs) + 2026 migraine-app market comparison

> Line numbers reference the files as of this audit and may drift as fixes land. Each item is written so any developer can pick it up independently.

---

## Executive Summary

The app has strong bones — a genuinely local-first data model, a weather/barometric engine more advanced than most paid competitors, rich medication tracking with MOH (medication-overuse headache) detection — but the v4.0.0 "production release" ships with **critical data-integrity bugs** (deleted data resurrects on reload; pain-0 entries are destroyed), **real security holes** (an SSRF-able push endpoint, an unauthenticated push relay, `onclick` allowlisted through DOMPurify, and 97 `git filter-repo` artifact files still tracked after the secret-purge history rewrite), **two shipped-but-broken features** (voice logging throws on any command; background sync silently deletes queued data), and **privacy copy that is factually wrong** for a privacy-first product.

On the market side, the biggest feature gaps vs. every 2026 competitor are: no symptom/aura capture, no trigger tracking UI, no MIDAS/HIT-6 disability scores in the doctor report, and no one-tap "attack mode" logging.

**This sprint:** fix the P0 list. **Next:** P1 quality/trust/CI. **Then:** P2 competitive features, in the market-priority order below.

---

## Market Position (2026)

### Competitor landscape

| App | Positioning | Strengths | Weaknesses / user complaints |
|---|---|---|---|
| **Migraine Buddy** | Most-downloaded tracker | Thorough logging (head diagram, symptoms, triggers), community, "remind me later" deferred logging | Notification spam, forced account, $4.99/mo–$29.99/yr premium paywall for insights/weather/reports |
| **MigrAid** | Minimalist, privacy-first | One-tap logging, 16-zone head-pain map, dedicated prodrome tracking (8 symptom types), auto weather/pressure, built-in MIDAS calculator, PDF/CSV export with date ranges | Newer, smaller feature surface |
| **Pressure Pal** | Weather-trigger specialist | Real-time barometric tracking + personalized pressure alerts | Single-purpose |
| **Bearable** | Multi-condition health tracker | Best when migraine is part of a larger health picture | Not migraine-specialized |
| **Claru** | Holistic "health intelligence" | Most comprehensive UX per 2026 reviews | Breadth over depth |

### What users consistently want (review/community sentiment)

1. **Logging in under 30 seconds during an attack** — photophobia makes every screen-second painful; if logging is slow, users skip days and the data becomes useless. The loudest single demand.
2. **True privacy** — no data selling, no forced accounts.
3. **No subscription** — paywall resentment is the top Migraine Buddy complaint category.
4. **Automatic weather/pressure capture** — barometric pressure is the most-cited trigger; manual tracking misses it.
5. **Prodrome tracking** — emerging differentiator.
6. **Clinician-ready exports** — MIDAS/HIT-6 scores in the report, not just raw logs.
7. **Not too many notifications** — Migraine Buddy's #1 complaint.

### Where Aiding Migraine stands

**Edge:** free, offline-first, genuinely local storage, no account, and a weather engine (60-day pressure history, personal sensitivity profiling, risk prediction) stronger than everything except Pressure Pal.

**Gaps:** no symptoms/aura, no triggers UI, no disability scores, no head-pain map, no one-tap logging — and the P0 bugs below undermine the privacy-first promise the whole product stands on.

---

## Priority System

- **P0 — Critical (this sprint):** data loss, security holes, false claims, broken shipped features
- **P1 — Quality/trust (this sprint if capacity, else next):** UX polish, accessibility, CI honesty, backend hygiene
- **P2 — Competitive features (next sprints):** market-driven, ordered by user demand
- **P3 — Later:** valuable but not differentiating right now

---

## P0 — Critical Fixes

### A. Data integrity (frontend `index.html`)

**P0-1. Deleted data resurrects on reload.**
`saveData()` (~3723) only `put`s in-memory rows to IndexedDB; it never deletes. Every hard-delete path — `confirmPermanentDelete` (5465), `confirmEmptyTrash` (5500), `purgeOldDeletedEpisodes` (5282), `confirmClearAll` (7446) — splices the array only, and `loadData()` (3666) re-reads **all** rows on launch. "Clear All Data" clears localStorage but not the IndexedDB migraines store, so **all "deleted" data returns on next launch**.
*Fix:* call `IDB.delete`/`clear` in each delete path. Working helpers exist (`permanentlyDeleteMigraine` 11744, `deleteMigraineFromIDB` 11732) but are dead code with an incompatible field model — they read `isDeleted`/`isArchived`/`date`/`pain` while the app writes `deleted`/`deletedAt`/`startTime`/`painLevel`. Reconcile to one model, fix the IDB indexes declared on non-existent fields (11433–11437), and note `archiveOldMigraines` (11803) does `new Date(migraine.date)` → `Invalid Date`, so "Archive Old Data" (wired 12491) has never archived anything.
*Verify:* delete an episode → empty trash → reload → gone. Clear All → reload → empty. Archive Old Data actually moves records.

**P0-2. Pain level 0 destroys data.**
UI offers "0 – No pain" (2318) but `validateActiveMigraine` (3648) uses falsy `!migraine.painLevel` → a 0-pain active episode is treated as corrupt and wiped on reload; `validateEpisodes` (6386) requires `painLevel >= 1` → 0-pain entries fail JSON re-import; tour copy says "1–10" (7530).
*Fix:* explicit `painLevel == null` checks; accept 0–10 everywhere; align copy.
*Verify:* log pain-0 active episode → reload → still active. Export JSON containing a pain-0 entry → import → accepted.

**P0-3. Auto-lock TypeError.**
`initializePhase1Settings` (12598) declares `const autoLockDelay = document.getElementById(...)`, shadowing the outer `let autoLockDelay` number (12410). Line 12623 assigns the element to its own `.value`; the change handler (12628) assigns to the `const` → **"Assignment to constant variable"** and the delay never updates.
*Fix:* rename the element variable.
*Verify:* change auto-lock delay in Settings → no console error → new delay takes effect.

**P0-4. `exportJSON` stamps `appVersion: '3.2.0'`** (6132) while the app is 4.0.0 — misleads any future import/version logic. Fix to the real version (single source it if possible).

**P0-5. Weather v4→v5 migration never persists.**
`initWeatherTracking` (8594) gates the post-migration save on `loaded.version !== 4`, so a genuine v4 blob migrates in memory but is never saved — it re-migrates every launch. Fix the inverted condition.

### B. Security (frontend + backend)

**P0-6. Remove tracked `.git-rewrite/` artifacts (97 files).**
Leftovers from the `git filter-repo` secret purge (see `SECURITY_REMEDIATION.md`) are still committed — including `map/*` old→new SHA mappings that partially defeat the history rewrite. `.gitignore:37` lists the directory but gitignore doesn't untrack committed files.
*Fix:* `git rm -r --cached .git-rewrite`, commit, and re-audit that no purged secrets remain reachable through these artifacts.
*Verify:* `git ls-files | grep git-rewrite` → empty.

**P0-7. Push-endpoint allowlist is a no-op on `/subscribe` (SSRF).**
`middleware/auth.js:44` reads `req.body.endpoint || req.body.subscriptionEndpoint`, but `routes/subscriptions.js:26` nests it at `req.body.subscription.endpoint` — so `validateEndpoint` early-returns (auth.js:47) and the HTTPS + push-service-domain allowlist (auth.js:51–85) is silently skipped on the main subscribe route. An attacker can register an arbitrary (e.g. internal) URL that the server will later POST to from `push-notifications.js:49`.
*Fix:* check the nested path; also require `subscription.keys` (p256dh/auth) at subscribe time (currently unvalidated → guaranteed send failures later).
*Verify:* POST /subscribe with `subscription.endpoint = "https://evil.internal/"` → 400.

**P0-8. Unauthenticated push relay.**
`POST /api/notifications/send-test` (routes/notifications.js:57) has no admin auth and no endpoint validation — anyone can make the server sign and send Web Push (with our VAPID key) to any endpoint they supply. Combined with P0-7 this is a free SSRF/abuse relay.
*Fix:* gate behind `requireAdminAuth` (or compile out in production) + run `validateEndpoint`.
*Verify:* unauthenticated POST → 401.

**P0-9. `safeHTML` allowlists `onclick`/`onchange`; `showModal` bypasses DOMPurify.**
`safeHTML` (3443) passes `ALLOWED_ATTR` including `onclick` and `onchange` (3447) — explicitly re-opening the hole DOMPurify exists to close, and violating the repo's own "no inline event handlers" rule. `showModal` (7462) assigns `modal-body.innerHTML = content` with **no sanitization**, while callers like `reviewConflicts` interpolate imported medication text raw (6577, 6585). `searchMedications` (3888) builds `onclick="selectMedication('${...}')"` with only manual quote-escaping; import modals stuff entire JSON payloads into onclick attributes (6537–6543, 6598–6600).
*Fix (P0 scope):* drop event-handler attrs from ALLOWED_ATTR; sanitize `showModal` content with DOMPurify; convert the medication-search and import-modal handler generators to `addEventListener`/data-attributes. (Sweeping all 55 inline handlers app-wide is P1.)
*Verify:* import a JSON backup whose medication name contains `<img src=x onerror=alert(1)>` → renders inert.

**P0-10. CSV formula injection.**
`exportCSV` (6669) quotes fields but doesn't neutralize leading `=`, `+`, `-`, `@` — a note like `=HYPERLINK(...)` becomes a live formula when the doctor-report CSV opens in Excel/Sheets.
*Fix:* prefix-escape (`'`) cells starting with those characters.
*Verify:* export a note starting with `=1+1` → opens as text.

**P0-11. Scheduler crash + race-prone JSON storage (backend).**
`database.js:143` derefs `sub.preferences.dailyCheckIn.enabled` with only a `preferences` null-check — one record missing `dailyCheckIn` (reachable; `validatePreferences` auth.js:113 doesn't require it) throws inside the hourly job (scheduler.js:66) and **aborts daily check-ins for all users**. Separately, every mutator (`addSubscription` :110, `removeSubscription` :117, `updateSubscriptionPreferences` :125, `addScheduledFollowup` :180, `markFollowupAsSent` :197, `addScheduledActiveCheckin` :207, `markActiveCheckinAsSent` :224, `cancelActiveCheckin` :231) calls `save*()` **without await** — routes return 200/201 before the write lands, failures become unhandled rejections, and concurrent requests interleave non-atomic whole-file `fs.writeFile` rewrites (:90–98) → lost or corrupted data.
*Fix:* null-guard `dailyCheckIn`; await all saves and surface failures as 500s; write atomically via temp-file + `rename`.
*Verify:* insert a subscription without `dailyCheckIn` into subscriptions.json → hourly job completes; parallel subscribe requests → both persisted.

**P0-12. Rate limiting broken behind Render's proxy; `strictLimiter` dead.**
No `app.set('trust proxy', ...)` — behind Render's reverse proxy, express-rate-limit v8 (`^8.2.1`) either throws `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` or buckets all users under one proxy IP. `strictLimiter` (index.js:74–78, 10 req/min) is defined but never applied — the sensitive `schedule-*`, `send-test`, and admin routes run under the loose 100/15min limiter only.
*Fix:* `app.set('trust proxy', 1)`; apply `strictLimiter` to the sensitive routes.

### C. Broken shipped features — REMOVE BOTH (decision confirmed)

**P0-13. Remove the background-sync stub — it silently discards user data.**
`service-worker.js:281–286` and `processSyncQueue` (index.html:11865–11879) iterate the IndexedDB `syncQueue`, log "Synced item", then **delete the item without sending it anywhere** ("In a real app, this would sync to a server"). Meanwhile index.html:11854 registers `sync-data` and enqueues real `migraine_update` items → any change queued offline is dropped with no error. The app is local-first with no user-data server; there is nothing to sync to.
*Fix:* remove the SW sync handler, the in-app queue processing/enqueueing, and the Settings "background sync status" display. Keep the data in the local stores (which is where it already lives authoritatively).
*Verify:* no `sync-data` registration; Settings shows no sync status; grep for `syncQueue` usage → only removal or storage cleanup remains.

**P0-14. Remove voice logging — it throws on every command.**
`processVoiceCommand` (12218) calls `selectPain(painLevel)` (12229, 12239) and `startActiveMigraine()` (12240) — **neither function exists anywhere** → `ReferenceError` on any spoken command, yet the feature is advertised in Settings (3145).
*Fix:* remove the voice button, feedback UI, Settings toggle, and recognition code. A correctly built voice-logging feature is queued in P3 (it genuinely fits attack-time ergonomics).
*Verify:* Settings has no voice toggle; no SpeechRecognition references remain.

### D. Honesty fixes

**P0-15. Privacy copy is factually wrong.**
The app states "No cloud uploads. No servers, no tracking, no analytics" (7409–7410), "Nothing is sent to any server" (7497), "Privacy-first — all data stays on your device" (3101). In reality (opt-in): notifications POST the push subscription, timezone, check-in times, and attack IDs (which are onset timestamps) to `aiding-migraine-notifications.onrender.com` (8031, 8202, 8249, 8298, 8340); weather sends city/ZIP and precise GPS lat/lon to open-meteo.com and nominatim.openstreetmap.org (8784, 8837, 8951, 9480).
*Fix:* reword everywhere to: local by default; optional weather sends location to Open-Meteo/Nominatim; optional notifications send subscription + schedule metadata to our notification server; nothing else, ever. For a privacy-first product this copy **is** the brand — it must be precise. Update help/privacy.html to match.

**P0-16. Biometric lock oversell.**
`authenticateBiometric` (12342) accepts any assertion object; data remains unencrypted in IndexedDB/localStorage; the lock only hides the UI and is bypassed by clearing one storage flag. Soften "Secure your health data" (3185) to "screen lock / privacy shield" language. Real at-rest encryption is P3.

---

## P1 — Quality, Trust, CI

1. **UI text artifacts** from an emoji→word replacement sweep: "Notification Enable Notifications" (2887), "Calendar Daily Check-in" (2898), "Active Active Attack Check-in" (2925), "Weather Weather Conditions" (5840), "Trash Clear All Data" (3321), "Notification iOS Notification Setup" (3299), "Save IndexedDB Status" (3357), "Save Existing"/"Import Importing" (6572/6580), "Calendar Last 7 Days" (6996). Sweep the whole file; these read as broken and confuse screen readers.
2. **Chart theme bug:** `getChartColors` (10483) and the pressure chart (11017) decide dark-mode via `getAttribute('data-theme') !== 'light'`, but themes are `warm-dark`, `warm-light`, `high-contrast`, `light` — so **warm-light gets dark chart colors on a light background**. Match against the real theme list.
3. **Validators/CI give false confidence:** `validate-security.js` reads only index.html + service-worker.js — it never scans `notification-server/` (where the real holes were), and `html.match || sw.match` short-circuits so the SW is often unchecked. `validate-pwa.js` syntax-checks only `notification-server/index.js` — a syntax error in database.js/scheduler.js/routes/middleware passes CI — and doesn't verify installability essentials (192+512 icons, maskable). CI (`.github/workflows/ci.yml`) **reimplements** validator logic inline instead of running `npm test`, so they drift; no `npm audit`, no lint, no runtime tests.
   *Fix:* validators scan all server files; CI runs the real `npm test` + `npm audit`; add Dependabot.
4. **Notification-server hygiene:** prune sent follow-ups/check-ins — the JSON stores grow forever and every scheduler tick rescans them (database.js:184, :211); `weekly` frequency is accepted by validation (auth.js:134) but silently behaves as **daily** (database.js:164–170), and `every-other-day` keys off global calendar parity, not per-user; active check-in IDs (`active-checkin-${attackId}`, notifications.js:114) aren't deduped so re-scheduling can double-fire; CORS rejection returns **500** instead of 403 (index.js:36) and `ALLOWED_ORIGINS` defaults to localhost with no startup check that a production origin is configured; stored `utcMinutes` (index.html:8024) is ignored by the hour-granular cron (scheduler.js:27, database.js:159) — honor it or stop collecting it; use `crypto.timingSafeEqual` for the admin key compare (auth.js:28).
5. **Service worker:** the fetch handler (service-worker.js:69) intercepts **all** requests — `cache.put(POST)` on API calls throws in a dangling promise (:102–104), and a failed API call falls back to cached **HTML** handed to JSON-expecting code (:109). Guard to same-origin GETs; return a proper network error for API paths. Also: server push type `active-attack-checkin` (push-notifications.js:124) matches no action branch in the SW (:170–180) — those notifications get no buttons.
6. **Accessibility pass:** calendar days are click-only `<div>`s (5773) — add `role="button"`, `tabindex="0"`, Enter/Space handlers, aria-labels (same for medication search results, 3888); modals (`#modal`, `#debug-modal`) need `role="dialog"`, `aria-modal`, Escape-to-close, focus trap and focus return (currently only backdrop click, 7705); add text equivalents where severity/trend is color-only; visible focus styles on toggle switches.
7. **Performance:** Chart.js + jsPDF load eagerly in `<head>` (2070–2071) — lazy-load on first analytics/PDF use (CLAUDE.md already claims this happens); `saveData` (3728) rewrites **every** migraine on every save — write only changed records; strip or gate the emoji/`[DEBUG]` console noise (3482, 3532, 5779, 5984, 9074, scheduler.js, service-worker.js:270); replace the `retryUntilSuccess` polling init (3479) and the 500ms `setTimeout` races across two `DOMContentLoaded` handlers (11904, 12649) + `window.load` (12721) with deterministic init.
8. **Unify the two edit flows:** history's `editEpisode` (5104: meds/notes/relief only) vs. calendar's `editAttack` (4583: dates/times/pain only) — one modal covering times, pain, medications, notes, relief methods.
9. **Docs truth pass (after fixes land):** CLAUDE.md says ~8.5k lines (it's ~12.8k) and "Chart.js lazy-loaded" (it isn't yet); `ML_FEATURES_DOCUMENTATION.md` overstates heuristic risk-scoring as ML; README/CHANGELOG/`SECURITY_COMPLETION_SUMMARY.md` present an audited production release that this review contradicts — update all once P0/P1 are done.

---

## P2 — Competitive Features (market-priority order)

1. **Symptoms & aura tracking** — nausea, photophobia, phonophobia, vomiting, neck pain; aura presence/type/duration. Table stakes in every competitor; currently symptoms exist only as *medication side effects*. Touches: log flow, entry model, history, analytics, PDF report.
2. **Trigger tracking UI** — the `triggers` field already exists in `sanitizeEpisode` (6317) but has no UI. Preset chips (stress, poor sleep, skipped meal, alcohol, caffeine, screens, dehydration; weather auto-filled from the existing engine) + free text + trigger-correlation analytics. Cheap to add, pairs perfectly with the weather engine.
3. **MIDAS + HIT-6 questionnaires** — the standard clinical disability instruments, computed in-app and embedded in the doctor PDF (7067 currently exports frequency/pain/duration/weather only). MigrAid ships MIDAS as a headline feature; this is the #1 clinical-export gap.
4. **Surface the ML/risk predictions** — `trainMigrainePredictionModel` (10343), `predictMigraineProbability` (10445), `generatePredictiveAlerts` (10227) already compute risk **but no UI ever shows it**. Quick win: a risk card on Today + optional pressure alert. Differentiator vs. everything except Pressure Pal.
5. **One-tap "attack mode" logging** — single button starts an episode with defaults + auto-weather; details fillable later ("remind me later" is the most-praised Migraine Buddy pattern). Sub-30-second logging is the loudest user demand in the category. Also: an in-attack dark/minimal UI mode.
6. **Prodrome/postdrome phase tracking** — emerging differentiator (MigrAid tracks 8 prodrome symptom types).
7. **Head-pain location map + pain quality** — zone diagram (MigrAid: 16 zones; Migraine Buddy: head diagram), laterality, throbbing vs. pressure.
8. **Menstrual/hormonal cycle tracking** — one of the strongest migraine correlates; weak in most competitors, fits our correlation engine.

## P3 — Later

- **Real at-rest encryption** behind the lock (WebCrypto, key wrapped via passkey/WebAuthn) — makes the P0-16 copy true again, stronger.
- **Sleep & hydration logging** (already referenced by the risk science, not user-loggable).
- **Manifest upgrades:** `screenshots` (richer install UI), `id`, `share_target`; more shortcuts.
- **Rebuilt voice logging** (removed in P0-14) — attack-time ergonomics justify doing it properly.
- **Backend:** Express 5, SQLite instead of JSON files, server-side prune job.
- **Explicitly deprioritized:** community/social features — our differentiator is privacy, not community.

---

## Remove List (explicit)

| Item | Why |
|---|---|
| `.git-rewrite/` tracked artifacts (97 files) | Leak SHA maps from the secret-purge rewrite (P0-6) |
| Background-sync stub (SW + app + Settings status) | Silently deletes queued data; nothing to sync to (P0-13) |
| Voice-logging feature | Calls undefined functions; throws on every use (P0-14) |
| Dead IDB helper layer *or* the ad-hoc paths duplicating it | Two incompatible data models; keep exactly one, wired correctly (P0-1) |
| `send-test` endpoint from production surface | Unauthenticated push relay (P0-8) |
| "Nothing leaves your device" claims; "ML" overstatement in docs | Factually wrong; trust is the brand (P0-15, P1-9) |

---

## Sprint Verification Checklist (P0 exit criteria)

- [ ] Delete episode → empty trash → reload → gone; Clear All → reload → empty (P0-1)
- [ ] Pain-0 episode survives reload and JSON export→import round-trip (P0-2)
- [ ] Auto-lock delay change works with no console error (P0-3)
- [ ] Exported JSON shows the real app version (P0-4)
- [ ] Weather config migrates once and persists (P0-5)
- [ ] `git ls-files | grep git-rewrite` → empty (P0-6)
- [ ] `/subscribe` rejects non-allowlisted endpoints; `send-test` requires admin key (P0-7/8)
- [ ] Malicious medication name in imported JSON renders inert; no `onclick`/`onchange` in ALLOWED_ATTR (P0-9)
- [ ] CSV cell starting `=` opens as text in Excel/Sheets (P0-10)
- [ ] Malformed subscription record doesn't abort the scheduler; concurrent subscribes both persist (P0-11)
- [ ] `trust proxy` set; strict limiter active on sensitive routes (P0-12)
- [ ] No background-sync or voice-logging code/UI remains (P0-13/14)
- [ ] Privacy copy accurately describes the two opt-in network features, in-app and in help/privacy.html (P0-15/16)
- [ ] `npm test` passes; manual smoke test of log → end episode → history → analytics → export on all four themes

---

## Sources (market research)

- [Best Migraine Tracker Apps in 2026: Honest Comparison (Migra)](https://getmigra.com/blog/best-migraine-tracker-app-2026/)
- [Best Migraine Tracker App: A Comprehensive Review for 2026 (Pressure Pal)](https://pressurepal.app/blog/best-migraine-tracker-app/)
- [MigrAid vs Migraine Buddy](https://migraid.app/blog/migraid-vs-migraine-buddy)
- [Halstead Research 2026 Rankings of Migraine Tracking Apps](https://www.barchart.com/story/news/1158076/halstead-research-releases-its-2026-rankings-of-the-best-migraine-tracking-apps-and-tools)
- [Migraine Buddy — App Store reviews](https://apps.apple.com/us/app/migraine-buddy-track-headache/id975074413?see-all=reviews)
- [Migraine Buddy reviews (JustUseApp)](https://justuseapp.com/en/app/975074413/migraine-buddy/reviews)
- [8 of the best migraine apps (Medical News Today)](https://www.medicalnewstoday.com/articles/319508)
- [Reviewed: Top 5 Migraine Tracking Apps (Axon Optics)](https://axonoptics.com/blogs/post/top-5-migraine-tracking-apps)
