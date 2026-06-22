/**
 * Skill Loader Tool Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { skillTool, listAvailableSkills } from '../../../tools/skills/skill-tool.js';
import { getCurrentCwd, getCurrentResourceLoader } from '../../../runtime-context.js';

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

// Helper type for resource loader
interface ResourceLoader {
  loadSkill(name: string): Promise<{ content: string }>;
}

// Cast skillTool.execute once to avoid multiple 'as any'
const skillExecute = skillTool.execute as unknown as (
  toolCallId: string,
  params: { skill: string; [key: string]: any },
  signal?: any,
  onUpdate?: any,
  ctx?: any
) => Promise<any>;

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
      const params = skillTool.parameters as unknown as Record<string, any>;
      expect(params.required).toContain('skill');
      expect(params.properties.skill.type).toBe('string');
    });
  });

  describe('execute', () => {
    it('should load skill content from file', async () => {
      vi.mocked(readFile).mockResolvedValue('# Test Skill\n\nThis is a test skill.');

      const result = await skillExecute('test-call', { skill: 'test-skill' });

      expect(result.details?.status).toBe('success');
      expect(result.content[0].text).toContain('Test Skill');
    });

    it('should return error if skill not found', async () => {
      vi.mocked(readFile).mockRejectedValue(new Error('File not found'));

      const result = await skillExecute('test-call', { skill: 'nonexistent' });

      expect(result.details?.status).toBe('error');
      expect(result.content[0].text).toContain('not found');
    });
  });

  describe('listAvailableSkills', () => {
    it('should list skills from directory', async () => {
      const { readdir, readFile } = await import('fs/promises');
      const mockFiles = ['analyze-code.md', 'refactor-extract.md'];
      vi.mocked(readdir).mockResolvedValue(mockFiles);
      vi.mocked(readFile).mockImplementation(async (path: string) => {
        if (path.includes('analyze-code.md')) {
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

  describe('execute fallback and error handling', () => {
    it('should fallback to resourceLoader when file not found in any path', async () => {
      vi.mocked(readFile).mockRejectedValue(new Error('ENOENT'));
      const mockResourceLoader = { loadSkill: vi.fn().mockResolvedValue({ content: 'Skill from loader' }) } as unknown as ResourceLoader;
      vi.mocked(getCurrentResourceLoader).mockReturnValue(mockResourceLoader);

      const result = await skillExecute('call', { skill: 'fallback-skill' });

      expect(result.details?.status).toBe('success');
      expect(result.content[0].text).toBe('Skill from loader');
      expect(mockResourceLoader.loadSkill).toHaveBeenCalledWith('fallback-skill');
    });

    it('should return error when both file and resourceLoader fail', async () => {
      vi.mocked(readFile).mockRejectedValue(new Error('ENOENT'));
      const mockResourceLoader = { loadSkill: vi.fn().mockRejectedValue(new Error('Loader error')) } as unknown as ResourceLoader;
      vi.mocked(getCurrentResourceLoader).mockReturnValue(mockResourceLoader);

      const result = await skillExecute('call', { skill: 'missing' });

      expect(result.details?.status).toBe('error');
      expect(result.content[0].text).toContain('Skill "missing" not found');
    });

    it('should try next path if earlier readFile fails', async () => {
      vi.mocked(readFile)
        .mockImplementationOnce(async (path: string) => { throw new Error('fail1'); })
        .mockImplementationOnce(async () => 'Second path content');

      const result = await skillExecute('call', { skill: 'test' });
      expect(result.details?.status).toBe('success');
      expect(result.content[0].text).toBe('Second path content');
    });
  });

  describe('listAvailableSkills edge cases', () => {
    it('should handle readdir error and return empty array', async () => {
      vi.mocked(readdir).mockRejectedValue(new Error('readdir fail'));
      const skills = await listAvailableSkills('/test/cwd');
      expect(skills).toEqual([]);
    });
  });
});
