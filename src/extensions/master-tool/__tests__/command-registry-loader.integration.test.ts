import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CommandRegistry } from '../command-registry.js';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('CommandRegistry loader integration', () => {
  let tmpDir: string;
  let registry: CommandRegistry;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'jf-cmd-test-'));
    // valid command file .js
    const validPath = join(tmpDir, 'valid.js');
    await writeFile(validPath, `
export const metadata = { description: 'Valid test command' };
export const schema = {};
export async function execute() { return { code: 0, stdout: '' }; }
    `);
    // invalid command file .js (missing required exports)
    const invalidPath = join(tmpDir, 'invalid.js');
    await writeFile(invalidPath, `export const something = 123;`);

    registry = new CommandRegistry({ commandsDir: tmpDir });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('should load and execute valid command', async () => {
    await registry.initialize();
    const result = await registry.execute('valid', {}, {
      toolCallId: '1',
      signal: new AbortController().signal,
      onUpdate: () => {},
      ctx: {},
      maxOutputSize: 1024
    });
    expect(result.isError).toBe(false);
  });

  it('should handle invalid command execution gracefully', async () => {
    await registry.initialize();
    const result = await registry.execute('invalid', {}, {
      toolCallId: '1',
      signal: new AbortController().signal,
      onUpdate: () => {},
      ctx: {},
      maxOutputSize: 1024
    });
    expect(result.isError).toBe(true);
    const errorTexts = result.content.map(c => c.text).join(' ');
    expect(errorTexts).toContain('Invalid command module');
  });
});
