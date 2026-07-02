#!/usr/bin/env node
/**
 * Team Performance Benchmark
 *
 * Measures performance of core team operations:
 * - Team creation and initialization
 * - Task claiming and completion
 * - Agent lifecycle events
 * - Team scaling (concurrent agents)
 */

import { harness } from './benchmark-harness.js';

// Mock minimal team runtime for benchmarks
function createMockRuntime(id: number) {
  return {
    sessionId: `session-${id}`,
    agentId: `agent-${id}`,
    async executeTask(task: any): Promise<any> {
      // Simulate work
      await new Promise(resolve => setTimeout(resolve, 1));
      return { result: `completed-${task.id}` };
    },
    async sendHeartbeat(): Promise<void> {
      await Promise.resolve();
    },
    capabilities: new Set(['test']),
    async initialize(): Promise<void> {},
    async shutdown(): Promise<void> {}
  };
}

// Simulate team manager operations
async function benchmarkTeamCreation(iterations: number = 1): Promise<number> {
  const start = process.hrtime.bigint();

  for (let i = 0; i < iterations; i++) {
    // Simulate team creation logic (without actual team system to avoid side effects)
    const team = {
      id: `team-${i}`,
      agents: new Map(),
      tasks: new Map(),
      initialize: async () => {},
      registerAgent: async (id: string) => {},
      claimTask: async (taskId: number) => {},
      completeTask: async (taskId: number) => {}
    };
  }

  const end = process.hrtime.bigint();
  return Number(end - start) / 1_000_000 / iterations;
}

async function benchmarkTaskClaiming(iterations: number = 100): Promise<number> {
  const start = process.hrtime.bigint();

  const taskSet = new Map();
  for (let i = 0; i < 100; i++) {
    taskSet.set(i, { id: i, status: 'pending' });
  }

  for (let i = 0; i < iterations; i++) {
    const taskId = i % 100;
    const task = taskSet.get(taskId);
    if (task && task.status === 'pending') {
      task.status = 'claimed';
    }
  }

  const end = process.hrtime.bigint();
  return Number(end - start) / 1_000_000;
}

async function benchmarkAgentHeartbeat(iterations: number = 1000): Promise<number> {
  const heartbeats = new Map<string, number>();

  const start = process.hrtime.bigint();

  for (let i = 0; i < iterations; i++) {
    const agentId = `agent-${i % 10}`;
    heartbeats.set(agentId, Date.now());
  }

  const end = process.hrtime.bigint();
  return Number(end - start) / 1_000_000;
}

async function benchmarkConcurrentAgents(concurrency: number = 10): Promise<number> {
  const start = process.hrtime.bigint();

  const agents = Array.from({ length: concurrency }, (_, i) => ({
    id: `agent-${i}`,
    lastSeen: Date.now(),
    tasks: new Set<number>()
  }));

  // Simulate task assignment
  for (const agent of agents) {
    for (let t = 0; t < 5; t++) {
      agent.tasks.add(agent.id.charCodeAt(0) + t);
    }
  }

  const end = process.hrtime.bigint();
  return Number(end - start) / 1_000_000;
}

async function benchmarkTaskStatusTracking(iterations: number = 1000): Promise<number> {
  const statuses = new Map<number, { status: string; updated: number }>();

  const start = process.hrtime.bigint();

  for (let i = 0; i < iterations; i++) {
    const taskId = i % 100;
    statuses.set(taskId, {
      status: taskId % 3 === 0 ? 'completed' : 'in_progress',
      updated: Date.now()
    });
  }

  const end = process.hrtime.bigint();
  return Number(end - start) / 1_000_000;
}

// Main benchmark runner
async function main() {
  console.log('\n🏃 Running Team Performance Benchmarks...\n');

  // Team creation
  await harness.runBenchmark('Team Creation (1 team)', () => benchmarkTeamCreation(1), {
    iterations: 100,
    warmup: 10
  });

  // Task claiming
  await harness.runBenchmark('Task Claiming (100 claims)', () => benchmarkTaskClaiming(100), {
    iterations: 50,
    warmup: 5
  });

  // Agent heartbeats
  await harness.runBenchmark('Agent Heartbeat (1000 heartbeats)', () => benchmarkAgentHeartbeat(1000), {
    iterations: 30,
    warmup: 5
  });

  // Concurrent agents
  await harness.runBenchmark('Concurrent Agents (10 agents)', () => benchmarkConcurrentAgents(10), {
    iterations: 50,
    warmup: 5
  });

  // Task status tracking
  await harness.runBenchmark('Task Status Tracking (1000 updates)', () => benchmarkTaskStatusTracking(1000), {
    iterations: 30,
    warmup: 5
  });

  // Print results
  console.log(harness.generateReport());
}

main().catch(console.error);
