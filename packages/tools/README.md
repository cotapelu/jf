# @quangtynu/pi-tools

A collection of tools for the pi coding agent.

## Tools

### autocompact

Automatically compacts source code by removing console statements, trimming whitespace, and more.

#### Usage

```typescript
import { autoCompact } from '@quangtynu/pi-tools/autocompact'

// Compact a single file
const results = await autoCompact('/path/to/file.js', {
	removeConsole: true,
	trimTrailing: true
})

// Compact a directory (recursively)
const dirResults = await autoCompact('/path/to/src', {
	extensions: ['.ts', '.js', '.tsx'],
	removeConsole: true,
	removeEmptyLines: false
})

console.log(results)
```

#### Options

- `removeConsole` (default: `true`) — Remove `console.log`, `console.error`, etc.
- `removeEmptyLines` (default: `false`) — Remove empty lines
- `trimTrailing` (default: `true`) — Trim trailing whitespace
- `removePatterns` (default: `[]`) — Array of regex patterns to remove
- `extensions` (default: `['.ts', '.js', '.tsx', '.jsx', '.mjs', '.cjs']`) — File extensions to process (directory only)
- `maxFileSize` (default: `1048576` bytes) — Skip files larger than this

#### Return

`Promise<AutoCompactResult[]>` where each result contains:

```typescript
interface AutoCompactResult {
	path: string
	originalSize: number
	newSize: number
	delta: number
	changed: boolean
	error?: string
}
```

## Development

```bash
# Build
npm run build

# Watch
npm run dev

# Test
npm test
```

## License

MIT