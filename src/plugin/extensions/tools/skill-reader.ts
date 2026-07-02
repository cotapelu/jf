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
      "plugin.skill_reader({ command: 'read_skill', args: {} })",
      "plugin.skill_reader({ command: 'read_skill', args: { skill: 'debugger' } })",
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
    skillListLines.push(`  Example: plugin.skill_reader({ command:'read_skill', args:{ skill:'${exampleSkill}' } })`);
  } else {
    skillListLines.push(`  No skills currently available.`);
  }
  skillListLines.push(`  Note: Skills are read-only. Place .md files in skills/ to add new ones.`);

  const finalPromptGuidelines = [
    `plugin.skill_reader commands:`,
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
    name: "plugin.skill_reader",
    label: "Skill Reader",
    description: "CRITICAL: Read skill playbooks BEFORE executing complex tasks. Skills contain mandatory step-by-step procedures, checklists, and best practices for audit, code review, debugging, refactoring, and testing. NEVER skip this step.",
    promptSnippet: `plugin.skill_reader({ command:'read_skill', args:{skill:'<skill-name>'} })  // MANDATORY before audit, code-review, debug, refactor, test`,
    promptGuidelines: [
      `# ⚠️ CRITICAL: SKILL READER - MANDATORY FIRST STEP`,
      ``,
      `## BEFORE ANY COMPLEX TASK, READ THE SKILL GUIDE`,
      ``,
      `### REQUIRED WORKFLOW`,
      `When user requests ANY of these tasks, follow EXACTLY:`,
      ``,
      `1. **Identify task type**:`,
      `   - "audit", "security", "quality", "compliance" → skill: \`audit\``,
      `   - "review", "code review", "PR review" → skill: \`code-review\``,
      `   - "debug", "troubleshoot", "find bug", "error" → skill: \`debugger\``,
      `   - "refactor", "improve code", "clean up", "remove duplication" → skill: \`refactor\``,
      `   - "test", "increase coverage", "write tests" → skill: \`test-rule\``,
      ``,
      `2. **IMMEDIATELY call plugin.skill_reader** to get the guide:`,
      `   \`plugin.skill_reader({ command:'read_skill', args:{ skill:'<matched-name>' } })\``,
      ``,
      `3. **READ and FOLLOW** every step in the guide. Do NOT skip.`,
      ``,
      `### WHY THIS IS MANDATORY`,
      `- Skills contain **proven procedures** you might miss`,
      `- Skills include **checklists** to ensure completeness`,
      `- Skills recommend **specific tools** for each step`,
      `- Skipping leads to **incomplete or low-quality** results`,
      ``,
      `### EXAMPLES`,
      `User: "Hãy audit codebase để tìm security issues"`,
      `YOU:`,
      `  - Call \`plugin.skill_reader({ command:'read_skill', args:{ skill:'audit' } })\``,
      `  - Wait for full guide`,
      `  - Execute steps: search secrets, scan dependencies, check complexity, etc.`,
      `  - Use guide's checklist to verify completeness`,
      ``,
      `User: "Có PR cần review"`,
      `YOU:`,
      `  - Call \`plugin.skill_reader({ command:'read_skill', args:{ skill:'code-review' } })\``,
      `  - Follow review checklist: logic, security, performance, tests, documentation`,
      ``,
      `### NEVER SKIP`,
      `❌ DO NOT start auditing without reading \`audit\` skill`,
      `❌ DO NOT start code review without reading \`code-review\` skill`,
      `❌ DO NOT debug without reading \`debugger\` skill`,
      `❌ DO NOT refactor without reading \`refactor\` skill`,
      `❌ DO NOT write tests without reading \`test-rule\` skill`,
      ``,
      `### AVAILABLE SKILLS`,
      `| Skill | Use for |`,
      `|-------|---------|`,
      `| audit | Systematic code audits (security, performance, quality) |`,
      `| code-review | Review pull requests, provide feedback |`,
      `| debugger | Debug issues, trace execution, find root cause |`,
      `| refactor | Improve code structure, eliminate duplication |`,
      `| test-rule | Write tests, improve coverage, test strategies |`,
      ``,
      `Remember: Reading the skill guide is NOT optional—it's the first step.`,
      ``,
      ...skillListLines,
      `Note: Skills are READ-ONLY guides. They do NOT execute code. You must manually perform each step using other tools.`,
    ],
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
    commandMeta,

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
          content: [{ type: "text", text: `plugin.skill_reader ${command} error: ${error.message}` }],
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
