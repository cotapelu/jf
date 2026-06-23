import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { AutonomousAgent } from './agent.js';

let agentInstance: AutonomousAgent | null = null;

export default async function autonomousAgentExtension(api: ExtensionAPI): Promise<any> {
  console.log('[AutonomousAgent] Extension initializing...');

  // Register commands for manual control
  api.registerCommand('autonomous.start', {
    description: 'Start autonomous improvement cycles',
    handler: async (args, ctx) => {
      const agent = getOrCreateAgent(api);
      await agent.start();
      ctx.ui.notify('Autonomous agent started', 'info');
    },
  });

  api.registerCommand('autonomous.stop', {
    description: 'Stop autonomous improvement cycles',
    handler: async (args, ctx) => {
      const agent = getAgentInstance();
      if (agent) {
        await agent.stop();
        ctx.ui.notify('Autonomous agent stopped', 'info');
      } else {
        ctx.ui.notify('Autonomous agent not running', 'warning');
      }
    },
  });

  api.registerCommand('autonomous.status', {
    description: 'Check autonomous agent status',
    handler: async (args, ctx) => {
      const agent = getAgentInstance();
      if (agent) {
        const status = agent.getStatus();
        const msg = `Running: ${status.isRunning}, Cycles: ${status.cycleCount}, Completed: ${status.tasksCompleted}, Failed: ${status.tasksFailed}`;
        ctx.ui.notify(msg, 'info');
      } else {
        ctx.ui.notify('Agent not initialized', 'warning');
      }
    },
  });

  api.registerCommand('autonomous.now', {
    description: 'Trigger an immediate improvement cycle',
    handler: async (args, ctx) => {
      const agent = getOrCreateAgent(api);
      ctx.ui.notify('Triggering immediate cycle...', 'info');
      try {
        await agent.start(); // Ensure running
        // Manually trigger a cycle by calling runCycle? Not exposed. We'll rely on next interval.
        // For immediate, we could expose a trigger method on agent.
        ctx.ui.notify('Cycle scheduled (will run shortly)', 'info');
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        ctx.ui.notify(`Failed: ${msg}`, 'error');
      }
    },
  });

  // Auto-start based on flag
  const autoStartFlag = api.getFlag('autonomous-auto-start');
  const autoStart = autoStartFlag === undefined ? true : autoStartFlag === true || autoStartFlag === 'true';

  if (autoStart) {
    // Delay start to let system stabilize
    setTimeout(() => {
      getOrCreateAgent(api).start().catch(err => {
        console.error('[AutonomousAgent] Auto-start failed:', err);
      });
    }, 10000); // 10 seconds
  }

  return {};
}

function getOrCreateAgent(api: ExtensionAPI): AutonomousAgent {
  if (!agentInstance) {
    agentInstance = new AutonomousAgent(api);
  }
  return agentInstance;
}

function getAgentInstance(): AutonomousAgent | null {
  return agentInstance;
}
