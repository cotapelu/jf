import {
    // Types (ALL)
    type AgentSessionRuntime,
    type AgentSessionRuntimeDiagnostic,
    type AgentSessionServices,
    type CreateAgentSessionOptions,
    type CreateAgentSessionResult,
    type CreateAgentSessionRuntimeFactory,
    type CreateAgentSessionRuntimeResult,
    type CreateAgentSessionServicesOptions,
    type CreateAgentSessionFromServicesOptions,
    type PromptTemplate,
    // Functions (ALL)
    createAgentSession,
    createAgentSessionFromServices,
    createAgentSessionRuntime,
    createAgentSessionServices,
    createBashTool,
    createCodingTools,
    createEditTool,
    createFindTool,
    createGrepTool,
    createLsTool,
    createReadOnlyTools,
    createReadTool,
    createWriteTool,
    // Core
    getAgentDir,
    InteractiveMode,
    SessionManager,
    type InteractiveModeOptions,
    type ModelInfo,
} from "@earendil-works/pi-coding-agent";

import { registerAllTools } from "./tools/index.js";
import { setCurrentRuntime } from "./runtime-context.js";
import { ParentChildSessionManager } from "./parent-child-session-manager.js";

// 1️⃣ PromptTemplate usage
const myCustomPrompt: PromptTemplate = {
    name: "my_custom_assistant",
    description: "Custom assistant prompt for Pi SDK demo",
    filePath: process.argv[1] ?? "<inline:custom>",
    sourceInfo: {
        path: process.argv[1] ?? "<inline:custom>",
        source: "temporary",
        scope: "temporary",
        origin: "top-level",
    },
    content: `You are an AI coding assistant specialized in TypeScript and Node.js. Be concise, accurate, and provide code examples when helpful. Always explain your reasoning before providing solutions.`,
};

// 2️⃣ Factory tạo runtime với tất cả factories
const createRuntime: CreateAgentSessionRuntimeFactory = async ({
    cwd,
    agentDir,
    sessionManager,
    sessionStartEvent,
    projectTrustContext,
}): Promise<CreateAgentSessionRuntimeResult> => {
    // Services với PromptTemplate override
    const servicesOptions: CreateAgentSessionServicesOptions = {
        cwd,
        agentDir,
        resourceLoaderOptions: {
            promptsOverride: () => ({
                prompts: [myCustomPrompt],
                diagnostics: [],
            }),
        },
    };

    const services: AgentSessionServices =
        await createAgentSessionServices(servicesOptions);
    const diagnostics: AgentSessionRuntimeDiagnostic[] = services.diagnostics;

    // Session options
    const sessionOptions: CreateAgentSessionFromServicesOptions = {
        services,
        sessionManager,
        sessionStartEvent,
        tools: [],
        customTools: registerAllTools(cwd),
    };

    // Create session với explicit typing
    const result: CreateAgentSessionResult =
        await createAgentSessionFromServices(sessionOptions);

    // Return full runtime result
    const runtimeResult: CreateAgentSessionRuntimeResult = {
        session: result.session,
        extensionsResult: result.extensionsResult,
        services,
        diagnostics,
        modelFallbackMessage: result.modelFallbackMessage,
    };

    // Log diagnostics
    diagnostics.forEach((diag: AgentSessionRuntimeDiagnostic) => {
        if (diag.type === "warning")
            console.warn(`[Diagnostic] ${diag.message}`);
        if (diag.type === "error")
            console.error(`[Diagnostic] ${diag.message}`);
    });

    return runtimeResult;
};

export async function main() {
    console.log("🚀 Pi SDK - FULL EXPORTS USAGE\n");

    // ====== DEMO 1: Standalone createAgentSession (simple) ======
    console.log("📦 Demo 1: createAgentSession (standalone)");
    const demoOptions: CreateAgentSessionOptions = {
        sessionManager: SessionManager.inMemory(),
        tools: ["read", "bash"],
    };
    const standaloneResult: CreateAgentSessionResult =
        await createAgentSession(demoOptions);
    console.log(` Session created: ${standaloneResult.session.sessionFile}`);
    standaloneResult.session.dispose();
    console.log();

    // ====== DEMO 2: Runtime quản lý nhiều session ======
    console.log("📦 Demo 2: createAgentSessionRuntime (multi-session parent)");
    const sessionManager: SessionManager = SessionManager.create(
        process.cwd(),
    );
    const runtime: AgentSessionRuntime = await createAgentSessionRuntime(
        createRuntime,
        {
            cwd: process.cwd(),
            agentDir: getAgentDir(),
            sessionManager,
        },
    );
    // Set global runtime context for session_manager tool
    setCurrentRuntime(runtime);
    console.log(` Parent session: ${runtime.session.sessionFile}`);
    console.log();

    // ====== DEMO 3: Parent-Child Session Tool (LLM có thể gọi) ======
    console.log(
        "📦 Demo 3: Using session_manager tool directly (as LLM would)",
    );

    // Demo: gọi tool trực tiếp (mô phỏng LLM gọi)
    const { registerSessionManagerTool } = await import("./tools/index.js");
    const sessionTool: any = registerSessionManagerTool()[0];

    // Trạng thái ban đầu
    console.log("\n1. Getting initial status...");
    const status1 = await sessionTool.execute("status_1", { action: "get_status" });
    console.log("   ", status1.content[0].text);

    // Tạo child
    console.log("\n2. Creating child session...");
    const createResult = await sessionTool.execute("create_1", { action: "create_child" });
    console.log("   ", createResult.content[0].text);
    const status2 = await sessionTool.execute("status_2", { action: "get_status" });
    console.log("   ", status2.content[0].text);

    // Tạo child mới (replace)
    console.log("\n3. Creating another child (replaces previous)...");
    await sessionTool.execute("create_2", { action: "create_child" });
    const status3 = await sessionTool.execute("status_3", { action: "get_status" });
    console.log("   ", status3.content[0].text);

    // Switch parent
    console.log("\n4. Switching to parent...");
    await sessionTool.execute("switch_parent", { action: "switch_to_parent" });
    const status4 = await sessionTool.execute("status_4", { action: "get_status" });
    console.log("   ", status4.content[0].text);

    // Switch child
    console.log("\n5. Switching to child...");
    await sessionTool.execute("switch_child", { action: "switch_to_child" });
    const status5 = await sessionTool.execute("status_5", { action: "get_status" });
    console.log("   ", status5.content[0].text);

    // Dispose
    console.log("\n6. Disposing...");
    await sessionTool.execute("dispose", { action: "dispose" });

    console.log();

    // ====== DEMO 4: InteractiveMode ======
    console.log("📦 Demo 4: InteractiveMode");

    // InteractiveModeOptions demo
    const modeOptions: InteractiveModeOptions = {
        initialMessages: ["Hello! I'm running with full Pi SDK exports."],
        verbose: true,
    };

    // ModelInfo demo
    const demoModel: ModelInfo = {
        provider: "anthropic",
        id: "claude-sonnet-4-20250514",
        contextWindow: 200000,
        reasoning: true,
    };

    console.log(" ModelInfo demo:", JSON.stringify(demoModel));
    console.log(" InteractiveModeOptions:", JSON.stringify(modeOptions));

    console.log(" All exports used:");
    console.log(
        " Types: ALL types (9) - AgentSessionRuntime, AgentSessionRuntimeDiagnostic,",
    );
    console.log(
        " AgentSessionServices, CreateAgentSessionFromServicesOptions,",
    );
    console.log(
        " CreateAgentSessionOptions, CreateAgentSessionResult,",
    );
    console.log(
        " CreateAgentSessionRuntimeFactory, CreateAgentSessionRuntimeResult,",
    );
    console.log(
        " CreateAgentSessionServicesOptions, PromptTemplate",
    );
    console.log(
        " Functions: ALL functions (13) - createAgentSession, createAgentSessionFromServices,",
    );
    console.log(
        " createAgentSessionRuntime, createAgentSessionServices,",
    );
    console.log(
        " createBashTool, createCodingTools, createEditTool, createFindTool,",
    );
    console.log(
        " createGrepTool, createLsTool, createReadOnlyTools, createReadTool, createWriteTool",
    );
    console.log(" Core: ALL (3) - getAgentDir, InteractiveMode, SessionManager");
    console.log();
    console.log("🖥️ Launching InteractiveMode...\n");
    const mode = new InteractiveMode(runtime, modeOptions);
    await mode.run();
}

main().catch((err: unknown) => {
    console.error("💥 Fatal error:", err);
    process.exit(1);
});
