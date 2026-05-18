#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 Validating HTML and JavaScript syntax...\n');

let exitCode = 0;

// Validate HTML structure
try {
  console.log('📄 Checking index.html...');
  const html = fs.readFileSync('index.html', 'utf8');

  if (!html.includes('<!DOCTYPE html>')) {
    console.error('❌ Missing DOCTYPE declaration');
    exitCode = 1;
  }
  if (!html.includes('<html')) {
    console.error('❌ Missing HTML tag');
    exitCode = 1;
  }
  if (!html.includes('</html>')) {
    console.error('❌ Missing closing HTML tag');
    exitCode = 1;
  }

  if (exitCode === 0) {
    console.log('✅ HTML structure is valid\n');
  }
} catch (error) {
  console.error('❌ Error reading index.html:', error.message);
  exitCode = 1;
}

// Validate service worker
try {
  console.log('📄 Checking service-worker.js...');
  execSync('node -c service-worker.js', { stdio: 'pipe' });
  console.log('✅ Service worker syntax is valid\n');
} catch (error) {
  console.error('❌ Service worker has syntax errors');
  console.error(error.stderr.toString());
  exitCode = 1;
}

// Validate inline JavaScript
try {
  console.log('📄 Checking inline JavaScript...');
  const html = fs.readFileSync('index.html', 'utf8');
  const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  let scriptNum = 0;
  let hasError = false;

  while ((match = scriptRegex.exec(html)) !== null) {
    scriptNum++;
    const script = match[1];

    // Skip empty scripts or external scripts
    if (!script.trim()) continue;

    // Write to temp file and check syntax
    const tempFile = path.join(os.tmpdir(), `temp-script-${scriptNum}.js`);
    fs.writeFileSync(tempFile, script);

    try {
      execSync(`node -c ${tempFile}`, { stdio: 'pipe' });
      console.log(`  ✅ Script block ${scriptNum} is valid`);
    } catch (e) {
      console.error(`  ❌ Script block ${scriptNum} has syntax errors`);
      console.error(e.stderr.toString());
      hasError = true;
    }
  }

  if (hasError) {
    exitCode = 1;
  } else {
    console.log('✅ All inline JavaScript is valid\n');
  }
} catch (error) {
  console.error('❌ Error validating inline JavaScript:', error.message);
  exitCode = 1;
}

if (exitCode === 0) {
  console.log('✅ All syntax validation passed!\n');
} else {
  console.error('\n❌ Syntax validation failed\n');
}

process.exit(exitCode);
