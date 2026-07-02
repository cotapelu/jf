import { describe, it, expect, vi } from 'vitest';
import type { SessionMetadata } from '../tools/session/registry.js';
import { SessionState } from '../tools/session/registry.js';
import type { MultiSessionManager } from '../tools/session/manager.js';

// Mock handoff operations to avoid filesystem dependencies
vi.mock('../tools/session/operations/handoff.js', () => ({
  operationPrepareChild: async () => ({
    content: [{ type: 'text', text: 'Prepared child child-1' }],
    details: { sessionId: 'child-1', contractPath: '/bus' },
  }),
  operationChildRead: async () => ({
    content: [{ type: 'text', text: 'Contract content' }],
    details: { sessionId: 'child-1', contractPath: '/bus' },
  }),
  operationChildWrite: async () => ({
    content: [{ type: 'text', text: 'Output written' }],
    details: { sessionId: 'child-1', outputPath: '/out' },
  }),
  operationParentRead: async () => ({
    content: [{ type: 'text', text: 'Parent read' }],
    details: { sessionId: 'child-1', output: '...', status: {} },
  }),
  operationCompleteChild: async () => ({
    content: [{ type: 'text', text: 'Child completed' }],
    details: { sessionId: 'child-1' },
  }),
}));

// Helper to create a minimal SessionMetadata-like object
function mockSession(overrides: Partial<SessionMetadata> = {}): SessionMetadata {
  return {
    id: 's1',
    filePath: '/f',
    parentId: null,
    createdAt: new Date(),
    name: undefined,
    tags: [],
    state: SessionState.ACTIVE,
    sessionRef: null,
    isActive: false,
    ...overrides,
  } as unknown as SessionMetadata; // assertion because required fields may be missing
}

describe('Session Router Handoff Operations', () => {
  it('should route prepare_child operation when mission provided', async () => {
    const { createSessionToolRouter } = await import('../tools/session/router.js');
    const router = createSessionToolRouter({
      initialize: () => ({
        createChild: async (): Promise<SessionMetadata> => mockSession({ id: 'child-1', name: 'child1', isActive: true }),
      } as unknown as MultiSessionManager),
    });

    const result = await router.execute('test', { operation: 'prepare_child', contract: { mission: 'Test' } });
    expect(result.isError).not.toBe(true);
    expect(result.content[0].text).toContain('Prepared child');
  });

  it('should validate missing contract.mission for prepare_child', async () => {
    const { createSessionToolRouter } = await import('../tools/session/router.js');
    const router = createSessionToolRouter({
      initialize: () => ({
        createChild: async (): Promise<SessionMetadata> => mockSession({ id: 'c' }),
      } as unknown as MultiSessionManager),
    });

    const result = await router.execute('test', { operation: 'prepare_child', contract: {} });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('contract.mission is required');
  });

  it('should route child_read operation', async () => {
    const { createSessionToolRouter } = await import('../tools/session/router.js');
    const router = createSessionToolRouter({
      initialize: () => ({
        getActive: (): SessionMetadata | null => mockSession({ id: 'child-1' }),
      } as unknown as MultiSessionManager),
    });

    const result = await router.execute('test', { operation: 'child_read' });
    expect(result.isError).not.toBe(true);
    expect(result.content[0].text).toContain('Contract content');
  });

  it('should validate missing content for child_write', async () => {
    const { createSessionToolRouter } = await import('../tools/session/router.js');
    const router = createSessionToolRouter({
      initialize: () => ({
        getActive: (): SessionMetadata | null => mockSession({ id: 'child-1' }),
        addTags: async (): Promise<any> => ({}),
      } as unknown as MultiSessionManager),
    });

    const result = await router.execute('test', { operation: 'child_write', content: '' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('content is required');
  });

  it('should route child_write with content', async () => {
    const { createSessionToolRouter } = await import('../tools/session/router.js');
    const router = createSessionToolRouter({
      initialize: () => ({
        getActive: (): SessionMetadata | null => mockSession({ id: 'child-1' }),
        addTags: async (): Promise<any> => ({}),
      } as unknown as MultiSessionManager),
    });

    const result = await router.execute('test', { operation: 'child_write', content: 'output data' });
    expect(result.isError).not.toBe(true);
    expect(result.content[0].text).toContain('Output written');
  });

  it('should validate missing sessionId for parent_read', async () => {
    const { createSessionToolRouter } = await import('../tools/session/router.js');
    const router = createSessionToolRouter({
      initialize: () => ({
        get: (): SessionMetadata | null => mockSession({ id: 'child-1' }),
      } as unknown as MultiSessionManager),
    });

    const result = await router.execute('test', { operation: 'parent_read' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('sessionId is required');
  });

  it('should route parent_read with sessionId', async () => {
    const { createSessionToolRouter } = await import('../tools/session/router.js');
    const router = createSessionToolRouter({
      initialize: () => ({
        get: (): SessionMetadata | null => mockSession({ id: 'child-1', filePath: '/f' }),
      } as unknown as MultiSessionManager),
    });

    const result = await router.execute('test', { operation: 'parent_read', sessionId: 'child-1' });
    expect(result.isError).not.toBe(true);
    expect(result.content[0].text).toContain('Parent read');
  });

  it('should route complete_child operation', async () => {
    const { createSessionToolRouter } = await import('../tools/session/router.js');
    const router = createSessionToolRouter({
      initialize: () => ({
        getActive: (): SessionMetadata | null => mockSession({ id: 'child-1' }),
        addTags: async (): Promise<any> => ({}),
      } as unknown as MultiSessionManager),
    });

    const result = await router.execute('test', { operation: 'complete_child' });
    expect(result.isError).not.toBe(true);
    expect(result.content[0].text).toContain('Child completed');
  });
});
