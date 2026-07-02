import { describe, it, expect } from 'vitest';
import { VERSION } from '../index';

describe('index', () => {
  it('exposes VERSION', () => {
    expect(VERSION).toBe('0.0.1');
  });
});
