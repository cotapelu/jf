import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { schema, executeLoadSkill } from './read-skill.js';

// Mock fs/promises
vi.mock('fs/promises');
const mockFs = vi.mocked(fs, true);

// Helper to compute __dirname for tests
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('read-skill command module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('schema', () => {
    it('should define optional string skill property', () => {
      expect(schema).toBeDefined();
      // Schema should be TypeBox object
      expect(schema.type).toBe('object');
      expect(schema.properties).toHaveProperty('skill');
      // required may be undefined if no required fields
      if (schema.required) {
        expect(schema.required).not.toContain('skill');
      }
    });
  });

  describe('executeLoadSkill', () => {
    const mockCwd = '/test/cwd';
    const mockSkillsDir = path.join(__dirname, 'skills');

    it('should return error if skills directory is not a directory', async () => {
      mockFs.stat.mockResolvedValue({ isDirectory: () => false });

      const result = await executeLoadSkill({}, mockCwd, undefined, {});

      expect(result.code).toBe(1);
      expect(result.stderr).toContain(`Skills directory not found: ${mockSkillsDir}`);
      expect(result.stdout).toBe('');
    });

    it('should return error if fs.stat throws', async () => {
      mockFs.stat.mockRejectedValue(new Error('Permission denied'));

      const result = await executeLoadSkill({}, mockCwd, undefined, {});

      expect(result.code).toBe(1);
      expect(result.stderr).toContain(`Cannot access skills directory: ${mockSkillsDir}`);
      expect(result.stdout).toBe('');
    });

    it('should handle empty skills directory', async () => {
      mockFs.stat.mockResolvedValue({ isDirectory: () => true });
      mockFs.readdir.mockResolvedValue([]);

      const result = await executeLoadSkill({}, mockCwd, undefined, {});

      expect(result.code).toBe(0);
      expect(result.stdout).toContain(`No skill templates found in ${mockSkillsDir}`);
      expect(result.stderr).toBe('');
    });

    it('should list skills in discovery mode when no skill specified', async () => {
      mockFs.stat.mockResolvedValue({ isDirectory: () => true });
      mockFs.readdir.mockResolvedValue(['audit.md', 'code-review.md', 'debugger.md']);

      const result = await executeLoadSkill({}, mockCwd, undefined, {});

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Available skills (3)');
      expect(result.stdout).toContain('  • audit');
      expect(result.stdout).toContain('  • code-review');
      expect(result.stdout).toContain('  • debugger');
      expect(result.stderr).toBe('');
    });

    it('should return error when skill not found', async () => {
      mockFs.stat.mockResolvedValue({ isDirectory: () => true });
      mockFs.readdir.mockResolvedValue(['audit.md', 'debugger.md']);

      const result = await executeLoadSkill({ skill: 'nonexistent' }, mockCwd, undefined, {});

      expect(result.code).toBe(1);
      expect(result.stderr).toContain("Skill 'nonexistent' not found");
      expect(result.stderr).toContain('audit, debugger');
      expect(result.stdout).toBe('');
    });

    it('should return skill content when skill exists', async () => {
      mockFs.stat.mockResolvedValue({ isDirectory: () => true });
      mockFs.readdir.mockResolvedValue(['audit.md']);
      const skillContent = '# Audit Skill\n\nDescription';
      mockFs.readFile.mockResolvedValue(skillContent);

      const result = await executeLoadSkill({ skill: 'audit' }, mockCwd, undefined, {});

      expect(result.code).toBe(0);
      expect(result.stdout).toBe(skillContent);
      expect(result.stderr).toBe('');
      expect(mockFs.readFile).toHaveBeenCalledWith(path.join(mockSkillsDir, 'audit.md'), 'utf-8');
    });

    it('should handle errors accessing skills directory', async () => {
      mockFs.stat.mockRejectedValue(new Error('Unexpected error'));

      const result = await executeLoadSkill({ skill: 'any' }, mockCwd, undefined, {});

      expect(result.code).toBe(1);
      // The inner catch for stat returns this message, not the outer loader catch
      expect(result.stderr).toContain('Cannot access skills directory:');
      expect(result.stdout).toBe('');
    });

    it('should handle readFile errors for specific skill', async () => {
      mockFs.stat.mockResolvedValue({ isDirectory: () => true });
      mockFs.readdir.mockResolvedValue(['audit.md']);
      mockFs.readFile.mockRejectedValue(new Error('File corrupted'));

      const result = await executeLoadSkill({ skill: 'audit' }, mockCwd, undefined, {});

      expect(result.code).toBe(1);
      expect(result.stderr).toContain('load_skill error: File corrupted');
      expect(result.stdout).toBe('');
    });

    it('should handle skill file with various names', async () => {
      mockFs.stat.mockResolvedValue({ isDirectory: () => true });
      mockFs.readdir.mockResolvedValue(['test-skill.md', 'skill_with_underscore.md']);
      mockFs.readFile.mockResolvedValue('Content');

      const result = await executeLoadSkill({ skill: 'test-skill' }, mockCwd, undefined, {});

      expect(result.code).toBe(0);
      expect(result.stdout).toBe('Content');
    });

    it('should handle signal parameter (cancellation)', async () => {
      mockFs.stat.mockResolvedValue({ isDirectory: () => true });
      mockFs.readdir.mockResolvedValue([]);
      // Minimal AbortSignal mock for test
      const mockSignal = { aborted: false } as unknown as AbortSignal;

      const result = await executeLoadSkill({}, mockCwd, mockSignal, {});

      expect(result.code).toBe(0);
    });
  });
});
