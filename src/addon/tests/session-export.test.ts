import { describe, it, expect, beforeEach, vi } from 'vitest';
import { operationExport } from '../tools/session/operations/export.js';
import type { MultiSessionManager } from '../tools/session/manager.js';

describe('operationExport', () => {
  let mgr: MultiSessionManager;
  let mockSession: any;

  function createMockSession(id: string, name?: string): any {
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
    const getActive = vi.fn();
    const get = vi.fn();
    mockSession = createMockSession('sess1', 'My Session');
    get.mockImplementation((id: string) => (id === 'sess1' ? mockSession : undefined));
    mgr = {
      getActive,
      get,
    } as unknown as MultiSessionManager;
  });

  it('exports with explicit sessionId, format=json, custom path', () => {
    (mgr.getActive as ReturnType<typeof vi.fn>).mockReturnValue(null);
    const result = operationExport(mgr, { sessionId: 'sess1', exportFormat: 'json', exportPath: '/custom/path.json' });
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
    (mgr.getActive as ReturnType<typeof vi.fn>).mockReturnValue(mockSession);
    const result = operationExport(mgr, {});
    expect(result.details).toMatchObject({
      sessionId: 'sess1',
      format: 'json',
    });
    expect(result.details.path).toMatch(/^session-my_session-\d+\.json$/);
  });

  it('generates filename based on session name and timestamp', () => {
    (mgr.getActive as ReturnType<typeof vi.fn>).mockReturnValue(mockSession);
    const result = operationExport(mgr, { exportFormat: 'html' });
    expect(result.details.path).toMatch(/^session-my_session-\d+\.html$/);
  });

  it('throws when no active session and no sessionId', () => {
    (mgr.getActive as ReturnType<typeof vi.fn>).mockReturnValue(null);
    expect(() => operationExport(mgr, {})).toThrow('No active session and no sessionId provided');
  });

  it('throws when sessionId not found', () => {
    (mgr.getActive as ReturnType<typeof vi.fn>).mockReturnValue(null);
    expect(() => operationExport(mgr, { sessionId: 'unknown' })).toThrow('Session not found: unknown');
  });

  it('defaults to json format when not specified', () => {
    (mgr.getActive as ReturnType<typeof vi.fn>).mockReturnValue(mockSession);
    const result = operationExport(mgr, {});
    expect(result.details.format).toBe('json');
  });

  it('handles session name with special characters sanitization', () => {
    const specialSession = createMockSession('sess2', 'Test@Session#123');
    (mgr.get as ReturnType<typeof vi.fn>).mockImplementation((id: string) => (id === 'sess2' ? specialSession : undefined));
    (mgr.getActive as ReturnType<typeof vi.fn>).mockReturnValue(null);
    const result = operationExport(mgr, { sessionId: 'sess2' });
    expect(result.details.path).toMatch(/^session-test_session_123-\d+\.json$/);
  });
});
