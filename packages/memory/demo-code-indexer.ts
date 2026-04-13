/**
 * Demo: Code Indexer + Memory Integration
 * Shows how codebase gets automatically indexed into memory
 */

import { createSQLiteStore, createMemoryEngine, createCodeIndexer } from "./src/index.js";

async function demo() {
	console.log("=".repeat(60));
	console.log("CODE INDEXER DEMO");
	console.log("=".repeat(60));

	// 1. Create memory engine
	const store = createSQLiteStore(":memory:");
	const engine = createMemoryEngine(store);

	// 2. Create code indexer
	const indexer = createCodeIndexer(engine, {
		watchPaths: ["./test-files"], // Test directory with sample code
		extensions: [".ts", ".js", ".py"],
		onIndexed: (file, symbols) => {
			console.log(`\nIndexed: ${file}`);
			console.log(`  Symbols found: ${symbols.length}`);
			symbols.forEach(s => console.log(`    - ${s.type} ${s.name}: ${s.signature}`));
		},
	});

	// 3. Start indexing (will index existing files and watch for changes)
	console.log("\n--- Starting code indexer ---\n");
	indexer.start();

	// Wait a bit for async indexing
	await new Promise(r => setTimeout(r, 2000));

	// 4. Show memory stats
	console.log("\n--- Memory Stats ---\n");
	const stats = engine.stats();
	console.log(`Total memories: ${stats.value.total}`);
	console.log(`By type:`, stats.value.byType);
	console.log(`By tags:`, stats.value.byTags);

	// 5. Search for symbols
	console.log("\n--- Search for 'auth' ---\n");
	const search = engine.find("auth");
	if (search.value.total > 0) {
		console.log(`Found ${search.value.total} memories:`);
		search.value.memories.forEach(m => {
			console.log(`  [${m.type}] ${m.content.substring(0, 80)}...`);
		});
	}

	// 6. Get indexer stats
	console.log("\n--- Indexer Stats ---\n");
	console.log(indexer.getStats());

	// Stop after 5 seconds
	setTimeout(() => {
		console.log("\n--- Stopping indexer ---");
		indexer.stop();
		console.log("Demo complete!");
	}, 5000);
}

// Create test files first
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
const testDir = "./test-files";
if (!existsSync(testDir)) {
	mkdirSync(testDir, { recursive: true });
	// Sample TypeScript file
	writeFileSync(testDir + "/auth.ts", `
		export function authenticate(token: string): boolean {
			return token.length > 0;
		}

		export class AuthService {
			private secret: string;
			constructor(secret: string) {
				this.secret = secret;
			}
			validate(token: string): boolean {
				return token === this.secret;
			}
		}
	`);
	// Sample Python file
	writeFileSync(testDir + "/utils.py", `
		def calculate_sum(numbers):
			total = 0
			for n in numbers:
				total += n
			return total
	`);
}

demo().catch(console.error);
