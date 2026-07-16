import type { MultiSessionManager } from '../manager.js';
import { buildHandoffBusPaths } from '../handoff.js';
import fs from 'node:fs/promises';
import path from 'node:path';

function ensureDir(dir: string) {
  return fs.mkdir(dir, { recursive: true });
}

function nowISO(): string {
  return new Date().toISOString();
}

function buildContractContent(
  params: {
    name?: string;
    contract: {
      mission: string;
      allowedFiles?: string[];
      outputPath?: string;
      doneCriteria?: string[];
    };
  },
  busPaths: { sessionId: string; outputFile: string }
): string {
  const { contract } = params;
  const name = params.name ?? 'child';
  const allowedList = (contract.allowedFiles ?? [])
    .map((f) => `- ${f}`)
    .join('\n') || '(none)';
  const doneList = (contract.doneCriteria ?? [])
    .map((c) => `- [ ] ${c}`)
    .join('\n') || '(none)';
  return (
    `# Contract for ${name}\n` +
    `SessionID: ${busPaths.sessionId}\n` +
    `Created: ${nowISO()}\n\n` +
    `## Mission\n${contract.mission}\n\n` +
    `## Allowed Files\n${allowedList}\n\n` +
    `## Output Path\n${contract.outputPath ?? busPaths.outputFile}\n\n` +
    `## Done Criteria\n${doneList}\n`
  );
}

async function writeContractFiles(
  busPaths: { busFile: string; statusFile: string; outputFile: string },
  contractContent: string,
  contract: { mission: string; outputPath?: string }
): Promise<void> {
  await ensureDir(path.dirname(busPaths.busFile));
  await fs.writeFile(busPaths.busFile, contractContent, 'utf8');
  const statusContent = JSON.stringify(
    {
      status: 'pending',
      createdAt: nowISO(),
      mission: contract.mission,
      outputPath: contract.outputPath ?? busPaths.outputFile,
    },
    null,
    2
  );
  await fs.writeFile(busPaths.statusFile, statusContent, 'utf8');
}

export async function operationPrepareChild(
  mgr: MultiSessionManager,
  params: {
    name?: string;
    tags?: string[];
    contract: {
      mission: string;
      allowedFiles?: string[];
      outputPath?: string;
      doneCriteria?: string[];
    };
  }
): Promise<any> {
  const contract = params.contract;
  if (!contract?.mission) {
    throw new Error('contract.mission is required for prepare_child');
  }
  const busPaths = buildHandoffBusPaths(`child-${Date.now()}`);
  const contractContent = buildContractContent(params, busPaths);
  await writeContractFiles(busPaths, contractContent, contract);
  const meta = await mgr.createChild({
    name: params.name,
    tags: ['child', 'handoff', ...(params.tags ?? [])],
  });
  return {
    content: [
      {
        type: 'text',
        text: `Prepared child ${meta.id} (${meta.name}). Contract written to ${busPaths.busFile}`,
      },
    ],
    details: {
      operation: 'prepare_child',
      sessionId: meta.id,
      contractPath: busPaths.busFile,
      outputPath: contract.outputPath ?? busPaths.outputFile,
      statusPath: busPaths.statusFile,
      busPaths,
    },
  };
}

export async function operationChildRead(
  mgr: MultiSessionManager,
  params: { sessionId?: string }
): Promise<any> {
  const active = mgr.getActive();
  if (!active) throw new Error('No active session');
  const sessionId = params.sessionId ?? active.id;
  const busPaths = buildHandoffBusPaths(sessionId);
  let contract: string;
  try {
    contract = await fs.readFile(busPaths.busFile, 'utf8');
  } catch {
    throw new Error(
      `Contract not found for session ${sessionId}. Did you use prepare_child?`
    );
  }
  return {
    content: [{ type: 'text', text: contract }],
    details: { operation: 'child_read', sessionId, contractPath: busPaths.busFile },
  };
}

export async function operationChildWrite(
  mgr: MultiSessionManager,
  params: { sessionId?: string; content: string; checkpoint?: string }
): Promise<any> {
  const active = mgr.getActive();
  if (!active)
    throw new Error(
      'No active session - child_write must be called from within child session'
    );
  const sessionId = params.sessionId ?? active.id;
  if (!params.content) throw new Error('content is required for child_write');
  const busPaths = buildHandoffBusPaths(sessionId);
  await ensureDir(path.dirname(busPaths.outputFile));
  await fs.writeFile(busPaths.outputFile, params.content, 'utf8');
  const statusContent = JSON.stringify(
    {
      status: 'completed',
      completedAt: nowISO(),
      lastCheckpoint: params.checkpoint ?? null,
      outputPath: busPaths.outputFile,
    },
    null,
    2
  );
  await fs.writeFile(busPaths.statusFile, statusContent, 'utf8');
  mgr.addTags(sessionId, 'completed');
  return {
    content: [
      { type: 'text', text: `Output written to ${busPaths.outputFile}. Status updated.` },
    ],
    details: {
      operation: 'child_write',
      sessionId,
      outputPath: busPaths.outputFile,
      statusPath: busPaths.statusFile,
    },
  };
}

export async function operationParentRead(
  mgr: MultiSessionManager,
  params: { sessionId: string }
): Promise<any> {
  if (!params.sessionId) throw new Error('sessionId is required for parent_read');
  const meta = mgr.get(params.sessionId);
  if (!meta) throw new Error(`Session not found: ${params.sessionId}`);
  const busPaths = buildHandoffBusPaths(params.sessionId);
  let output: string;
  let status: string;
  try {
    [output, status] = await Promise.all([
      fs.readFile(busPaths.outputFile, 'utf8'),
      fs.readFile(busPaths.statusFile, 'utf8'),
    ]);
  } catch {
    throw new Error(
      `Output or status not found for session ${params.sessionId}. Child may not have completed.`
    );
  }
  return {
    content: [
      { type: 'text', text: `Output from ${params.sessionId}:\n${output}\n\nStatus:\n${status}` },
    ],
    details: {
      operation: 'parent_read',
      sessionId: params.sessionId,
      output,
      status: JSON.parse(status),
      outputPath: busPaths.outputFile,
      statusPath: busPaths.statusFile,
    },
  };
}

export async function operationCompleteChild(
  mgr: MultiSessionManager,
  params: { sessionId?: string }
): Promise<any> {
  const active = mgr.getActive();
  const sessionId = params.sessionId ?? active?.id;
  if (!sessionId) throw new Error('No session specified');
  const busPaths = buildHandoffBusPaths(sessionId);
  const statusContent = JSON.stringify(
    {
      status: 'completed',
      completedAt: nowISO(),
      outputPath: busPaths.outputFile,
    },
    null,
    2
  );
  await fs.writeFile(busPaths.statusFile, statusContent, 'utf8');
  mgr.addTags(sessionId, 'completed');
  return {
    content: [{ type: 'text', text: `Child ${sessionId} marked completed.` }],
    details: {
      operation: 'complete_child',
      sessionId,
      statusPath: busPaths.statusFile,
    },
  };
}
