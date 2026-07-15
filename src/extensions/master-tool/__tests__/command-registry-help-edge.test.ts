import { describe, it, expect, beforeEach, vi, useFakeTimers } from 'vitest';
import { CommandRegistry } from '../command-registry.js';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readdir: vi.fn(),
  stat: vi.fn()
}));
import { readdir, stat } from 'fs/promises';

// Helper to create command modules
function createMockCommandModule(overrides: any = {}): any {
  return {
    metadata: {
      name: 'test.cmd',
      category: 'test',
      description: 'Test command',
      ...overrides.metadata
    },
    schema: overrides.schema ?? {},
    execute: overrides.execute ?? vi.fn().mockResolvedValue({ code: 0, stdout: '', stderr: '' }),
    StateClass: overrides.StateClass,
    getPersistencePath: overrides.getPersistencePath,
    ...overrides
  };
}

describe('CommandRegistry - getCommandHelp edge cases', () => {
  let registry: CommandRegistry;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Simulate no scanned files; we'll register a custom command directly via executor
    // We'll access the private executor to register a command manually.
    // We can construct a registry with no commandsDir to avoid scanning.
    readdir.mockResolvedValue([]);
    stat.mockResolvedValue({ isFile: () => true, isDirectory: () => false } as any);
    registry = new CommandRegistry({ commandsDir: '/fake/commands' });
    await registry.initialize(); // done, no commands
  });

  describe('getCommandHelp', () => {
    // Helper to register command for help tests
    function registerHelpTestCommand(meta: any, schema: any = {}) {
      (registry as any).executor.register({
        loader: async () => createMockCommandModule({ metadata: meta, schema }),
        metadata: meta,
        schema,
        StateClass: undefined,
        getPersistencePath: undefined,
        lastLoaded: Date.now(),
        loadCount: 0,
        errorCount: 0
      });
    }
    it('should return basic info for simple command', () => {
      const meta = { name: 'simple', category: 'misc', description: 'A simple command' };
      registerHelpTestCommand(meta);
      const help = registry.getCommandHelp('simple');
      ['Command: simple','Category: misc','Description: A simple command'].forEach(s => expect(help).toContain(s));
    });

    it('should include longDescription when present', () => {
      const meta = { name: 'long', category: 'misc', description: 'Short desc', longDescription: 'Detailed explanation\nwith multiple lines' };
      registerHelpTestCommand(meta);
      const help = registry.getCommandHelp('long');
      ['Detailed explanation','multiple lines'].forEach(s => expect(help).toContain(s));
    });

    it('should include examples when provided', () => {
      const meta = { name: 'ex', category: 'test', description: 'Command with examples', examples: ['master_tool({ command: "ex", args: { x: 1 } })','Another example: /ex --force'] };
      registerHelpTestCommand(meta);
      const help = registry.getCommandHelp('ex');
      expect(help).toContain('Examples:');
      expect(help).toContain('master_tool({ command: "ex", args: { x: 1 } })');
    });

    it('should not include Examples section when none provided', () => {
      const meta = { name: 'noex', category: 'test', description: 'No examples' };
      registerHelpTestCommand(meta);
      const help = registry.getCommandHelp('noex');
      expect(help).not.toContain('Examples:');
    });

    it('should include dependsOn when present', () => {
      const meta = { name: 'withdep', category: 'test', description: 'Has dependencies', dependsOn: ['auth','network'] };
      registerHelpTestCommand(meta);
      const help = registry.getCommandHelp('withdep');
      expect(help).toContain('Depends on: auth, network');
    });

    it('should include permissions when present', () => {
      const meta = { name: 'secure', category: 'admin', description: 'Secure command', permissions: ['admin','write'] };
      registerHelpTestCommand(meta);
      const help = registry.getCommandHelp('secure');
      expect(help).toContain('Permissions: admin, write');
    });

    it('should include experimental warning when experimental is true', () => {
      const meta = { name: 'exp', category: 'test', description: 'Experimental command', experimental: true };
      registerHelpTestCommand(meta);
      const help = registry.getCommandHelp('exp');
      expect(help).toContain('EXPERIMENTAL');
    });

    it('should include parameter description when schema has properties', () => {
      const meta = { name: 'params', category: 'test', description: 'Command with parameters' };
      const schema = { type: 'object', properties: { name: { type: 'string', description: 'User name' }, age: { type: 'number', description: 'User age' }, verbose: { type: 'boolean' } }, required: ['name'] };
      registerHelpTestCommand(meta, schema);
      const help = registry.getCommandHelp('params');
      expect(help).toContain('Parameters:');
      ['name: string (required) - User name','age: number (optional) - User age','verbose: boolean (optional)'].forEach(s => expect(help).toContain(s));
    });

    it('should return null for unknown command', () => {
      expect(registry.getCommandHelp('unknown')).toBeNull();
    });
  });

});
