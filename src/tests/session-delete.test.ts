import { describe, it, expect, beforeEach, vi } from 'vitest';
import { operationDelete } from '../tools/session/operations/delete.js';
import type { MultiSessionManager } from '../tools/session/manager.js';

describe('operationDelete', () => {
  let mgr: MultiSessionManager;

  beforeEach(() => {
    mgr = {
      dispose: vi.fn(),
      getActive: vi.fn(),
    } as unknown as MultiSessionManager;
  });

  it('deletes session by explicit sessionId', async () => {
    (mgr.dispose as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    const result = await operationDelete(mgr, { sessionId: 's1' });
    expect(result.details).toMatchObject({ operation: 'delete', sessionId: 's1' });
    expect(mgr.dispose).toHaveBeenCalledWith('s1');
  });

  it('deletes active session when sessionId omitted', async () => {
    (mgr.getActive as ReturnType<typeof vi.fn>).mockReturnValue({ id: 'active1' });
    (mgr.dispose as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    const result = await operationDelete(mgr, {});
    expect(result.details.sessionId).toBe('active1');
    expect(mgr.dispose).toHaveBeenCalledWith('active1');
  });

  it('throws when no active session and no sessionId', async () => {
    (mgr.getActive as ReturnType<typeof vi.fn>).mockReturnValue(null);
    await expect(operationDelete(mgr, {})).rejects.toThrow(
      'No active session and no sessionId provided'
    );
  });
});
