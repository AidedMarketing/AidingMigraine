const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
let failures = 0;
for (const file of files) {
    if (!fs.existsSync(file) || /\.(png|jpg|jpeg|gif|pdf)$/.test(file)) continue;
    if (/(^|\/)\.env(?:\.|$)/.test(file) && !file.endsWith('.example')) {
        console.error(`Tracked environment file: ${file}`); failures++; continue;
    }
    const source = fs.readFileSync(file, 'utf8');
    const pattern = /(?:ADMIN_API_KEY|VAPID_PRIVATE_KEY)\s*[:=]\s*["']?([A-Za-z0-9_-]{40,})/g;
    for (const match of source.matchAll(pattern)) {
        // Report the location only. A scanner must never repeat a secret in CI logs.
        const line = source.slice(0, match.index).split('\n').length;
        console.error(`Possible published credential: ${file}:${line}`); failures++;
    }
    if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----\s*[A-Za-z0-9+/=\r\n]{80,}\s*-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(source.replace(/\\n/g, '\n'))) {
        console.error(`Private key material: ${file}`); failures++;
    }
}
if (failures) process.exit(1);
console.log('Tracked files contain no detected credential literals or private keys.');
