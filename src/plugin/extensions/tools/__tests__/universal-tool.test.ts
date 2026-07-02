#!/usr/bin/env node
/**
 * Universal Tool Unit Tests (buildCommand and execute error handling)
 */

import { describe, it, expect } from 'vitest';
import { buildCommand, execute } from '../universal-tool.js';

describe('universal-tool buildCommand', () => {

  describe('echo', () => {
    it('should quote message with JSON.stringify', () => {
      expect(buildCommand('echo', { message: 'Hello' })).toBe('echo "Hello"');
    });

    it('should escape quotes and newlines', () => {
      // JSON.stringify will produce a quoted string with escapes
      const cmd = buildCommand('echo', { message: 'Say "hi"' });
      expect(cmd).toContain('echo');
      expect(cmd).toContain('"');
      // The exact format: echo "Say \"hi\""
      expect(cmd).toBe('echo "Say \\"hi\\""');
    });

    it('should throw on missing or empty message', () => {
      expect(() => buildCommand('echo', { message: '' })).toThrow('Missing or invalid parameter');
      expect(() => buildCommand('echo', {})).toThrow('Missing or invalid parameter');
    });
  });

  describe('system_info', () => {
    it('should return uname -a && df -h', () => {
      expect(buildCommand('system_info', {})).toBe('uname -a && df -h');
    });
  });

  describe('date', () => {
    it('should return date', () => {
      expect(buildCommand('date', {})).toBe('date');
    });
  });

  describe('uuid', () => {
    it('should return uuid generation command', () => {
      const cmd = buildCommand('uuid', {});
      expect(cmd).toMatch(/^cat \/proc\/sys\/kernel\/random\/uuid/);
      expect(cmd).toContain('|| uuidgen');
    });
  });

  describe('random', () => {
    it('should default to 0-100', () => {
      expect(buildCommand('random', {})).toBe('echo $((RANDOM % (100 - 0 + 1) + 0))');
    });

    it('should respect min and max', () => {
      expect(buildCommand('random', { min: 5, max: 15 })).toBe('echo $((RANDOM % (15 - 5 + 1) + 5))');
    });

    it('should throw if min > max', () => {
      expect(() => buildCommand('random', { min: 10, max: 5 })).toThrow('min > max');
    });

    it('should throw if min or max not numbers', () => {
      expect(() => buildCommand('random', { min: 'a' })).toThrow('min and max must be numbers');
    });
  });

  describe('calc', () => {
    it('should sanitize expression by removing spaces', () => {
      // Universal tool uses bc for floating point, not $(( ))
      expect(buildCommand('calc', { expression: '2 + 3 * 4' })).toBe('echo "scale=6; 2+3*4" | bc -l');
    });

    it('should throw on empty expression', () => {
      expect(() => buildCommand('calc', { expression: '' })).toThrow('Missing required parameter');
    });
  });

  describe('unknown action', () => {
    it('should throw for unrecognized action', () => {
      // buildCommand might throw or return something; actually buildCommand does not throw for unknown; it just returns undefined? Let's see code: It has cases and default: throw new Error(`Unknown action: ${action}`).
      expect(() => buildCommand('unknown' as any, {})).toThrow('Unknown action');
    });
  });

});

describe('universal-tool execute', () => {

  // We test only the unknown action path, which doesn't require bash tool.
  // For other actions, buildCommand tests cover command generation.

  it('should return error for unknown action without crashing', async () => {
    const ctx = { cwd: '/test' };
    const result = await execute('call-1', { action: 'unknown' as any }, undefined, undefined, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Unknown action');
  });

});
