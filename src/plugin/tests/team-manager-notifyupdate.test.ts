import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentTeam } from '../extensions/team/team-manager.js';

describe('AgentTeam notifyUpdate error handling', () => {
  it('should catch errors in onUpdate and log warning', () => {
    const team = new AgentTeam();
    // Assign an onUpdate that throws
    // @ts-ignore - onUpdate is not declared but used for testing error handling
    team.onUpdate = () => { throw new Error('Update failed'); };
    // Spy on console.warn
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Call notifyUpdate with a dummy update
    team.notifyUpdate({ content: [{ type: 'text', text: 'test' }] });
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to send update'), expect.any(Error));
  });
});
