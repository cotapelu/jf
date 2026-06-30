import { describe, it, expect } from 'vitest';
import { validateOptions, MAX_TEAM_SIZE } from './team-manager.js';

describe('validateOptions', () => {
  it('should clamp teamSize to at least 1', () => {
    const result = validateOptions(0, []);
    expect(result.size).toBe(1);
    expect(result.roles).toHaveLength(1);
    expect(result.roles[0]).toBe('agent-1');
  });

  it('should clamp teamSize to at most MAX_TEAM_SIZE', () => {
    const result = validateOptions(MAX_TEAM_SIZE + 5, []);
    expect(result.size).toBe(MAX_TEAM_SIZE);
    expect(result.roles).toHaveLength(MAX_TEAM_SIZE);
  });

  it('should generate default role names for missing entries', () => {
    const result = validateOptions(3, ['custom-1']);
    expect(result.roles).toEqual(['custom-1', 'agent-2', 'agent-3']);
  });

  it('should truncate excess teamRoles', () => {
    const result = validateOptions(2, ['a', 'b', 'c', 'd']);
    expect(result.roles).toEqual(['a', 'b']);
  });

  it('should use exact teamRoles when length matches size', () => {
    const result = validateOptions(3, ['x', 'y', 'z']);
    expect(result.roles).toEqual(['x', 'y', 'z']);
  });

  it('should fill defaults when teamRoles empty', () => {
    const result = validateOptions(4, []);
    expect(result.roles).toEqual(['agent-1', 'agent-2', 'agent-3', 'agent-4']);
  });
});
