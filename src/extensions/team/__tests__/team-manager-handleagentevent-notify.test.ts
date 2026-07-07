import { AgentTeam } from '../team-manager.js';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('AgentTeam handleAgentEvent notify branches', () => {
  let team: AgentTeam;

  beforeEach(() => {
    team = new AgentTeam();
    team.id = 'test';
    team.setOnUpdate(() => {}); // no-op, but we'll spy
  });

  function callHandle(role: string, event: any) {
    (team as any).handleAgentEvent(role, event);
  }

  it('should notify for agent_start event', () => {
    const notifySpy = vi.spyOn(team, 'notifyUpdate');
    callHandle('agent-1', { type: 'agent_start' });
    expect(notifySpy).toHaveBeenCalledOnce();
    const update = notifySpy.mock.calls[0][0];
    expect(update.content[0].text).toContain('[agent-1] Agent started');
    expect(update.details).toEqual({ role: 'agent-1', eventType: 'agent_start' });
    expect(update.isError).toBe(false);
  });

  it('should notify for agent_end with non-error stopReason', () => {
    const notifySpy = vi.spyOn(team, 'notifyUpdate');
    callHandle('agent-1', { type: 'agent_end', stopReason: 'completed' });
    expect(notifySpy).toHaveBeenCalledOnce();
    const update = notifySpy.mock.calls[0][0];
    expect(update.content[0].text).toContain('Agent finished: completed');
    expect(update.isError).toBe(false);
  });

  it('should notify for agent_end with error stopReason (isError=true)', () => {
    const notifySpy = vi.spyOn(team, 'notifyUpdate');
    callHandle('agent-1', { type: 'agent_end', stopReason: 'error' });
    expect(notifySpy).toHaveBeenCalledOnce();
    const update = notifySpy.mock.calls[0][0];
    expect(update.content[0].text).toContain('Agent finished: error');
    expect(update.isError).toBe(true);
  });

  it('should notify for message_start with user role', () => {
    const notifySpy = vi.spyOn(team, 'notifyUpdate');
    callHandle('agent-1', {
      type: 'message_start',
      message: { role: 'user', content: 'Hello world' }
    });
    expect(notifySpy).toHaveBeenCalledOnce();
    const update = notifySpy.mock.calls[0][0];
    expect(update.content[0].text).toContain('[agent-1] User: Hello world');
    expect(update.details).toEqual({ role: 'agent-1', eventType: 'message_start' });
  });

  it('should notify for message_start with assistant role', () => {
    const notifySpy = vi.spyOn(team, 'notifyUpdate');
    callHandle('agent-1', {
      type: 'message_start',
      message: { role: 'assistant', content: 'Hi there' }
    });
    expect(notifySpy).toHaveBeenCalledOnce();
    const update = notifySpy.mock.calls[0][0];
    expect(update.content[0].text).toContain('[agent-1] Assistant: Hi there');
  });

  it('should not notify for message_start with other roles', () => {
    const notifySpy = vi.spyOn(team, 'notifyUpdate');
    callHandle('agent-1', {
      type: 'message_start',
      message: { role: 'system', content: 'ignore' }
    });
    expect(notifySpy).not.toHaveBeenCalled();
  });

  it('should notify for tool_execution_start with toolName', () => {
    const notifySpy = vi.spyOn(team, 'notifyUpdate');
    callHandle('agent-1', { type: 'tool_execution_start', toolName: 'bash' });
    expect(notifySpy).toHaveBeenCalledOnce();
    const update = notifySpy.mock.calls[0][0];
    expect(update.content[0].text).toContain('[agent-1] Tool: bash');
  });

  it('should not notify for tool_execution_start without toolName', () => {
    const notifySpy = vi.spyOn(team, 'notifyUpdate');
    callHandle('agent-1', { type: 'tool_execution_start' });
    expect(notifySpy).not.toHaveBeenCalled();
  });

  it('should notify for tool_execution_end with toolName', () => {
    const notifySpy = vi.spyOn(team, 'notifyUpdate');
    callHandle('agent-1', { type: 'tool_execution_end', toolName: 'read' });
    expect(notifySpy).toHaveBeenCalledOnce();
    const update = notifySpy.mock.calls[0][0];
    expect(update.content[0].text).toContain('[agent-1] Tool read done');
  });

  it('should not notify for tool_execution_end without toolName', () => {
    const notifySpy = vi.spyOn(team, 'notifyUpdate');
    callHandle('agent-1', { type: 'tool_execution_end' });
    expect(notifySpy).not.toHaveBeenCalled();
  });

  it('should not notify for message_update', () => {
    const notifySpy = vi.spyOn(team, 'notifyUpdate');
    callHandle('agent-1', { type: 'message_update', message: { role: 'user', content: 'streaming' } });
    expect(notifySpy).not.toHaveBeenCalled();
  });

  it('should handle message_start with content array (multiple parts)', () => {
    const notifySpy = vi.spyOn(team, 'notifyUpdate');
    callHandle('agent-1', {
      type: 'message_start',
      message: {
        role: 'user',
        content: [
          { type: 'text', text: ' Part1' },
          { type: 'text', text: ' Part2' }
        ]
      }
    });
    expect(notifySpy).toHaveBeenCalledOnce();
    const update = notifySpy.mock.calls[0][0];
    expect(update.content[0].text).toContain('Part1');
    expect(update.content[0].text).toContain('Part2');
  });
});
