import { describe, it, expect, beforeEach, vi } from 'vitest';

// Helper to import logger with current env
async function importLogger() {
  vi.resetModules(); // Clear cache
  return import('../logger.js');
}

describe('logger', () => {
  let originalConsoleLog: typeof console.log;
  let originalConsoleDebug: typeof console.debug;
  let originalConsoleInfo: typeof console.info;
  let originalConsoleWarn: typeof console.warn;
  let originalConsoleError: typeof console.error;

  beforeEach(() => {
    originalConsoleLog = console.log;
    originalConsoleDebug = console.debug;
    originalConsoleInfo = console.info;
    originalConsoleWarn = console.warn;
    originalConsoleError = console.error;
    vi.restoreAllMocks();
  });

  function mockConsole() {
    console.log = vi.fn();
    console.debug = vi.fn();
    console.info = vi.fn();
    console.warn = vi.fn();
    console.error = vi.fn();
  }

  it('logs JSON format when PI_LOG_FORMAT=json and PI_LOG_LEVEL=info', async () => {
    process.env.PI_LOG_FORMAT = 'json';
    process.env.PI_LOG_LEVEL = 'info';
    const { logger: reloadedLogger } = await importLogger();
    mockConsole();

    reloadedLogger.info('test-message', { foo: 'bar' }, 123);

    expect(console.log).toHaveBeenCalledTimes(1);
    const loggedArg = (console.log as any).mock.calls[0][0];
    const parsed = JSON.parse(loggedArg);
    expect(parsed).toMatchObject({
      timestamp: expect.any(String),
      level: 'info',
      message: 'test-message',
      meta: [{ foo: 'bar' }, 123],
    });
  });

  it('logs JSON for exact level set', async () => {
    process.env.PI_LOG_FORMAT = 'json';
    process.env.PI_LOG_LEVEL = 'warn';
    const { logger: reloadedLogger } = await importLogger();
    mockConsole();

    reloadedLogger.warn('warn-msg');
    reloadedLogger.error('error-msg'); // shouldn't log

    expect(console.log).toHaveBeenCalledTimes(1);
    const loggedArg = (console.log as any).mock.calls[0][0];
    const parsed = JSON.parse(loggedArg);
    expect(parsed.level).toBe('warn');
    expect(parsed.message).toBe('warn-msg');
  });

  it('does not log if PI_LOG_LEVEL is unset', async () => {
    delete process.env.PI_LOG_LEVEL;
    delete process.env.PI_LOG_FORMAT;
    const { logger: reloadedLogger } = await importLogger();
    mockConsole();

    reloadedLogger.info('silent');
    expect(console.log).not.toHaveBeenCalled();
  });

  it('logs pretty format when PI_LOG_FORMAT is not json', async () => {
    process.env.PI_LOG_LEVEL = 'info';
    delete process.env.PI_LOG_FORMAT;
    const { logger: reloadedLogger } = await importLogger();
    mockConsole();

    reloadedLogger.info('pretty-msg', 'extra');

    expect(console.info).toHaveBeenCalledWith('[INFO]', 'pretty-msg', 'extra');
  });

  it('handles no-args gracefully', async () => {
    process.env.PI_LOG_FORMAT = 'json';
    process.env.PI_LOG_LEVEL = 'error';
    const { logger: reloadedLogger } = await importLogger();
    mockConsole();

    reloadedLogger.error();

    expect(console.log).toHaveBeenCalledTimes(1);
    const loggedArg = (console.log as any).mock.calls[0][0];
    const parsed = JSON.parse(loggedArg);
    expect(parsed).toHaveProperty('timestamp');
    expect(parsed.level).toBe('error');
    expect(parsed.message).toBeUndefined();
  });
});
