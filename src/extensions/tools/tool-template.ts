#!/usr/bin/env node

/**
 * ============================================================================
 * KIcad TOOL TEMPLATE
 * ============================================================================
 * Copy này và chỉnh sửa để tạo tool mới.
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║  CẤU TRÚC THƯ MỤC (BẮT BUỘC KHI TẠO TOOL MỚI)                            ║
 * ╠═══════════════════════════════════════════════════════════════════════════╣
 * ║                                                                           ║
 * ║  src/extensions/tools/                                                   ║
 * ║  ├── your-tool-name.ts          ← File chính (như file này)             ║
 * ║  └── your-tool-name/           ← Thư mục chứa các command files         ║
 * ║      ├── command-1.js          ← MỖI FILE LÀ 1 COMMAND                 ║
 * ║      ├── command-2.js                                               ║
 * ║      └── ...                                                             ║
 * ║                                                                           ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 *
 * Pattern:
 * 1. Định nghĩa commands registry (dynamic import)
 * 2. Tạo ToolDefinition với name, description, promptGuidelines, parameters
 * 3. execute() router: nhận params, gọi command module, trả về result
 * 4. registerTool() để đăng ký với extension API
 *
 * Mỗi command là FILE RIÊNG trong thư mục tool (KHÔNG CẦN thư mục commands/).
 * File command export: { schema: Type.Object(...), execute: async (args, cwd, signal, ctx) => { ... } }
 * ============================================================================
 */

import { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { Static } from "typebox";
import { schema as exampleSchema } from './tool-template/example-command';
import { schema as anotherSchema } from './tool-template/another-command';
// Validation: import { validate } from "@sinclair/typebox/validate"; (optional)

// Trả về help text từ schema
function generateCommandHelp(commandName: string, meta: { description: string; schema: any; examples: string[] }): string {
  const lines: string[] = [`=== ${commandName} ===`];
  
  if (meta.description) {
    lines.push(`\nDescription: ${meta.description}`);
  }
  
  // Extract schema properties
  // @ts-ignore
  const schema = meta.schema;
  if (schema?.properties) {
    lines.push("\nArguments:");
    const props = schema.properties as Record<string, any>;
    for (const [key, prop] of Object.entries(props)) {
      const required = schema.required?.includes(key);
      const type = prop?.type || "any";
      const desc = prop.description || "";
      lines.push(`  ${key}${required ? '*' : ''} (${type}): ${desc}`);
    }
  }
  
  if (meta.examples && meta.examples.length > 0) {
    lines.push("\nExamples:");
    meta.examples.forEach((ex: string) => lines.push(`  ${ex}`));
  }
  
  return lines.join("\n");
}

// ============================================================================
// 1. LOAD COMMANDS (Dynamic imports)
// ============================================================================
// LƯU Ý:
// - Tạo thư mục con TRÙNG TÊN với file này: your-tool-name/
// - Mỗi command là file riêng trong thư mục đó: your-tool-name/<tên-command>.js
// - Import path: './<tên-command>.js' (KHÔNG CẦN thư mục commands/)
// ============================================================================

// Type-safe command loader interface
interface CommandModule<TInput = any> {
  schema: any;
  execute(args: TInput, cwd: string, signal?: AbortSignal, ctx?: any): Promise<{ stdout: string; stderr: string; code: number }>;
}

type CommandLoader = () => Promise<CommandModule>;

const commands: Record<string, CommandLoader> = {
  example_command: () => import('./tool-template/example-command.ts'),
  another_command: () => import('./tool-template/another-command.ts'),
};

// ============================================================================
// 2. TOOL FACTORY
// ============================================================================

/**
 * Tạo ToolDefinition cho tool của bạn.
 *
 * QUAN TRỌNG:
 * - name: ID duy nhất, dùng trong prompt LLM (ví dụ: your_tool_name)
 * - label: Tên hiển thị
 * - description: Mô tả ngắn gọn + liệt kê commands
 * - promptSnippet: Cú pháp gọi tool (dùng trong system prompt)
 * - promptGuidelines: Các ví dụ cụ thể để LLM hiểu cách dùng
 * - parameters: JSON Schema cho tham số đầu vào
 */
export function createYourTool(): ToolDefinition {
  // ╔═══════════════════════════════════════════════════════════════════════════╗
  // ║  COMMAND METADATA - Định nghĩa schema, description, examples cho mỗi cmd ║
  // ╚═══════════════════════════════════════════════════════════════════════════╝
  // Dùng để:
  // 1. Validate khi LLM gọi (validate args theo schema của command)
  // 2. Trả về help khi args rỗng (discovery mode)
  // 3. Tự động generate promptGuidelines
  // 4. Command router biết schema của từng command
  const commandMeta: Record<string, {
    description: string;
    schema: any;  // TypeBox schema
    examples: string[];
  }> = {
  example_command: {
    description: "Mô tả ngắn về command này",
    schema: exampleSchema,
    examples: ["your_tool_name({ command: 'example_command', args: { input: 'data.txt' } })"]
  },
  another_command: {
    description: "Một command khác",
    schema: anotherSchema,
    examples: ["your_tool_name({ command: 'another_command', args: { files: ['a.txt', 'b.txt'] } })"]
  }
};

  // Capture commandMeta trong closure (không dùng this)
  const cm = commandMeta;

  return {
    name: "tool_template",
    label: "Tool Template",
    description:"Multi-command tool. Call with empty args {} to see subcommand help.",
    promptSnippet:"tool_template({ command:'<cmd>', args:{...} })",
    promptGuidelines:[
      `Subcommands (call with {} for details):`,
      ...Object.entries(commandMeta).map(([cmd,meta]) =>
        `• ${cmd}: ${meta.description}` +
        (meta.examples[0] ? ` e.g. ${meta.examples[0]}` : '')
      )
    ],
    parameters: {
      type: "object",
      properties: {
        command: {
          type: "string",
          enum: Object.keys(commands), // Tự động lấy danh sách command
          description: "Tên sub-command để thực thi"
        },
        args: {
          type: "object",
          description: "Arguments cho command cụ thể (xem schema của từng command)"
        }
      },
      required: ["command", "args"]
    },

        // ── DISCOVERY SUPPORT: Lưu metadata để trả về help khi args rỗng ─────────
    // Field này không phải part của ToolDefinition chuẩn, nhưng tool có thể
    // sử dụng trong execute().
    // Framework PI sẽ bỏ qua, không đưa vào system prompt.
    // @ts-expect-error - custom field for tool template
    commandMeta: commandMeta,

    // ========================================================================
    // 3. EXECUTE ROUTER
    // ========================================================================
    async execute(_toolCallId: string, params: any, signal: AbortSignal | undefined, _onUpdate: any, ctx: any) {
      const { command, args } = params;
      const loader = commands[command];

      // Kiểm tra command hợp lệ
      if (!loader) {
        return {
          content: [{ type: "text", text: `Unknown command: ${command}. Available: ${Object.keys(commands).join(', ')}` }],
          details: null,
          isError: true
        } as const;
      }

      try {
        // ── DISCOVERY MODE: Nếu args rỗng → trả về help của command ───────────
        if (Object.keys(args).length === 0) {
          const meta = cm[command];
          if (meta) {
            const help = generateCommandHelp(command, meta);
            return {
              content: [{ type: "text", text: help }],
              details: { mode: "discovery", command, schema: meta.schema },
              isError: false
            } as const;
          }
          // Fallback nếu không có metadata
          return {
            content: [{ type: "text", text: `Command '${command}' requires arguments. Use schema to see required fields.` }],
            details: { mode: "discovery", command },
            isError: false
          } as const;
        }

        // ── STEP 1 (OPTIONAL): Validate args theo command-specific schema ─────
        // Uncomment nếu cần validation runtime:
        // import { validate } from "@sinclair/typebox/validate";
        // const meta = cm[command];
        // if (meta?.schema) {
        //   const validationResult = validate(args, meta.schema);
        //   if (!validationResult.valid) {
        //     const errors = validationResult.errors?.map((e: any) => 
        //       `${e.path?.join('.') || ''}: ${e.message}`
        //     ).join('; ') || 'Invalid arguments';
        //     return { content: [{ text: `Validation failed: ${errors}` }], isError: true } as const;
        //   }
        // }

        // Get command metadata
        const meta = cm[command];

        // Dynamic import command module
        let mod: CommandModule | undefined;
        try {
          mod = await loader();
        } catch (importError: any) {
          throw new Error(`Failed to load command '${command}': ${importError.message}`);
        }

        // Lấy cwd từ context, fallback về process.cwd()
        const cwd = ctx.session?.cwd ?? process.cwd();

        // Gọi command execute với typed args (nếu có schema)
        const result = await (meta?.schema
          ? mod.execute(args as Static<typeof meta.schema>, cwd, signal, ctx)
          : mod.execute(args, cwd, signal, ctx)) as { stdout: string; stderr: string; code: number };

        // Nếu code !== 0 → error
        if (result.code !== 0) {
          throw new Error(result.stderr || `Command ${command} exited with code ${result.code}`);
        }

        // Success: trả về stdout
        return {
          content: [{ type: "text", text: result.stdout }],
          // @ts-ignore
          details: result,
          isError: false
        } as const;

      } catch (error: any) {
        // Error handling
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `Tool '${command}' error: ${errorMessage}` }],
          details: { error: errorMessage, command },
          isError: true
        } as const;
      }
    }
  };
}

// ============================================================================
// 4. REGISTRATION
// ============================================================================

/**
 * Đăng ký tool với extension API.
 *
 * Trong file index.ts của extension, import và gọi:
 *   import { registerToolTemplate } from './tools/tool-template.js';
 *   registerToolTemplate(api);
 */
export function registerToolTemplate(api: import("@earendil-works/pi-coding-agent").ExtensionAPI): void {
  api.registerTool(createYourTool());
}

// ============================================================================
// 5. IMPORTANT: ĐĂNG KÝ COMMAND METADATA
// ============================================================================
/*
╔═══════════════════════════════════════════════════════════════════════════╗
║  BẮT BUỘC: Trong createYourTool(), sau khi define commandMeta object,   ║
║  bạn PHẢI import schema từ các command module và gán vào commandMeta.   ║
║                                                                           ║
║  Ví dụ:                                                                   ║
║    const commandMeta = {                                                  ║
║      erc: {                                                              ║
║        description: "Run electrical rules check",                       ║
║        schema: (await import('./commands/erc.js')).schema,              ║
║        examples: [                                                       ║
║          "your_tool({ command: 'erc', args: { input: 'file.kicad_sch' } })"║
║        ]                                                                 ║
║      }                                                                   ║
║    };                                                                    ║
║                                                                           ║
║  LƯU Ý:                                                                   ║
║  - schema phải là TypeBox schema object (trả xuống từ command module)   ║
║  - Có thể import tĩnh (require) hoặc dynamic import (await import)      ║
║  - Metadata này dùng cho discovery mode: args rỗng → trả về help text   ║
╚═══════════════════════════════════════════════════════════════════════════╝
*/

// ============================================================================
// 5. VÍ DỤ COMMAND MODULE (Tạo file <tên-command>.js trong thư mục tool)
// ============================================================================
/*
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Template cho một command module bất kỳ
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { Type } from "typebox";

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  1. SCHEMA - Định nghĩa cấu trúc arguments (dùng cho validation)        ║
// ╚═══════════════════════════════════════════════════════════════════════════╝
// Sử dụng TypeBox để định nghĩa JSON Schema.
// Khi tool được gọi, framework sẽ tự động validate args trước khi gọi execute.
// Nếu không hợp lệ → error trước khi chạy command.
export const schema = Type.Object({
  // Required field (bắt buộc)
  input: Type.String({ description: "Đường dẫn file đầu vào" }),

  // Optional fields (tùy chọn)
  output: Type.Optional(Type.String({ description: "Đường dẫn file đầu ra" })),
  flag: Type.Optional(Type.Boolean()),
  count: Type.Optional(Type.Number()),
  mode: Type.Optional(Type.Union([
    Type.Literal("fast"),
    Type.Literal("accurate")
  ], { description: "Chế độ chạy" })),
});

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  2. EXECUTE - Hàm thực thi command                                      ║
// ╚═══════════════════════════════════════════════════════════════════════════╝
// Args đã được validated theo schema, nên an toàn để dùng.
// Trả về { stdout: string, stderr: string, code: number }
// discovery mode được xử lý ở ToolDefinition.execute(), không cần ở đây.
//
// IMPORTANT: Có thể dùng ctx.exec() để chạy shell commands. Ví dụ:
//   const result = await ctx.exec('python', ['-m', 'module', '--input', args.input], { cwd, signal });
//   return { stdout: result.stdout, stderr: result.stderr, code: result.code };
//
// HOẶC: Dùng trực tiếp Node APIs (fs, path, etc.)
//   import fs from 'fs/promises';
//   const content = await fs.readFile(args.input, 'utf-8');
//   return { stdout: content, stderr: '', code: 0 };
export async function execute(args: Static<typeof schema>, cwd: string, signal?: AbortSignal, ctx?: any) {
  // cwd: working directory từ session
  // signal: AbortSignal để hủy giữa chừng
  // ctx: context có ctx.exec() để chạy shell command

  // ===== VÍ DỤ DÙNG ctx.exec (an toàn, respects session cwd, cancellation) ====
  // const python = process.env.PYTHON || 'python3';
  // const cmd = [python, '-m', 'your.module.name', args.input];
  // if (args.output) cmd.push('--output', args.output);
  // if (args.flag) cmd.push('--flag');
  // if (args.mode) cmd.push('--mode', args.mode);
  // const result = await ctx!.exec(python, cmd.slice(1), { cwd, signal });
  // return { stdout: result.stdout, stderr: result.stderr, code: result.code };

  // ===== HOẶC VÍ DỤ DÙng Node API trực tiếp ====================================
  // import path from 'path';
  // const inputPath = path.resolve(cwd, args.input);
  // const content = await fs.readFile(inputPath, 'utf-8');
  // return { stdout: `Read ${args.input}: ${content.length} chars`, stderr: '', code: 0 };

  // TODO: Implement your command logic here
  throw new Error("Command not implemented. Replace this with your actual logic.");
}

export default { schema, execute };

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*/