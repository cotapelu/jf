// @ts-nocheck
import { vi } from 'vitest';
import { createTeamOpsTool } from '../team-ops-tool.js';

// Mock AgentTeam đơn giản
function createMockTeam() {
  return {
    tasks: [] as string[],
    claimTask: vi.fn(),
    releaseTask: vi.fn(),
    completeTask: vi.fn(),
    getMyCurrentTask: vi.fn(),
    getTeamStatus: vi.fn(),
    workspaceRead: vi.fn(),
    workspaceWrite: vi.fn(),
    publishMessage: vi.fn(),
    getMessages: vi.fn(),
  };
}

// Mock context
function createMockContext(sessionId = 'agent-1') {
  return {
    session: { sessionId },
    runtime: { session: { sessionId } }
  };
}

describe('Team Ops Tool', () => {
  let tool: any;
  let mockTeam: any;
  let mockCtx: any;

  beforeEach(() => {
    mockTeam = createMockTeam();
    tool = createTeamOpsTool(mockTeam);
    mockCtx = createMockContext();
  });

  describe('Tool Definition', () => {
    it('should have correct name and label', () => {
      expect(tool.name).toBe('team_ops');
      expect(tool.label).toBe('Team Ops');
    });

    it('should include all expected actions', () => {
      const actions = tool.parameters.properties.action.enum;
      expect(actions).toContain('claim_task');
      expect(actions).toContain('release_task');
      expect(actions).toContain('complete_task');
      expect(actions).toContain('get_team_status');
      expect(actions).toContain('workspace_read');
      expect(actions).toContain('workspace_write');
      expect(actions).toContain('send_message');
      expect(actions).toContain('get_messages');
      expect(actions).toContain('update_status');
    });
  });

  describe('Execute', () => {
    it('should parse JSON string', async () => {
      mockTeam.claimTask = vi.fn().mockResolvedValue(0);
      const result = await tool.execute('call-1', '{"action":"claim_task"}', undefined, undefined, mockCtx);
      expect(result.isError).toBe(false);
      expect(mockTeam.claimTask).toHaveBeenCalledWith(mockCtx.session.sessionId);
    });

    it('should reject invalid JSON', async () => {
      const result = await tool.execute('call-1', 'invalid', undefined, undefined, mockCtx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Invalid JSON');
    });

    it('should handle claim_task - success', async () => {
      mockTeam.tasks = ['task1'];
      mockTeam.claimTask = vi.fn().mockResolvedValue(0);
      const result = await tool.execute('call-1', { action: 'claim_task' }, undefined, undefined, mockCtx);
      expect(result.isError).toBe(false);
      expect(result.details?.taskIndex).toBe(0);
    });

    it('should handle claim_task - no tasks', async () => {
      mockTeam.claimTask = vi.fn().mockResolvedValue(null);
      const result = await tool.execute('call-1', { action: 'claim_task' }, undefined, undefined, mockCtx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe('No pending tasks available.');
    });

    it('should handle release_task', async () => {
      mockTeam.getMyCurrentTask = vi.fn().mockResolvedValue(1);
      mockTeam.releaseTask = vi.fn().mockResolvedValue(true);
      const result = await tool.execute('call-1', { action: 'release_task' }, undefined, undefined, mockCtx);
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('Released task 1');
    });

    it('should handle release_task - no active', async () => {
      mockTeam.getMyCurrentTask = vi.fn().mockResolvedValue(null);
      const result = await tool.execute('call-1', { action: 'release_task' }, undefined, undefined, mockCtx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe('No active task to release.');
    });

    it('should handle complete_task', async () => {
      mockTeam.getMyCurrentTask = vi.fn().mockResolvedValue(2);
      mockTeam.completeTask = vi.fn().mockResolvedValue(undefined);
      const result = await tool.execute('call-1', { action: 'complete_task', taskIndex: 2, result: 'done' }, undefined, undefined, mockCtx);
      expect(result.isError).toBe(false);
      expect(mockTeam.completeTask).toHaveBeenCalledWith(mockCtx.session.sessionId, 2, 'done');
    });

    it('should fail complete_task without taskIndex', async () => {
      const result = await tool.execute('call-1', { action: 'complete_task' }, undefined, undefined, mockCtx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe('Missing taskIndex');
    });

    it('should fail complete_task wrong assignment', async () => {
      mockTeam.getMyCurrentTask = vi.fn().mockResolvedValue(3);
      const result = await tool.execute('call-1', { action: 'complete_task', taskIndex: 5 }, undefined, undefined, mockCtx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe('Task 5 is not assigned to you.');
    });

    it('should handle get_team_status', async () => {
      const status = { totalTasks: 5, completedTasks: 2 };
      mockTeam.getTeamStatus = vi.fn().mockResolvedValue(status);
      const result = await tool.execute('call-1', { action: 'get_team_status' }, undefined, undefined, mockCtx);
      expect(result.isError).toBe(false);
      expect(JSON.parse(result.content[0].text)).toEqual(status);
    });

    it('should handle workspace_read', async () => {
      mockTeam.workspaceRead = vi.fn().mockResolvedValue('val');
      const result = await tool.execute('call-1', { action: 'workspace_read', key: 'k' }, undefined, undefined, mockCtx);
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toBe('val');
    });

    it('should handle workspace_read - not found', async () => {
      mockTeam.workspaceRead = vi.fn().mockResolvedValue(undefined);
      const result = await tool.execute('call-1', { action: 'workspace_read', key: 'k' }, undefined, undefined, mockCtx);
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toBe('(not found)');
    });

    it('should fail workspace_read missing key', async () => {
      const result = await tool.execute('call-1', { action: 'workspace_read' }, undefined, undefined, mockCtx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe('Missing key');
    });

    it('should handle workspace_write', async () => {
      mockTeam.workspaceWrite = vi.fn().mockResolvedValue(undefined);
      const result = await tool.execute('call-1', { action: 'workspace_write', key: 'k', value: 'v' }, undefined, undefined, mockCtx);
      expect(result.isError).toBe(false);
      expect(mockTeam.workspaceWrite).toHaveBeenCalledWith('k', 'v', mockCtx.session.sessionId);
    });

    it('should fail workspace_write missing key/value', async () => {
      const r1 = await tool.execute('call-2', { action: 'workspace_write', key: 'k' }, undefined, undefined, mockCtx);
      expect(r1.isError).toBe(true);
      const r2 = await tool.execute('call-3', { action: 'workspace_write', value: 'v' }, undefined, undefined, mockCtx);
      expect(r2.isError).toBe(true);
    });

    it('should handle send_message', async () => {
      mockTeam.publishMessage = vi.fn().mockResolvedValue(undefined);
      const result = await tool.execute('call-1', { action: 'send_message', channel: 'alerts', content: 'hi' }, undefined, undefined, mockCtx);
      expect(result.isError).toBe(false);
      expect(mockTeam.publishMessage).toHaveBeenCalledWith('alerts', mockCtx.session.sessionId, 'hi');
    });

    it('should fail send_message missing content', async () => {
      const result = await tool.execute('call-1', { action: 'send_message' }, undefined, undefined, mockCtx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe('Missing content');
    });

    it('should handle get_messages', async () => {
      const msgs = [{ timestamp: 1, from: 'a', content: 'c' }];
      mockTeam.getMessages = vi.fn().mockResolvedValue(msgs);
      const result = await tool.execute('call-1', { action: 'get_messages' }, undefined, undefined, mockCtx);
      expect(result.isError).toBe(false);
      expect(result.details?.messages).toEqual(msgs);
    });

    it('should handle get_messages empty', async () => {
      mockTeam.getMessages = vi.fn().mockResolvedValue([]);
      const result = await tool.execute('call-1', { action: 'get_messages' }, undefined, undefined, mockCtx);
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toBe('(no messages)');
    });

    it('should handle update_status', async () => {
      mockTeam.getMyCurrentTask = vi.fn().mockResolvedValue(null);
      const result = await tool.execute('call-1', { action: 'update_status', status: 'working' }, undefined, undefined, mockCtx);
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toBe('Status updated to: working');
    });

    it('should fail update_status missing status', async () => {
      const result = await tool.execute('call-1', { action: 'update_status' }, undefined, undefined, mockCtx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe('Missing status');
    });

    it('should handle unknown action', async () => {
      const result = await tool.execute('call-1', { action: 'unknown' }, undefined, undefined, mockCtx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Unknown action');
    });

    it('should catch exceptions from team methods', async () => {
      mockTeam.claimTask = vi.fn().mockRejectedValue(new Error('fail'));
      const result = await tool.execute('call-1', { action: 'claim_task' }, undefined, undefined, mockCtx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error: fail');
    });
  });
});
