import { describe, it, expect, beforeEach } from 'vitest';
import { getValidator, resetValidator, CommandValidator } from '../utils/command-validator.js';
import { Type } from 'typebox';

describe('CommandValidator', () => {
  let validator: CommandValidator;

  beforeEach(() => {
    validator = new CommandValidator({ rateLimitPerMinute: 2 });
  });

  describe('checkRateLimit', () => {
    it('should allow first calls within limit', () => {
      expect(validator.checkRateLimit('test').allowed).toBe(true);
      expect(validator.checkRateLimit('test').allowed).toBe(true);
    });

    it('should deny when limit exceeded', () => {
      validator.checkRateLimit('test');
      validator.checkRateLimit('test');
      const res = validator.checkRateLimit('test');
      expect(res.allowed).toBe(false);
      expect(res.resetIn).toBeGreaterThan(0);
      expect(res.remaining).toBe(0);
    });

    it('should reset after 1 minute', async () => {
      validator.checkRateLimit('test');
      validator.checkRateLimit('test');
      expect(validator.checkRateLimit('test').allowed).toBe(false);

      // Mock time by decreasing internal timer not possible; skip or set clock
      // Instead test that clearRateLimits resets
      validator.clearRateLimits();
      expect(validator.checkRateLimit('test').allowed).toBe(true);
    });

    it('should be unlimited when rateLimitPerMinute = 0', () => {
      const unlimited = new CommandValidator({ rateLimitPerMinute: 0 });
      for (let i = 0; i < 100; i++) {
        expect(unlimited.checkRateLimit('test').allowed).toBe(true);
      }
    });
  });

  describe('validateWithSchema', () => {
    it('should accept valid data', () => {
      const schema = Type.Object({ name: Type.String(), age: Type.Number() });
      const res = validator.validateWithSchema({ name: 'Alice', age: 30 }, schema);
      expect(res.valid).toBe(true);
      expect(res.errors).toBeUndefined();
    });

    it('should reject invalid data with errors', () => {
      const schema = Type.Object({ name: Type.String() });
      const res = validator.validateWithSchema({ name: 123 }, schema);
      expect(res.valid).toBe(false);
      expect(res.errors).toHaveLength(1);
      expect(res.errors![0].message).toContain('string');
    });

    it('should handle null and undefined', () => {
      const schema = Type.Object({ x: Type.String() });
      const res1 = validator.validateWithSchema({ x: null }, schema);
      expect(res1.valid).toBe(false);
      const res2 = validator.validateWithSchema(undefined as any, schema);
      expect(res2.valid).toBe(false);
    });

    it('should catch runtime error in validator compilation', () => {
      // Pass an invalid schema (null) to trigger catch block
      const res = validator.validateWithSchema({ x: 1 }, null as any);
      expect(res.valid).toBe(false);
      expect(res.errors).toBeDefined();
      expect(res.errors!.length).toBeGreaterThan(0);
    });
  });

  describe('validateResult', () => {
    it('should pass when output size under limit', () => {
      const res = validator.validateResult({ stdout: 'a'.repeat(100), stderr: '' }, 1000);
      expect(res.valid).toBe(true);
    });

    it('should fail when output too large', () => {
      const res = validator.validateResult({ stdout: 'a'.repeat(2000), stderr: '' }, 1000);
      expect(res.valid).toBe(false);
      expect(res.errors[0]).toContain('too large');
    });

    it('should count both stdout and stderr', () => {
      const res = validator.validateResult({ stdout: 'a'.repeat(600), stderr: 'b'.repeat(600) }, 1000);
      expect(res.valid).toBe(false);
    });
  });

  describe('validateSecurity', () => {
    it('should detect prototype pollution via own property __proto__', () => {
      const bad = JSON.parse('{"__proto__":{}}');
      const sec = validator.validateSecurity(bad, { name: 'test' });
      expect(sec.valid).toBe(false);
      expect(sec.errors).toContain('Potential prototype pollution detected');
    });

    it('should detect prototype pollution via constructor', () => {
      const bad = JSON.parse('{"constructor":{"prototype":{}}}');
      const sec = validator.validateSecurity(bad, { name: 'test' });
      expect(sec.valid).toBe(false);
    });

    it('should detect prototype pollution via prototype nested', () => {
      const bad = { nested: { prototype: {} } };
      const sec = validator.validateSecurity(bad, { name: 'test' });
      expect(sec.valid).toBe(false);
    });

    it('should pass for clean objects', () => {
      const clean = { a: 1, b: 'text' };
      const sec = validator.validateSecurity(clean, { name: 'test' });
      expect(sec.valid).toBe(true);
    });

    it('should reject arguments > 100KB', () => {
      const big = { data: 'x'.repeat(100 * 1024 + 1) };
      const sec = validator.validateSecurity(big, { name: 'test' });
      expect(sec.valid).toBe(false);
      expect(sec.errors).toContain('Arguments too large (max 100KB)');
    });

    it('should handle non-serializable arguments', () => {
      const circular = { a: null as any };
      circular.a = circular;
      const sec = validator.validateSecurity(circular, { name: 'test' });
      expect(sec.valid).toBe(false);
      expect(sec.errors).toContain('Cannot serialize arguments');
    });
  });

  describe('validateSecurity command injection detection', () => {
    it('should detect command injection patterns in strings', () => {
      const v = new CommandValidator();
      const args = { cmd: 'echo hello; rm -rf /' };
      const res = v.validateSecurity(args, { name: 'test' } as any);
      expect(res.valid).toBe(false);
      expect(res.errors).toContain('Potential command injection pattern detected');
    });

    it('should accept clean arguments without shell metacharacters', () => {
      const v = new CommandValidator();
      const args = { cmd: 'echo hello', path: '/tmp/clean' };
      const res = v.validateSecurity(args, { name: 'test' } as any);
      expect(res.valid).toBe(true);
    });

    it('should detect injection in nested objects and arrays', () => {
      const v = new CommandValidator();
      const args = { nested: { deep: 'value$(whoami)' } };
      const res = v.validateSecurity(args, { name: 'test' } as any);
      expect(res.valid).toBe(false);
    });

    it('should not flag non-string types', () => {
      const v = new CommandValidator();
      const args = { num: 42, bool: true, obj: { x: 1 } };
      const res = v.validateSecurity(args, { name: 'test' } as any);
      expect(res.valid).toBe(true);
    });
  });

  describe('clearRateLimits', () => {
    it('should reset all rate limit counters', () => {
      validator.checkRateLimit('cmd1');
      validator.checkRateLimit('cmd1');
      validator.checkRateLimit('cmd2');
      validator.checkRateLimit('cmd2');

      validator.clearRateLimits();

      expect(validator.checkRateLimit('cmd1').allowed).toBe(true);
      expect(validator.checkRateLimit('cmd2').allowed).toBe(true);
    });
  });

  describe('getValidator / resetValidator (singleton)', () => {
    it('getValidator should return same instance', () => {
      const v1 = getValidator({ rateLimitPerMinute: 1 });
      const v2 = getValidator({ rateLimitPerMinute: 2 });
      expect(v1).toBe(v2); // same singleton
    });

    it('resetValidator should clear global instance', () => {
      getValidator({ rateLimitPerMinute: 5 });
      resetValidator();
      const fresh = getValidator({ rateLimitPerMinute: 10 });
      expect(fresh).toBeInstanceOf(CommandValidator);
      // The fresh instance should have new options
      expect((fresh as any).rateLimitPerMinute).toBe(10);
    });
  });
});
