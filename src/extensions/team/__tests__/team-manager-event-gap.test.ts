import { AgentTeam } from '../team-manager.js';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('AgentTeam handleAgentEvent unknown type', () => {
  let team: AgentTeam;

  beforeEach(() => {
    vi.useFakeTimers();
    team = new AgentTeam();
    team.id = 'test';
    // Set a dummy onUpdate to verify no calls
    team.setOnUpdate(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should ignore unknown event type (switch default)', () => {
    const notifySpy = vi.spyOn(team, 'notifyUpdate');
    // Call internal handleAgentEvent with a known unknown type
    (team as any).handleAgentEvent('agent-1', { type: 'unknown_event' } as any);
    expect(notifySpy).not.toHaveBeenCalled();
  });
});
