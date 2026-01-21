#!/bin/bash
# Credential Rotation Script for Aiding Migraine Notification Server
# This script generates new credentials after a security incident

set -e

echo "==========================================="
echo " Aiding Migraine - Credential Rotation"
echo "==========================================="
echo ""
echo "⚠️  WARNING: This will generate NEW credentials."
echo "    Old credentials will need to be revoked manually."
echo ""
read -p "Continue? (y/N): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

echo ""
echo "Step 1: Generating new VAPID keys..."
echo "----------------------------------------"

# Check if web-push is installed
if ! command -v npx &> /dev/null; then
    echo "❌ Error: npx not found. Please install Node.js first."
    exit 1
fi

# Generate VAPID keys
echo ""
echo "Run this command to generate VAPID keys:"
echo "  npx web-push generate-vapid-keys"
echo ""
echo "Then update your .env file with:"
echo "  VAPID_PUBLIC_KEY=<public key from output>"
echo "  VAPID_PRIVATE_KEY=<private key from output>"
echo ""
read -p "Press Enter to generate VAPID keys now..."

npx web-push generate-vapid-keys

echo ""
echo "Step 2: Generating new Admin API key..."
echo "----------------------------------------"

ADMIN_API_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

echo ""
echo "New Admin API Key (save this securely!):"
echo "  ADMIN_API_KEY=$ADMIN_API_KEY"
echo ""
echo "Add this to your notification-server/.env file"

echo ""
echo "Step 3: Update .env file"
echo "----------------------------------------"
echo "Please update notification-server/.env with:"
echo ""
echo "1. New VAPID keys from Step 1"
echo "2. New Admin API key from Step 2"
echo "3. Updated ALLOWED_ORIGINS for production domains"
echo ""
echo "Example .env:"
cat <<'EOF'

# Server Configuration
PORT=3000
NODE_ENV=production

# VAPID Keys (from Step 1)
VAPID_SUBJECT=mailto:your-email@example.com
VAPID_PUBLIC_KEY=<paste_public_key_here>
VAPID_PRIVATE_KEY=<paste_private_key_here>

# Admin API Key (from Step 2)
ADMIN_API_KEY=<paste_admin_key_here>

# CORS Allowed Origins
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

EOF

echo ""
echo "Step 4: Update frontend with new VAPID public key"
echo "----------------------------------------"
echo "Update index.html with the new VAPID_PUBLIC_KEY:"
echo ""
echo "Search for 'applicationServerKey' in index.html and replace"
echo "the base64 string with your new VAPID public key."
echo ""

echo "Step 5: Revoke old credentials"
echo "----------------------------------------"
echo "✓ VAPID keys: Old keys are automatically invalidated when you deploy new ones"
echo "! Admin API key: Update any scripts/tools using the old key"
echo ""

echo "Step 6: Deploy new credentials"
echo "----------------------------------------"
echo "1. Restart the notification server: npm restart"
echo "2. Test push notifications with new keys"
echo "3. Monitor logs for any authentication errors"
echo ""

echo "==========================================="
echo " ✅ Credential rotation complete!"
echo "==========================================="
echo ""
echo "Security reminders:"
echo "- Never commit .env to git (already in .gitignore)"
echo "- Store credentials in secure password manager"
echo "- Rotate credentials every 90 days"
echo "- Monitor for unauthorized access attempts"
echo ""
