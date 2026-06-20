import { describe, it, expect, vi } from 'vitest';

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

describe('Session Router Handoff Operations', () => {
  it('should route prepare_child operation when mission provided', async () => {
    const { createSessionToolRouter } = await import('../tools/session/router.js');
    const router = createSessionToolRouter({
      initialize: () => ({
        createChild: async () => ({ id: 'child-1', name: 'child1', tags: [], parentId: 'p', filePath: '/f', createdAt: new Date(), state: 'active', isActive: true } as any),
      } as any),
    });

    const result = await router.execute('test', { operation: 'prepare_child', contract: { mission: 'Test' } });
    expect(result.isError).not.toBe(true);
    expect(result.content[0].text).toContain('Prepared child');
  });

  it('should validate missing contract.mission for prepare_child', async () => {
    const { createSessionToolRouter } = await import('../tools/session/router.js');
    const router = createSessionToolRouter({
      initialize: () => ({ createChild: async () => ({ id: 'c' } as any) } as any),
    });

    const result = await router.execute('test', { operation: 'prepare_child', contract: {} });
    expect(result.isError).toBe(true); // should be true for error
    expect(result.content[0].text).toContain('contract.mission is required');
  });

  it('should route child_read operation', async () => {
    const { createSessionToolRouter } = await import('../tools/session/router.js');
    const router = createSessionToolRouter({
      initialize: () => ({
        getActive: () => ({ id: 'child-1' } as any),
      } as any),
    });

    const result = await router.execute('test', { operation: 'child_read' });
    expect(result.isError).not.toBe(true);
    expect(result.content[0].text).toContain('Contract content');
  });

  it('should validate missing content for child_write', async () => {
    const { createSessionToolRouter } = await import('../tools/session/router.js');
    const router = createSessionToolRouter({
      initialize: () => ({
        getActive: () => ({ id: 'child-1' } as any),
      } as any),
    });

    const result = await router.execute('test', { operation: 'child_write', content: '' });
    // According to router, if content is provided but empty string, it's truthy, but they check `if (!params.content)`. Empty string is falsy.
    // So empty string should trigger error.
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('content is required');
  });

  it('should route child_write with content', async () => {
    const { createSessionToolRouter } = await import('../tools/session/router.js');
    const router = createSessionToolRouter({
      initialize: () => ({
        getActive: () => ({ id: 'child-1' } as any),
        addTags: () => ({} as any),
      } as any),
    });

    const result = await router.execute('test', { operation: 'child_write', content: 'output data' });
    expect(result.isError).not.toBe(true);
    expect(result.content[0].text).toContain('Output written');
  });

  it('should validate missing sessionId for parent_read', async () => {
    const { createSessionToolRouter } = await import('../tools/session/router.js');
    const router = createSessionToolRouter({
      initialize: () => ({
        get: () => ({} as any),
      } as any),
    });

    const result = await router.execute('test', { operation: 'parent_read' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('sessionId is required');
  });

  it('should route parent_read with sessionId', async () => {
    const { createSessionToolRouter } = await import('../tools/session/router.js');
    const router = createSessionToolRouter({
      initialize: () => ({
        get: () => ({ id: 'child-1', filePath: '/f' } as any),
      } as any),
    });

    const result = await router.execute('test', { operation: 'parent_read', sessionId: 'child-1' });
    expect(result.isError).not.toBe(true);
    expect(result.content[0].text).toContain('Parent read');
  });

  it('should route complete_child operation', async () => {
    const { createSessionToolRouter } = await import('../tools/session/router.js');
    const router = createSessionToolRouter({
      initialize: () => ({
        getActive: () => ({ id: 'child-1' } as any),
        addTags: () => ({} as any),
      } as any),
    });

    const result = await router.execute('test', { operation: 'complete_child' });
    expect(result.isError).not.toBe(true);
    expect(result.content[0].text).toContain('Child completed');
  });
});
