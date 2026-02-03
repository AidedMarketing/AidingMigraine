#!/usr/bin/env node

const fs = require('fs');

console.log('🔍 Checking for security issues...\n');

let warnings = [];
let errors = [];

try {
  const html = fs.readFileSync('index.html', 'utf8');
  const sw = fs.readFileSync('service-worker.js', 'utf8');

  // Check for inline event handlers (XSS risk)
  const inlineHandlers = html.match(/on(click|load|error|change|submit|mouseover|mouseout|keypress|keydown|keyup)=/gi);
  if (inlineHandlers) {
    warnings.push(`⚠️  Found ${inlineHandlers.length} inline event handler(s) - consider using addEventListener`);
  }

  // Check for eval usage
  if (html.includes('eval(') || sw.includes('eval(')) {
    errors.push('❌ Found eval() usage - potential security risk');
  }

  // Check for innerHTML with variables (potential XSS)
  const innerHTMLMatches = html.match(/innerHTML\s*=\s*(?!['"`])/g);
  if (innerHTMLMatches && innerHTMLMatches.length > 0) {
    warnings.push(`⚠️  Found ${innerHTMLMatches.length} dynamic innerHTML assignment(s) - verify XSS protection`);
  }

  // Check for document.write (can be dangerous)
  if (html.includes('document.write(') || sw.includes('document.write(')) {
    warnings.push('⚠️  Found document.write() usage - consider safer alternatives');
  }

  // Check for external script sources
  const externalScripts = html.match(/<script[^>]+src=['"](https?:\/\/[^'"]+)['"]/gi);
  if (externalScripts && externalScripts.length > 0) {
    console.log(`📄 Found ${externalScripts.length} external script(s):`);
    externalScripts.forEach(script => {
      const src = script.match(/src=['"](https?:\/\/[^'"]+)['"]/i);
      if (src) {
        console.log(`   - ${src[1]}`);
        // Check for SRI (Subresource Integrity)
        if (!script.includes('integrity=')) {
          warnings.push(`⚠️  External script without SRI: ${src[1]}`);
        }
      }
    });
    console.log('');
  }

  // Check for localStorage/sessionStorage usage (privacy concern)
  const storageUsage = (html.match(/localStorage|sessionStorage/g) || []).length;
  if (storageUsage > 0) {
    console.log(`📄 Found ${storageUsage} localStorage/sessionStorage usage(s)`);
    console.log('   ℹ️  Ensure sensitive data is properly handled\n');
  }

  // Check for console.log in production code (information disclosure)
  const consoleLogs = html.match(/console\.(log|debug|info|warn|error)/g);
  if (consoleLogs && consoleLogs.length > 10) {
    warnings.push(`⚠️  Found ${consoleLogs.length} console statements - consider removing in production`);
  }

  // Check for fetch/XMLHttpRequest without error handling
  const fetchCalls = (html.match(/fetch\(/g) || []).length;
  const xhrCalls = (html.match(/XMLHttpRequest/g) || []).length;
  if (fetchCalls + xhrCalls > 0) {
    console.log(`📄 Found ${fetchCalls + xhrCalls} network request(s)`);
    console.log('   ℹ️  Ensure proper error handling and HTTPS usage\n');
  }

  // Check for hardcoded credentials (common mistake)
  const credentialPatterns = [
    /password\s*=\s*['"]\w+['"]/gi,
    /api[_-]?key\s*=\s*['"]\w+['"]/gi,
    /secret\s*=\s*['"]\w+['"]/gi,
    /token\s*=\s*['"]\w+['"]/gi
  ];

  credentialPatterns.forEach(pattern => {
    const matches = html.match(pattern) || sw.match(pattern);
    if (matches) {
      errors.push(`❌ Found potential hardcoded credential: ${matches[0]}`);
    }
  });

} catch (error) {
  console.error('❌ Error reading files:', error.message);
  process.exit(1);
}

// Display results
if (errors.length > 0) {
  console.log('Security Errors:');
  errors.forEach(error => console.error('  ' + error));
  console.log('');
}

if (warnings.length > 0) {
  console.log('Security Warnings:');
  warnings.forEach(warning => console.warn('  ' + warning));
  console.log('');
}

if (errors.length === 0 && warnings.length === 0) {
  console.log('✅ No security issues detected\n');
} else if (errors.length === 0) {
  console.log('✅ No critical security issues detected\n');
  console.log('   (Some warnings were found - review above)\n');
} else {
  console.error('❌ Security validation failed\n');
  process.exit(1);
}
