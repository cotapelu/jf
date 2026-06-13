// Simple test script for ParentChildSessionManager
// Run with: npx tsx test-parent-child.js

import { createAgentSessionRuntime, SessionManager, getAgentDir, createAgentSession, createAgentSessionServices } from "@earendil-works/pi-coding-agent";
import { registerAllTools } from "./src/tools/index.js";
import { ParentChildSessionManager } from "./src/parent-child-session-manager.js";

// Factory tương tự main.ts
const createRuntime = async ({ cwd, agentDir, sessionManager }) => {
    const services = await createAgentSessionServices({ cwd, agentDir });
    const sessionResult = await createAgentSession({
        cwd,
        agentDir,
        sessionManager,
        customTools: registerAllTools(cwd),
    });
    return {
        session: sessionResult.session,
        services,
        diagnostics: services.diagnostics,
        modelFallbackMessage: sessionResult.modelFallbackMessage,
    };
};

async function test() {
    console.log("🧪 Testing ParentChildSessionManager\n");

    const sessionManager = SessionManager.create(process.cwd());
    const runtime = await createAgentSessionRuntime(createRuntime, {
        cwd: process.cwd(),
        agentDir: getAgentDir(),
        sessionManager,
    });

    const manager = new ParentChildSessionManager(runtime);

    console.log("1. Initial state:");
    console.log("   Parent session:", manager.parentSession.sessionFile);
    console.log("   Active:", manager.isParentActive ? "parent" : "child");

    console.log("\n2. Creating child session...");
    await manager.createChildSession();
    console.log("   Child session:", manager.childSession?.sessionFile);
    console.log("   Active:", manager.isParentActive ? "parent" : "child");
    console.log("   Runtime.session === child:", manager.session.sessionFile === manager.childSession?.sessionFile);

    console.log("\n3. Switching to parent...");
    await manager.switchToParent();
    console.log("   Active:", manager.isParentActive ? "parent" : "child");
    console.log("   Runtime.session === parent:", manager.session.sessionFile === manager.parentSession.sessionFile);

    console.log("\n4. Switching back to child...");
    await manager.switchToChild();
    console.log("   Active:", manager.isParentActive ? "parent" : "child");
    console.log("   Runtime.session === child:", manager.session.sessionFile === manager.childSession?.sessionFile);

    console.log("\n5. Disposing...");
    await manager.dispose();
    try {
        manager.parentSession;
        console.log("   ❌ Expected error accessing parent after dispose");
    } catch (e) {
        console.log("   ✅ Expected error after dispose:", e.message);
    }

    console.log("\n✅ All checks passed!");
}

test().catch(console.error);
