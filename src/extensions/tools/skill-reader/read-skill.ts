import { Type } from "typebox";
import * as fs from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Schema for read_skill command
 */
export const schema = Type.Object({
  skill: Type.Optional(Type.String({ description: "Skill name to retrieve (without .md). If omitted, lists all available skills." })),
});

/**
 * Get skills directory (bundled with extension)
 */
function getSkillsDir(): string {
  // Read from bundled skills directory next to this compiled file
  return path.join(__dirname, 'skills');
}

/**
 * Execute load_skill command
 *
 * Behavior:
 * - No args / empty skill → list all skill names
 * - With skill name → read .md file and return its content
 *
 * IMPORTANT: This tool only RETRIEVES skill content for LLM inspection.
 * It does NOT register skills with Pi or modify system state.
 */
export async function executeLoadSkill(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any
) {
  const { skill } = args;
  const skillsDir = getSkillsDir();

  try {
    // Check directory exists
    try {
      const stat = await fs.stat(skillsDir);
      if (!stat.isDirectory()) {
        return {
          stdout: "",
          stderr: `Skills directory not found: ${skillsDir}`,
          code: 1,
        };
      }
    } catch (e: any) {
      return {
        stdout: "",
        stderr: `Cannot access skills directory: ${skillsDir} (${e.message})`,
        code: 1,
      };
    }

    // Read all .md files
    const files = await fs.readdir(skillsDir);
    const mdFiles = files.filter(f => f.endsWith('.md'));

    if (mdFiles.length === 0) {
      return {
        stdout: `No skill templates found in ${skillsDir}`,
        stderr: "",
        code: 0,
      };
    }

    // Build skill map: name → file path
    const skillMap = new Map<string, string>();
    for (const file of mdFiles) {
      const name = path.basename(file, '.md');
      skillMap.set(name, path.join(skillsDir, file));
    }

    // ── DISCOVERY MODE: No skill specified → list all ────────────────────────
    if (!skill) {
      const lines = [
        `Available skills (${skillMap.size}) in ${skillsDir}:`,
        ...Array.from(skillMap.keys()).sort().map(s => `  • ${s}`),
        "",
        `To view a skill: skill_loader({ command:'load_skill', args:{ skill:'<name>' } })`
      ];
      return {
        stdout: lines.join('\n'),
        stderr: "",
        code: 0,
      };
    }

    // ── GET MODE: Retrieve specific skill content ────────────────────────────
    if (!skillMap.has(skill)) {
      return {
        stdout: "",
        stderr: `Skill '${skill}' not found. Available: ${Array.from(skillMap.keys()).join(', ')}`,
        code: 1,
      };
    }

    const filePath = skillMap.get(skill)!;
    const content = await fs.readFile(filePath, 'utf-8');

    // Return full content for LLM to read
    return {
      stdout: content,
      stderr: "",
      code: 0,
    };

  } catch (error: any) {
    return {
      stdout: "",
      stderr: `load_skill error: ${error.message}`,
      code: 1,
    };
  }
}

export default { schema, executeLoadSkill };
