#!/usr/bin/env bash
# Stage replacement credentials locally; Render and subscriptions are unchanged.
set -euo pipefail
cd "$(dirname "$0")"
umask 077
node <<'NODE'
const fs = require('node:fs');
const crypto = require('node:crypto');
const webPush = require('web-push');
const keys = webPush.generateVAPIDKeys();
const adminKey = crypto.randomBytes(32).toString('hex');
const file = '.env.rotated';
fs.writeFileSync(file, [
    `VAPID_PUBLIC_KEY=${keys.publicKey}`,
    `VAPID_PRIVATE_KEY=${keys.privateKey}`,
    `ADMIN_API_KEY=${adminKey}`, ''
].join('\n'), { flag: 'wx', mode: 0o600 });
console.log(`Replacement credentials staged in ${file}; private values were not logged.`);
console.log('Copy these values into Render Environment, then deploy the server and updated app.');
console.log('Users must re-enable notifications to unregister the old VAPID pair and register the new pair.');
console.log('New server keys do not revoke old browser subscriptions or erase git history.');
console.log('See ../docs/SECURITY-REVIEW-2026-10-06.md before deployment.');
NODE
