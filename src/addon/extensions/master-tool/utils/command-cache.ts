#!/usr/bin/env node

/**
 * Command Cache - LRU với TTL
 *
 * Cache loaded command modules để tránh dynamic import lại mỗi lần.
 * Tự động expire sau cacheTTL.
 */

import type { CommandModule, CommandRegistryEntry } from "../types/command-module.js";

export class CommandCache {
  private cache: Map<string, CommandRegistryEntry> = new Map();
  private readonly ttl: number;
  private maxSize: number;

  constructor(options: { ttl?: number; maxSize?: number } = {}) {
    this.ttl = options.ttl ?? 5 * 60 * 1000; // 5 minutes default
    this.maxSize = options.maxSize ?? 100; // Max 100 commands cached
  }

  /**
   * Get cached command module
   */
  get(key: string): CommandModule | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    const now = Date.now();
    if (now - entry.lastLoaded > this.ttl) {
      // Expired
      this.cache.delete(key);
      return undefined;
    }

    // Update access order (LRU)
    entry.loadCount++;
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.module;
  }

  /**
   * Set command module in cache
   */
  set(key: string, module: CommandModule, metadata?: CommandModule["metadata"]): void {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    const entry: CommandRegistryEntry = {
      loader: async () => module, // Not storing loader, just module
      metadata: metadata ?? module.metadata,
      schema: module.schema,
      module,
      lastLoaded: Date.now(),
      loadCount: 1,
      errorCount: 0
    };

    this.cache.set(key, entry);
  }

  /**
   * Mark command as errored (reduce priority)
   */
  markError(key: string, error?: string): void {
    const entry = this.cache.get(key);
    if (entry) {
      entry.errorCount++;
      entry.lastError = error;
      // Decrease priority by moving to end (will be evicted first)
      this.cache.delete(key);
      this.cache.set(key, entry);
    }
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    entries: Array<{
      key: string;
      name: string;
      category: string;
      loadCount: number;
      errorCount: number;
      ageMs: number;
      lastError?: string;
    }>;
  } {
    const now = Date.now();
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.entries()).map(([key, entry]) => ({
        key,
        name: entry.metadata.name,
        category: entry.metadata.category,
        loadCount: entry.loadCount,
        errorCount: entry.errorCount,
        ageMs: now - entry.lastLoaded,
        lastError: entry.lastError
      }))
    };
  }

  /**
   * Remove specific command from cache
   */
  invalidate(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Invalidate all commands in a category
   */
  invalidateCategory(category: string): void {
    for (const [key, entry] of this.cache.entries()) {
      if (entry.metadata.category === category) {
        this.cache.delete(key);
      }
    }
  }
}

// Global cache instance (per master tool instance)
let globalCache: CommandCache | null = null;

export function getGlobalCache(): CommandCache {
  if (!globalCache) {
    globalCache = new CommandCache();
  }
  return globalCache;
}

export function setGlobalCache(cache: CommandCache): void {
  globalCache = cache;
}

export function resetGlobalCache(): void {
  globalCache = null;
}
