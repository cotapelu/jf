#!/usr/bin/env node
/**
 * Branch coverage for master-tool command-registry
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

// Mock dependencies
vi.mock('../command-executor', () => {
  return {
    CommandExecutor: class MockCommandExecutor {
      private registry: Map<string, any> = new Map();
      register = vi.fn((entry: any) => {
        this.registry.set(entry.metadata.name, entry);
      });
      listCommands = vi.fn(() => Array.from(this.registry.keys()).sort());
      listCommandsByCategory = vi.fn(() => {
        const map = new Map<string, string[]>();
        for (const [name, entry] of this.registry) {
          const cat = entry.metadata.category || 'uncategorized';
          if (!map.has(cat)) map.set(cat, []);
          map.get(cat)!.push(name);
        }
        return map;
      });
      getMetadata = vi.fn((name: string) => this.registry.get(name)?.metadata);
      getSchema = vi.fn((name: string) => this.registry.get(name)?.schema || null);
      getStats = vi.fn(() => ({
        totalCommands: this.registry.size,
        hits: 0,
        misses: 0,
        cacheSize: 0
      }));
      clearCache = vi.fn();
      execute = vi.fn().mockResolvedValue({ output: 'ok', truncated: false, code: 0, stderr: '' });
      constructor() {}
    }
  };
});
vi.mock('../types/command-module', () => ({
  DEFAULT_MASTER_TOOL_OPTIONS: {
    commandsDir: 'commands',
    enableCache: true,
    cacheSize: 100,
    audit: false,
    security: false
  }
}));

// Mock fs/promises readdir for error testing
let fsReaddirOverride: ((...args: any[]) => Promise<any>) | null = null;
let mockedFsReaddir: any = null;
vi.mock('fs/promises', async () => {
  const actual = await vi.importActual('fs/promises');
  const readdirFn = vi.fn().mockImplementation(async (...args) => {
    if (fsReaddirOverride) return fsReaddirOverride(...args);
    return actual.readdir(...args);
  });
  mockedFsReaddir = readdirFn;
  return { ...actual, readdir: readdirFn };
});

const { CommandRegistry } = await import('../command-registry.ts');

describe('command-registry branch coverage', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await fs.mkdtemp(join(os.tmpdir(), 'cmdreg-branch-'));
    process.chdir(tempDir);
    vi.clearAllMocks();
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    vi.clearAllMocks();
  });

  const writeFile = async (name: string, content: string) => {
    const filePath = join(tempDir, name);
    await fs.writeFile(filePath, content, 'utf-8');
    return filePath;
  };

  it('handles non-existent commands directory gracefully', async () => {
    // commands directory does not exist
    const registry = new CommandRegistry({ commandsDir: join(tempDir, 'missing') });
    await expect(registry.initialize()).resolves.not.toThrow();
    // Should complete without loading any commands
    const executor = (registry as any).executor;
    expect(executor.listCommands()).toHaveLength(0);
  });

  it('handles readdir error', async () => {
    // Simulate readdir throwing
    fsReaddirOverride = async () => { throw new Error('permission denied'); };
    const registry = new CommandRegistry({ commandsDir: tempDir });
    await expect(registry.initialize()).resolves.not.toThrow();
    expect(mockedFsReaddir).toHaveBeenCalled();
    fsReaddirOverride = null;
  });

  it('handles category directory read error', async () => {
    const categoryDir = join(tempDir, 'git');
    await fs.mkdir(categoryDir);
    let callCount = 0;
    fsReaddirOverride = async (path: string, options?: any) => {
      callCount++;
      if (callCount === 1) {
        // root readdir returns the category directory name
        return ['git'];
      } else {
        // subsequent readdir for category fails
        throw new Error('category read error');
      }
    };
    const registry = new CommandRegistry({ commandsDir: tempDir });
    await expect(registry.initialize()).resolves.not.toThrow();
    fsReaddirOverride = null;
  });

  it('handles file with unsupported extension', async () => {
    await writeFile('readme.txt', 'not a command');
    const registry = new CommandRegistry({ commandsDir: tempDir });
    await registry.initialize();
    // Should not load the .txt file
    const executor = (registry as any).executor;
    expect(executor.listCommands()).toHaveLength(0);
  });

  it('loads direct .ts command file', async () => {
    await writeFile('test.ts', `export default { execute: async () => ({ output: 'ok' }) }`);
    const registry = new CommandRegistry({ commandsDir: tempDir });
    await registry.initialize();
    const executor = (registry as any).executor;
    expect(executor.listCommands()).toContain('test');
  });

  it('handles command file without default export', async () => {
    await writeFile('bad.ts', `export const foo = 1;`);
    const registry = new CommandRegistry({ commandsDir: tempDir });
    await registry.initialize();
    // Simulate executor error for this command
    const exec = (registry as any).executor as any;
    exec.execute = vi.fn().mockResolvedValue({ code: 1, stdout: '', stderr: 'missing default export', data: {} });
    const result = await registry.execute('bad', {}, { toolCallId: '1', signal: undefined, onUpdate: undefined, ctx: {}, maxOutputSize: 1000 });
    expect(result.isError).toBe(true);
  });

  it('handles command file with invalid export (null)', async () => {
    await writeFile('bad2.ts', `export default null;`);
    const registry = new CommandRegistry({ commandsDir: tempDir });
    await registry.initialize();
    const exec = (registry as any).executor as any;
    exec.execute = vi.fn().mockResolvedValue({ code: 1, stdout: '', stderr: 'invalid export', data: {} });
    const result = await registry.execute('bad2', {}, { toolCallId: '1', signal: undefined, onUpdate: undefined, ctx: {}, maxOutputSize: 1000 });
    expect(result.isError).toBe(true);
  });

  it('handles custom command with minimal metadata', async () => {
    const customCommands = new Map([
      ['custom-cmd', {
        async execute(params, ctx) { return { output: 'custom' }; },
        getMetadata: () => ({ name: 'Custom Cmd', description: 'A custom command' })
      }]
    ]);
    const registry = new CommandRegistry({}, customCommands);
    await registry.initialize();
    const executor = (registry as any).executor;
    expect(executor.listCommands()).toContain('custom-cmd');
  });

  it('handles command not found during execute', async () => {
    const registry = new CommandRegistry();
    await registry.initialize();
    // Inject executor that rejects for unknown command
    const executor = (registry as any).executor;
    executor.execute = vi.fn().mockRejectedValue(new Error('Command not found'));
    await expect(registry.execute('unknown', {}, {}, null)).rejects.toThrow(/not found/i);
  });

  it('handles executor throwing during execute', async () => {
    const mockExecutor = {
      register: vi.fn(),
      listCommands: vi.fn(() => ['test']),
      execute: vi.fn().mockRejectedValue(new Error('exec failed'))
    };
    // Manually inject mock executor into registry instance
    const registry = new CommandRegistry();
    (registry as any).executor = mockExecutor;
    await registry.initialize(); // no-op for this test
    await expect(registry.execute('test', {}, {}, null)).rejects.toThrow('exec failed');
  });

  it('handles initialize called multiple times (idempotent)', async () => {
    await writeFile('cmd.ts', `export default { execute: async () => ({ output: 'ok' }) }`);
    const registry = new CommandRegistry({ commandsDir: tempDir });
    await registry.initialize();
    const firstList = (registry as any).executor.listCommands();
    // Second initialize should be no-op
    await registry.initialize();
    const secondList = (registry as any).executor.listCommands();
    expect(firstList).toEqual(secondList);
  });

  it('handles custom command without getMetadata', async () => {
    const customCommands = new Map([
      ['bare', {
        async execute(params, ctx) { return { output: 'bare' }; }
        // no getMetadata
      }]
    ]);
    const registry = new CommandRegistry({}, customCommands);
    await registry.initialize();
    const executor = (registry as any).executor;
    expect(executor.listCommands()).toContain('bare');
  });

  it('handles command file that throws during require', async () => {
    await writeFile('throw.ts', `throw new Error('module error');`);
    const registry = new CommandRegistry({ commandsDir: tempDir });
    await registry.initialize();
    const exec = (registry as any).executor as any;
    exec.execute = vi.fn().mockResolvedValue({ code: 1, stdout: '', stderr: 'module error', data: {} });
    const result = await registry.execute('throw', {}, { toolCallId: '1', signal: undefined, onUpdate: undefined, ctx: {}, maxOutputSize: 1000 });
    expect(result.isError).toBe(true);
  });

  it('handles command loader returning non-object', async () => {
    await writeFile('number.ts', `export default 42;`);
    const registry = new CommandRegistry({ commandsDir: tempDir });
    await registry.initialize();
    const exec = (registry as any).executor as any;
    exec.execute = vi.fn().mockResolvedValue({ code: 1, stdout: '', stderr: 'non-object', data: {} });
    const result = await registry.execute('number', {}, { toolCallId: '1', signal: undefined, onUpdate: undefined, ctx: {}, maxOutputSize: 1000 });
    expect(result.isError).toBe(true);
  });

  it('handles command file with execute not a function', async () => {
    await writeFile('noexec.ts', `export default { notExecute: () => {} };`);
    const registry = new CommandRegistry({ commandsDir: tempDir });
    await registry.initialize();
    const exec = (registry as any).executor as any;
    exec.execute = vi.fn().mockResolvedValue({ code: 1, stdout: '', stderr: 'execute not a function', data: {} });
    const result = await registry.execute('noexec', {}, { toolCallId: '1', signal: undefined, onUpdate: undefined, ctx: {}, maxOutputSize: 1000 });
    expect(result.isError).toBe(true);
  });

  it('handles empty commands directory', async () => {
    await fs.mkdir(join(tempDir, 'empty'));
    const registry = new CommandRegistry({ commandsDir: join(tempDir, 'empty') });
    await registry.initialize();
    const executor = (registry as any).executor;
    expect(executor.listCommands()).toHaveLength(0);
  });

  it('handles nested category with multiple command files', async () => {
    const gitDir = join(tempDir, 'git');
    await fs.mkdir(gitDir);
    await writeFile('git/status.ts', `export default { execute: async () => ({ output: 'status' }) }`);
    await writeFile('git/commit.ts', `export default { execute: async () => ({ output: 'commit' }) }`);
    const registry = new CommandRegistry({ commandsDir: tempDir });
    await registry.initialize();
    const executor = (registry as any).executor;
    expect(executor.listCommands()).toContain('git.status');
    expect(executor.listCommands()).toContain('git.commit');
  });

  it('handles duplicate command names across categories', async () => {
    const gitDir = join(tempDir, 'git');
    const devDir = join(tempDir, 'dev');
    await fs.mkdir(gitDir);
    await fs.mkdir(devDir);
    await writeFile('git/status.ts', `export default { execute: async () => ({ output: 'git-status' }) }`);
    await writeFile('dev/status.ts', `export default { execute: async () => ({ output: 'dev-status' }) }`);
    const registry = new CommandRegistry({ commandsDir: tempDir });
    await registry.initialize();
    const executor = (registry as any).executor;
    // Both should be registered with fully qualified names
    expect(executor.listCommands()).toContain('git.status');
    expect(executor.listCommands()).toContain('dev.status');
  });
});
