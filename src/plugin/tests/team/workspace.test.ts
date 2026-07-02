#!/usr/bin/env node

import { describe, it, expect, beforeEach } from 'vitest';
import { SharedWorkspace } from '../../extensions/team/workspace.js';

describe('SharedWorkspace', () => {
  let workspace: SharedWorkspace;

  beforeEach(() => {
    workspace = new SharedWorkspace();
  });

  it('set should store value', () => {
    workspace.set('k', 'v', 'a1');
    expect(workspace.get('k')).toBe('v');
  });

  it('getEntry returns metadata', () => {
    workspace.set('k', 'v', 'a1');
    const entry = workspace.getEntry('k');
    expect(entry?.owner).toBe('a1');
    expect(entry?.value).toBe('v');
    expect(entry?.timestamp).toBeGreaterThan(0);
  });

  it('list returns all keys', () => {
    workspace.set('a', '1', 'x');
    workspace.set('b', '2', 'y');
    expect(workspace.list().sort()).toEqual(['a', 'b']);
  });

  it('listByPrefix filters keys', () => {
    workspace.set('task:1', '...', 'x');
    workspace.set('task:2', '...', 'x');
    workspace.set('note:1', '...', 'x');
    expect(workspace.listByPrefix('task:')).toEqual(['task:1', 'task:2']);
  });

  it('delete removes key', () => {
    workspace.set('k', 'v', 'x');
    expect(workspace.delete('k')).toBe(true);
    expect(workspace.get('k')).toBeUndefined();
  });

  it('clear removes all', () => {
    workspace.set('a', '1', 'x');
    workspace.set('b', '2', 'x');
    workspace.clear();
    expect(workspace.list()).toEqual([]);
  });

  it('toObject returns plain object', () => {
    workspace.set('x', '10', 'a');
    workspace.set('y', '20', 'b');
    expect(workspace.toObject()).toEqual({ x: '10', y: '20' });
  });
});
