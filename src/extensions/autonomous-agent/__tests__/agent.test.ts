import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AutonomousAgent } from '../agent.js';

describe('AutonomousAgent', () => {
  let agent: AutonomousAgent;
  let mockApi: any;

  beforeEach(() => {
    mockApi = {
      exec: vi.fn(async () => ({ code: 0, stdout: '', stderr: '' })),
    };
    agent = new AutonomousAgent(mockApi);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should have initial status stopped', () => {
    const status = agent.getStatus();
    expect(status.isRunning).toBe(false);
    expect(status.tasksCompleted).toBe(0);
    expect(status.tasksFailed).toBe(0);
    expect(status.cycleCount).toBe(0);
  });

  it('should set isRunning true after start', async () => {
    // Override runCycle to avoid long execution
    (agent as any).runCycle = vi.fn().mockResolvedValue(undefined);
    await agent.start();
    expect(agent.getStatus().isRunning).toBe(true);
    await agent.stop();
  });

  it('should clear running state on stop', async () => {
    (agent as any).runCycle = vi.fn().mockResolvedValue(undefined);
    await agent.start();
    expect(agent.getStatus().isRunning).toBe(true);
    await agent.stop();
    expect(agent.getStatus().isRunning).toBe(false);
  });

  it('should not start multiple times concurrently', async () => {
    (agent as any).runCycle = vi.fn().mockResolvedValue(undefined);
    await agent.start();
    await agent.start(); // second call should be no-op
    expect(agent.getStatus().isRunning).toBe(true);
    expect((agent as any).runCycle).toHaveBeenCalledTimes(1);
    await agent.stop();
  });

  it('should truncate text correctly', () => {
    const truncate = (agent as any).truncate;
    expect(truncate('hello', 10)).toBe('hello');
    expect(truncate('hello world!', 5)).toBe('he...');
    expect(truncate('1234567890', 5)).toBe('12...');
    expect(truncate('short', 10)).toBe('short');
  });
});
