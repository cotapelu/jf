// Demo test for context-compactor
import { contextCompact, estimateTokens } from './dist/context-compactor-tool.js'
import * as fs from 'fs'

async function main() {
	// Test 1: estimateTokens
	console.log('Test estimateTokens:')
	console.log('  "Hello world" tokens:', estimateTokens('Hello world')) // ~3

	// Test 2: Create a mock directory
	const testDir = 'test-src'
	await fs.promises.mkdir(testDir, { recursive: true })

	await fs.promises.writeFile(`${testDir}/main.js`, `
console.log('Hello from main');
function longFunction() {
	// This is a long comment that should be removed.
	// Another comment line.
	const x = 1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 9 + 10;
	// And more comments...
	return x;
}
console.log('End of main');
`)
	await fs.promises.writeFile(`${testDir}/utils.js`, `
// Utility functions
export function utilA() {
	return 'A';
}
export function utilB() {
	return 'B';
}
`)

	// Compact directory with low token limit (e.g., 50 tokens) to force compaction
	const result = await contextCompact({ type: 'directory', path: testDir }, {
		tokenLimit: 50,
		dropDocs: false,
		dropExamples: false,
		verbose: true
	})

	console.log('\n=== Compaction Result ===')
	console.log('Tokens before:', result.tokensBefore)
	console.log('Tokens after:', result.tokensAfter)
	console.log('Tokens saved:', result.tokensSaved)
	console.log('Was compacted:', result.wasCompacted)
	console.log('Actions:', result.actions)
	console.log('Dropped files:', result.droppedFiles)
	console.log('Kept files:', result.compactedFiles)
}

main().catch(console.error)
