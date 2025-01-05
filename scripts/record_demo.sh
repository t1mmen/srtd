#!/bin/bash

set -e  # Exit on any error

# Cleanup function
cleanup() {
    local exit_code=$?
    echo "🧹 Cleaning up..."
    [ -d "$BACKUP_DIR" ] && rm -rf "$BACKUP_DIR"
    exit $exit_code
}

trap cleanup EXIT

# Ensure we're in the project root
cd "$(dirname "$0")/.."

# Create temp backup directory
BACKUP_DIR=".demo-backup-$(date +%s)"
echo "📦 Creating backup directory: $BACKUP_DIR"
mkdir -p "$BACKUP_DIR"

# Backup existing files
echo "💾 Backing up existing files..."
if [ -d "supabase/migrations-templates" ]; then
    mkdir -p "$BACKUP_DIR/supabase"
    cp -r supabase/migrations-templates "$BACKUP_DIR/supabase/"
fi
if [ -d "supabase/migrations" ]; then
    mkdir -p "$BACKUP_DIR/supabase"
    cp -r supabase/migrations "$BACKUP_DIR/supabase/"
fi

# Backup root files with debug output
for file in "srtd.config.json" ".gitignore"; do
    if [ -f "$file" ]; then
        echo "📑 Backing up $file"
        cp "$file" "$BACKUP_DIR/" || echo "⚠️ Failed to backup $file"
    fi
done

# Clean slate for demo
echo "🧹 Preparing clean environment..."
rm -f srtd.config.json
rm -f .gitignore
rm -rf supabase/migrations-templates
rm -rf supabase/migrations
mkdir -p supabase/migrations

# Debugging
echo "🔍 State of files and folders..."
ls -la supabase/migrations-templates || true
ls -la supabase/migrations || true
cat srtd.config.json || true
cat supabase/migrations-templates/.srtd.buildlog.local.json  || true
cat supabase/migrations-templates/.srtd.buildlog.json || true

# Build
npm run build
npm link
chmod u+x ./dist/cli.js

# Record the demo
echo "🎥 Recording demo..."
vhs readme-demo.tape

# echo "🎥 Creating screenshots..."
# vhs readme-screenshot.tape


# Clean up demo-generated files
echo "🧹 Cleaning up demo files..."
rm -rf supabase/migrations-templates
rm -rf supabase/migrations
rm -f srtd.config.json

# Restore original files
echo "♻️ Restoring original files..."
if [ -d "$BACKUP_DIR/supabase/migrations-templates" ]; then
    mkdir -p supabase
    cp -r "$BACKUP_DIR/supabase/migrations-templates" supabase/
fi
if [ -d "$BACKUP_DIR/supabase/migrations" ]; then
    mkdir -p supabase
    cp -r "$BACKUP_DIR/supabase/migrations" supabase/
fi
# Restore root files with debug output
for file in "srtd.config.json" ".gitignore"; do
    if [ -f "$BACKUP_DIR/$file" ]; then
        echo "📑 Restoring $file"
        cp "$BACKUP_DIR/$file" . || echo "⚠️ Failed to restore $file"
    fi
done

echo "✨ Demo recorded! Check readme-demo.gif"
