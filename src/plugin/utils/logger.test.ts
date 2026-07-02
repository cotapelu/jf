#!/usr/bin/env node
/**
 * Logger Utility Tests
 *
 * Tests for the centralized logging system.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { logger } from './logger.js';

// Clear mocks and set default env before every test
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('PICLAW_LOG_LEVEL', 'info');
  vi.stubEnv('PICLAW_LOG_FORMAT', 'pretty');
  // Mock console methods to prevent actual output and track calls
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('Logger', () => {
  describe('Log Level Filtering', () => {
    it('should log info level by default', () => {
      logger.info('test message');
      expect(console.log).toHaveBeenCalled();
    });

    it('should not log debug when level is info', () => {
      logger.debug('debug message');
      expect(console.log).not.toHaveBeenCalled();
    });

    it('should log warn level when level is info or higher', () => {
      logger.warn('warning message');
      expect(console.warn).toHaveBeenCalled();
    });

    it('should log error level regardless of level setting', () => {
      vi.stubEnv('PICLAW_LOG_LEVEL', 'error');
      logger.error('error message');
      expect(console.error).toHaveBeenCalled();
    });

    it('should respect PICLAW_LOG_LEVEL=debug', () => {
      vi.stubEnv('PICLAW_LOG_LEVEL', 'debug');
      logger.debug('debug enabled');
      expect(console.log).toHaveBeenCalled();
    });

    it('should suppress info when level is warn', () => {
      vi.stubEnv('PICLAW_LOG_LEVEL', 'warn');
      logger.info('info suppressed');
      expect(console.log).not.toHaveBeenCalled();
    });

    it('should suppress debug and info when level is error', () => {
      vi.stubEnv('PICLAW_LOG_LEVEL', 'error');
      logger.debug('debug suppressed');
      logger.info('info suppressed');
      logger.warn('warn suppressed');
      expect(console.log).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    it('falls back to info level when PICLAW_LOG_LEVEL is invalid', () => {
      vi.stubEnv('PICLAW_LOG_LEVEL', 'bogus');
      vi.clearAllMocks();
      logger.info('fallback test');
      expect(console.log).toHaveBeenCalled();
    });
  });

  describe('JSON Formatting', () => {
    beforeEach(() => {
      vi.stubEnv('PICLAW_LOG_FORMAT', 'json');
    });

    it('should format log as JSON with required fields', () => {
      logger.info('json test');
      const callArgs = (console.log as any).mock.calls[0][0];
      expect(typeof callArgs).toBe('string');
      const parsed = JSON.parse(callArgs);
      expect(parsed).toHaveProperty('timestamp');
      expect(parsed).toHaveProperty('level', 'info');
      expect(parsed).toHaveProperty('message', 'json test');
    });

    it('should include meta in JSON output', () => {
      logger.info('with meta', { key: 'value', count: 42 });
      const callArgs = (console.log as any).mock.calls[0][0];
      const parsed = JSON.parse(callArgs);
      expect(parsed.meta).toEqual({ key: 'value', count: 42 });
    });

    it('should use ISO timestamp format', () => {
      logger.info('timestamp check');
      const callArgs = (console.log as any).mock.calls[0][0];
      const parsed = JSON.parse(callArgs);
      expect(parsed.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should format error as JSON with error level', () => {
      logger.error('error json');
      const callArgs = (console.error as any).mock.calls[0][0];
      const parsed = JSON.parse(callArgs);
      expect(parsed.level).toBe('error');
    });
  });

  describe('Pretty Formatting', () => {
    // Default env is already 'pretty', so no override needed

    it('should format info with no prefix', () => {
      logger.info('pretty info');
      const callArgs = (console.log as any).mock.calls[0][0];
      expect(callArgs).toBe('pretty info');
    });

    it('should format warn with [WARN] prefix', () => {
      logger.warn('pretty warn');
      const callArgs = (console.warn as any).mock.calls[0][0];
      expect(callArgs).toContain('[WARN] pretty warn');
    });

    it('should format error with [ERROR] prefix', () => {
      logger.error('pretty error');
      const callArgs = (console.error as any).mock.calls[0][0];
      expect(callArgs).toContain('[ERROR] pretty error');
    });

    it('should format debug in pretty mode (with color codes)', () => {
      vi.stubEnv('PICLAW_LOG_LEVEL', 'debug');
      logger.debug('pretty debug');
      const callArgs = (console.log as any).mock.calls[0][0];
      expect(callArgs).toContain('pretty debug');
    });
  });

  describe('logger methods', () => {
    it('should have all standard logging methods', () => {
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.log).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
    });

    it('log method should behave like info', () => {
      logger.log('log method test');
      expect(console.log).toHaveBeenCalled();
    });

    it('should handle empty message', () => {
      logger.info('');
      expect(console.log).toHaveBeenCalledWith('');
    });

    it('should ignore meta in pretty mode', () => {
      logger.info('meta test', { foo: 'bar' });
      const callArgs = (console.log as any).mock.calls[0][0];
      expect(callArgs).toBe('meta test');
    });

    it('should include meta in JSON mode', () => {
      vi.stubEnv('PICLAW_LOG_FORMAT', 'json');
      logger.info('meta test', { foo: 'bar' });
      const callArgs = (console.log as any).mock.calls[0][0];
      const parsed = JSON.parse(callArgs);
      expect(parsed.meta).toEqual({ foo: 'bar' });
    });
  });

  describe('edge cases', () => {
    it('should handle special characters in messages', () => {
      logger.info('Special chars: \u001b[31mred\u001b[0m 😀');
      expect(console.log).toHaveBeenCalled();
    });

    it('should handle large meta objects without crashing', () => {
      const largeMeta = { data: Array(100).fill(0).map((_, i) => ({ id: i })) };
      logger.info('large meta', largeMeta);
      // Just ensure it called console.log and didn't throw
      expect(console.log).toHaveBeenCalled();
    });
  });
});
