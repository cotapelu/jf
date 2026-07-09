import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock fs/promises BEFORE importing module under test
vi.mock('fs/promises', () => ({
  readdir: vi.fn(),
  readFile: vi.fn(),
}));

import { readdir, readFile } from 'fs/promises';
import { listAvailableSkills } from '../../../tools/skills/skill-tool.js';

describe('listAvailableSkills coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should read markdown files and extract names/descriptions', async () => {
    vi.mocked(readdir).mockResolvedValue(['analyze-code.md']);
    vi.mocked(readFile).mockResolvedValue('# Analyze Code\nPhân tích code');

    const skills = await listAvailableSkills('/cwd');

    expect(skills).toHaveLength(1);
    expect(skills[0]).toEqual({ name: 'analyze-code', description: 'Analyze Code' });
  });

  it('should skip non-markdown files', async () => {
    vi.mocked(readdir).mockResolvedValue(['README.txt', 'refactor-extract.md']);
    vi.mocked(readFile).mockResolvedValue('# Refactor\nTách hàm');

    const skills = await listAvailableSkills('/cwd');

    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe('refactor-extract');
  });

  it('should return empty array if readFile throws on only file', async () => {
    vi.mocked(readdir).mockResolvedValue(['a.md']);
    vi.mocked(readFile).mockRejectedValue(new Error('fail'));

    const skills = await listAvailableSkills('/cwd');

    expect(skills).toEqual([]);
  });

  it('should return partial results if readFile throws after some successes', async () => {
    vi.mocked(readdir).mockResolvedValue(['a.md', 'b.md']);
    vi.mocked(readFile)
      .mockImplementationOnce(async () => '# A\nDesc A') // first success
      .mockImplementationOnce(async () => { throw new Error('fail'); }); // second fails

    const skills = await listAvailableSkills('/cwd');

    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe('a');
  });

  it('should return empty array when readdir fails', async () => {
    vi.mocked(readdir).mockRejectedValue(new Error('enoent'));
    const skills = await listAvailableSkills('/cwd');
    expect(skills).toEqual([]);
  });

  it('should return empty array for empty directory', async () => {
    vi.mocked(readdir).mockResolvedValue([]);
    const skills = await listAvailableSkills('/cwd');
    expect(skills).toEqual([]);
  });
});
