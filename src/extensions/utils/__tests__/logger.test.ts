import { describe, it, expect, vi } from 'vitest';
import { createLogger, logger } from '../logger.js';

describe('createLogger', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create logger with no prefix', () => {
    const l = createLogger();
    l.log('test log');
    expect(console.log).toHaveBeenCalledWith('test log');
    l.error('test error');
    expect(console.error).toHaveBeenCalledWith('test error');
    l.warn('test warn');
    expect(console.warn).toHaveBeenCalledWith('test warn');
    l.info('test info');
    expect(console.info).toHaveBeenCalledWith('test info');
    l.debug('test debug');
    expect(console.debug).toHaveBeenCalledWith('test debug');
  });

  it('should create logger with prefix', () => {
    const l = createLogger('MyTag');
    l.log('msg');
    expect(console.log).toHaveBeenCalledWith('[MyTag]', 'msg');
    l.error('err');
    expect(console.error).toHaveBeenCalledWith('[MyTag]', 'err');
    l.warn('warn');
    expect(console.warn).toHaveBeenCalledWith('[MyTag]', 'warn');
    l.info('info');
    expect(console.info).toHaveBeenCalledWith('[MyTag]', 'info');
    l.debug('debug');
    expect(console.debug).toHaveBeenCalledWith('[MyTag]', 'debug');
  });

  it('default logger should work', () => {
    logger.log('default log');
    expect(console.log).toHaveBeenCalledWith('default log');
  });
});
