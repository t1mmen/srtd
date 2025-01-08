#!/usr/bin/env -S node --no-warnings
import Pastel from 'pastel';
import updateNotifier from 'update-notifier';
import packageJson from '../package.json' with { type: 'json' };

updateNotifier({ pkg: packageJson }).notify();

const app = new Pastel({
  importMeta: import.meta,
});

await app.run();
