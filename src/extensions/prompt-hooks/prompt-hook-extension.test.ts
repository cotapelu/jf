/* eslint @typescript-eslint/no-explicit-any: "off" */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import promptHookExtension, { parseCommandArgs, substitutePromptArgs } from './prompt-hook-extension.js';

// Mock logger for observability
vi.mock('../utils/logger.js', () => ({
  createLogger: vi.fn(() => ({
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  })),
}));

// Mock the prompts module (used by /prompt only)
vi.mock('./prompts/index.js', () => {
  const mockPrompt = {
    name: 'test-prompt',
    description: 'Test prompt',
    content: 'Hello $1, you have ${2:-default} tasks. $@',
  };
  const mockPrompt2 = {
    name: 'review',
    description: 'Review code',
    content: 'Review this code:\n$@',
  };
  return {
    getBuiltinPrompt: vi.fn((name: string) => (name === 'test-prompt' ? mockPrompt : name === 'review' ? mockPrompt2 : undefined)),
    getAllBuiltinPrompts: vi.fn(() => [mockPrompt, mockPrompt2]),
  };
});

// Mock external dependencies
vi.mock('@earendil-works/pi-coding-agent', () => ({
  type: {},
}));
vi.mock('@earendil-works/pi-tui', () => ({
  type: {},
}));

// Mock fs.promises for GOAL.md reading tests
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
}));

describe('prompt-hook-extension', () => {
  let mockPi: any;
  let mockCtx: any;
  let originalConsoleLog: typeof console.log;
  let originalConsoleError: typeof console.error;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPi = {
      registerCommand: vi.fn(),
      sendUserMessage: vi.fn(),
    };
    mockCtx = {
      hasUI: true,
      cwd: '/test/cwd',
      ui: {
        notify: vi.fn(),
      },
    };
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    console.log = vi.fn();
    console.error = vi.fn();
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  describe('/prompt command (built-in prompt execution)', () => {
    it('should register /prompt command with autocomplete', () => {
      promptHookExtension(mockPi);
      // Find the /prompt command (second call)
      const promptCmd = mockPi.registerCommand.mock.calls.find(call => call[0] === 'prompt');
      expect(promptCmd).toBeDefined();
      expect(promptCmd[1]).toMatchObject({
        description: expect.stringContaining('Built-in prompts'),
        getArgumentCompletions: expect.any(Function),
        handler: expect.any(Function),
      });
    });

    it('getArgumentCompletions returns prompts starting with prefix', () => {
      promptHookExtension(mockPi);
      const promptCmd = mockPi.registerCommand.mock.calls.find(call => call[0] === 'prompt');
      const commandDef = promptCmd[1];
      const completions = commandDef.getArgumentCompletions('test');
      expect(completions).toHaveLength(1);
      expect(completions[0].value).toBe('test-prompt');
    });

    it('handler with no args shows usage', async () => {
      promptHookExtension(mockPi);
      const promptCmd = mockPi.registerCommand.mock.calls.find(call => call[0] === 'prompt');
      const commandDef = promptCmd[1];
      await commandDef.handler('', mockCtx);
      expect(mockCtx.ui.notify).toHaveBeenCalledWith(
        expect.stringContaining('Usage: /prompt <prompt-name>'),
        'warning'
      );
    });

    it('handler with unknown prompt shows error and uses available list', async () => {
      promptHookExtension(mockPi);
      const promptCmd = mockPi.registerCommand.mock.calls.find(call => call[0] === 'prompt');
      const commandDef = promptCmd[1];
      await commandDef.handler('unknown', mockCtx);
      expect(mockCtx.ui.notify).toHaveBeenCalledWith(
        expect.stringContaining('Prompt "unknown" not found'),
        'error'
      );
    });

    it('handler executes known prompt with no args', async () => {
      promptHookExtension(mockPi);
      const promptCmd = mockPi.registerCommand.mock.calls.find(call => call[0] === 'prompt');
      const commandDef = promptCmd[1];
      await commandDef.handler('test-prompt', mockCtx);
      // With no args, substitution yields: $1 -> '', ${2:-default} -> 'default', $@ -> ''
      expect(mockPi.sendUserMessage).toHaveBeenCalledWith('Hello , you have default tasks. ');
    });

    it('handler executes prompt with argument substitution', async () => {
      promptHookExtension(mockPi);
      const promptCmd = mockPi.registerCommand.mock.calls.find(call => call[0] === 'prompt');
      const commandDef = promptCmd[1];
      await commandDef.handler('test-prompt arg1 10', mockCtx);
      expect(mockPi.sendUserMessage).toHaveBeenCalledWith('Hello arg1, you have 10 tasks. arg1 10');
    });

    it('handler handles error from sendUserMessage', async () => {
      promptHookExtension(mockPi);
      const promptCmd = mockPi.registerCommand.mock.calls.find(call => call[0] === 'prompt');
      const commandDef = promptCmd[1];
      mockPi.sendUserMessage.mockImplementation(() => {
        throw new Error('send failed');
      });
      await commandDef.handler('test-prompt', mockCtx);
      expect(mockCtx.ui.notify).toHaveBeenCalledWith(expect.stringContaining('Error: send failed'), 'error');
    });
  });

  describe('/goal command (GOAL.md reader)', () => {
    it('should register /goal command', () => {
      promptHookExtension(mockPi);
      const goalCmd = mockPi.registerCommand.mock.calls.find(call => call[0] === 'goal');
      expect(goalCmd).toBeDefined();
      expect(goalCmd[1]).toMatchObject({
        description: expect.stringContaining('GOAL.md'),
        handler: expect.any(Function),
      });
      expect(goalCmd[1].getArgumentCompletions).toBeUndefined();
    });

    it('handler sends GOAL.md content', async () => {
      const fakeContent = '# My GOAL\nThis is the goal.';
      const fs = await import('node:fs/promises');
      vi.spyOn(fs, 'readFile').mockResolvedValue(fakeContent);
      promptHookExtension(mockPi);
      const goalCmd = mockPi.registerCommand.mock.calls.find(call => call[0] === 'goal');
      const commandDef = goalCmd[1];
      await commandDef.handler('', mockCtx);
      expect(mockPi.sendUserMessage).toHaveBeenCalledWith(fakeContent);
    });

    it('handler handles ENOENT (GOAL.md not found)', async () => {
      const fs = await import('node:fs/promises');
      const enoent = new Error('ENOENT') as any;
      enoent.code = 'ENOENT';
      vi.spyOn(fs, 'readFile').mockRejectedValue(enoent);
      promptHookExtension(mockPi);
      const goalCmd = mockPi.registerCommand.mock.calls.find(call => call[0] === 'goal');
      const commandDef = goalCmd[1];
      await commandDef.handler('', mockCtx);
      expect(mockCtx.ui.notify).toHaveBeenCalledWith(
        expect.stringContaining('not found'),
        'error'
      );
    });

    it('handler handles other read errors', async () => {
      const fs = await import('node:fs/promises');
      vi.spyOn(fs, 'readFile').mockRejectedValue(new Error('permission denied'));
      promptHookExtension(mockPi);
      const goalCmd = mockPi.registerCommand.mock.calls.find(call => call[0] === 'goal');
      const commandDef = goalCmd[1];
      await commandDef.handler('', mockCtx);
      expect(mockCtx.ui.notify).toHaveBeenCalledWith(
        expect.stringContaining('Error reading GOAL.md'),
        'error'
      );
    });
  });

  describe('parseCommandArgs', () => {
    it('parses simple space-separated arguments', () => {
      expect(parseCommandArgs('a b c')).toEqual(['a', 'b', 'c']);
    });
    it('respects double quotes', () => {
      expect(parseCommandArgs('a "b c" d')).toEqual(['a', 'b c', 'd']);
    });
    it('respects single quotes', () => {
      expect(parseCommandArgs("a 'b c' d")).toEqual(['a', 'b c', 'd']);
    });
    it('handles empty string', () => {
      expect(parseCommandArgs('')).toEqual([]);
    });
    it('handles multiple spaces', () => {
      expect(parseCommandArgs('   a   b   c   ')).toEqual(['a', 'b', 'c']);
    });
  });

  describe('substitutePromptArgs', () => {
    it('should substitute positional args $1, $2, $3', () => {
      const content = '$1-$2-$3';
      const args = ['a', 'b', 'c'];
      expect(substitutePromptArgs(content, args)).toBe('a-b-c');
    });

    it('should return empty string for missing positional args (no default)', () => {
      const content = '$1-$2-$3';
      const args = ['a'];
      expect(substitutePromptArgs(content, args)).toBe('a--');
    });

    it('should substitute $@ and $ARGUMENTS with all args joined', () => {
      const content = 'args: $@, all: $ARGUMENTS';
      const args = ['x', 'y', 'z'];
      expect(substitutePromptArgs(content, args)).toBe('args: x y z, all: x y z');
    });

    it('should substitute ${N:-default} with default when arg missing', () => {
      const content = '${1:-default1} ${2:-default2}';
      const args: string[] = [];
      expect(substitutePromptArgs(content, args)).toBe('default1 default2');
    });

    it('should substitute ${N:-default} with arg when present', () => {
      const content = '${1:-default1} ${2:-default2}';
      const args = ['val1', 'val2'];
      expect(substitutePromptArgs(content, args)).toBe('val1 val2');
    });

    it('should use default for ${N:-default} when arg is empty string', () => {
      const content = '${1:-default1}';
      const args = [''];
      expect(substitutePromptArgs(content, args)).toBe('default1');
    });

    it('should handle mixed substitutions', () => {
      const content = '$1 ${2:-missing} $@ ${3:-def}';
      const args = ['first', 'second'];
      expect(substitutePromptArgs(content, args)).toBe('first second first second def');
    });

    it('should support ${@:N} slice from N (1-indexed)', () => {
      const content = '${@:2}';
      const args = ['a', 'b', 'c', 'd'];
      expect(substitutePromptArgs(content, args)).toBe('b c d');
    });

    it('should support ${@:N:L} slice with length', () => {
      const content = '${@:2:2}';
      const args = ['a', 'b', 'c', 'd'];
      expect(substitutePromptArgs(content, args)).toBe('b c');
    });

    it('should handle ${@:1} returns all args', () => {
      const content = '${@:1}';
      const args = ['a', 'b', 'c'];
      expect(substitutePromptArgs(content, args)).toBe('a b c');
    });

    it('should return original content when no patterns match', () => {
      const content = 'Hello world, no substitutions';
      const args = ['a', 'b'];
      expect(substitutePromptArgs(content, args)).toBe(content);
    });
  });

  describe('additional error handling', () => {
    it('prompt: handles non-Error throw from sendUserMessage', async () => {
      promptHookExtension(mockPi);
      const promptCmd = mockPi.registerCommand.mock.calls.find(call => call[0] === 'prompt');
      const commandDef = promptCmd[1];
      mockPi.sendUserMessage.mockImplementation(() => { throw 'string error'; });
      await commandDef.handler('test-prompt', mockCtx);
      expect(mockCtx.ui.notify).toHaveBeenCalledWith(expect.stringContaining('Unexpected error: string error'), 'error');
    });

    it('goal: handles non-Error throw from readFile', async () => {
      const fs = await import('node:fs/promises');
      vi.spyOn(fs, 'readFile').mockRejectedValue('non-error value');
      promptHookExtension(mockPi);
      const goalCmd = mockPi.registerCommand.mock.calls.find(call => call[0] === 'goal');
      const commandDef = goalCmd[1];
      await commandDef.handler('', mockCtx);
      expect(mockCtx.ui.notify).toHaveBeenCalledWith(expect.stringContaining('Unexpected error: non-error value'), 'error');
    });
  });
});
