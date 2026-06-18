import { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { Static } from "typebox";
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
  } catch (e) {
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
    // @ts-expect-error - custom field for discovery
    commandMeta: commandMeta,

    async execute(_toolCallId: string, params: any, signal?: AbortSignal, _onUpdate?: any, ctx?: any) {
      const { command, args } = params;
      const loader = commands[command];

      // Validate command exists
      if (!loader) {
        return {
          content: [{ type: "text", text: `Unknown command: ${command}. Available: ${Object.keys(commands).join(', ')}` }],
          details: null,
          isError: true
        } as const;
      }

      try {
        // Discovery mode: empty args → help
        if (Object.keys(args).length === 0) {
          const meta = cm[command];
          if (meta) {
            const lines: string[] = [`=== ${command} ===`, `Description: ${meta.description}`, '', 'Arguments:'];
            // @ts-ignore
            const schema = meta.schema;
            if (schema?.properties) {
              const props = schema.properties as Record<string, any>;
              for (const [key, prop] of Object.entries(props)) {
                const required = schema.required?.includes(key);
                const type = prop?.type || 'any';
                const desc = prop.description || '';
                lines.push(`  ${key}${required ? '*' : ''} (${type}): ${desc}`);
              }
            }
            if (meta.examples.length > 0) {
              lines.push('', 'Examples:', `  ${meta.examples[0]}`);
            }
            return {
              content: [{ type: "text", text: lines.join('\n') }],
              details: { mode: "discovery", command },
              isError: false
            } as const;
          }
        }

        // Load command module
        const mod = await loader();

        // Execute (support both .execute and .executeLoadSkill naming)
        const execFn = mod.execute || mod.executeLoadSkill;
        if (!execFn) {
          throw new Error(`Command module missing execute function`);
        }
        const result = await execFn(args, ctx?.session?.cwd ?? process.cwd(), signal, ctx);

        // Return
        return {
          content: [{ type: "text", text: result.stdout }],
          details: result,
          isError: result.code !== 0
        } as const;

      } catch (error: any) {
        return {
          content: [{ type: "text", text: `skill_reader ${command} error: ${error.message}` }],
          details: { error: error.message, command },
          isError: true
        } as const;
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
