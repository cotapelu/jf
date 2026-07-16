import { describe, it, expect, beforeEach } from 'vitest';
import { AgentWorkspace } from '../agent-workspace.js';
import { SharedWorkspace } from '../workspace.js';

describe('AgentWorkspace coverage', () => {
  let shared: SharedWorkspace;
  let agentWs: AgentWorkspace;

  beforeEach(() => {
    shared = new SharedWorkspace();
    agentWs = new AgentWorkspace(shared);
  });

  it('clear() clears underlying workspace', () => {
    shared.set('a', 1, 'x');
    shared.set('b', 2, 'y');
    agentWs.clear();
    expect(shared.list()).toEqual([]);
  });

  it('set() writes to workspace', () => {
    agentWs.set('key', 'value', 'agent-1');
    expect(shared.get('key')).toBe('value');
    expect(shared.getEntry('key')).toEqual({
      value: 'value',
      owner: 'agent-1',
      timestamp: expect.any(Number),
    });
  });

  it('get() reads value from workspace', () => {
    shared.set('k', 'v', 'o');
    expect(agentWs.get('k')).toBe('v');
  });

  it('getEntry() returns metadata', () => {
    shared.set('k', 'v', 'o');
    const entry = agentWs.getEntry('k');
    expect(entry).toEqual({
      value: 'v',
      owner: 'o',
      timestamp: expect.any(Number),
    });
  });

  it('list() returns all keys', () => {
    shared.set('a', 1, 'x');
    shared.set('b', 2, 'y');
    expect(agentWs.list().sort()).toEqual(['a', 'b']);
  });

  it('listByPrefix() filters keys', () => {
    shared.set('abc-1', 'v1', 'x');
    shared.set('abc-2', 'v2', 'x');
    shared.set('xyz-1', 'v3', 'y');
    expect(agentWs.listByPrefix('abc')).toEqual(['abc-1', 'abc-2']);
  });

  it('delete() removes key and returns true', () => {
    shared.set('key', 'val', 'owner');
    expect(agentWs.delete('key')).toBe(true);
    expect(agentWs.list()).not.toContain('key');
  });

  it('delete() returns false if key missing', () => {
    expect(agentWs.delete('missing')).toBe(false);
  });

  it('toObject() returns copy of data', () => {
    shared.set('k1', 'v1', 'a');
    shared.set('k2', 'v2', 'b');
    const obj = agentWs.toObject();
    expect(obj).toEqual({ k1: 'v1', k2: 'v2' });
    // Ensure it's a copy, not reference
    obj.k1 = 'modified';
    expect(shared.get('k1')).toBe('v1');
  });

  it('underlying returns the SharedWorkspace instance', () => {
    expect(agentWs.underlying).toBe(shared);
  });
});
