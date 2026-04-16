/**
 * SQLite-backed Memory Store with Full-Text Search
 */

import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import type { IMemoryStore } from "../store/memory-store.js";
import type {
	Memory,
	MemoryInput,
	MemoryQuery,
	MemorySearchResult,
	MemoryStats,
	MemoryUpdate,
	Result,
} from "../types.js";

function generateId(): string {
	return `mem_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

function now(): number {
	return Date.now();
}

export function createSQLiteStore(dbPath: string): IMemoryStore {
	// Ensure directory exists
	const dir = dirname(dbPath);
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}

	const db = new Database(dbPath);

	// Auto-expunge background job
	let autoExpungeInterval: ReturnType<typeof setInterval> | null = null;
	// Auto-decay background job
	let autoDecayInterval: ReturnType<typeof setInterval> | null = null;
	// Decay config
	const decayConfig = { decayAfterDays: 30, decayRate: 0.01 };

	// Enable WAL mode for better concurrency
	db.pragma("journal_mode = WAL");

	// Create tables
	db.exec(`
    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK(type IN ('preference', 'project', 'command', 'solution', 'note', 'code_symbol')),
      content TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '[]',
      weight REAL NOT NULL DEFAULT 0.5,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      access_count INTEGER NOT NULL DEFAULT 0,
      expires_at INTEGER,
      metadata TEXT DEFAULT '{}',
      -- Code symbol metadata
      symbol_type TEXT,
      file_path TEXT,
      line_start INTEGER,
      line_end INTEGER,
      language TEXT,
      signature TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_type ON memories(type);
    CREATE INDEX IF NOT EXISTS idx_created ON memories(created_at);
    CREATE INDEX IF NOT EXISTS idx_updated ON memories(updated_at);
    CREATE INDEX IF NOT EXISTS idx_expires_at ON memories(expires_at);
    CREATE INDEX IF NOT EXISTS idx_file_path ON memories(file_path);
    CREATE INDEX IF NOT EXISTS idx_file_path_type ON memories(file_path, type);

    -- Full-Text Search virtual table
    CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
      content,
      tags,
      content=memories,
      content_rowid=rowid,
      tokenize='porter unicode61'
    );

    -- Triggers to keep FTS in sync
    CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
      INSERT INTO memories_fts(rowid, content, tags)
      VALUES (new.rowid, new.content, new.tags);
    END;

    CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
      INSERT INTO memories_fts(memories_fts, rowid, content, tags)
      VALUES('delete', old.rowid, old.content, old.tags);
    END;

    CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN
      INSERT INTO memories_fts(memories_fts, rowid, content, tags)
      VALUES('delete', old.rowid, old.content, old.tags);
      INSERT INTO memories_fts(rowid, content, tags)
      VALUES (new.rowid, new.content, new.tags);
    END;
  `);

	// Prepare statements
	const stmtInsert = db.prepare(`
    INSERT INTO memories (id, type, content, tags, weight, created_at, updated_at, access_count, expires_at, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

	const stmtGet = db.prepare("SELECT * FROM memories WHERE id = ?");
	const stmtUpdate = db.prepare(`
    UPDATE memories SET
      content = COALESCE(?, content),
      tags = COALESCE(?, tags),
      weight = COALESCE(?, weight),
      expires_at = COALESCE(?, expires_at),
      metadata = COALESCE(?, metadata),
      updated_at = ?
    WHERE id = ?
  `);
	const stmtDelete = db.prepare("DELETE FROM memories WHERE id = ?");
	const stmtDeleteByFilePath = db.prepare("DELETE FROM memories WHERE file_path = ? AND type = 'code_symbol'");
	const stmtCount = db.prepare("SELECT COUNT(*) as count FROM memories");
	const stmtClear = db.prepare("DELETE FROM memories");
	const stmtList = db.prepare("SELECT * FROM memories ORDER BY updated_at DESC LIMIT ? OFFSET ?");

	// Stats queries
	const stmtStatsByType = db.prepare(`
    SELECT type, COUNT(*) as count
    FROM memories
    GROUP BY type
  `);
	const stmtStatsByTags = db.prepare(`
    SELECT json_each.value as tag, COUNT(*) as count
    FROM memories, json_each(memories.tags)
    GROUP BY json_each.value
    ORDER BY count DESC
  `);
	const stmtAvgWeight = db.prepare("SELECT AVG(weight) as avg FROM memories");

	return {
		save(input: MemoryInput): Result<Memory> {
			try {
				const id = generateId();
				const nowVal = now();
				const tagsJson = JSON.stringify(input.tags ?? []);
				const metadataJson = JSON.stringify(input.metadata ?? {});

				stmtInsert.run(
					id,
					input.type,
					input.content,
					tagsJson,
					input.weight ?? 0.5,
					nowVal,
					nowVal,
					0, // access_count
					input.expires_at,
					metadataJson,
				);

				const memory = mapRow(stmtGet.get(id));
				return { ok: true, value: memory! };
			} catch (e) {
				return { ok: false, error: e instanceof Error ? e.message : String(e) };
			}
		},

		find(query: string, options: Partial<MemoryQuery> = {}): Result<MemorySearchResult> {
			try {
				// Validate query non-empty
				if (!query || query.trim() === "") {
					return { ok: true, value: { memories: [], total: 0 } };
				}
				const limit = options.limit ?? 10;
				const type = options.type;
				const requiredTags = options.tags ?? [];

				let memories: Memory[] = [];
				let ftsFailed = false;

				// Try FTS search first (for better ranking)
				try {
					const ftsResults = db
						.prepare(
							`SELECT memories.* FROM memories
								JOIN memories_fts ON memories.rowid = memories_fts.rowid
								WHERE memories_fts MATCH ?
								ORDER BY bm25(memories_fts)
								LIMIT ?`, // Fetch more to account for filtering
						)
						.all(query, limit * 2);

					memories = ftsResults.map(mapRow);
				} catch (_ftsError) {
					// FTS failed (e.g., special characters in query), fallback to LIKE
					ftsFailed = true;
				}

				// Fallback to LIKE search if FTS failed or no results
				if (ftsFailed || memories.length === 0) {
					const likePattern = `%${query}%`;
					const likeResults = db
						.prepare(
							`SELECT * FROM memories
								WHERE content LIKE ? OR tags LIKE ?
								ORDER BY updated_at DESC
								LIMIT ?`,
						)
						.all(likePattern, likePattern, limit * 2);

					memories = likeResults.map(mapRow);
				}

				// Apply filters
				if (type) {
					memories = memories.filter((m) => m.type === type);
				}
				if (requiredTags.length > 0) {
					memories = memories.filter((m) => requiredTags.every((tag) => m.tags.includes(tag)));
				}

				// Filter expired
				const nowVal = now();
				memories = memories.filter((m) => !m.expires_at || m.expires_at > nowVal);

				// Increment access count for results (async-ish, don't wait)
				for (const mem of memories.slice(0, limit)) {
					db.prepare("UPDATE memories SET access_count = access_count + 1 WHERE id = ?").run(mem.id);
				}

				return {
					ok: true,
					value: {
						memories: memories.slice(0, limit),
						total: memories.length,
					},
				};
			} catch (e) {
				return { ok: false, error: e instanceof Error ? e.message : String(e) };
			}
		},

		get(id: string): Result<Memory | null> {
			try {
				const row = stmtGet.get(id);
				if (!row) return { ok: true, value: null };

				// Check expiration
				const memory = mapRow(row);
				if (memory.expires_at && memory.expires_at < now()) {
					stmtDelete.run(id);
					return { ok: true, value: null };
				}

				// Increment access count
				db.prepare("UPDATE memories SET access_count = access_count + 1 WHERE id = ?").run(id);

				return { ok: true, value: memory };
			} catch (e) {
				return { ok: false, error: e instanceof Error ? e.message : String(e) };
			}
		},

		update(id: string, data: MemoryUpdate): Result<Memory | null> {
			try {
				const existing = stmtGet.get(id);
				if (!existing) {
					return { ok: true, value: null };
				}

				const nowVal = now();
				stmtUpdate.run(
					data.content,
					data.tags ? JSON.stringify(data.tags) : null,
					data.weight,
					data.expires_at,
					data.metadata ? JSON.stringify(data.metadata) : null,
					nowVal,
					id,
				);

				const updated = stmtGet.get(id);
				return { ok: true, value: mapRow(updated) };
			} catch (e) {
				return { ok: false, error: e instanceof Error ? e.message : String(e) };
			}
		},

		delete(id: string): Result<boolean> {
			try {
				const info = stmtDelete.run(id);
				return { ok: true, value: info.changes > 0 };
			} catch (e) {
				return { ok: false, error: e instanceof Error ? e.message : String(e) };
			}
		},

		stats(): Result<MemoryStats> {
			try {
				const total = (stmtCount.get() as { count: number }).count;

				// By type
				const byType: Record<string, number> = {
					preference: 0,
					project: 0,
					command: 0,
					solution: 0,
					note: 0,
				};
				for (const row of stmtStatsByType.all() as Array<{ type: string; count: number }>) {
					byType[row.type as keyof typeof byType] = row.count;
				}

				// By tags
				const byTags: Record<string, number> = {};
				for (const row of stmtStatsByTags.all() as Array<{ tag: string; count: number }>) {
					byTags[row.tag] = row.count;
				}

				// Average weight
				const avgWeight = (stmtAvgWeight.get() as { avg: number | null }).avg || 0;

				return {
					ok: true,
					value: {
						total,
						byType: byType as Record<Memory["type"], number>,
						byTags,
						averageWeight: avgWeight,
					},
				};
			} catch (e) {
				return { ok: false, error: e instanceof Error ? e.message : String(e) };
			}
		},

		clear(): void {
			stmtClear.run();
		},

		startAutoExpunge(intervalMs?: number): void {
			if (autoExpungeInterval) return;
			const interval = intervalMs ?? 24 * 60 * 60 * 1000; // Default 24 hours
			autoExpungeInterval = setInterval(() => {
				// Run expunge silently, ignore errors
				try {
					this.expunge();
				} catch {}
			}, interval);
		},

		stopAutoExpunge(): void {
			if (autoExpungeInterval) {
				clearInterval(autoExpungeInterval);
				autoExpungeInterval = null;
			}
		},

		startAutoDecay(options?: { intervalMs?: number; decayAfterDays?: number; decayRate?: number }): void {
			if (autoDecayInterval) return;
			if (options?.decayAfterDays !== undefined) decayConfig.decayAfterDays = options.decayAfterDays;
			if (options?.decayRate !== undefined) decayConfig.decayRate = options.decayRate;
			const interval = options?.intervalMs ?? 24 * 60 * 60 * 1000; // 24h

			autoDecayInterval = setInterval(() => {
				try {
					// Fetch memories that haven't been updated recently
					const cutoff = Date.now() - decayConfig.decayAfterDays * 24 * 60 * 60 * 1000;
					// Select memories with updated_at < cutoff (not accessed recently)
					const stmt = db.prepare(
						"SELECT id, weight, updated_at FROM memories WHERE updated_at < ? AND expires_at IS NULL",
					);
					const candidates = stmt.all(cutoff) as Array<{ id: string; weight: number; updated_at: number }>;

					for (const mem of candidates) {
						const daysInactive = (Date.now() - mem.updated_at) / (24 * 60 * 60 * 1000);
						const decayFactor = (1 - decayConfig.decayRate) ** daysInactive;
						const newWeight = Math.max(0.01, mem.weight * decayFactor);

						// Update if significantly changed
						if (Math.abs(newWeight - mem.weight) > 0.001) {
							db.prepare("UPDATE memories SET weight = ?, updated_at = ? WHERE id = ?").run(
								newWeight,
								Date.now(),
								mem.id,
							);
						}
					}
				} catch {}
			}, interval);
		},

		stopAutoDecay(): void {
			if (autoDecayInterval) {
				clearInterval(autoDecayInterval);
				autoDecayInterval = null;
			}
		},

		expunge(olderThan?: number): Result<number> {
			try {
				const cutoff = olderThan ?? Date.now();
				const info = db.prepare("DELETE FROM memories WHERE expires_at IS NOT NULL AND expires_at < ?").run(cutoff);
				return { ok: true, value: info.changes };
			} catch (e) {
				return { ok: false, error: e instanceof Error ? e.message : String(e) };
			}
		},

		deleteByFilePath(filePath: string): Result<number> {
			try {
				const info = stmtDeleteByFilePath.run(filePath);
				return { ok: true, value: info.changes };
			} catch (e) {
				return { ok: false, error: e instanceof Error ? e.message : String(e) };
			}
		},

		exportJSON(): string {
			const rows = db.prepare("SELECT * FROM memories ORDER BY created_at ASC").all();
			const memories = rows.map(mapRow);
			return JSON.stringify(memories, null, 2);
		},

		importJSON(data: string): Result<number> {
			try {
				const memories: Memory[] = JSON.parse(data);
				let count = 0;
				for (const mem of memories) {
					const existing = stmtGet.get(mem.id);
					if (existing) continue;

					stmtInsert.run(
						mem.id,
						mem.type,
						mem.content,
						JSON.stringify(mem.tags),
						mem.weight,
						mem.created_at,
						mem.updated_at,
						mem.access_count,
						mem.expires_at,
						JSON.stringify(mem.metadata ?? {}),
					);
					count++;
				}
				return { ok: true, value: count };
			} catch (e) {
				return { ok: false, error: e instanceof Error ? e.message : String(e) };
			}
		},

		transaction<T>(fn: (store: IMemoryStore) => T): Result<T> {
			try {
				const transaction = db.transaction(() => {
					return fn(this);
				});
				const result = transaction();
				return { ok: true, value: result };
			} catch (e) {
				return { ok: false, error: e instanceof Error ? e.message : String(e) };
			}
		},

		list(options: { limit?: number; offset?: number } = {}): Memory[] {
			const limit = options.limit ?? 10000;
			const offset = options.offset ?? 0;
			const rows = stmtList.all(limit, offset) as Array<any>;
			return rows.map(mapRow);
		},
	};
}

// Helper to convert SQLite row to Memory
function mapRow(row: any): Memory {
	return {
		id: row.id,
		type: row.type,
		content: row.content,
		tags: JSON.parse(row.tags || "[]"),
		weight: row.weight,
		created_at: row.created_at,
		updated_at: row.updated_at,
		access_count: row.access_count,
		expires_at: row.expires_at,
		metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
	};
}
