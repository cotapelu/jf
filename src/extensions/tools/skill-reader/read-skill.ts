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
// --- Helpers ---
async function ensureSkillsDir(dir: string): Promise<{stdout:string,stderr:string,code:number} | null> {
  try {
    const stat = await fs.stat(dir);
    if (!stat.isDirectory()) {
      return { stdout:"", stderr:`Skills directory not found: ${dir}`, code:1 };
    }
    return null;
  } catch (e: any) {
    return { stdout:"", stderr:`Cannot access skills directory: ${dir} (${e.message})`, code:1 };
  }
}

async function buildSkillMap(dir: string): Promise<Map<string,string> | {stdout:string,stderr:string,code:number}> {
  const files = await fs.readdir(dir);
  const mdFiles = files.filter(f => f.endsWith('.md'));
  if (mdFiles.length === 0) {
    return { stdout:`No skill templates found in ${dir}`, stderr:"", code:0 };
  }
  const map = new Map<string, string>();
  for (const file of mdFiles) {
    const name = path.basename(file, '.md');
    map.set(name, path.join(dir, file));
  }
  return map;
}

function formatDiscovery(dir: string, map: Map<string,string>): {stdout:string,stderr:"",code:0} {
  const lines = [
    `Available skills (${map.size}) in ${dir}:`,
    ...Array.from(map.keys()).sort().map(s => `  • ${s}`),
    "",
    `To view a skill: skill_loader({ command:'load_skill', args:{ skill:'<name>' } })`
  ];
  return { stdout: lines.join('\n'), stderr: "", code: 0 };
}

async function readSkillFile(filePath: string): Promise<string | {stdout:"",stderr:string,code:number}> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return content;
  } catch (e: any) {
    return { stdout:"", stderr:`load_skill error: ${e.message}`, code:1 };
  }
}

export async function executeLoadSkill(
  args: any,
  _cwd: string,
  _signal?: AbortSignal,
  _ctx?: any
) {
  const { skill } = args; const skillsDir = getSkillsDir();
  const dirCheck = await ensureSkillsDir(skillsDir); if (dirCheck) return dirCheck;
  const mapResult = await buildSkillMap(skillsDir); if (!(mapResult instanceof Map)) return mapResult;
  const skillMap = mapResult;
  if (!skill) return formatDiscovery(skillsDir, skillMap);
  if (!skillMap.has(skill)) return { stdout:"", stderr:`Skill '${skill}' not found. Available: ${Array.from(skillMap.keys()).join(', ')}`, code:1 };
  const filePath = skillMap.get(skill)!; const content = await readSkillFile(filePath);
  return typeof content === 'string' ? { stdout: content, stderr:"", code:0 } : content;
}

export default { schema, executeLoadSkill };
