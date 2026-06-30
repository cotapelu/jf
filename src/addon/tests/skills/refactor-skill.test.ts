/**
 * Refactor Extract Skill Tests
 * Verifies the content and structure of the refactor-extract skill definition.
 */

import { describe, it, expect } from 'vitest';
import { readFile } from 'fs/promises';
import { join } from 'path';

describe('Refactor Extract Skill', () => {
  it('should contain required sections and keywords', async () => {
    const filePath = join(process.cwd(), 'src', 'addon', 'tools', 'skills', 'skills-md', 'refactor-extract.md');
    const content = await readFile(filePath, 'utf-8');

    // Title
    expect(content).toContain('# Refactor Extract');

    // Key concepts
    expect(content).toContain('parameters');
    expect(content).toContain('return');
    expect(content).toContain('function');
    expect(content).toContain('extract');
    expect(content).toContain('dependencies');

    // Rules
    expect(content).toContain('Preserve original logic');
    expect(content).toContain('Handle edge cases');

    // Output example
    expect(content).toContain('typescript');
    expect(content).toContain('function newFunction');
  });
});
