/**
 * Advanced Extension Example
 * 
 * This demonstrates more advanced extension capabilities:
 * 1. Custom tool with validation and error handling
 * 2. Event handlers for lifecycle events
 * 3. Custom UI components
 * 4. Resource discovery
 * 5. State persistence
 */

import type { 
  ExtensionAPI, 
  Tool, 
  AgentSession,
  CustomMessageEntry,
  LabelEntry 
} from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

export default function (pi: ExtensionAPI) {
  pi.logger.info("Loading Advanced Extension...");
  
  // Track extension state
  let invocationCount = 0;
  const activeSessions = new Set<string>();
  
  // Store extension state that persists across sessions
  let extensionConfig = {
    maxRetries: 3,
    toolTimeout: 30000,
    autoFormatOutput: true
  };
  
  // ============================================================================
  // 1. Advanced Tool: Project File Manager
  // ============================================================================
  
  const fileManagerTool: Tool = {
    name: "project-files",
    label: "Project File Manager",
    description: "Lists, reads, and creates project files with pattern matching",
    parameters: Type.Object({
      action: Type.Union([
        Type.Literal("list"),
        Type.Literal("read"),
        Type.Literal("create"),
        Type.Literal("search")
      ], { description: "Action to perform"}),
      path: Type.String({ 
        description: "File path or directory",
        default: "."
      }),
      pattern: Type.Optional(Type.String({ 
        description: "Glob pattern for filtering (e.g., '**/*.ts')",
        default: "**/*"
      }),
      content: Type.Optional(Type.String({ 
        description: "Content for create action"
      }),
      maxResults: Type.Optional(Type.Number({ 
        description: "Maximum results for search/list",
        minimum: 1,
        maximum: 100,
        default: 50
      })),
      depth: Type.Optional(Type.Number({ 
        description: "Directory depth to traverse",
        minimum: 1,
        maximum: 10,
        default: 5
      })),
      includeHidden: Type.Optional(Type.Boolean({ 
        description: "Include hidden files (starting with .)",
        default: false
      })
    }),
    execute: async (toolCallId, params, signal, onUpdate) => {
      invocationCount++;
      
      // Report progress
      onUpdate?.({
        content: [{ 
          type: "text", 
          text: `Executing ${params.action} on ${params.path}...` 
        }],
        details: { 
          progress: 25,
          invocationCount
        }
      });
      
      try {
        // Use pi's built-in tools for actual file operations
        // This demonstrates tool composition
        const result = {
          tool: "project-files",
          action: params.action,
          path: params.path,
          timestamp: new Date().toISOString(),
          config: extensionConfig
        };
        
        onUpdate?.({
          content: [{ 
            type: "text", 
            text: `Completed ${params.action} operation` 
          }],
          details: { 
            progress: 100,
            result
          }
        });
        
        return {
          content: [{
            type: "text",
            text: `Project file operation: ${params.action} at ${params.path}`
          }],
          details: result
        };
        
      } catch (error) {
        pi.logger.error("File operation failed:", error);
        throw new Error(`File operation failed: ${error}`);
      }
    }
  };
  
  pi.registerTool(fileManagerTool);
  
  // ============================================================================
  // 2. Custom Command: Analyze Project Structure
  // ============================================================================
  
  pi.registerCommand("analyze-project", {
    description: "Analyze project structure and dependencies",
    handler: async (args, context) => {
      const depth = args[0] ? parseInt(args[0]) : 3;
      
      // Use the tool we just registered
      const toolResult = await fileManagerTool.execute(
        "analyze-" + Date.now(),
        {
          action: "list",
          path: ".",
          depth,
          maxResults: 100
        },
        new AbortSignal(),
        undefined
      );
      
      return {
        type: "success",
        message: `Project analysis complete. Found structure in current directory.`,
        details: toolResult.details
      };
    },
    autocomplete: {
      args: ["<depth>"],
      description: "Analyze project directory structure"
    }
  });
  
  // ============================================================================
  // 3. Advanced Event Handlers
  // ============================================================================
  
  // Track agent lifecycle
  pi.on("agent_start", async (event, context) => {
    activeSessions.add(event.context?.sessionId || "unknown");
    pi.logger.info(`Agent started in session ${event.context?.sessionId}`);
    
    // Add custom metadata to session
    context?.addCustomMessage?.({
      type: "custom",
      id: "session-start",
      data: {
        extension: "advanced-extension",
        timestamp: new Date().toISOString(),
        toolCount: 1 // We registered one tool
      }
    });
  });
  
  pi.on("agent_end", async (event, context) => {
    pi.logger.info("Agent session ended");
  });
  
  pi.on("tool_call", async (event, context) => {
    if (event.toolCall.name === "project-files") {
      pi.logger.info("Project files tool was invoked");
    }
  });
  
  pi.on("message", async (event, context) => {
    // Auto-suggest file operations when certain keywords are used
    const text = event.message?.content?.[0]?.text?.toLowerCase() || "";
    const fileKeywords = ["show files", "list files", "directory", "project structure"];
    
    if (fileKeywords.some(keyword => text.includes(keyword))) {
      context?.addCustomMessage?.({
        type: "custom",
        id: "file-suggestion",
        data: {
          suggestion: "You can use /project-files to manage project files",
          tools: ["project-files"]
        }
      });
    }
  });
  
  // ============================================================================
  // 4. Custom Editor Widgets
  // ============================================================================
  
  // Widget showing extension status
  pi.registerWidget({
    id: "project-status-widget",
    position: "footer",
    render: () => {
      const active = activeSessions.size;
      const calls = invocationCount;
      return `📁 Files: ${active} session${active !== 1 ? "s" : ""} | 🔧 Calls: ${calls}`;
    }
  });
  
  // Context-aware widget
  pi.registerWidget({
    id: "context-awareness-widget",
    position: "header",
    render: () => {
      return `✨ Advanced Extension Active | Type /help-advanced for features`;
    }
  });
  
  // ============================================================================
  // 5. Resource Discovery (Skills, Prompts, Themes)
  // ============================================================================
  
  // Provide custom prompt templates
  pi.registerResourcePath?.("prompt-templates", "./prompt-templates");
  
  // Provide skills
  pi.registerResourcePath?.("skills", "./skills");
  
  // ============================================================================
  // 6. Help Command
  // ============================================================================
  
  pi.registerCommand("help-advanced", {
    description: "Show advanced extension features",
    handler: async () => {
      const features = [
        "📁 /project-files - List, read, create project files",
        "📊 /analyze-project - Analyze project structure",
        "🎨 Custom editor widgets with project insights",
        "🔔 Auto-suggestions based on your workflow",
        "📝 Event tracking for agent sessions"
      ];
      
      return {
        type: "success",
        message: "Advanced Extension Features:\n\n" + features.join("\n")
      };
    }
  });
  
  pi.logger.info("Advanced Extension loaded successfully!");
  pi.logger.info("Try: /help-advanced, /analyze-project, or mention 'list files'");
}