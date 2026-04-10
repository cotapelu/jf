# @mariozechner/pi-llm-wiki

LLM-powered wiki/query extension for pi.

## Installation

This package is part of the pi monorepo and is installed automatically when you install the pi dependencies.

## Usage

```typescript
import { Agent } from '@mariozechner/pi-agent-core';
import { PIAI } from '@mariozechner/pi-ai';
import { LLMExtension } from '@mariozechner/pi-llm-wiki';

// Initialize pi components
const agent = new Agent();
const ai = new PIAI();

// Create the wiki extension
const wiki = new LLMExtension(agent, ai, {
  defaultModel: 'gpt-4o-mini',
  maxResults: 5,
  enableCache: true
});

// Query knowledge
const results = await wiki.queryKnowledge('What is the capital of France?');
console.log(results);

// Get a specific article
const article = await wiki.getArticle('Eiffel Tower');

// Search for topics
const searchResults = await wiki.search('machine learning', 10);
```

## Configuration

The extension accepts the following configuration options:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `defaultModel` | string | (uses AI default) | Default LLM model to use for queries |
| `maxResults` | number | 5 | Maximum number of results to return per query |
| `enableCache` | boolean | true | Whether to cache query results |
| `cacheTTL` | number (seconds) | 300 | Time-to-live for cached results |

## API

### `queryKnowledge(question: string, options?: Partial<Config>): Promise<WikiResult[]>`

Query the knowledge base using LLM capabilities.

### `getArticle(title: string): Promise<string \| null>`

Retrieve a specific article by title.

### `search(topic: string, limit?: number): Promise<Array<{title: string; snippet: string}>>`

Search for articles related to a topic.

### `clearCache(): void`

Clear the internal result cache.

## Development

```bash
# Build the package
npm run build

# Run tests
npm test

# Watch for changes during development
npm run dev
```

## License

MIT