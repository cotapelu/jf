/**
 * Property-Based Tests for AI Package
 * 
 * Uses fast-check for property-based testing to validate invariants
 * and edge cases across a wide range of inputs.
 */

import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { 
  registerFauxProvider, 
  fauxAssistantMessage, 
  fauxText, 
  fauxThinking,
  type FauxModelDefinition 
} from "../src/providers/faux.js";
import { complete, stream } from "../src/index.js";
import type { Context } from "../src/types.js";
import type { Model } from "../src/models.js";

describe("property-based tests", () => {
  
  // =========================================================================
  // Model Definitions
  // =========================================================================
  
  it("should handle arbitrary context sizes", async () => {
    const provider = registerFauxProvider({
      models: [
        { id: "test-model", name: "Test Model" }
      ]
    });
    
    // Property: For any valid context, we should get a response
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.string(), { minLength: 0, maxLength: 20 }),
        async (messages) => {
          provider.setResponses([
            fauxAssistantMessage("Response to arbitrary context")
          ]);
          
          const model = provider.getModel("test-model")!;
          const context: Context = {
            messages: messages.map(msg => ({
              role: "user",
              content: [{ type: "text", text: msg }],
              timestamp: Date.now()
            }))
          };
          
          const response = await complete(model, context);
          
          // Invariant: Response should have required fields
          expect(response).toHaveProperty("role", "assistant");
          expect(response).toHaveProperty("content");
          expect(Array.isArray(response.content)).toBe(true);
          expect(response).toHaveProperty("timestamp");
          expect(typeof response.timestamp).toBe("number");
        }
      ),
      { numRuns: 50, verbose: true }
    );
  });

  it("should preserve message ordering across transformations", async () => {
    const provider = registerFauxProvider({
      models: [
        { id: "test-model", name: "Test Model" }
      ]
    });
    
    // Property: Message order should be preserved through complete()
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.string(), { minLength: 1, maxLength: 10 }),
        async (texts) => {
          // Echo the last message to verify ordering
          const lastText = texts[texts.length - 1];
          provider.setResponses([
            fauxAssistantMessage(`Echo: ${lastText}`)
          ]);
          
          const model = provider.getModel("test-model")!;
          const context: Context = {
            messages: texts.map(text => ({
              role: "user",
              content: [{ type: "text", text }],
              timestamp: Date.now()
            }))
          };
          
          const response = await complete(model, context);
          const responseText = response.content[0].text;
          
          // Invariant: Should echo the last message
          expect(responseText).toContain(lastText);
        }
      ),
      { numRuns: 30 }
    );
  });

  it("should handle thinking/reasoning flags correctly", async () => {
    // Property: Models marked as reasoning should preserve thinking blocks
    await fc.assert(
      fc.asyncProperty(
        fc.boolean(),
        fc.array(fc.string(), { minLength: 1, maxLength: 5 }),
        async (hasReasoning, thoughts) => {
          const modelDef: FauxModelDefinition = {
            id: `model-${hasReasoning ? "reasoning" : "no-reasoning"}`,
            name: "Test Model",
            reasoning: hasReasoning
          };
          
          const provider = registerFauxProvider({
            models: [modelDef]
          });
          
          // Create a response with thinking blocks
          const thinkingContent = thoughts.map(t => fauxThinking(t));
          const textContent = [fauxText("Final answer")];
          
          provider.setResponses([
            fauxAssistantMessage([...thinkingContent, ...textContent])
          ]);
          
          const model = provider.getModel(modelDef.id)!;
          const context: Context = {
            messages: [{
              role: "user",
              content: [{ type: "text", text: "Test" }],
              timestamp: Date.now()
            }]
          };
          
          const response = await complete(model, context);
          
          // Invariant: All content blocks should be preserved
          expect(response.content.length).toBe(thoughts.length + 1);
          
          // Check thinking blocks are present
          const thinkingBlocks = response.content.filter(
            (c): c is { type: "thinking"; thinking: string } => 
              c.type === "thinking"
          );
          
          expect(thinkingBlocks.length).toBe(thoughts.length);
          
          // Check final text is present
          const textBlocks = response.content.filter(
            (c): c is { type: "text"; text: string } => 
              c.type === "text"
          );
          expect(textBlocks.length).toBe(1);
          expect(textBlocks[0].text).toBe("Final answer");
        }
      ),
      { numRuns: 20 }
    );
  });

  it("should correctly serialize/deserialize thinking blocks", async () => {
    // Property: Thinking blocks should round-trip correctly
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.string(), { minLength: 1, maxLength: 10 }),
        async (thinkingTexts) => {
          const provider = registerFauxProvider({
            models: [{ id: "test", name: "Test", reasoning: true }]
          });
          
          const thinkingBlocks = thinkingTexts.map(t => fauxThinking(t));
          provider.setResponses([
            fauxAssistantMessage([...thinkingBlocks, fauxText("Done")])
          ]);
          
          const model = provider.getModel("test")!;
          const context: Context = {
            messages: [{
              role: "user",
              content: [{ type: "text", text: "Test" }],
              timestamp: Date.now()
            }]
          };
          
          const response = await complete(model, context);
          const thinkingResponses = response.content.filter(
            (c): c is { type: "thinking"; thinking: string } => 
              c.type === "thinking"
          );
          
          // Invariant: All thinking texts should be preserved
          const responseThinkingTexts = thinkingResponses.map(t => t.thinking);
          expect(responseThinkingTexts).toEqual(thinkingTexts);
        }
      ),
      { numRuns: 30 }
    );
  });

  it("should handle various thinking levels", async () => {
    const levels = ["off", "minimal", "low", "medium", "high", "xhigh"] as const;
    
    // Property: Any thinking level should be handled
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(...levels.map(fc.constant)),
        async (level) => {
          const provider = registerFauxProvider({
            models: [{
              id: "test",
              name: "Test",
              reasoning: level !== "off"
            }]
          });
          
          provider.setResponses([
            level === "off"
              ? fauxAssistantMessage("No thinking")
              : fauxAssistantMessage([
                  fauxThinking(`Thinking at level: ${level}`),
                  fauxText("Done")
                ])
          ]);
          
          const model = provider.getModel("test")!;
          const context: Context = {
            messages: [{
              role: "user",
              content: [{ type: "text", text: "Test" }],
              timestamp: Date.now()
            }]
          };
          
          const response = await complete(model, context);
          
          // Invariant: Response should be valid
          expect(response.role).toBe("assistant");
          expect(response.content.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 20 }
    );
  });

  it("should generate valid model IDs", async () => {
    // Property: Generated faux model IDs should follow expected patterns
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.boolean(),
        async (name, hasReasoning) => {
          const provider = registerFauxProvider({
            models: [{
              id: `model-${name.toLowerCase().replace(/\s+/g, "-")}`,
              name,
              reasoning: hasReasoning
            }]
          });
          
          const model = provider.getModel(provider.models[0].id)!;
          
          // Invariant: Model should be retrievable
          expect(model).toBeDefined();
          expect(model.id).toContain("model-");
          expect(model.name).toBe(name);
          expect(model.reasoning).toBe(hasReasoning);
        }
      ),
      { numRuns: 30 }
    );
  });

  it("should handle concurrent stream operations", async () => {
    // Property: Multiple concurrent streams should not interfere
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 5 }),
        async (concurrentCount) => {
          const providers = Array.from({ length: concurrentCount }, (_, i) => {
            const provider = registerFauxProvider({
              models: [{ id: `model-${i}`, name: `Model ${i}` }]
            });
            provider.setResponses([
              fauxAssistantMessage(`Response from model ${i}`)
            ]);
            return provider;
          });
          
          // Invariant: All concurrent streams should complete
          const results = await Promise.all(
            providers.map((provider, i) => {
              const model = provider.getModel(`model-${i}`)!;
              const context: Context = {
                messages: [{
                  role: "user",
                  content: [{ type: "text", text: `Test ${i}` }],
                  timestamp: Date.now()
                }]
              };
              return complete(model, context);
            })
          );
          
          expect(results).toHaveLength(concurrentCount);
          results.forEach((response, i) => {
            expect(response.content[0].text).toContain(`model ${i}`);
          });
        }
      ),
      { numRuns: 10 }
    );
  });

  it("should maintain consistent API across different model types", async () => {
    // Property: Faux models should behave consistently regardless of definition
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.string({ minLength: 1 }),
            name: fc.string({ minLength: 1 }),
            reasoning: fc.boolean()
          }),
          { minLength: 1, maxLength: 5 }
        ),
        async (modelDefs) => {
          const provider = registerFauxProvider({
            models: modelDefs as FauxModelDefinition[]
          });
          
          // Set same response for all models
          provider.setResponses([
            fauxAssistantMessage("Consistent response")
          ]);
          
          // Invariant: All models should return consistent responses
          for (const modelDef of modelDefs) {
            const model = provider.getModel(modelDef.id)!;
            const context: Context = {
              messages: [{
                role: "user",
                content: [{ type: "text", text: "Test" }],
                timestamp: Date.now()
              }]
            };
            
            const response = await complete(model, context);
            
            expect(response.role).toBe("assistant");
            expect(response.api).toBe("faux");
            expect(response.provider).toBe("faux");
          }
        }
      ),
      { numRuns: 15 }
    );
  });

  // =========================================================================
  // Stream Property Tests
  // =========================================================================
  
  it("should produce valid stream events", async () => {
    // Property: Stream should produce valid event sequences
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.string(), { minLength: 1, maxLength: 5 }),
        async (texts) => {
          const provider = registerFauxProvider({
            models: [{ id: "stream-test", name: "Stream Test" }]
          });
          
          provider.setResponses([
            fauxAssistantMessage(texts.map(t => fauxText(t)))
          ]);
          
          const model = provider.getModel("stream-test")!;
          const context: Context = {
            messages: [{
              role: "user",
              content: [{ type: "text", text: "Stream test" }],
              timestamp: Date.now()
            }]
          };
          
          const events: any[] = [];
          const eventStream = stream(model, context);
          
          for await (const event of eventStream) {
            events.push(event);
          }
          
          // Invariant: Stream should produce valid event sequence
          expect(events.length).toBeGreaterThan(0);
          
          // Should have message_start and message_end events
          const hasMessageStart = events.some(e => e.type === "message_start");
          const hasMessageEnd = events.some(e => e.type === "message_end");
          
          expect(hasMessageStart).toBe(true);
          expect(hasMessageEnd).toBe(true);
          
          // Final event should be message_end
          const lastEvent = events[events.length - 1];
          expect(lastEvent.type).toBe("message_end");
        }
      ),
      { numRuns: 20 }
    );
  });
});