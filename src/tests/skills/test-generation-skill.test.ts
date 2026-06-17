/**
 * Test Generation Skill Tests
 * Verifies the content and structure of the generate-tests skill definition.
 */

import { describe, it, expect } from 'vitest';
import { readFile } from 'fs/promises';
import { join } from 'path';

describe('Test Generation Skill', () => {
  it('should contain required sections and keywords', async () => {
    const filePath = join(process.cwd(), 'src', 'tools', 'skills', 'skills-md', 'generate-tests.md');
    const content = await readFile(filePath, 'utf-8');

    // Title
    expect(content).toContain('# Generate Tests');

    // Key concepts
    expect(content).toContain('unit tests');
    expect(content).toContain('Jest');
    expect(content).toContain('Vitest');
    expect(content).toContain('Coverage');
    expect(content).toContain('Edge cases');

    // Structure
    expect(content).toContain('describe');
    expect(content).toContain('it(');
    expect(content).toContain('expect');

    // mock and setup
    expect(content).toContain('mock');
  });
});
