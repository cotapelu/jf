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
  let originalConsoleTrace: typeof console.trace;

  beforeEach(() => {
    originalConsoleLog = console.log;
    originalConsoleDebug = console.debug;
    originalConsoleInfo = console.info;
    originalConsoleWarn = console.warn;
    originalConsoleError = console.error;
    originalConsoleTrace = console.trace;
    vi.restoreAllMocks();
  });

  function mockConsole() {
    console.log = vi.fn();
    console.debug = vi.fn();
    console.info = vi.fn();
    console.warn = vi.fn();
    console.error = vi.fn();
    console.trace = vi.fn();
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

  // Cover all levels (trace, debug, warn, error, fatal) for pretty format
  const levels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const;
  levels.forEach((lvl) => {
    it(`logs pretty format for ${lvl}`, async () => {
      process.env.PI_LOG_FORMAT = 'pretty';
      process.env.PI_LOG_LEVEL = lvl;
      const { logger: reloadedLogger } = await importLogger();
      mockConsole();

      // @ts-expect-error dynamic level access
      reloadedLogger[lvl](`${lvl}-msg`, 'arg2');

      const expectedFn = lvl === 'fatal' ? console.error : console[lvl as keyof typeof console];
      expect(expectedFn).toHaveBeenCalledWith(`[${lvl.toUpperCase()}]`, `${lvl}-msg`, 'arg2');
    });
  });

  // Cover all levels for JSON format
  levels.forEach((lvl) => {
    it(`logs JSON format for ${lvl}`, async () => {
      process.env.PI_LOG_FORMAT = 'json';
      process.env.PI_LOG_LEVEL = lvl;
      const { logger: reloadedLogger } = await importLogger();
      mockConsole();

      // @ts-expect-error dynamic level access
      reloadedLogger[lvl](`${lvl}-message`, { key: 'value' });

      expect(console.log).toHaveBeenCalledTimes(1);
      const loggedArg = (console.log as any).mock.calls[0][0];
      const parsed = JSON.parse(loggedArg);
      expect(parsed).toMatchObject({
        timestamp: expect.any(String),
        level: lvl,
        message: `${lvl}-message`,
        meta: [{ key: 'value' }],
      });
    });
  });

  it('uses pretty format by default when PI_LOG_FORMAT unset', async () => {
    process.env.PI_LOG_LEVEL = 'debug';
    delete process.env.PI_LOG_FORMAT;
    const { logger: reloadedLogger } = await importLogger();
    mockConsole();

    reloadedLogger.debug('debug-default');

    expect(console.debug).toHaveBeenCalledWith('[DEBUG]', 'debug-default');
  });

  it('trace uses console.trace in pretty mode', async () => {
    process.env.PI_LOG_FORMAT = 'pretty';
    process.env.PI_LOG_LEVEL = 'trace';
    const { logger: reloadedLogger } = await importLogger();
    mockConsole();

    reloadedLogger.trace('trace-msg');

    expect(console.trace).toHaveBeenCalledWith('[TRACE]', 'trace-msg');
  });
});
