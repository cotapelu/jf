#!/usr/bin/env node

/**
 * HTTP Sub-Tool
 * Web requests with structured API (cleaner than raw curl)
 */

import { Type } from "typebox";
import * as fs from "fs/promises";
import { tmpdir } from "os";

export const httpSchema = Type.Object({
  method: Type.Optional(Type.String({ description: "GET, POST, PUT, DELETE, PATCH (default: GET)" })),
  url: Type.String({ description: "URL to request" }),
  headers: Type.Optional(Type.Record(Type.String(), Type.String())),
  body: Type.Optional(Type.Any({ description: "Request body (will be JSON stringified if object)" })),
  timeout: Type.Optional(Type.Number({ description: "Timeout in seconds (default: 30)" })),
  insecure: Type.Optional(Type.Boolean()),
  user: Type.Optional(Type.String()),
  verbose: Type.Optional(Type.Boolean()),
});

export async function executeHttp(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const {
    method = "GET",
    url,
    headers = {},
    body,
    timeout = 30,
    insecure = false,
    user,
    verbose = false,
  } = args as {
    method?: string;
    url: string;
    headers?: Record<string, string>;
    body?: any;
    timeout?: number;
    insecure?: boolean;
    user?: string;
    verbose?: boolean;
  };

  try {
    const curlArgs: string[] = [];

    if (method !== "GET") curlArgs.push("-X", method);

    for (const [key, value] of Object.entries(headers)) {
      curlArgs.push("-H", `${key}: ${value}`);
    }

    let tempFilePath: string | null = null;
    if (body && ["POST", "PUT", "PATCH"].includes(method)) {
      const bodyStr = typeof body === "string" ? body : JSON.stringify(body);
      // Create a temporary file
      tempFilePath = `${tmpdir()}/curl-data-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`;
      await fs.writeFile(tempFilePath, bodyStr, "utf8");
      curlArgs.push("--data", `@${tempFilePath}`);
    }

    curlArgs.push("--max-time", String(timeout));

    if (insecure) curlArgs.push("-k");
    if (user) curlArgs.push("-u", user);
    if (verbose) curlArgs.push("-v");

    curlArgs.push(url);

    const result = await ctx!.exec("curl", curlArgs, { cwd, signal });

    // Cleanup temp file if created
    if (tempFilePath) {
      try { await fs.unlink(tempFilePath); } catch (e) {}
    }

    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed, url, method },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `HTTP error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}
