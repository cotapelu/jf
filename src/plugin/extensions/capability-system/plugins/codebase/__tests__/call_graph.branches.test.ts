#!/usr/bin/env node
/**
 * Branch coverage for codebase.call_graph
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'path';

// Mock fs to control readFile/access
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    promises: {
      ...actual.promises,
      readFile: vi.fn(),
      access: vi.fn(),
    },
  };
});

const { execute } = await import('../capabilities/call_graph.ts');

describe('call_graph branch coverage', () => {
  let tempDir: string;

  beforeEach(async () => {
    const fs = await import('fs/promises');
    const os = await import('os');
    tempDir = await fs.mkdtemp(join(os.tmpdir(), 'piclaw-callgraph-'));
    const { access } = await import('fs').then(m => m.promises);
    vi.mocked(access).mockResolvedValue(undefined);
  });

  afterEach(async () => {
    const fs = await import('fs/promises');
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  const writeFile = async (name: string, content: string) => {
    const fs = await import('fs/promises');
    const path = await import('path');
    const filePath = path.join(tempDir, name);
    await fs.writeFile(filePath, content, 'utf-8');
    return filePath;
  };

  it('handles readFile error', async () => {
    const { readFile } = await import('fs').then(m => m.promises);
    vi.mocked(readFile).mockRejectedValue(new Error('read error'));

    await writeFile('a.ts', `function foo() {}`);
    const ctx = { cwd: tempDir } as any;
    const result = await execute({ file: 'a.ts', query: {} }, ctx);
    expect(result.isError).toBe(false);
    expect(result.details.result.nodes).toHaveLength(0);
  });

  it('handles parse error', async () => {
    const { readFile } = await import('fs').then(m => m.promises);
    vi.mocked(readFile).mockResolvedValue('function('); // invalid syntax

    await writeFile('bad.ts', '');
    const ctx = { cwd: tempDir } as any;
    const result = await execute({ file: 'bad.ts', query: {} }, ctx);
    expect(result.isError).toBe(false);
    expect(result.details.result.nodes).toHaveLength(0);
  });
});
