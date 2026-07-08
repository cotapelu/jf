import { describe, it, expect, vi, afterEach } from 'vitest';

describe('logger module', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.PI_LOG_LEVEL;
    delete process.env.PI_LOG_FORMAT;
  });

  it('should set loggers to noop when PI_LOG_LEVEL is unset', async () => {
    delete process.env.PI_LOG_LEVEL;
    vi.resetModules();
    const { logger } = await import('../logger.js');

    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    logger.info('test');
    logger.error('err');

    expect(infoSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('should enable only exact log level', async () => {
    process.env.PI_LOG_LEVEL = 'warn';
    vi.resetModules();
    const { logger } = await import('../logger.js');

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    logger.warn('warn msg');
    logger.info('info msg');

    expect(warnSpy).toHaveBeenCalledWith('[WARN]', 'warn msg');
    expect(infoSpy).not.toHaveBeenCalled();
  });

  it('should use pretty format by default', async () => {
    process.env.PI_LOG_LEVEL = 'info';
    vi.resetModules();
    const { logger } = await import('../logger.js');

    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    logger.info('hello');
    expect(infoSpy).toHaveBeenCalledWith('[INFO]', 'hello');
  });

  it('should use JSON format when PI_LOG_FORMAT=json', async () => {
    process.env.PI_LOG_LEVEL = 'debug';
    process.env.PI_LOG_FORMAT = 'json';
    vi.resetModules();
    const { logger } = await import('../logger.js');

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.debug('msg', { key: 'value' });

    const jsonStr = logSpy.mock.calls[0][0];
    const parsed = JSON.parse(jsonStr);
    expect(parsed.level).toBe('debug');
    expect(parsed.message).toBe('msg');
    expect(parsed.meta).toEqual([{ key: 'value' }]);
    expect(parsed.timestamp).toBeDefined();
  });

  it('should not include meta in JSON when no extra args', async () => {
    process.env.PI_LOG_LEVEL = 'info';
    process.env.PI_LOG_FORMAT = 'json';
    vi.resetModules();
    const { logger } = await import('../logger.js');

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.info('simple');

    const jsonStr = logSpy.mock.calls[0][0];
    const parsed = JSON.parse(jsonStr);
    expect(parsed.meta).toBeUndefined();
  });

  it('should map fatal to console.error', async () => {
    process.env.PI_LOG_LEVEL = 'fatal';
    vi.resetModules();
    const { logger } = await import('../logger.js');

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logger.fatal('fatal error');
    expect(errorSpy).toHaveBeenCalledWith('[FATAL]', 'fatal error');
  });

  it('should handle error level correctly', async () => {
    process.env.PI_LOG_LEVEL = 'error';
    vi.resetModules();
    const { logger } = await import('../logger.js');

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logger.error('error msg');
    expect(errorSpy).toHaveBeenCalledWith('[ERROR]', 'error msg');
  });

  it('should handle trace level correctly', async () => {
    process.env.PI_LOG_LEVEL = 'trace';
    vi.resetModules();
    const { logger } = await import('../logger.js');

    const traceSpy = vi.spyOn(console, 'trace').mockImplementation(() => {});
    logger.trace('trace msg');
    expect(traceSpy).toHaveBeenCalledWith('[TRACE]', 'trace msg');
  });
});
