import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CLIConfig } from '../types.js';
import { checkTemplateCount } from '../utils/doctorChecks.js';

describe('doctor template discovery', () => {
  let projectRoot: string;

  const config: CLIConfig = {
    templateDir: 'templates',
    migrationDir: 'migrations',
    wipIndicator: '.wip',
    buildLog: 'templates/.srtd.buildlog.json',
    localBuildLog: 'templates/.srtd.buildlog.local.json',
    pgConnection: 'postgresql://postgres:postgres@localhost:54322/postgres',
    filter: '**/*.sql',
    banner: 'Generated file',
    footer: '',
    wrapInTransaction: true,
  };

  beforeEach(async () => {
    projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'srtd-doctor-discovery-'));
    await fs.mkdir(path.join(projectRoot, 'templates', 'functions'), { recursive: true });
    await fs.writeFile(path.join(projectRoot, 'templates', 'ignored.txt'), 'not a template');
    await fs.writeFile(path.join(projectRoot, 'templates', 'functions', 'nested.sql'), 'select 1;');
  });

  afterEach(async () => {
    await fs.rm(projectRoot, { recursive: true, force: true });
  });

  it('honors the configured filter for nested templates', async () => {
    const matchingResult = await checkTemplateCount(projectRoot, config);

    expect(matchingResult).toMatchObject({
      name: 'Template count',
      passed: true,
    });
    expect(matchingResult.message).toContain('1 SQL template');

    const nonMatchingResult = await checkTemplateCount(projectRoot, {
      ...config,
      filter: 'policies/**/*.sql',
    });

    expect(nonMatchingResult).toMatchObject({
      name: 'Template count',
      passed: false,
    });
    expect(nonMatchingResult.hint).toContain('policies/**/*.sql');
  });
});
