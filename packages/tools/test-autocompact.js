// Quick test for autocompact
import { autoCompact } from './dist/autocompact-tool.js'
import * as fs from 'fs'

async function main() {
	// Test on a sample file
	const testFile = 'test-sample.js'

	// Create sample
	await fs.promises.writeFile(testFile, `
console.log('hello');
function foo() {
  return  1  +  2;
}
console.error('bye');
`)

	// Run autocompact
	const results = await autoCompact(testFile)
	console.log('Results:', JSON.stringify(results, null, 2))
}

main().catch(console.error)