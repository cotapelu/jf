/**
 * Skill Loader Tool
 *
 * Simple file loader: read .md skill files on demand.
 * LLM decides which skill to use based on skill list provided in system prompt.
 *
 * Usage: LLM calls this tool with skill name → returns file content.
 */

import { ToolDefinition } from '@earendil-works/pi-coding-agent';
import { getCurrentCwd, getCurrentResourceLoader } from '../../runtime-context.js';
import { readFile } from 'fs/promises';
import { join } from 'path';

function getSkillPaths(cwd: string, skill: string): string[] {
  return [
    join(cwd, 'src', 'addon', 'tools', 'skills', 'skills-md', `${skill}.md`),
    join(cwd, 'dist', 'tools', 'skills', 'skills-md', `${skill}.md`),
    join(cwd, 'tools', 'skills', 'skills-md', `${skill}.md`),
  ];
}

async function tryLoadFromPaths(paths: string[]): Promise<{ content: string; path: string } | null> {
  for (const path of paths) {
    try {
      const content = await readFile(path, 'utf-8');
      return { content, path };
    } catch {
      // continue
    }
  }
  return null;
}

async function tryLoadViaResourceLoader(skill: string, resourceLoader: any): Promise<{ content: string } | null> {
  try {
    const resource = await resourceLoader.loadSkill(skill);
    return { content: resource.content };
  } catch {
    return null;
  }
}

export const skillTool: ToolDefinition = {
  name: 'skills',
  label: 'Skill Loader',
  description:
    'Load skill documentation from markdown files. Use this tool to retrieve complete instructions for a specific skill, then follow those instructions to perform the task. Skills are reusable knowledge bases for common operations.',
  promptSnippet: `
You have access to skill definitions stored as markdown files. When a user asks you to perform a task that matches a skill (like code review, refactoring, test generation, etc.), you should:

1. CALL this tool with the appropriate skill name to load its full instructions
2. READ the returned skill documentation carefully
3. FOLLOW the instructions precisely to complete the task

Available skills (auto-discovered from tools/skills/):
- analyze-code: Code analysis and review (bugs, security, performance)
- refactor-extract: Extract function/method improvements
- generate-tests: Unit test generation (Jest/Vitest)
- generate-docs: Documentation with JSDoc/TSDoc
- security-audit: Security vulnerability assessment
- performance-optimize: Performance optimization guidelines

Example usage:
User: "Phân tích code này"
You: (call skills tool with skill: "analyze-code")
You: (receive skill instructions)
You: (follow instructions and analyze code)
`.trim(),
  promptGuidelines: [
    'ALWAYS load the skill instructions BEFORE attempting the task',
    'Use exact skill names from the available list (no .md extension)',
    'Read the full skill content carefully - it contains critical steps and output format',
    'Follow the skill instructions EXACTLY as specified',
    'If the skill requires specific input format, ensure your output matches',
    'Do not modify or skip steps from the skill instructions',
    'If a skill is not available, inform the user and suggest alternatives',
    'After loading a skill, acknowledge its requirements and proceed accordingly',
  ],
  parameters: {
    type: 'object',
    properties: {
      skill: {
        type: 'string',
        description: 'Skill name (filename without .md extension)'
      }
    },
    required: ['skill']
  },
  async execute(toolCallId: string, params: any, _signal?: AbortSignal, _onUpdate?: (result: any) => void, _ctx?: any) {
    const startTime = Date.now();
    try {
      const cwd = getCurrentCwd(), resourceLoader = getCurrentResourceLoader(), paths = getSkillPaths(cwd, params.skill);
      let loaded = await tryLoadFromPaths(paths);
      if (!loaded) {
        const resourceResult = await tryLoadViaResourceLoader(params.skill, resourceLoader);
        if (resourceResult) loaded = { content: resourceResult.content, path: `[loaded via resourceLoader: ${params.skill}]` };
      }
      if (!loaded) return { content: [{ type: 'text', text: `❌ Skill "${params.skill}" not found. Check available skill names.` }], details: { toolCallId, status: 'error', error: 'Skill file not found', duration: Date.now() - startTime } };
      const duration = Date.now() - startTime;
      return { content: [{ type: 'text', text: loaded.content }], details: { toolCallId, skill: params.skill, status: 'success', path: loaded.path, duration } };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(`[skill-tool] Failed to load skill:`, error);
      return { content: [{ type: 'text', text: `❌ Failed to load skill: ${error.message}` }], details: { toolCallId, status: 'error', error: error.message, duration } };
    }
  },
};

/**
 * Helper: List all available skills (for system prompt)
 * Called during runtime initialization to populate skill list
 */
export async function listAvailableSkills(cwd: string): Promise<Array<{ name: string; description: string }>> {
  const skillsDir = join(cwd, 'src', 'addon', 'tools', 'skills', 'skills-md');
  const skills: Array<{ name: string; description: string }> = [];

  try {
    const { readdir } = await import('fs/promises');
    const files = await readdir(skillsDir);

    for (const file of files) {
      if (file.endsWith('.md')) {
        const name = file.replace('.md', '');
        const content = await readFile(join(skillsDir, file), 'utf-8');
        // Extract first line as description
        const description = content.split('\n')[0].replace(/^#+\s*/, '').trim();
        skills.push({ name, description });
      }
    }
  } catch (error) {
    console.warn('[skill-tool] Could not list skills:', error);
  }

  return skills;
}
