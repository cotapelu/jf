import { describe, it, expect, vi, afterEach } from 'vitest';

describe('Top-level Logger (src/logger.ts)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('should no-op when PI_LOG_LEVEL is unset', async () => {
    vi.stubEnv('PI_LOG_LEVEL', '');
    vi.stubEnv('PI_LOG_FORMAT', 'pretty');
    vi.resetModules();

    const { logger } = await import('./logger.js');

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const traceSpy = vi.spyOn(console, 'trace').mockImplementation(() => {});

    logger.trace('trace');
    logger.debug('debug');
    logger.info('info');
    logger.warn('warn');
    logger.error('error');

    expect(logSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();
    expect(debugSpy).not.toHaveBeenCalled();
    expect(traceSpy).not.toHaveBeenCalled();
  });

  it('should log when PI_LOG_LEVEL matches', async () => {
    vi.stubEnv('PI_LOG_LEVEL', 'info');
    vi.stubEnv('PI_LOG_FORMAT', 'pretty');
    vi.resetModules();

    const { logger } = await import('./logger.js');

    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    logger.info('hello');

    // In pretty format, info uses console.info
    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('[INFO]'), 'hello');
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('should output JSON when PI_LOG_FORMAT=json', async () => {
    vi.stubEnv('PI_LOG_LEVEL', 'warn');
    vi.stubEnv('PI_LOG_FORMAT', 'json');
    vi.resetModules();

    const { logger } = await import('./logger.js');

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    logger.warn('warning message');

    // JSON format uses console.log with a single JSON string
    const arg = logSpy.mock.calls[0][0];
    expect(typeof arg).toBe('string');
    const parsed = JSON.parse(arg);
    expect(parsed).toMatchObject({
      level: 'warn',
      message: 'warning message'
    });
    expect(parsed.timestamp).toBeDefined();
  });
});
