import { AgentTeam } from '../team-manager.js';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('AgentTeam handleAgentEvent additional branches', () => {
  let team: AgentTeam;

  beforeEach(() => {
    team = new AgentTeam();
    team.id = 'test';
    team.setOnUpdate(() => {}); // no-op
  });

  function callHandle(role: string, event: any) {
    (team as any).handleAgentEvent(role, event);
  }

  it('should not notify for tool_execution_start without toolName', () => {
    const notifySpy = vi.spyOn(team, 'notifyUpdate');
    callHandle('agent-1', { type: 'tool_execution_start' });
    expect(notifySpy).not.toHaveBeenCalled();
  });

  it('should not notify for tool_execution_end without toolName', () => {
    const notifySpy = vi.spyOn(team, 'notifyUpdate');
    callHandle('agent-1', { type: 'tool_execution_end' });
    expect(notifySpy).not.toHaveBeenCalled();
  });

  it('should not notify for message_start with non-user/assistant role', () => {
    const notifySpy = vi.spyOn(team, 'notifyUpdate');
    callHandle('agent-1', {
      type: 'message_start',
      message: { role: 'system', content: 'ignore' },
    });
    expect(notifySpy).not.toHaveBeenCalled();
  });

  it('should not notify for unknown event type (default case)', () => {
    const notifySpy = vi.spyOn(team, 'notifyUpdate');
    callHandle('agent-1', { type: 'foo_bar' });
    expect(notifySpy).not.toHaveBeenCalled();
  });
});
