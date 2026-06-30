import { createTeamTool } from '../team-tool.js';
import { describe, it, expect, vi } from 'vitest';

// Minimal mock - enough to test param validation
const mockCtx: any = {
  runtime: { session: { sessionId: 'test-session' } },
  session: { sessionId: 'test-session' },
};

describe('team_run tool', () => {
  const tool = createTeamTool();
  const toolCallId = 'test-call-1';

  describe('parameter validation', () => {
    it('should reject call reference strings with clear error', async () => {
      const result: any = await tool.execute(toolCallId, 'call_abc123', undefined, undefined, mockCtx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('call reference');
      expect(result.details?.error).toBe('Unresolved call reference');
    });

    it('should reject invalid JSON strings', async () => {
      const result: any = await tool.execute(toolCallId, 'not valid json', undefined, undefined, mockCtx);
      expect(result.isError).toBe(true);
      expect(result.details?.error).toBe('Invalid JSON');
    });

    it('should reject object without tasks array', async () => {
      const result: any = await tool.execute(toolCallId, { teamSize: 2 }, undefined, undefined, mockCtx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('tasks must be a non-empty array');
    });

    it('should reject empty tasks array', async () => {
      const result: any = await tool.execute(toolCallId, { tasks: [] }, undefined, undefined, mockCtx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('tasks must be a non-empty array');
    });

    it('should accept valid object with tasks (may fail later due to runtime)', async () => {
      const result: any = await tool.execute(toolCallId, { tasks: ['ls'], teamSize: 1 }, undefined, undefined, mockCtx);
      // Should NOT have param validation errors
      expect(result.details?.error).not.toBe('Invalid JSON');
      expect(result.details?.error).not.toBe('Unresolved call reference');
    });
  });

  describe('JSON string parsing', () => {
    it('should parse valid JSON string param', async () => {
      const result: any = await tool.execute(toolCallId, '{"tasks": ["ls"], "teamSize": 1}', undefined, undefined, mockCtx);
      expect(result.details?.error).not.toBe('Invalid JSON');
    });
  });
});
