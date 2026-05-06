import { ExtensionAPI, Tool } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

/**
 * Hello World Extension Example
 * 
 * This extension registers:
 * 1. A custom tool (greeting)
 * 2. A command (hello)
 * 3. An event handler (on message)
 * 4. A custom editor widget
 */
export default function (pi: ExtensionAPI) {
  // 1. Register a custom tool
  const greetingTool: Tool = {
    name: "greeting",
    label: "Greeting Tool",
    description: "Generates a personalized greeting message",
    parameters: Type.Object({
      name: Type.String({ description: "Name to greet" }),
      formal: Type.Optional(Type.Boolean({ description: "Use formal greeting"})),
      language: Type.Optional(Type.String({ 
        description: "Language code (en, es, fr, de)",
        default: "en"
      })),
    }),
    execute: async (toolCallId, params, signal, onUpdate) => {
      const greetings = {
        en: params.formal ? `Dear ${params.name}, welcome.` : `Hello ${params.name}!`,
        es: params.formal ? `Estimado ${params.name}, bienvenido.` : `¡Hola ${params.name}!`,
        fr: params.formal ? `Cher ${params.name}, bienvenue.` : `Salut ${params.name} !`,
        de: params.formal ? `Sehr geehrter ${params.name}, willkommen.` : `Hallo ${params.name}!`,
      };
      
      const greeting = greetings[params.language as keyof typeof greetings] || greetings.en;
      
      // Stream progress update (optional)
      onUpdate?.({
        content: [{ type: "text", text: `Generating greeting for ${params.name}...` }],
        details: { progress: 50 }
      });
      
      return {
        content: [{ type: "text", text: greeting }],
        details: { 
          tool: "greeting",
          language: params.language,
          timestamp: new Date().toISOString()
        }
      };
    }
  };
  
  pi.registerTool(greetingTool);
  
  // 2. Register a custom command
  pi.registerCommand("hello", {
    description: "Send a test greeting",
    handler: async (args, context) => {
      const name = args[0] || "World";
      const toolResult = await greetingTool.execute(
        "test-id",
        { name, formal: false },
        new AbortSignal(),
        undefined
      );
      
      return {
        type: "success",
        message: toolResult.content[0].text,
      };
    },
    autocomplete: {
      args: ["name"],
      description: "Test the greeting tool"
    }
  });
  
  // 3. Register an event handler
  pi.on("message", async (event, context) => {
    // Auto-respond to greetings
    const text = event.message?.content?.[0]?.text?.toLowerCase();
    if (text?.includes("hello") || text?.includes("hi")) {
      pi.logger.info("Detected greeting, could auto-respond...");
    }
  });
  
  // 4. Custom editor widget (shows current time)
  pi.registerWidget({
    id: "hello-world-widget",
    position: "footer",
    render: () => {
      const time = new Date().toLocaleTimeString();
      return `⏰ ${time} | Hello World Extension Active`;
    },
    updateInterval: 1000 // Update every second
  });
  
  // 5. Add a custom slash command to editor
  pi.registerAutocomplete({
    prefix: "/hello",
    description: "Test the greeting extension",
    handler: (editor) => {
      editor.setValue("/hello World");
    }
  });
  
  pi.logger.info("Hello World Extension loaded successfully!");
}
