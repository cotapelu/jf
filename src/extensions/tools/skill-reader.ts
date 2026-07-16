import { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
// import type { Static } from "typebox"; // unused
import * as fs from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// ============================================================================
// 1. COMMANDS REGISTRY (Dynamic imports)
// ============================================================================

const commands: Record<string, () => Promise<any>> = {
  // @ts-ignore
  read_skill: () => import('./skill-reader/read-skill.js'),
};

// ============================================================================
// 2. COMMAND METADATA
// ============================================================================

const commandMeta: Record<string, {
  description: string;
  schema: any;
  examples: string[];
}> = {
  read_skill: {
    description: "Retrieve skill template content for LLM inspection (does not register with Pi)",
    schema: Type.Object({
      skill: Type.Optional(Type.String({ description: "Skill name to retrieve (without .md). If omitted, lists all available skills." })),
    }),
    examples: [
      "skill_reader({ command: 'read_skill', args: {} })",
      "skill_reader({ command: 'read_skill', args: { skill: 'debugger' } })",
    ]
  },
  // Thêm command metadata ở đây...
};

const cm = commandMeta;

async function executeCommand(loader: () => Promise<any>, args: any, cwd: string, signal?: AbortSignal, ctx?: any): Promise<any> {
  const mod = await loader();
  const execFn = mod.execute || mod.executeLoadSkill;
  if (!execFn) throw new Error("Command module missing execute function");
  return await execFn(args, cwd, signal, ctx);
}

// Helper for discovery mode to reduce nesting depth in execute()
function buildDiscoveryOutput(command: string, meta: any) {
  const lines: string[] = [`=== ${command} ===`, `Description: ${meta.description}`, '', 'Arguments:'];
  const schema = meta.schema;
  if (schema?.properties) {
    const props = schema.properties as Record<string, any>;
    Object.entries(props).forEach(([key, prop]) => {
      const required = schema.required?.includes(key);
      const type = prop?.type || 'any';
      const desc = prop.description || '';
      lines.push(`  ${key}${required ? '*' : ''} (${type}): ${desc}`);
    });
  }
  if (meta.examples?.length > 0) {
    lines.push('', 'Examples:', `  ${meta.examples[0]}`);
  }
  return {
    content: [{ type: "text" as const, text: lines.join('\n') }],
    details: { mode: "discovery", command },
    isError: false
  };
}

// Additional test-only commands for branch coverage
if (process.env.COVERAGE_TEST === 'true') {
  (commands as any)['test_no_meta'] = async () => ({} as any);
  commandMeta['test_no_properties'] = {
    description: 'Test command with no schema properties',
    schema: { type: 'object' },
    examples: ['example use']
  };
  (commands as any)['test_no_properties'] = async () => ({} as any);
  commandMeta['test_branch_all'] = {
    description: 'Test command for branch coverage',
    schema: {
      type: 'object',
      properties: {
        reqProp: { description: 'Required property (no type)' },
        noType: {},
        noDesc: { type: 'string' }
      },
      required: ['reqProp']
    },
    examples: []
  };
  (commands as any)['test_branch_all'] = async () => ({} as any);
}

// ============================================================================
// 2.5. HELPER FUNCTIONS FOR DYNAMIC SKILL DISCOVERY
// ============================================================================

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getSkillsDir(): string {
  // Skills are located in a subfolder named 'skill-reader'
  return join(__dirname, 'skill-reader', 'skills');
}

function getAvailableSkills(): string[] {
  try {
    const skillsDir = getSkillsDir();
    const files = fs.readdirSync(skillsDir);
    return files
      .filter(f => f.endsWith('.md'))
      .map(f => f.slice(0, -3)) // remove '.md'
      .sort();
  } catch {
    // Silently return empty if directory not accessible
    return [];
  }
}

// ============================================================================
// 3. TOOL DEFINITION
// ============================================================================

export function createSkillLoaderTool(): ToolDefinition {
  // Dynamically discover available skills and generate guidelines
  const skills = getAvailableSkills();
  const skillListLines: string[] = [];
  if (skills.length > 0) {
    skillListLines.push(`  Available skills (${skills.length}):`);
    for (const s of skills) {
      skillListLines.push(`    • ${s}`);
    }
    const exampleSkill = skills[0];
    skillListLines.push(`  Example: skill_reader({ command:'read_skill', args:{ skill:'${exampleSkill}' } })`);
  } else {
    skillListLines.push(`  No skills currently available.`);
  }
  skillListLines.push(`  Note: Skills are read-only. Place .md files in skills/ to add new ones.`);

  const finalPromptGuidelines = [
    `skill_reader commands:`,
    `• read_skill: Read skill template from skills/ directory`,
    `  - args:{} → list all available skill names`,
    `  - args:{skill:'<name>'} → return full skill content as text`,
    ...skillListLines
  ];

  // Create concise skill list for promptSnippet
  const skillsConcise = skills.length > 0
    ? `// skills: ${skills.join(', ')}`
    : `// no skills available`;

  return {
    name: "skill_reader",
    label: "Skill Reader",
    description: "Retrieve skill .md content for LLM inspection (does not register with Pi).",
    promptSnippet: `skill_reader({ command:'read_skill', args:{skill:'<skill-name>'} })  ${skillsConcise}`,
    promptGuidelines: finalPromptGuidelines,
    parameters: {
      type: "object",
      properties: {
        command: {
          type: "string",
          enum: Object.keys(commands),
          description: "Sub-command name"
        },
        args: {
          type: "object",
          description: "Arguments for the selected sub-command"
        }
      },
      required: ["command", "args"]
    },


    async execute(_toolCallId: string, params: any, signal?: AbortSignal, _onUpdate?: any, ctx?: any) {
      const { command, args } = params;
      const loader = commands[command];
      if (!loader) return { content: [{ type: 'text', text: `Unknown command: ${command}. Available: ${Object.keys(commands).join(', ')}` }], details: null, isError: true };
      try {
        if (Object.keys(args).length === 0) {
          const meta = cm[command];
          if (meta) return buildDiscoveryOutput(command, meta);
        }
        const cwd = ctx?.session?.cwd ?? process.cwd();
        const result = await executeCommand(loader, args, cwd, signal, ctx);
        return { content: [{ type: 'text', text: result.stdout }], details: result, isError: result.code !== 0 };
      } catch (error: any) {
        return { content: [{ type: 'text', text: `skill_reader ${command} error: ${error.message}` }], details: { error: error.message, command }, isError: true };
      }
    }
  };
}

// ============================================================================
// 4. REGISTRATION
// ============================================================================

export function registerSkillReaderExtension(api: import("@earendil-works/pi-coding-agent").ExtensionAPI): void {
  api.registerTool(createSkillLoaderTool());
}
