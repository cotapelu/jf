import { describe, it, expect } from 'vitest';
import { SharedWorkspace } from '../workspace.js';

describe('SharedWorkspace coverage gaps', () => {
  it('should listByPrefix return filtered keys', () => {
    const ws = new SharedWorkspace();
    ws.set('abc-1', 'v1', 'a');
    ws.set('abc-2', 'v2', 'a');
    ws.set('xyz-1', 'v3', 'b');
    const keys = ws.listByPrefix('abc');
    expect(keys).toEqual(['abc-1', 'abc-2']);
  });

  it('should listByPrefix return empty when no match', () => {
    const ws = new SharedWorkspace();
    ws.set('abc-1', 'v1', 'a');
    const keys = ws.listByPrefix('none');
    expect(keys).toEqual([]);
  });

  it('should getEntry return undefined for missing key', () => {
    const ws = new SharedWorkspace();
    expect(ws.getEntry('missing')).toBeUndefined();
  });

  it('should toObject return plain object with values', () => {
    const ws = new SharedWorkspace();
    ws.set('k1', 'v1', 'a');
    ws.set('k2', 123, 'b');
    const obj = ws.toObject();
    expect(obj).toEqual({ k1: 'v1', k2: 123 });
  });
});
