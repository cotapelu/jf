import { describe, it, expect, vi } from 'vitest';
import { operationSwitch } from '../operations/switch.js';
import type { MultiSessionManager } from '../manager.js';

// Minimal metadata for get() return
function meta(id: string, name?: string, isActive = false): any {
  return { id, name: name || id, filePath: `/path/${id}`, isActive, tags: [], createdAt: new Date() };
}

// Create manager with mocked methods
function createMockManager(overrides: Partial<MultiSessionManager> = {}): MultiSessionManager {
  return {
    getRoot: vi.fn(),
    getChildren: vi.fn(() => []),
    get: vi.fn(),
    getActive: vi.fn(),
    switchTo: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as any as MultiSessionManager;
}

describe('operationSwitch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('branch coverage for targetId resolution', () => {
    it('should handle "parent" alias (first ternary true)', async () => {
      const mgr = createMockManager({
        getRoot: vi.fn(() => meta('root-1')),
        get: vi.fn((id) => meta(id)),
      });

      const result = await operationSwitch(mgr, { sessionId: 'parent' });

      expect(mgr.getRoot).toHaveBeenCalled();
      expect(mgr.switchTo).toHaveBeenCalledWith('root-1');
      expect(result.content[0].text).toContain('Switched to session');
    });

    it('should handle "last" alias - takes first child from getChildren()', async () => {
      const children = [
        meta('child-1', 'c1', false),
        meta('child-2', 'c2', false),
      ];
      const mgr = createMockManager({
        getRoot: vi.fn(() => meta('root-1')),
        getChildren: vi.fn(() => children),
        get: vi.fn((id) => children.find((c) => c.id === id) || meta(id)),
      });

      const result = await operationSwitch(mgr, { sessionId: 'last' });

      expect(mgr.getChildren).toHaveBeenCalled();
      // getChildren()[0] is used directly
      expect(mgr.switchTo).toHaveBeenCalledWith('child-1');
    });

    it('should throw when "last" alias but no children', async () => {
      const mgr = createMockManager({
        getRoot: vi.fn(() => meta('root-1')),
        getChildren: vi.fn(() => []),
      });

      await expect(operationSwitch(mgr, { sessionId: 'last' }))
        .rejects.toThrow('Target session not specified or not found');
    });

    it('should use explicit sessionId directly', async () => {
      const mgr = createMockManager({
        get: vi.fn(() => meta('explicit')),
        switchTo: vi.fn().mockResolvedValue(undefined),
      });

      const result = await operationSwitch(mgr, { sessionId: 'explicit' });

      expect(mgr.switchTo).toHaveBeenCalledWith('explicit');
      expect(result.details.sessionId).toBe('explicit');
    });

    it('should throw when targetId resolves to falsy', async () => {
      const mgr = createMockManager();

      await expect(operationSwitch(mgr, { sessionId: '' }))
        .rejects.toThrow('Target session not specified or not found');
    });

    it('should propagate error when switchTo fails', async () => {
      const mgr = createMockManager({
        get: vi.fn(() => meta('target')),
        switchTo: vi.fn().mockRejectedValue(new Error('Switch failed')),
      });

      await expect(operationSwitch(mgr, { sessionId: 'target' }))
        .rejects.toThrow('Switch failed');
    });

    it('should include activeSession in details', async () => {
      const mgr = createMockManager({
        get: vi.fn(() => meta('target', 'Target', true)),
        getActive: vi.fn(() => meta('target', 'Target', true)),
      });

      const result = await operationSwitch(mgr, { sessionId: 'target' });

      expect(result.details.activeSession).toBe('target');
    });
  });
});
