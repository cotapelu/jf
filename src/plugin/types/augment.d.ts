import type { AgentToolResult } from "@earendil-works/pi-coding-agent";

declare module "@earendil-works/pi-coding-agent" {
  interface AgentToolResult<T = unknown> {
    isError?: boolean;
  }
}
