#!/usr/bin/env node

/**
 * Tests for simple actions (equalizers)
 */

import { describe, it, expect } from 'vitest';
import { randomAction } from '../extensions/tools/actions/random-action';
import { dateAction } from '../extensions/tools/actions/date-action';
import { calcAction } from '../extensions/tools/actions/calc-action';
import { uuidAction } from '../extensions/tools/actions/uuid-action';
import { echoAction } from '../extensions/tools/actions/echo-action';

describe('random-action', () => {
  it('should generate a number within default 0-100', async () => {
    const result = await randomAction.execute({});
    const match = result.content[0].text.match(/Random number: (\d+)/);
    expect(match).not.toBeNull();
    const num = parseInt(match![1], 10);
    expect(num).toBeGreaterThanOrEqual(0);
    expect(num).toBeLessThanOrEqual(100);
    expect(result.details).toMatchObject({ min: 0, max: 100 });
  });

  it('should respect custom min/max', async () => {
    const result = await randomAction.execute({ min: 10, max: 20 });
    const match = result.content[0].text.match(/Random number: (\d+)/);
    const num = parseInt(match![1], 10);
    expect(num).toBeGreaterThanOrEqual(10);
    expect(num).toBeLessThanOrEqual(20);
    expect(result.details).toMatchObject({ min: 10, max: 20 });
  });

  it('should have correct schema', () => {
    const schema = randomAction.getParameters();
    expect(schema.type).toBe('object');
    expect(schema.properties).toHaveProperty('min');
    expect(schema.properties).toHaveProperty('max');
  });
});

describe('date-action', () => {
  it('should return current date/time in ISO and locale', async () => {
    const result = await dateAction.execute(); // no args
    expect(result.content).toHaveLength(2);
    expect(result.content[0].text).toMatch(/Current date\/time: \d{4}-\d{2}-\d{2}T/);
    expect(result.content[1].text).toMatch(/Human readable: /);
    expect(result.details).toHaveProperty('iso');
    expect(result.details).toHaveProperty('timestamp');
    expect(result.details).toHaveProperty('locale');
  });

  it('should have empty schema', () => {
    const schema = dateAction.getParameters();
    expect(schema.type).toBe('object');
    expect(schema.properties).toEqual({});
  });
});

describe('calc-action', () => {
  it('should evaluate simple arithmetic', async () => {
    const result = await calcAction.execute({ expression: '2 + 3 * 4' });
    expect(result.content[0].text).toBe('2 + 3 * 4 = 14');
    expect(result.details.result).toBe(14);
  });

  it('should handle parentheses', async () => {
    const result = await calcAction.execute({ expression: '(2+3)*4' });
    expect(result.details.result).toBe(20);
  });

  it('should reject invalid characters', async () => {
    // @ts-ignore
    await expect(calcAction.execute({ expression: '2 + "foo"' })).rejects.toThrow('Invalid expression');
    // @ts-ignore
    await expect(calcAction.execute({ expression: 'alert(1)' })).rejects.toThrow('Invalid expression');
  });

  it('should have correct schema', () => {
    const schema = calcAction.getParameters();
    expect(schema.type).toBe('object');
    expect(schema.properties).toHaveProperty('expression');
    expect(schema.required).toContain('expression');
  });
});

describe('uuid-action', () => {
  it('should generate a valid UUID v4', async () => {
    const result = await uuidAction.execute(); // no args
    const text = result.content[0].text;
    expect(text).toMatch(/^Generated UUID: [0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(result.details.uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('should have empty schema', () => {
    const schema = uuidAction.getParameters();
    expect(schema.type).toBe('object');
    expect(schema.properties).toEqual({});
  });
});

describe('echo-action', () => {
  it('should echo back the message', async () => {
    const result = await echoAction.execute({ message: 'Hello, world!' });
    expect(result.content[0].text).toBe('Echo: Hello, world!');
    expect(result.details).toBe('Hello, world!');
  });

  it('should throw if message missing', async () => {
    // @ts-ignore - testing missing required param
    await expect(echoAction.execute({})).rejects.toThrow("Missing required parameter 'message' for echo action");
  });

  it('should have correct schema', () => {
    const schema = echoAction.getParameters();
    expect(schema.type).toBe('object');
    expect(schema.properties).toHaveProperty('message');
    expect(schema.required).toContain('message');
  });
});
