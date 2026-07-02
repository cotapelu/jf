import { describe, it, expect, beforeEach } from 'vitest';
import { SharedWorkspace } from '../extensions/team/workspace.js';

describe('SharedWorkspace', () => {
  let workspace: SharedWorkspace;

  beforeEach(() => {
    workspace = new SharedWorkspace();
  });

  describe('set/get', () => {
    it('should store and retrieve values', () => {
      workspace.set('key1', 'value1', 'agent-1');
      expect(workspace.get('key1')).toBe('value1');
    });

    it('should return undefined for missing keys', () => {
      expect(workspace.get('missing')).toBeUndefined();
    });

    it('should store entry metadata', () => {
      workspace.set('key', 'val', 'agent-2');
      const entry = workspace.getEntry('key');
      expect(entry?.owner).toBe('agent-2');
      expect(entry?.value).toBe('val');
      expect(entry?.timestamp).toBeTypeOf('number');
    });
  });

  describe('list', () => {
    it('should list all keys', () => {
      workspace.set('a', 1, 'agent-1');
      workspace.set('b', 2, 'agent-1');
      workspace.set('c', 3, 'agent-1');
      expect(workspace.list()).toHaveLength(3);
      expect(workspace.list()).toContain('a');
      expect(workspace.list()).toContain('b');
      expect(workspace.list()).toContain('c');
    });

    it('should return empty array when empty', () => {
      expect(workspace.list()).toEqual([]);
    });
  });

  describe('listByPrefix', () => {
    it('should filter keys by prefix', () => {
      workspace.set('task:1', 'a', 'a');
      workspace.set('task:2', 'b', 'b');
      workspace.set('note:1', 'c', 'c');
      expect(workspace.listByPrefix('task:')).toHaveLength(2);
      expect(workspace.listByPrefix('note:')).toHaveLength(1);
    });

    it('should return empty array when no matches', () => {
      workspace.set('x', 1, 'a');
      expect(workspace.listByPrefix('nonexistent:')).toEqual([]);
    });
  });

  describe('delete', () => {
    it('should remove keys', () => {
      workspace.set('key', 'val', 'a');
      expect(workspace.delete('key')).toBe(true);
      expect(workspace.get('key')).toBeUndefined();
    });

    it('should return false for missing keys', () => {
      expect(workspace.delete('missing')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should remove all entries', () => {
      workspace.set('a', 1, 'a');
      workspace.set('b', 2, 'b');
      workspace.clear();
      expect(workspace.list()).toEqual([]);
    });
  });

  describe('toObject', () => {
    it('should return plain object with values', () => {
      workspace.set('x', 10, 'a');
      workspace.set('y', 20, 'b');
      const obj = workspace.toObject();
      expect(obj).toEqual({ x: 10, y: 20 });
    });

    it('should not include metadata', () => {
      workspace.set('k', 'v', 'owner');
      const obj = workspace.toObject();
      expect(Object.keys(obj)).toHaveLength(1);
      expect(obj.k).toBe('v');
    });
  });
});
