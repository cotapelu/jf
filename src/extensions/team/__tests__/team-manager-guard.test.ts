import { describe, it, expect, beforeEach } from 'vitest';
import { AgentTeam } from '../team-manager.js';

describe('AgentTeam handleAgentEvent Guards', () => {
  let team: AgentTeam;

  beforeEach(() => {
    team = new AgentTeam('test-guard', { roles: ['agent-1'] });
  });

  it('should ignore non-object events', () => {
    const anyTeam = team as any;
    expect(() => anyTeam.handleAgentEvent('agent-1', 'string event')).not.toThrow();
    expect(() => anyTeam.handleAgentEvent('agent-1', 123)).not.toThrow();
  });

  it('should ignore null event', () => {
    const anyTeam = team as any;
    expect(() => anyTeam.handleAgentEvent('agent-1', null)).not.toThrow();
  });

  it('should ignore object without type property', () => {
    const anyTeam = team as any;
    expect(() => anyTeam.handleAgentEvent('agent-1', { foo: 'bar' })).not.toThrow();
    expect(() => anyTeam.handleAgentEvent('agent-1', {})).not.toThrow();
  });
});
