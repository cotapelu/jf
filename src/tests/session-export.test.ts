import { describe, it, expect, beforeEach, vi } from 'vitest';
import { operationExport } from '../tools/session/operations/export.js';
import type { MultiSessionManager } from '../tools/session/manager.js';

// Treat mgr as any to avoid complex typing in tests
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mgr: any = {};

describe('operationExport', () => {
  let mgr!: any;
  let mockRegistry: any;
  let mockSession: any;

  function createMockSession(id: string, name?: string) {
    return {
      id,
      name,
      created: new Date(),
      disposed: false,
      parent: null,
      children: [],
      tags: [],
      history: [],
    };
  }

  beforeEach(() => {
    mockRegistry = {
      getActive: vi.fn(),
      get: vi.fn(),
    };
    mockSession = createMockSession('sess1', 'My Session');
    (mgr as any) = {
      getActive: () => mockRegistry.getActive(),
      get: (id: string) => (id === 'sess1' ? mockSession : undefined),
    };
  });

  it('exports with explicit sessionId, format=json, custom path', () => {
    mockRegistry.getActive.mockReturnValue(null);
    const result = operationExport(mgr as any, { sessionId: 'sess1', exportFormat: 'json', exportPath: '/custom/path.json' });
    expect(result.details).toMatchObject({
      operation: 'export',
      sessionId: 'sess1',
      format: 'json',
      path: '/custom/path.json',
    });
    expect(result.content.length).toBeGreaterThan(0);
    expect(result.content[0].text).toContain('Exported session sess1');
  });

  it('exports using active session when sessionId omitted', () => {
    mockRegistry.getActive.mockReturnValue(mockSession);
    const result = operationExport(mgr as any, {});
    expect(result.details).toMatchObject({
      sessionId: 'sess1',
      format: 'json',
    });
    expect(result.details.path).toMatch(/^session-my_session-\d+\.json$/);
  });

  it('generates filename based on session name and timestamp', () => {
    mockRegistry.getActive.mockReturnValue(mockSession);
    const result = operationExport(mgr as any, { exportFormat: 'html' });
    expect(result.details.path).toMatch(/^session-my_session-\d+\.html$/);
  });

  it('throws when no active session and no sessionId', () => {
    mockRegistry.getActive.mockReturnValue(null);
    expect(() => operationExport(mgr as any, {})).toThrow('No active session and no sessionId provided');
  });

  it('throws when sessionId not found', () => {
    mockRegistry.getActive.mockReturnValue(null);
    expect(() => operationExport(mgr as any, { sessionId: 'unknown' })).toThrow('Session not found: unknown');
  });

  it('defaults to json format when not specified', () => {
    mockRegistry.getActive.mockReturnValue(mockSession);
    const result = operationExport(mgr as any, {});
    expect(result.details.format).toBe('json');
  });

  it('handles session name with special characters sanitization', () => {
    const specialSession = createMockSession('sess2', 'Test@Session#123');
    (mgr as any).get = (id: string) => (id === 'sess2' ? specialSession : undefined);
    mockRegistry.getActive.mockReturnValue(null);
    const result = operationExport(mgr as any, { sessionId: 'sess2' });
    expect(result.details.path).toMatch(/^session-test_session_123-\d+\.json$/);
  });
});
