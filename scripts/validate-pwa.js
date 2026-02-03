#!/usr/bin/env node

const fs = require('fs');

console.log('🔍 Validating PWA configuration...\n');

let exitCode = 0;
let warnings = [];

// Validate manifest.json
try {
  console.log('📄 Checking manifest.json...');

  if (!fs.existsSync('manifest.json')) {
    console.error('❌ manifest.json not found');
    exitCode = 1;
  } else {
    const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));

    // Check required fields
    const requiredFields = ['name', 'short_name', 'start_url', 'display'];
    const missingFields = requiredFields.filter(field => !manifest[field]);

    if (missingFields.length > 0) {
      console.error('❌ Missing required fields in manifest.json:', missingFields.join(', '));
      exitCode = 1;
    } else {
      console.log('✅ manifest.json is valid');
      console.log(`   Name: ${manifest.name}`);
      console.log(`   Display: ${manifest.display}`);
      console.log(`   Icons: ${manifest.icons ? manifest.icons.length : 0}\n`);
    }

    // Check icons
    if (!manifest.icons || manifest.icons.length === 0) {
      warnings.push('⚠️  No icons defined in manifest.json');
    }
  }
} catch (error) {
  console.error('❌ Error parsing manifest.json:', error.message);
  exitCode = 1;
}

// Validate service worker registration
try {
  console.log('📄 Checking service worker registration...');
  const html = fs.readFileSync('index.html', 'utf8');

  if (!html.includes('serviceWorker.register')) {
    console.error('❌ No service worker registration found in index.html');
    exitCode = 1;
  } else if (!html.includes('service-worker.js')) {
    console.error('❌ service-worker.js not referenced in index.html');
    exitCode = 1;
  } else {
    console.log('✅ Service worker is properly registered\n');
  }

  // Check if service worker file exists
  if (!fs.existsSync('service-worker.js')) {
    console.error('❌ service-worker.js file not found');
    exitCode = 1;
  }
} catch (error) {
  console.error('❌ Error checking service worker:', error.message);
  exitCode = 1;
}

// Check PWA requirements
try {
  console.log('📄 Checking PWA requirements...');
  const html = fs.readFileSync('index.html', 'utf8');

  let issues = [];

  // Check for manifest link
  if (!html.includes('manifest.json')) {
    issues.push('❌ manifest.json not linked in HTML');
  }

  // Check for viewport meta tag
  if (!html.includes('viewport')) {
    issues.push('❌ Missing viewport meta tag');
  }

  // Check for theme color
  if (!html.includes('theme-color')) {
    warnings.push('⚠️  Missing theme-color meta tag');
  }

  // Check for icons
  if (!html.includes('apple-touch-icon')) {
    warnings.push('⚠️  Missing apple-touch-icon for iOS');
  }

  if (issues.length > 0) {
    console.error('PWA Requirements Failed:');
    issues.forEach(issue => console.error('  ' + issue));
    exitCode = 1;
  } else {
    console.log('✅ PWA requirements met\n');
  }
} catch (error) {
  console.error('❌ Error checking PWA requirements:', error.message);
  exitCode = 1;
}

// Validate notification server (if exists)
if (fs.existsSync('notification-server/package.json')) {
  try {
    console.log('📄 Checking notification server...');
    const pkg = JSON.parse(fs.readFileSync('notification-server/package.json', 'utf8'));

    if (!pkg.scripts || !pkg.scripts.start) {
      console.error('❌ Missing start script in notification-server/package.json');
      exitCode = 1;
    } else {
      console.log('✅ Notification server configuration is valid\n');
    }

    if (fs.existsSync('notification-server/index.js')) {
      const { execSync } = require('child_process');
      try {
        execSync('node -c notification-server/index.js', { stdio: 'pipe' });
        console.log('✅ Notification server code syntax is valid\n');
      } catch (e) {
        console.error('❌ Notification server code has syntax errors');
        console.error(e.stderr.toString());
        exitCode = 1;
      }
    }
  } catch (error) {
    console.error('❌ Error validating notification server:', error.message);
    exitCode = 1;
  }
}

// Display warnings
if (warnings.length > 0) {
  console.log('\nWarnings:');
  warnings.forEach(warning => console.warn('  ' + warning));
  console.log('');
}

if (exitCode === 0) {
  console.log('✅ All PWA validation passed!\n');
} else {
  console.error('❌ PWA validation failed\n');
}

process.exit(exitCode);
