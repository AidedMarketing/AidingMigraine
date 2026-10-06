# Security review — 6 October 2026

## Immediate credential response

Published admin key literals were found in `notification-server/README.md` and
`RENDER_SETUP_GUIDE.md`. VAPID private-key literals were also present in those
guides and `QUICKSTART.md`. The private key in `RENDER_SETUP_GUIDE.md` was verified
to derive the VAPID public key configured in the frontend before this change.
Treat that pair as compromised. A historical `notification-server/.env` was
also committed and later deleted. No private values are repeated in this report.

Current-file examples now use placeholders. Credential fingerprints in
`notification-server/retired-credentials.json` prevent starting this version
with known published admin/private keys. These are SHA-256 fingerprints, not
credentials. Deleting files or merging this change does not remove git history
and does not rotate the live Render environment.

1. On a trusted machine, install backend dependencies with `npm ci` in
   `notification-server`, then run `bash rotate-credentials.sh`. It writes a new,
   gitignored `.env.rotated` with restricted permissions and prints no secrets.
   It refuses to overwrite an existing file.
2. In Render Environment, replace `ADMIN_API_KEY`, `VAPID_PRIVATE_KEY`, and
   `VAPID_PUBLIC_KEY` with the newly generated values. Preserve `VAPID_SUBJECT`.
   Update any administrative clients with the new admin key.
3. Set `NODE_ENV=production` and
   `ALLOWED_ORIGINS=https://aidedmarketing.github.io`. Origins must be exact;
   repository URL paths and wildcards are rejected. Add additional real HTTPS
   origins only when actually serving the app there.
4. Deploy the backend with the new environment, then the updated frontend.
   The new browser code supplies ownership credentials for mutations; older
   browser releases cannot mutate subscriptions on the hardened backend.
5. Each device must re-enable notifications. The updated app fetches the new
   public key from `/api/public-key`, unregisters a mismatched browser push
   subscription, and registers the new pair. There is no private key in the
   frontend, and future key rotations need no hardcoded frontend key update.
6. Verify `/health`, public-key configuration, daily minute precision, one
   follow-up, and one active check-in. Verify the old admin key gets rejected.
   Delete the local staging file after storing credentials securely.

Changing server VAPID keys does **not** revoke already registered browser
subscriptions. Users must unregister the old subscription; an attacker with
the old private key and endpoint information may otherwise retain a sending
capability. Rotation is the first response. Coordinate any git-history rewrite
separately, including affected clones, forks and GitHub cached views; do not
force-push rewritten history during a normal application fix.

## Implemented controls

- CSP on the main document restricts scripts and API destinations; inline
  scripts, inline event handlers, frames, objects and form submissions are
  blocked. Styles retain `unsafe-inline` because current templates use inline
  style attributes. Scripts still permit two existing CDN hosts for lazy-loaded
  Chart.js/jsPDF, with their existing SRI checks. GitHub Pages does not allow
  configuring response headers; a future host should also supply header CSP
  with `frame-ancestors` (unsupported in a meta policy).
- All application HTML assignments pass through DOMPurify, except clearing
  content and the constant head-map SVG. A fixed action dispatcher replaces
  executable event attributes; interpolated action identifiers are escaped.
- Production browser/service-worker diagnostics are silent. Backend logs
  retain generic operation failures without raw errors, endpoints, credentials,
  reminder times or health-event identifiers.
- Admin authentication fails closed in every environment. Existing subscription
  changes require both browser-generated push keys; errors do not reveal whether
  another endpoint exists. Initial registration remains public and rate limited;
  this is a possession model, not a user-account authentication system. Conflicting
  public registration requests receive the same acknowledgment without overwriting
  an existing subscriber or revealing whether an endpoint exists.
- Scheduling, cancellation and replacement are scoped to the authenticated
  endpoint. Active reminder series schedule/cancel in one request so the existing
  10-per-minute limit does not truncate a 12-reminder series. Unsubscribing removes
  its pending queues. Endpoint HTTPS/domain,
  schedule, timezone, minute and preference validation and IP rate limits are
  tested. CORS is an additional browser restriction, not authentication.
- Episodes, active attacks, assessments, cycle data and custom medications use
  IndexedDB without a redundant plaintext localStorage mirror when primary
  transactions succeed. Legacy values migrate before removal, and transactions
  resolve after commit. Plaintext localStorage remains an offline fallback when
  IndexedDB fails. Optional passphrase encryption remains opt-in, protects the
  core health vault and wipes both health settings and legacy medication stores.
  IndexedDB itself is not encrypted by this change and does not protect against
  code already running in the origin. Weather and notification preferences are
  outside the encrypted health vault.

## Reminder hosting and durability

Render Free spins down after 15 minutes without inbound traffic and loses local
filesystem changes on sleep, restart or deploy. This server's JSON subscription
and reminder queues therefore require durable storage, not just atomic writes.
See [Render Free documentation](https://render.com/docs/free) and
[persistent disks](https://render.com/docs/disks).

For this single-instance file-backed server, use an always-running service with
a persistent disk mounted at `/var/data`, and set
`DATA_DIR=/var/data/aiding-migraine`. All three databases write under this path.
An external durable database is an alternative. `DB_PATH`, if supplied, selects
the subscription filename inside `DATA_DIR`; it does not configure the directory.
Do not run multiple instances against these JSON files.

The scheduler now checks once per minute with non-overlapping work, catches up
persisted queues on startup, honors local timezone/DST and reminder minutes,
and persists successful daily-delivery dates to avoid normal duplicate sends.
Provider retries and a crash between delivery and saving can still produce a
duplicate. Downtime can delay reminders, and ephemeral storage cannot recover
lost queues. Browser timers are only a fallback while the app is open. Do not
represent free hosting as a guaranteed reminder service.

## Validation and limits

Run `npm test` at the root, `npm test` in `notification-server`, and the mobile
and security browser tests after installing Playwright and its browsers.
CI exercises Chromium and WebKit, XSS payloads, blocked inline JavaScript,
legacy migration, encrypted-store cleanup, ownership isolation, CORS, limits,
schedule validation and local reminder timing. The credential scanner reports
file locations only and fails CI for detected tracked credential literals.

Repository source and reachable local history were checked for the identified
admin/VAPID assignment patterns; this is not an exhaustive audit of every
possible credential format, every remote ref, or the live Render configuration.
Render environment changes, service tier, disk setup and actual push delivery
must be verified in the hosting account. These account operations were not
performed as part of the source-code changes.
