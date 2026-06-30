/**
 * Skill Engine Tests
 * Tests for the skill discovery and listing mechanism.
 */

import { describe, it, expect } from 'vitest';
import { listAvailableSkills } from '../../tools/skills/skill-tool.js';

describe('Skill Engine', () => {
  it('should list all built-in skills from the skills-md directory', async () => {
    const skills = await listAvailableSkills(process.cwd());

    // Expected built-in skill names (without .md)
    const expected = new Set([
      'analyze-code',
      'generate-docs',
      'generate-tests',
      'performance-optimize',
      'refactor-extract',
      'security-audit',
    ]);

    const actual = new Set(skills.map(s => s.name));

    expect(actual).toEqual(expected);

    // Each skill must have a non-empty description
    for (const skill of skills) {
      expect(skill.description).toBeTruthy();
      expect(skill.description.length).toBeGreaterThan(0);
    }
  });
});
