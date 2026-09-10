const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const scripts = [...html.matchAll(/<script[^>]*src=["'](\.\/[^"']+)["'][^>]*>/g)].map(match => match[1].split('?')[0]);
module.exports = { html, scripts, source: html + '\n' + scripts.map(file => fs.readFileSync(file, 'utf8')).join('\n') };
