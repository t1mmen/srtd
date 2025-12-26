import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Unmock logger for these tests so we can test the real implementation
vi.unmock('./logger.js');

describe('logger', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  const originalDebug = process.env.DEBUG;

  beforeEach(async () => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.clearAllMocks();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    process.env.DEBUG = originalDebug;
  });

  it('should log info messages with info icon', async () => {
    const { logger } = await vi.importActual<typeof import('./logger.js')>('./logger.js');
    logger.info('Test info message');
    expect(consoleLogSpy).toHaveBeenCalled();
    const output = consoleLogSpy.mock.calls[0]?.[0];
    expect(output).toContain('Test info message');
  });

  it('should log success messages with tick icon', async () => {
    const { logger } = await vi.importActual<typeof import('./logger.js')>('./logger.js');
    logger.success('Test success message');
    expect(consoleLogSpy).toHaveBeenCalled();
    const output = consoleLogSpy.mock.calls[0]?.[0];
    expect(output).toContain('Test success message');
  });

  it('should log warning messages with warning icon', async () => {
    const { logger } = await vi.importActual<typeof import('./logger.js')>('./logger.js');
    logger.warn('Test warning message');
    expect(consoleLogSpy).toHaveBeenCalled();
    const output = consoleLogSpy.mock.calls[0]?.[0];
    expect(output).toContain('Test warning message');
  });

  it('should log error messages with cross icon', async () => {
    const { logger } = await vi.importActual<typeof import('./logger.js')>('./logger.js');
    logger.error('Test error message');
    expect(consoleLogSpy).toHaveBeenCalled();
    const output = consoleLogSpy.mock.calls[0]?.[0];
    expect(output).toContain('Test error message');
  });

  it('should log skip messages with pointer icon', async () => {
    const { logger } = await vi.importActual<typeof import('./logger.js')>('./logger.js');
    logger.skip('Test skip message');
    expect(consoleLogSpy).toHaveBeenCalled();
    const output = consoleLogSpy.mock.calls[0]?.[0];
    expect(output).toContain('Test skip message');
  });

  it('should not log debug messages when DEBUG is not set', async () => {
    process.env.DEBUG = undefined;
    const { logger } = await vi.importActual<typeof import('./logger.js')>('./logger.js');
    logger.debug('Test debug message');
    expect(consoleLogSpy).not.toHaveBeenCalled();
  });

  it('should log debug messages when DEBUG is set to true', async () => {
    process.env.DEBUG = 'true';
    const { logger } = await vi.importActual<typeof import('./logger.js')>('./logger.js');
    logger.debug('Test debug message');
    expect(consoleLogSpy).toHaveBeenCalled();
    const output = consoleLogSpy.mock.calls[0]?.[0];
    expect(output).toContain('Test debug message');
  });

  it('should not log debug messages when DEBUG is set to false', async () => {
    process.env.DEBUG = 'false';
    const { logger } = await vi.importActual<typeof import('./logger.js')>('./logger.js');
    logger.debug('Test debug message');
    expect(consoleLogSpy).not.toHaveBeenCalled();
  });
});
