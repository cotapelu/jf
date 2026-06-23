import { describe, it, expect, vi } from 'vitest';
import { operationRename } from '../operations/rename.js';
import type { MultiSessionManager } from '../manager.js';

function meta(id: string, name: string): any {
  return { id, name, filePath: `/path/${id}`, isActive: false, tags: [], createdAt: new Date() };
}

function createMockManager(overrides: Partial<MultiSessionManager> = {}): MultiSessionManager {
  return {
    getActive: vi.fn(),
    rename: vi.fn(),
    ...overrides,
  } as any as MultiSessionManager;
}

describe('operationRename', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('branch coverage', () => {
    it('should throw when no sessionId and no active session', () => {
      const mgr = createMockManager({ getActive: vi.fn(() => null) });

      expect(() => operationRename(mgr, { name: 'new' }))
        .toThrow('No active session and no sessionId provided');
    });

    it('should use explicit sessionId over active', () => {
      const mgr = createMockManager({
        getActive: vi.fn(() => meta('active', 'Active')),
        rename: vi.fn(() => meta('explicit', 'NewName')),
      });

      const result = operationRename(mgr, { sessionId: 'explicit', name: 'NewName' });

      expect(mgr.rename).toHaveBeenCalledWith('explicit', 'NewName');
      expect(result.content[0].text).toContain('Renamed session');
    });

    it('should throw when name is missing', () => {
      const mgr = createMockManager({ getActive: vi.fn(() => meta('active', 'Active')) });

      expect(() => operationRename(mgr, { sessionId: 'active' }))
        .toThrow('Name is required for rename operation');
    });

    it('should throw when rename returns null (session not found)', () => {
      const mgr = createMockManager({
        getActive: vi.fn(() => meta('active', 'Active')),
        rename: vi.fn(() => null),
      });

      expect(() => operationRename(mgr, { sessionId: 'missing', name: 'New' }))
        .toThrow('Session not found: missing');
    });

    it('should return success message with details', () => {
      const mgr = createMockManager({
        getActive: vi.fn(() => meta('active', 'Active')),
        rename: vi.fn(() => meta('active', 'NewName')),
      });

      const result = operationRename(mgr, { name: 'NewName' });

      expect(result.content[0].text).toBe('✏️ Renamed session active to "NewName"');
      expect(result.details).toEqual({
        operation: 'rename',
        sessionId: 'active',
        newName: 'NewName',
      });
    });

    it('should use active session when sessionId omitted', () => {
      const mgr = createMockManager({
        getActive: vi.fn(() => meta('active', 'Active')),
        rename: vi.fn(() => meta('active', 'Renamed')),
      });

      operationRename(mgr, { name: 'Renamed' });

      expect(mgr.rename).toHaveBeenCalledWith('active', 'Renamed');
    });
  });
});
