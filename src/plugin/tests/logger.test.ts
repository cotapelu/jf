import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createLogger } from "../extensions/utils/logger";

describe("Logger", () => {
  let consoleLogSpy: any;
  let consoleErrorSpy: any;
  let consoleWarnSpy: any;
  let consoleInfoSpy: any;
  let consoleDebugSpy: any;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    consoleDebugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates logger with all methods", () => {
    const logger = createLogger();
    expect(typeof logger.log).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.debug).toBe("function");
  });

  it("log without prefix", () => {
    const logger = createLogger();
    logger.log("hello", "world");
    expect(consoleLogSpy).toHaveBeenCalledWith("hello", "world");
  });

  it("log with prefix", () => {
    const logger = createLogger("MyTag");
    logger.log("message");
    expect(consoleLogSpy).toHaveBeenCalledWith("[MyTag]", "message");
  });

  it("error without prefix", () => {
    const logger = createLogger();
    logger.error("oops");
    expect(consoleErrorSpy).toHaveBeenCalledWith("oops");
  });

  it("error with prefix", () => {
    const logger = createLogger("ERR");
    logger.error("fail");
    expect(consoleErrorSpy).toHaveBeenCalledWith("[ERR]", "fail");
  });

  it("warn without prefix", () => {
    const logger = createLogger();
    logger.warn("warning");
    expect(consoleWarnSpy).toHaveBeenCalledWith("warning");
  });

  it("warn with prefix", () => {
    const logger = createLogger("WARN");
    logger.warn("caution");
    expect(consoleWarnSpy).toHaveBeenCalledWith("[WARN]", "caution");
  });

  it("info without prefix", () => {
    const logger = createLogger();
    logger.info("info");
    expect(consoleInfoSpy).toHaveBeenCalledWith("info");
  });

  it("info with prefix", () => {
    const logger = createLogger("INFO");
    logger.info("details");
    expect(consoleInfoSpy).toHaveBeenCalledWith("[INFO]", "details");
  });

  it("debug without prefix", () => {
    const logger = createLogger();
    logger.debug("debug");
    expect(consoleDebugSpy).toHaveBeenCalledWith("debug");
  });

  it("debug with prefix", () => {
    const logger = createLogger("DEBG");
    logger.debug("data");
    expect(consoleDebugSpy).toHaveBeenCalledWith("[DEBG]", "data");
  });
});
