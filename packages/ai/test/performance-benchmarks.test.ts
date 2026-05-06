
/**
 * Performance Benchmark Tests
 * 
 * These tests validate the performance characteristics of the AI package
 * under various loads and scenarios. They are designed to catch performance
 * regressions and ensure the system meets its performance targets.
 */

import { describe, expect, it, beforeEach } from "vitest";
import { getModel, complete, stream } from "../src/index.js";
import { registerFauxProvider, type FauxProviderRegistration } from "../src/index.js";
import type { Context } from "../src/types.js";

describe("Performance Benchmarks", () => {
  let registration: FauxProviderRegistration;

  beforeEach(() => {
    registration = registerFauxProvider({ tokensPerSecond: 1000 });
  });

  afterEach(() => {
    registration.unregister();
  });

  it("should process high-volume token streaming within time limits", async () => {
    // Generate a large response (simulating 1000 tokens)
    const largeText = "test ".repeat(200); // ~1000 tokens worth of text
    
    registration.setResponses([
      {
        ...registration.fauxAssistantMessage(largeText),
        usage: {
          input: 100,
          output: 1000,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 1100,
          cost: { input: 0.001, output: 0.002, cacheRead: 0, cacheWrite: 0, total: 0.003 }
        }
      }
    ]);

    const model = registration.getModel();
    const context: Context = {
      messages: [{ role: "user", content: "Generate a large response", timestamp: Date.now() }]
    };

    const startTime = Date.now();
    const response = await complete(model, context);
    const duration = Date.now() - startTime;

    // Should complete within reasonable time (under 2 seconds for 1000 tokens at 1000 tps)
    expect(duration).toBeLessThan(2000);
    expect(response.content[0].type).toBe("text");
    expect(response.usage.output).toBe(1000);
  });

  it("should handle concurrent requests efficiently", async () => {
    registration.setResponses([
      registration.fauxAssistantMessage("response1"),
      registration.fauxAssistantMessage("response2"),
      registration.fauxAssistantMessage("response3"),
    ]);

    const model = registration.getModel();
    const baseContext: Context = {
      messages: [{ role: "user", content: "test", timestamp: Date.now() }]
    };

    const startTime = Date.now();
    
    // Fire 3 concurrent requests
    const promises = [
      complete(model, { ...baseContext, messages: [...baseContext.messages] }),
      complete(model, { ...baseContext, messages: [...baseContext.messages] }),
      complete(model, { ...baseContext, messages: [...baseContext.messages] }),
    ];

    const results = await Promise.all(promises);
    const duration = Date.now() - startTime;

    // All should complete successfully
    expect(results).toHaveLength(3);
    results.forEach((result, i) => {
      expect(result.content[0].text).toContain(`response${i + 1}`);
    });

    // Should be faster than sequential processing
    // (Note: This is a loose check since faux provider is synchronous)
    expect(duration).toBeLessThan(1000);
  });

  it("should maintain performance with large context windows", async () => {
    // Create a context with many messages (simulating long conversation)
    const messages = [];
    for (let i = 0; i < 50; i++) {
      messages.push(
        { role: "user" as const, content: `Question ${i}`, timestamp: Date.now() + i },
        { role: "assistant" as const, content: [{ type: "text", text: `Answer ${i}` }], timestamp: Date.now() + i + 1 }
      );
    }
    messages.push({ role: "user" as const, content: "Final question", timestamp: Date.now() + 100 });

    registration.setResponses([registration.fauxAssistantMessage("Final answer")]);

    const model = registration.getModel();
    const context: Context = {
      systemPrompt: "You are a helpful assistant.",
      messages: messages
    };

    const startTime = Date.now();
    const response = await complete(model, context);
    const duration = Date.now() - startTime;

    // Should handle large context efficiently
    expect(duration).toBeLessThan(1000);
    expect(response.content[0].text).toBe("Final answer");
  });

  it("should stream tokens at consistent rate", async () => {
    const tokenCount = 100;
    const tokensPerSecond = 50;
    const expectedMinDuration = (tokenCount / tokensPerSecond) * 1000;

    const registration = registerFauxProvider({ 
      tokensPerSecond: tokensPerSecond,
      tokenSize: { min: 1, max: 1 }
    });

    const largeText = "x".repeat(tokenCount);
    registration.setResponses([
      registration.fauxAssistantMessage(largeText)
    ]);

    const model = registration.getModel();
    const context: Context = {
      messages: [{ role: "user", content: "test", timestamp: Date.now() }]
    };

    const startTime = Date.now();
    let chunkCount = 0;
    let totalTextLength = 0;

    const s = stream(model, context);
    for await (const event of s) {
      if (event.type === "text_delta") {
        chunkCount++;
        totalTextLength += event.delta.length;
      }
    }

    const duration = Date.now() - startTime;

    // Should take approximately the expected time (with some tolerance)
    expect(duration).toBeGreaterThanOrEqual(expectedMinDuration * 0.8);
    expect(duration).toBeLessThan(expectedMinDuration * 2);
    expect(totalTextLength).toBe(tokenCount);
    expect(chunkCount).toBeGreaterThan(0);

    registration.unregister();
  });

  it("should handle rapid sequential requests without degradation", async () => {
    const requestCount = 10;
    
    // Set up multiple responses
    const responses = [];
    for (let i = 0; i < requestCount; i++) {
      responses.push(registration.fauxAssistantMessage(`response${i}`));
    }
    registration.setResponses(responses);

    const model = registration.getModel();
    const baseContext: Context = {
      messages: [{ role: "user", content: "test", timestamp: Date.now() }]
    };

    const startTime = Date.now();
    
    // Make sequential requests
    for (let i = 0; i < requestCount; i++) {
      const context: Context = {
        messages: [{ role: "user", content: `test${i}`, timestamp: Date.now() + i }]
      };
      const response = await complete(model, context);
      expect(response.content[0].text).toBe(`response${i}`);
    }

    const duration = Date.now() - startTime;

    // All requests should complete quickly
    expect(duration).toBeLessThan(2000);
  });
});

/**
 * Load Testing Scenarios
 * 
 * These tests simulate high-load scenarios to ensure the system
 * remains stable under stress.
 */

describe("Load Testing", () => {
  it("should handle burst of requests with faux provider", async () => {
    const registration = registerFauxProvider({ tokensPerSecond: 500 });
    
    const burstSize = 20;
    const responses = [];
    for (let i = 0; i < burstSize; i++) {
      responses.push(registration.fauxAssistantMessage(`burst-response-${i}`));
    }
    registration.setResponses(responses);

    const model = registration.getModel();
    
    const startTime = Date.now();
    const results = await Promise.all(
      Array.from({ length: burstSize }, (_, i) =>
        complete(model, {
          messages: [{ role: "user", content: `request-${i}`, timestamp: Date.now() }]
        })
      )
    );
    const duration = Date.now() - startTime;

    expect(results).toHaveLength(burstSize);
    results.forEach((result, i) => {
      expect(result.content[0].text).toBe(`burst-response-${i}`);
    });
    
    // Should complete within reasonable time
    expect(duration).toBeLessThan(5000);

    registration.unregister();
  }, 10000);

  it("should maintain consistent performance across multiple provider types", async () => {
    // Test that different model configurations perform consistently
    const models = [
      registerFauxProvider({ tokensPerSecond: 100 }),
      registerFauxProvider({ tokensPerSecond: 500 }),
      registerFauxProvider({ tokensPerSecond: 1000 }),
    ];

    models.forEach(reg => {
      reg.setResponses([reg.fauxAssistantMessage("test")]);
    });

    const contexts: Context[] = models.map(() => ({
      messages: [{ role: "user", content: "test", timestamp: Date.now() }]
    }));

    const startTime = Date.now();
    const results = await Promise.all(
      models.map((reg, i) => complete(reg.getModel(), contexts[i]))
    );
    const duration = Date.now() - startTime;

    expect(results).toHaveLength(3);
    results.forEach(result => {
      expect(result.content[0].text).toBe("test");
    });
    
    // Should complete reasonably fast even with slowest provider
    expect(duration).toBeLessThan(2000);

    models.forEach(reg => reg.unregister());
  });
});
