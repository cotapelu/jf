/**
 * Skill Loader Tool Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { skillTool, listAvailableSkills } from '../../../tools/skills/skill-tool.js';
import { getCurrentCwd } from '../../../runtime-context.js';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readdir: vi.fn(),
  readFile: vi.fn(),
}));

import { readdir, readFile } from 'fs/promises';

// Mock runtime-context
vi.mock('../../../runtime-context.js', () => ({
  getCurrentCwd: vi.fn().mockReturnValue('/test/cwd'),
  getCurrentResourceLoader: vi.fn(),
}));

describe('Skill Loader Tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Tool Definition', () => {
    it('should have correct name and description', () => {
      expect(skillTool.name).toBe('skills');
      expect(skillTool.description).toContain('Load skill documentation');
    });

    it('should require skill parameter', () => {
      const params = skillTool.parameters as any;
      expect(params.required).toContain('skill');
      expect(params.properties.skill.type).toBe('string');
    });
  });

  describe('execute', () => {
    it('should load skill content from file', async () => {
      vi.mocked(readFile).mockResolvedValue('# Test Skill\n\nThis is a test skill.');

      const result = await (skillTool.execute as any)(
        'test-call',
        { skill: 'test-skill' },
        undefined,
        undefined,
        undefined
      );

      expect(result.details?.status).toBe('success');
      expect(result.content[0].text).toContain('Test Skill');
    });

    it('should return error if skill not found', async () => {
      vi.mocked(readFile).mockRejectedValue(new Error('File not found'));

      const result = await (skillTool.execute as any)(
        'test-call',
        { skill: 'nonexistent' },
        undefined,
        undefined,
        undefined
      );

      expect(result.details?.status).toBe('error');
      expect(result.content[0].text).toContain('not found');
    });
  });

  describe('listAvailableSkills', () => {
    it('should list skills from directory', async () => {
      const { readdir, readFile } = await import('fs/promises');
      const mockFiles = ['analyze-code.md', 'refactor-extract.md'] as any;
      vi.mocked(readdir).mockResolvedValue(mockFiles);
      vi.mocked(readFile).mockImplementation(async (path: any) => {
        const p = path as string;
        if (p.includes('analyze-code.md')) {
          return '# Analyze Code\n\nPhân tích code';
        }
        return '# Refactor Extract\n\nTách hàm';
      });

      const skills = await listAvailableSkills('/test/cwd');

      expect(skills.length).toBe(2);
      expect(skills[0].name).toBe('analyze-code');
      expect(skills[0].description).toBe('Analyze Code');
      expect(skills[1].name).toBe('refactor-extract');
      expect(skills[1].description).toBe('Refactor Extract');
    });
  });
});
