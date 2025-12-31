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

    # Restore tracked files
    git checkout -- "${DEMO_PATHS[@]}" 2>/dev/null || true

    # Remove untracked files created during demo
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

# Prepare clean environment using git
echo "🧹 Preparing clean environment..."
git checkout -- "${DEMO_PATHS[@]}" 2>/dev/null || true
rm -rf supabase/migrations-templates/*
rm -rf supabase/migrations/*
rm -f srtd.config.json

# CRITICAL: Clean up buildlog files to ensure fresh state
# Without this, SRTD may not detect template changes from previous runs
rm -f supabase/migrations-templates/.srtd.buildlog.json
rm -f supabase/migrations-templates/.srtd.buildlog.local.json

# Copy demo templates
echo "📝 Setting up demo templates..."
mkdir -p supabase/migrations-templates
mkdir -p supabase/migrations
cp demo-templates/*.sql supabase/migrations-templates/

# Build
echo "🔨 Building..."
npm run build
npm link
chmod u+x ./dist/cli.js

# Record the demo
echo "🎥 Recording demo..."
vhs readme-demo.tape

echo "✨ Demo recorded! Check readme-demo.gif"
