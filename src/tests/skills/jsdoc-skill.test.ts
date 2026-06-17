/**
 * JSDoc Generation Skill Tests
 * Verifies the content and structure of the generate-docs skill definition.
 */

import { describe, it, expect } from 'vitest';
import { readFile } from 'fs/promises';
import { join } from 'path';

describe('JSDoc Generation Skill', () => {
  it('should contain required sections and keywords', async () => {
    const filePath = join(process.cwd(), 'src', 'tools', 'skills', 'skills-md', 'generate-docs.md');
    const content = await readFile(filePath, 'utf-8');

    // Title
    expect(content).toContain('# Generate Documentation');

    // Key concepts
    expect(content).toContain('JSDoc');
    expect(content).toContain('TSDoc');
    expect(content).toContain('@param');
    expect(content).toContain('@returns');
    expect(content).toContain('@throws');

    // Focus areas
    expect(content).toContain('public APIs');
    expect(content).toContain('types');
    expect(content).toContain('Examples');
  });
});
