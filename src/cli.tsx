#!/usr/bin/env -S node --no-warnings
import Pastel from 'pastel';
import updateNotifier from 'update-notifier';
import packageJson from '../package.json' with { type: 'json' };

// Check for test environment
const isTestMode = process.env.SRTD_TEST_MODE === 'true';
const nonInteractiveFlag = process.argv.includes('--non-interactive');

// Only show update notifications in non-test mode
if (!isTestMode) {
  updateNotifier({ pkg: packageJson }).notify();
}

// Configure CLI options
const app = new Pastel({
  importMeta: import.meta,
});

// Run the app
await app.run();

// For testing purposes, ensure process exits cleanly
if (isTestMode || nonInteractiveFlag) {
  process.exit(0);
}
