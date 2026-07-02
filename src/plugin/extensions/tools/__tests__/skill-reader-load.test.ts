#!/usr/bin/env node
/**
 * Skill Reader executeLoadSkill Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeLoadSkill } from '../skill-reader/read-skill.js';

// Mock fs/promises
vi.mock('fs/promises', async () => {
  const actual = await vi.importActual('fs/promises');
  return {
    ...actual,
    stat: vi.fn(),
    readdir: vi.fn(),
    readFile: vi.fn(),
  };
});

import * as fs from 'fs/promises';

describe('skill-reader executeLoadSkill', () => {

  const mockCwd = '/repo';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should list skills when no skill arg', async () => {
    (fs.readdir as any).mockResolvedValue(['debugger.md', 'code-review.md']);
    (fs.stat as any).mockResolvedValue({ isDirectory: () => true });

    const result = await executeLoadSkill({ skill: undefined }, mockCwd);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('debugger');
    expect(result.stdout).toContain('code-review');
  });

  it('should return skill content', async () => {
    (fs.readdir as any).mockResolvedValue(['skill1.md']);
    (fs.stat as any).mockResolvedValue({ isDirectory: () => true });
    (fs.readFile as any).mockResolvedValue('# Skill One\nContent');

    const result = await executeLoadSkill({ skill: 'skill1' }, mockCwd);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('Skill One');
  });

  it('should error when skill not found', async () => {
    (fs.readdir as any).mockResolvedValue(['existing.md']);
    (fs.stat as any).mockResolvedValue({ isDirectory: () => true });

    const result = await executeLoadSkill({ skill: 'missing' }, mockCwd);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("Skill 'missing' not found");
  });

  it('should error when skills dir not found', async () => {
    (fs.stat as any).mockRejectedValue(new Error('ENOENT'));

    const result = await executeLoadSkill({}, mockCwd);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('Cannot access skills directory');
  });

  it('should handle empty skills dir', async () => {
    (fs.readdir as any).mockResolvedValue([]);
    (fs.stat as any).mockResolvedValue({ isDirectory: () => true });

    const result = await executeLoadSkill({}, mockCwd);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('No skill templates');
  });

});
