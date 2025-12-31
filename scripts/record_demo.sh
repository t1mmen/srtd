#!/bin/bash

set -e  # Exit on any error

# Ensure we're in the project root
cd "$(dirname "$0")/.."

# Paths that will be modified during demo
DEMO_PATHS=(
    "supabase/migrations-templates"
    "supabase/migrations"
    "srtd.config.json"
)

# Cleanup function - restore git state
cleanup() {
    local exit_code=$?
    echo ""
    echo "🧹 Restoring git state..."

    # Restore tracked files to committed state
    git checkout -- "${DEMO_PATHS[@]}" 2>/dev/null || true

    # Remove untracked files created during demo (like the 4th template)
    git clean -fd supabase/migrations-templates supabase/migrations 2>/dev/null || true

    # Pop stash if we created one
    if [ "$STASHED" = "true" ]; then
        echo "📦 Restoring stashed changes..."
        git stash pop --quiet || echo "⚠️ Could not restore stash"
    fi

    exit $exit_code
}

trap cleanup EXIT

# Check for uncommitted changes in demo paths
echo "🔍 Checking git state..."
if ! git diff --quiet -- "${DEMO_PATHS[@]}" 2>/dev/null || \
   ! git diff --cached --quiet -- "${DEMO_PATHS[@]}" 2>/dev/null; then
    echo "📦 Stashing uncommitted changes in demo paths..."
    git stash push -m "demo-recording-backup" -- "${DEMO_PATHS[@]}"
    STASHED=true
else
    STASHED=false
fi

# Reset to clean git state - this gives us the 3 shipped templates + migrations
echo "🧹 Resetting to clean git state..."
git checkout -- "${DEMO_PATHS[@]}" 2>/dev/null || true
git clean -fd supabase/migrations-templates supabase/migrations 2>/dev/null || true
rm -f srtd.config.json

# CRITICAL: Clean up buildlog files to ensure fresh state
# Without this, SRTD may not detect template changes from previous runs
rm -f supabase/migrations-templates/.srtd.buildlog.local.json

# Build CLI
echo "🔨 Building CLI..."
npm run build
npm link
chmod u+x ./dist/cli.js

# The repo ships with 3 templates + pre-built migrations
# The demo will create the 4th template (get_user_email) live via heredoc
echo "📦 Verifying shipped state..."
echo "  Templates: $(ls supabase/migrations-templates/*.sql | wc -l | tr -d ' ')"
echo "  Migrations: $(ls supabase/migrations/*.sql | wc -l | tr -d ' ')"

# Record the demo
echo "🎥 Recording demo..."
vhs readme-demo.tape

echo "✨ Demo recorded! Check readme-demo.gif"
