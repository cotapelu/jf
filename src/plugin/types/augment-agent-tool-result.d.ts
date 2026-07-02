import "@earendil-works/pi-agent-core";

declare module "@earendil-works/pi-agent-core" {
  interface AgentToolResult<T> {
    isError?: boolean;
  }
}

import "@earendil-works/pi-coding-agent";

declare module "@earendil-works/pi-coding-agent" {
  interface ExtensionContext {
    runtime?: any;
    session?: { sessionId: string };
  }
}
