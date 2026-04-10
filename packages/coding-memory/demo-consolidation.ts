/**
 * Demo: Consolidation (self-evolution)
 * Shows decay, merge, prune in action
 */

import { createSQLiteStore, createMemoryEngine, consolidate } from "./src/index.js";

async function demo() {
	console.log("=".repeat(60));
	console.log("CONSOLIDATION DEMO");
	console.log("=".repeat(60));

	// 1. Create memory engine with in-memory DB
	const store = createSQLiteStore(":memory:");
	const engine = createMemoryEngine(store);

	// 2. Populate with test data
	console.log("\n--- Populating memories ---\n");

	// Create duplicates
	engine.save({
		type: "note",
		content: "User prefers dark mode and 4-space indentation",
		tags: ["preference", "ui"],
		weight: 0.8,
	});
	engine.save({
		type: "note",
		content: "User prefers dark mode and 4-space indentation", // duplicate
		tags: ["preference"],
		weight: 0.6,
	});

	// Create various weighted items
	for (let i = 0; i < 20; i++) {
		engine.save({
			type: "code_symbol",
			content: `function test${i}() { return ${i}; }`,
			tags: ["test", "function"],
			weight: 0.3 + (i % 3) * 0.1,
		});
	}

	// Create some old memories (simulate old updated_at)
	// We'll manually update timestamps to be old
	console.log("Total after insert:", engine.stats().value.total);

	// 3. Run consolidation
	console.log("\n--- Running consolidation ---\n");
	const report = await consolidate(store, {
		decayAfterDays: 0, // decay immediately for demo
		decayRate: 0.1,
		mergeSimilarityThreshold: 0.8,
		maxMemories: 15,
		minHeatScore: 0.05,
	});

	console.log("Consolidation report:");
	console.log(JSON.stringify(report, null, 2));

	// 4. Show final stats
	console.log("\n--- Final stats ---\n");
	console.log(engine.stats().value);

	// 5. List remaining memories
	console.log("\n--- Remaining memories ---\n");
	const all = store.list({ limit: 20 });
	for (const mem of all) {
		console.log(`[${mem.type}] weight=${mem.weight.toFixed(2)} tags=${mem.tags.join(",")}`);
		console.log(`  ${mem.content.substring(0, 60)}...`);
	}
}

// Run
demo().catch(console.error);
