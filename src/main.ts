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
// New session tool replaces ParentChildSessionManager
// import { ParentChildSessionManager } from "./parent-child-session-manager.js";

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

    // ====== DEMO 3: Advanced Session Tool (LLM có thể gọi) ======
    console.log(
        "📦 Demo 3: Using session tool with all operations (as LLM would)",
    );

    // Demo: gọi tool trực tiếp với API mới
    const { registerSessionTool } = await import("./tools/index.js");
    const sessionTool: any = registerSessionTool()[0];

    // 1. Status ban đầu
    console.log("\n1. Getting initial status...");
    const status1 = await sessionTool.execute("status_1", { operation: "status" });
    console.log("   ", status1.content[0].text);

    // 2. Tạo child với name và tags
    console.log("\n2. Creating named child session...");
    const create1 = await sessionTool.execute("create_1", {
        operation: "create",
        name: "debug-session",
        tags: ["debug", "issue-123"],
    });
    console.log("   ", create1.content[0].text);
    const status2 = await sessionTool.execute("status_2", { operation: "status" });
    console.log("   ", status2.content[0].text);

    // 3. Tạo child thứ 2
    console.log("\n3. Creating another child (feature work)...");
    const create2 = await sessionTool.execute("create_2", {
        operation: "create",
        name: "feature-auth",
        tags: ["feature", "auth"],
    });
    console.log("   ", create2.content[0].text);

    // 4. List all sessions
    console.log("\n4. Listing all sessions (sorted by created)...");
    const list = await sessionTool.execute("list_1", { operation: "list" });
    console.log("   ", list.content[0].text);

    // 5. Get info on specific session
    console.log("\n5. Getting info on first child...");
    const firstChildId = create1.details.sessionId;
    const info = await sessionTool.execute("info_1", {
        operation: "info",
        sessionId: firstChildId,
    });
    console.log("   ", info.content[0].text);

    // 6. Switch to a specific session
    console.log("\n6. Switching to first child by ID...");
    const switch1 = await sessionTool.execute("switch_1", {
        operation: "switch",
        sessionId: firstChildId,
    });
    console.log("   ", switch1.content[0].text);

    // 7. Switch to parent
    console.log("\n7. Switching back to parent...");
    const switchParent = await sessionTool.execute("switch_parent", {
        operation: "switch",
        sessionId: "parent",
    });
    console.log("   ", switchParent.content[0].text);

    // 8. Show session tree
    console.log("\n8. Showing session tree...");
    const tree = await sessionTool.execute("tree_1", { operation: "tree" });
    console.log("   ", tree.content[0].text);

    // 9. Add tags to a session
    console.log("\n9. Adding priority:high tag to feature-auth...");
    const tag = await sessionTool.execute("tag_1", {
        operation: "tag",
        sessionId: create2.details.sessionId,
        tagAction: "add",
        tags: ["priority:high"],
    });
    console.log("   ", tag.content[0].text);

    // 10. View history
    console.log("\n10. Viewing operation history...");
    const history = await sessionTool.execute("history_1", { operation: "history", limit: 10 });
    console.log("   ", history.content[0].text);

    // 11. Diagnostics
    console.log("\n11. Running diagnostics...");
    const diag = await sessionTool.execute("diag_1", { operation: "diagnostics" });
    console.log("   ", diag.content[0].text);

    // 12. Get detailed diagnostics object
    console.log("\n12. Diagnostics details:", JSON.stringify(diag.details, null, 2));

    // 13. Rename a session
    console.log("\n13. Renaming feature-auth to feature-auth-v2...");
    await sessionTool.execute("rename_1", {
        operation: "rename",
        sessionId: create2.details.sessionId,
        name: "feature-auth-v2",
    });

    // 14. List again to see changes
    console.log("\n14. Listing sessions after rename...");
    const list2 = await sessionTool.execute("list_2", { operation: "list" });
    console.log("   ", list2.content[0].text);

    console.log("\n✅ Demo 3 complete!");

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
