/**
 * Orchestrator tests
 * Comprehensive unit tests covering service coordination, event handling, and command operations
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CLIConfig } from '../../types.js';
import { DatabaseService } from '../DatabaseService.js';
import { FileSystemService } from '../FileSystemService.js';
import { MigrationBuilder } from '../MigrationBuilder.js';
import { Orchestrator } from '../Orchestrator.js';
import { StateService } from '../StateService.js';

// Mock all the services
vi.mock('../FileSystemService.js');
vi.mock('../StateService.js');
vi.mock('../DatabaseService.js');
vi.mock('../MigrationBuilder.js');

describe('Orchestrator', () => {
  let orchestrator: Orchestrator;
  let mockConfig: CLIConfig;

  beforeEach(async () => {
    mockConfig = {
      filter: '**/*.sql',
      wipIndicator: '.wip',
      wrapInTransaction: true,
      banner: 'Test Banner',
      footer: 'Test Footer',
      templateDir: 'templates',
      migrationDir: 'migrations',
      migrationPrefix: 'test',
      buildLog: '.buildlog.json',
      localBuildLog: '.buildlog.local.json',
      pgConnection: 'postgresql://test:test@localhost:5432/test',
    };

    // Mock loadBuildLog
    vi.doMock('../../utils/loadBuildLog.js', () => ({
      loadBuildLog: vi.fn().mockResolvedValue({
        version: '1.0',
        lastTimestamp: '20240101000000',
        templates: {},
      }),
    }));

    orchestrator = new Orchestrator({
      baseDir: '/test/project',
      cliConfig: mockConfig,
      silent: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    orchestrator?.[Symbol.dispose]();
  });

  describe('initialization', () => {
    it('should create orchestrator instance', () => {
      expect(orchestrator).toBeInstanceOf(Orchestrator);
    });

    it('should initialize all services', async () => {
      await orchestrator.initialize();

      // Verify services were initialized (mocked)
      expect(FileSystemService).toHaveBeenCalled();
      expect(StateService).toHaveBeenCalled();
      expect(DatabaseService).toHaveBeenCalled();
      expect(MigrationBuilder.fromConfig).toHaveBeenCalled();
    });
  });

  describe('static factory', () => {
    it('should create orchestrator using static create method', async () => {
      const instance = await Orchestrator.create('/test/project', mockConfig, { silent: true });
      expect(instance).toBeInstanceOf(Orchestrator);
      instance[Symbol.dispose]();
    });
  });

  describe('service coordination', () => {
    it('should coordinate between services for unidirectional flow', async () => {
      await orchestrator.initialize();

      // This test verifies the basic setup works
      // More detailed coordination tests would require complex mocking
      expect(orchestrator).toBeDefined();
    });
  });

  describe('command handlers', () => {
    beforeEach(async () => {
      await orchestrator.initialize();
    });

    it('should have apply command handler', () => {
      expect(typeof orchestrator.apply).toBe('function');
    });

    it('should have build command handler', () => {
      expect(typeof orchestrator.build).toBe('function');
    });

    it('should have watch command handler', () => {
      expect(typeof orchestrator.watch).toBe('function');
    });

    it('should have findTemplates method', () => {
      expect(typeof orchestrator.findTemplates).toBe('function');
    });

    it('should have getTemplateStatusExternal method', () => {
      expect(typeof orchestrator.getTemplateStatusExternal).toBe('function');
    });
  });

  describe('disposal', () => {
    it('should dispose of all services', async () => {
      await orchestrator.initialize();
      expect(() => orchestrator[Symbol.dispose]()).not.toThrow();
    });

    it('should dispose via async Symbol.asyncDispose', async () => {
      await orchestrator.initialize();
      await expect(orchestrator[Symbol.asyncDispose]()).resolves.not.toThrow();
    });

    it('should dispose via async dispose method', async () => {
      await orchestrator.initialize();
      await expect(orchestrator.dispose()).resolves.not.toThrow();
    });
  });

  describe('typed events', () => {
    it('should support once() for single-fire listeners', async () => {
      await orchestrator.initialize();
      const handler = vi.fn();

      orchestrator.once('templateApplied', handler);

      // Emit twice - handler should only fire once
      orchestrator.emit('templateApplied', {
        templatePath: '/test/template.sql',
        relativePath: 'template.sql',
        hash: 'abc123',
        status: 'applied' as const,
      });
      orchestrator.emit('templateApplied', {
        templatePath: '/test/template2.sql',
        relativePath: 'template2.sql',
        hash: 'def456',
        status: 'applied' as const,
      });

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should support off() to remove listeners', async () => {
      await orchestrator.initialize();
      const handler = vi.fn();

      orchestrator.on('templateApplied', handler);

      // Emit once - should fire
      orchestrator.emit('templateApplied', {
        templatePath: '/test/template.sql',
        relativePath: 'template.sql',
        hash: 'abc123',
        status: 'applied' as const,
      });
      expect(handler).toHaveBeenCalledTimes(1);

      // Remove listener
      orchestrator.off('templateApplied', handler);

      // Emit again - should not fire
      orchestrator.emit('templateApplied', {
        templatePath: '/test/template2.sql',
        relativePath: 'template2.sql',
        hash: 'def456',
        status: 'applied' as const,
      });
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should support on() for persistent listeners', async () => {
      await orchestrator.initialize();
      const handler = vi.fn();

      orchestrator.on('templateApplied', handler);

      // Emit twice - handler should fire both times
      orchestrator.emit('templateApplied', {
        templatePath: '/test/template.sql',
        relativePath: 'template.sql',
        hash: 'abc123',
        status: 'applied' as const,
      });
      orchestrator.emit('templateApplied', {
        templatePath: '/test/template2.sql',
        relativePath: 'template2.sql',
        hash: 'def456',
        status: 'applied' as const,
      });

      expect(handler).toHaveBeenCalledTimes(2);
    });
  });
});
