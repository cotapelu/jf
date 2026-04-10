import { z } from "zod";

/**
 * Configuration schema for the LLM Wiki extension
 */
export const LLMWikiConfigSchema = z.object({
  /** Default model to use for queries */
  defaultModel: z.string().optional(),
  /** Maximum number of results to return */
  maxResults: z.number().int().positive().default(5),
  /** Enable caching of results */
  enableCache: z.boolean().default(true),
  /** Cache TTL in seconds */
  cacheTTL: z.number().int().positive().default(300),
});

export type LLMWikiConfig = z.infer<typeof LLMWikiConfigSchema>;

/**
 * Result from a wiki query
 */
export interface WikiResult {
  /** Title of the article */
  title: string;
  /** Content/summary of the article */
  content: string;
  /** Source URL or reference */
  source?: string;
  /** Relevance score (0-1) */
  relevance: number;
}

/**
 * Completion function type for LLM queries
 */
export type CompletionFunction = (options: {
  model?: string;
  messages: Array<{ role: string; content: string }>;
  response_format?: { type: string };
  temperature?: number;
}) => Promise<{ content: string }>;

/**
 * LLM Wiki extension - provides knowledge querying capabilities
 */
export class LLMExtension {
  private readonly completionFn: CompletionFunction;
  private readonly config: LLMWikiConfig;

  // Simple in-memory cache
  private cache: Map<string, { result: WikiResult[]; timestamp: number }> = new Map();

  constructor(completionFn: CompletionFunction, config: Partial<LLMWikiConfig> = {}) {
    this.completionFn = completionFn;
    this.config = LLMWikiConfigSchema.parse({
      defaultModel: config.defaultModel,
      maxResults: config.maxResults ?? 5,
      enableCache: config.enableCache ?? true,
      cacheTTL: config.cacheTTL ?? 300,
    });
  }

  /**
   * Query the knowledge base using LLM capabilities
   * @param question The question to ask
   * @param options Optional override for configuration
   * @returns Array of wiki results
   */
  async queryKnowledge(
    question: string,
    options: Partial<LLMWikiConfig> = {}
  ): Promise<WikiResult[]> {
    const effectiveConfig = { ...this.config, ...options };

    // Check cache if enabled
    if (effectiveConfig.enableCache) {
      const cacheKey = `${question}:${JSON.stringify(effectiveConfig)}`;
      const cached = this.cache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < effectiveConfig.cacheTTL * 1000) {
        return cached.result;
      }
    }

    try {
      // Use the completion function
      const response = await this.completionFn({
        model: effectiveConfig.defaultModel,
        messages: [
          {
            role: "system",
            content: `You are a knowledgeable assistant with access to a vast wiki-like knowledge base.
            Provide accurate, concise answers to questions. If you're uncertain about something,
            say so rather than making up information. Format your response as JSON with the following structure:
            {
              "results": [
                {
                  "title": "Article Title",
                  "content": "Concise summary or answer",
                  "source": "Optional source reference",
                  "relevance": 0.95
                }
              ]
            }
            Provide between 1 and ${effectiveConfig.maxResults} results.`,
          },
          {
            role: "user",
            content: question,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
      });

      // Parse the response
      let parsed: { results: WikiResult[] } = { results: [] };
      try {
        parsed = JSON.parse(response.content);
      } catch {
        // Fallback if JSON parsing fails
        parsed.results = [
          {
            title: "Knowledge Query Result",
            content: response.content.trim(),
            relevance: 0.8,
          },
        ];
      }

      // Validate and limit results
      const results = parsed.results
        .slice(0, effectiveConfig.maxResults)
        .map((result) => ({
          ...result,
          relevance: Math.max(0, Math.min(1, result.relevance ?? 0.8)),
        }));

      // Cache the result
      if (effectiveConfig.enableCache) {
        const cacheKey = `${question}:${JSON.stringify(effectiveConfig)}`;
        this.cache.set(cacheKey, {
          result: results,
          timestamp: Date.now(),
        });
      }

      return results;
    } catch (error) {
      console.error("LLM Wiki query failed:", error);
      return [];
    }
  }

  /**
   * Get a specific article by title
   * @param title The title of the article to retrieve
   * @returns The article content or null if not found
   */
  async getArticle(title: string): Promise<string | null> {
    const results = await this.queryKnowledge(`Provide a detailed article about "${title}"`, {
      maxResults: 1,
    });

    return results.length > 0 ? results[0].content : null;
  }

  /**
   * Search for articles related to a topic
   * @param topic The topic to search for
   * @param limit Maximum number of results
   * @returns Array of article titles and snippets
   */
  async search(topic: string, limit: number = 10): Promise<Array<{ title: string; snippet: string }>> {
    const results = await this.queryKnowledge(
      `Find articles related to "${topic}" and provide titles with brief snippets`,
      { maxResults: limit }
    );

    return results.map((result) => ({
      title: result.title,
      snippet:
        result.content.substring(0, Math.min(200, result.content.length)) +
        (result.content.length > 200 ? "..." : ""),
    }));
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   * @returns Object with cache info
   */
  getCacheStats(): { size: number } {
    return { size: this.cache.size };
  }
}