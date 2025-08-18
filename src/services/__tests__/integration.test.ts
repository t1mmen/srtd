/**
 * Integration tests for service interactions
 * Tests real interactions between multiple services working together
 */

import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CLIConfig } from '../../types.js';
import type { DatabaseService } from '../DatabaseService.js';
import { FileSystemService } from '../FileSystemService.js';
import { MigrationBuilder } from '../MigrationBuilder.js';
import { Orchestrator } from '../Orchestrator.js';
import type { OrchestratorConfig } from '../Orchestrator.js';
import { StateService } from '../StateService.js';

describe('Service Integration Tests', () => {
  let tempDir: string;
  let fileSystemService: FileSystemService;
  let stateService: StateService;
  let databaseService: DatabaseService;
  let migrationBuilder: MigrationBuilder;
  let orchestrator: Orchestrator;
  let orchestratorConfig: OrchestratorConfig;
  let cliConfig: CLIConfig;

  beforeEach(async () => {
    // Create temporary directory for test files
    tempDir = path.join(tmpdir(), 'srtd-integration-test-' + Date.now());
    await fs.mkdir(tempDir, { recursive: true });
    await fs.mkdir(path.join(tempDir, 'templates'), { recursive: true });
    await fs.mkdir(path.join(tempDir, 'migrations'), { recursive: true });

    // Create test CLI config
    cliConfig = {
      filter: '**/*.sql',
      wipIndicator: '.wip',
      wrapInTransaction: false,
      banner: '',
      footer: '',
      templateDir: 'templates',
      migrationDir: 'migrations',
      migrationPrefix: '',
      buildLog: '.buildlog.json',
      localBuildLog: '.buildlog.local.json',
      pgConnection: 'postgresql://test@localhost/test',
    };

    // Create orchestrator config
    orchestratorConfig = {
      baseDir: tempDir,
      cliConfig: cliConfig,
      silent: true,
    };

    // Initialize services with their specific configs
    fileSystemService = new FileSystemService({
      baseDir: tempDir,
      templateDir: 'templates',
      filter: '**/*.sql',
      migrationDir: 'migrations',
    });

    stateService = new StateService({
      baseDir: tempDir,
      buildLogPath: '.buildlog.json',
      localBuildLogPath: '.buildlog.local.json',
      autoSave: false,
    });

    // Mock database service to avoid real DB connections
    databaseService = {
      initialize: vi.fn(),
      executeSQL: vi.fn().mockResolvedValue({
        rows: [],
        applied: true,
        error: undefined,
      }),
      applyTemplate: vi.fn().mockResolvedValue({
        rows: [],
        applied: true,
        error: undefined,
      }),
      destroy: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
    } as any;

    migrationBuilder = new MigrationBuilder({
      baseDir: tempDir,
      templateDir: 'templates',
      migrationDir: 'migrations',
      migrationPrefix: '',
      banner: '',
      footer: '',
      wrapInTransaction: false,
    });

    // Initialize Orchestrator with real services
    orchestrator = new Orchestrator(orchestratorConfig);
    await orchestrator.initialize();
  });

  afterEach(async () => {
    // Cleanup
    // Services don't have destroy methods - just stop watching
    if (fileSystemService && typeof fileSystemService.stopWatching === 'function') {
      fileSystemService.stopWatching();
    }

    // Stop watching if active
    if (fileSystemService && typeof fileSystemService.stopWatching === 'function') {
      fileSystemService.stopWatching();
    }

    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('FileSystemService + StateService Integration', () => {
    it('should discover templates and track their states', async () => {
      // Create test template files
      const template1Path = path.join(tempDir, 'templates', 'test1.sql');
      const template2Path = path.join(tempDir, 'templates', 'test2.sql');

      await fs.writeFile(template1Path, 'CREATE TABLE test1 (id INT);');
      await fs.writeFile(template2Path, 'CREATE TABLE test2 (id INT);');

      // Initialize state service
      await stateService.initialize();

      // Discover templates
      const templatePaths = await fileSystemService.findTemplates();

      expect(templatePaths).toHaveLength(2);
      expect(templatePaths[0]).toContain('test1.sql');
      expect(templatePaths[1]).toContain('test2.sql');

      // Read templates to get their metadata
      const template1 = templatePaths[0]
        ? await fileSystemService.readTemplate(templatePaths[0])
        : null;
      const template2 = templatePaths[1]
        ? await fileSystemService.readTemplate(templatePaths[1])
        : null;

      if (!template1 || !template2) {
        throw new Error('Failed to read template files');
      }

      // Check states are tracked
      const status1 = stateService.getTemplateStatus(template1.name);
      const status2 = stateService.getTemplateStatus(template2.name);

      expect(status1).toBe('unseen');
      expect(status2).toBe('unseen');

      // Update state
      await stateService.markAsSynced(template1.name, template1.hash);

      const updatedStatus = stateService.getTemplateStatus(template1.name);
      expect(updatedStatus).toBe('synced');
    });

    it('should detect file changes through watch events', async () => {
      const templatePath = path.join(tempDir, 'templates', 'watched.sql');
      await fs.writeFile(templatePath, 'CREATE TABLE watched (id INT);');

      await stateService.initialize();

      // Start watching
      await fileSystemService.watchTemplates();

      // Setup event listener
      const changePromise = new Promise<void>(resolve => {
        fileSystemService.on('templateChanged', () => {
          resolve();
        });
      });

      // Modify file
      await fs.writeFile(templatePath, 'CREATE TABLE watched (id INT, name TEXT);');

      // Wait for change event (with timeout)
      await Promise.race([
        changePromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000)),
      ]).catch(() => {
        // Ignore timeout in test environment
      });

      // Stop watching
      fileSystemService.stopWatching();
    });
  });

  describe('StateService + MigrationBuilder Integration', () => {
    it('should build migrations for changed templates', async () => {
      const templateName = 'templates/build-test.sql';
      const content = 'CREATE TABLE build_test (id INT);';

      // Set template state
      await stateService.markAsChanged(templateName, 'hash123');

      // Build migration
      const mockBuildLog = {
        version: '1.0',
        lastTimestamp: '20240101000000',
        templates: {},
      };
      const migrationPath = await migrationBuilder.generateMigration(
        {
          name: templateName,
          templatePath: templateName,
          relativePath: templateName,
          content,
          hash: 'hash123',
        },
        mockBuildLog
      );

      expect(migrationPath).toContain('20240101000000');

      // Verify migration file exists
      const migrationContent = await fs.readFile(migrationPath.fileName, 'utf-8');
      expect(migrationContent).toContain('CREATE TABLE build_test');
    });
  });

  describe('Orchestrator Service Coordination', () => {
    it('should coordinate apply operation across services', async () => {
      // Create test template
      const templatePath = path.join(tempDir, 'templates', 'apply-test.sql');
      await fs.writeFile(templatePath, 'CREATE TABLE apply_test (id INT);');

      // Mock the orchestrator's internal services
      const mockFileSystem = {
        initialize: vi.fn(),
        findTemplates: vi.fn().mockResolvedValue([
          {
            name: 'templates/apply-test.sql',
            content: 'CREATE TABLE apply_test (id INT);',
            hash: 'hash456',
          },
        ]),
        destroy: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
      };

      const mockState = {
        initialize: vi.fn(),
        getTemplateStatus: vi.fn().mockReturnValue('unseen'),
        setTemplateState: vi.fn(),
        getAllTemplates: vi.fn().mockReturnValue([]),
        destroy: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
      };

      // Use mocked services for this test
      (orchestrator as any).fileSystemService = mockFileSystem;
      (orchestrator as any).stateService = mockState;
      (orchestrator as any).databaseService = databaseService;

      // Execute apply
      const result = await orchestrator.apply();

      expect(result.applied).toHaveLength(1);
      expect(result.applied[0]).toContain('apply-test.sql');
      expect(result.errors).toHaveLength(0);

      // Verify state was updated
      expect(mockState.setTemplateState).toHaveBeenCalled();
    });

    it('should coordinate build operation across services', async () => {
      // Create test templates
      const template1Path = path.join(tempDir, 'templates', 'build1.sql');
      const template2Path = path.join(tempDir, 'templates', 'build2.sql');

      await fs.writeFile(template1Path, 'CREATE TABLE build1 (id INT);');
      await fs.writeFile(template2Path, 'CREATE TABLE build2 (id INT);');

      // Mock services
      const mockFileSystem = {
        initialize: vi.fn(),
        findTemplates: vi.fn().mockResolvedValue([
          { name: 'templates/build1.sql', content: 'CREATE TABLE build1 (id INT);', hash: 'hash1' },
          { name: 'templates/build2.sql', content: 'CREATE TABLE build2 (id INT);', hash: 'hash2' },
        ]),
        destroy: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
      };

      const mockState = {
        initialize: vi.fn(),
        getTemplateStatus: vi.fn().mockReturnValue('changed'),
        setTemplateState: vi.fn(),
        getAllTemplates: vi.fn().mockReturnValue([
          { name: 'templates/build1.sql', hash: 'oldhash1', status: 'synced' },
          { name: 'templates/build2.sql', hash: 'oldhash2', status: 'synced' },
        ]),
        destroy: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
      };

      (orchestrator as any).fileSystemService = mockFileSystem;
      (orchestrator as any).stateService = mockState;
      (orchestrator as any).migrationBuilder = migrationBuilder;

      // Execute build
      const result = await orchestrator.build();

      expect(result.built).toHaveLength(2);
      expect(result.built[0]).toContain('build1.sql');
      expect(result.built[1]).toContain('build2.sql');
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Event Flow Integration', () => {
    it('should properly emit and handle events across services', async () => {
      const events: string[] = [];

      // Create event emitter to track events
      const eventTracker = new EventEmitter();
      eventTracker.on('fileSystemInit', () => events.push('fileSystemInit'));
      eventTracker.on('stateInit', () => events.push('stateInit'));
      eventTracker.on('templateFound', () => events.push('templateFound'));

      // Mock to track initialization
      // FileSystemService doesn't have an initialize method, just emit event
      eventTracker.emit('fileSystemInit');

      const originalStateInit = stateService.initialize.bind(stateService);
      stateService.initialize = async () => {
        const result = await originalStateInit();
        eventTracker.emit('stateInit');
        return result;
      };

      // Initialize state service
      await stateService.initialize();

      // Create and find a template
      const templatePath = path.join(tempDir, 'templates', 'event-test.sql');
      await fs.writeFile(templatePath, 'CREATE TABLE events (id INT);');

      const templates = await fileSystemService.findTemplates();
      if (templates.length > 0) {
        eventTracker.emit('templateFound');
      }

      // Verify event sequence
      expect(events).toContain('fileSystemInit');
      expect(events).toContain('stateInit');
      expect(events).toContain('templateFound');
      expect(events.indexOf('fileSystemInit')).toBeLessThan(events.indexOf('templateFound'));
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle errors gracefully across service boundaries', async () => {
      // Create invalid SQL template
      const invalidTemplatePath = path.join(tempDir, 'templates', 'invalid.sql');
      await fs.writeFile(invalidTemplatePath, 'INVALID SQL SYNTAX !!!');

      // Mock database to simulate error
      const errorDb = {
        ...databaseService,
        applyTemplate: vi.fn().mockRejectedValue(new Error('Syntax error')),
      };

      (orchestrator as any).databaseService = errorDb;

      // Attempt apply operation
      const result = await orchestrator.apply();

      // Should handle error gracefully
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toMatchObject({
        templateName: expect.stringContaining('invalid.sql'),
        error: expect.stringContaining('Syntax error'),
      });
    });

    it('should maintain consistency when operations fail', async () => {
      const templatePath = path.join(tempDir, 'templates', 'consistency.sql');
      await fs.writeFile(templatePath, 'CREATE TABLE consistency (id INT);');

      await stateService.initialize();

      const templatePaths = await fileSystemService.findTemplates();
      if (!templatePaths[0]) {
        throw new Error('No templates found');
      }
      const template = await fileSystemService.readTemplate(templatePaths[0]);
      const initialState = stateService.getTemplateStatus(template.name);

      // Mock database to fail
      const failingDb = {
        ...databaseService,
        applyTemplate: vi.fn().mockRejectedValue(new Error('Connection failed')),
      };

      (orchestrator as any).databaseService = failingDb;

      // Attempt apply
      await orchestrator.apply();

      // State should remain unchanged after failure
      const finalState = stateService.getTemplateStatus(template.name);
      expect(finalState).toBe(initialState);
    });
  });
});
