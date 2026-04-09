import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

/**
 * Command History - Lưu và tìm kiếm commands của user
 *
 * Lưu vào: .pi/commands/YYYY-MM-DD.json
 * Format: JSONL (1 dòng mỗi command)
 */

const COMMANDS_DIR = ".pi/commands";

export interface CommandEntry {
	ts: number; // Unix timestamp
	text: string; // Full command text
	type: "command" | "message"; // command (/...) hoặc message
	command?: string; // Command name (vd: "model", "settings")
	args?: string; // Args sau command
}

export class CommandHistory {
	constructor(private workspaceDir: string) {}

	/**
	 * Lưu một command/message
	 */
	save(text: string): void {
		const trimmed = text.trim();
		if (!trimmed) return;

		const isCommand = trimmed.startsWith("/");
		const parts = isCommand ? trimmed.slice(1).split(" ") : [];
		const command = isCommand ? parts[0] : undefined;
		const args = isCommand && parts.length > 1 ? parts.slice(1).join(" ") : undefined;

		const entry: CommandEntry = {
			ts: Date.now(),
			text: trimmed,
			type: isCommand ? "command" : "message",
			command,
			args,
		};

		this.appendEntry(entry);
	}

	/**
	 * Lấy commands trong ngày
	 */
	today(): CommandEntry[] {
		return this.getByDate(new Date());
	}

	/**
	 * Lấy commands trong ngày cụ thể
	 */
	byDate(date: Date): CommandEntry[] {
		return this.getByDate(date);
	}

	/**
	 * Lấy commands trong khoảng thời gian
	 */
	range(startDate: Date, endDate: Date): CommandEntry[] {
		const entries: CommandEntry[] = [];
		const current = new Date(startDate);

		while (current <= endDate) {
			entries.push(...this.getByDate(current));
			current.setDate(current.getDate() + 1);
		}

		return entries;
	}

	/**
	 * Tìm commands theo text (grep)
	 */
	search(query: string, days: number = 7): CommandEntry[] {
		const results: CommandEntry[] = [];
		const now = new Date();
		const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

		const files = this.getFilesInRange(start, now);
		for (const file of files) {
			const entries = this.readFile(file);
			for (const entry of entries) {
				if (entry.text.toLowerCase().includes(query.toLowerCase())) {
					results.push(entry);
				}
			}
		}

		return results;
	}

	/**
	 * Tìm commands theo loại (/command)
	 */
	byCommand(commandName: string, days: number = 30): CommandEntry[] {
		const results: CommandEntry[] = [];
		const now = new Date();
		const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

		const files = this.getFilesInRange(start, now);
		for (const file of files) {
			const entries = this.readFile(file);
			for (const entry of entries) {
				if (entry.command === commandName) {
					results.push(entry);
				}
			}
		}

		return results;
	}

	/**
	 * Tất cả commands
	 */
	all(limit: number = 100): CommandEntry[] {
		const commandsDir = join(this.workspaceDir, COMMANDS_DIR);
		if (!existsSync(commandsDir)) return [];

		const files = readdirSync(commandsDir)
			.filter((f) => f.endsWith(".json"))
			.sort()
			.reverse();

		const entries: CommandEntry[] = [];
		for (const file of files) {
			const fileEntries = this.readFile(join(commandsDir, file));
			entries.push(...fileEntries);
			if (entries.length >= limit) break;
		}

		return entries.slice(0, limit);
	}

	/**
	 * Lấy tất cả text commands (dùng cho Editor history)
	 */
	getAllAsText(limit: number = 100): string[] {
		const entries = this.all(limit);
		// Đảo ngược: file lưu mới nhất cuối, nhưng history.unshift() thêm vào đầu
		return entries.map((e) => e.text).reverse();
	}

	// ============== Private Methods ==============

	private getCommandsDir(): string {
		const dir = join(this.workspaceDir, COMMANDS_DIR);
		if (!existsSync(dir)) {
			mkdirSync(dir, { recursive: true });
		}
		return dir;
	}

	private getDateFile(date: Date): string {
		const yyyy = date.getFullYear();
		const mm = String(date.getMonth() + 1).padStart(2, "0");
		const dd = String(date.getDate()).padStart(2, "0");
		return join(this.getCommandsDir(), `${yyyy}-${mm}-${dd}.json`);
	}

	private appendEntry(entry: CommandEntry): void {
		const file = this.getDateFile(new Date());
		const line = JSON.stringify(entry) + "\n";

		// Create file if not exists
		if (!existsSync(file)) {
			// Create empty file
			const dir = this.getCommandsDir();
			mkdirSync(dir, { recursive: true });
		}

		appendFileSync(file, line, "utf8");
	}

	private getByDate(date: Date): CommandEntry[] {
		const file = this.getDateFile(date);
		if (!existsSync(file)) return [];
		return this.readFile(file);
	}

	private readFile(filePath: string): CommandEntry[] {
		if (!existsSync(filePath)) return [];

		try {
			const content = readFileSync(filePath, "utf8");
			if (!content.trim()) return [];

			return content
				.split("\n")
				.filter((line) => line.trim())
				.map((line) => JSON.parse(line) as CommandEntry);
		} catch {
			return [];
		}
	}

	private getFilesInRange(start: Date, end: Date): string[] {
		const commandsDir = join(this.workspaceDir, COMMANDS_DIR);
		if (!existsSync(commandsDir)) return [];

		const files = readdirSync(commandsDir)
			.filter((f) => f.endsWith(".json"))
			.filter((f) => {
				const filePath = join(commandsDir, f);
				const stats = statSync(filePath);
				return stats.mtime >= start && stats.mtime <= end;
			})
			.map((f) => join(commandsDir, f))
			.sort()
			.reverse();

		return files;
	}
}

/**
 * Helper function - tạo instance với workspace path
 */
export function createCommandHistory(workspaceDir: string): CommandHistory {
	return new CommandHistory(workspaceDir);
}

/**
 * CLI helpers để in ra console
 */
export function formatCommandEntry(entry: CommandEntry): string {
	const date = new Date(entry.ts);
	const time = date.toLocaleTimeString("en-US", { hour12: false });
	const prefix = entry.type === "command" ? ">" : " ";
	return `[${time}] ${prefix} ${entry.text}`;
}

export function printCommands(entries: CommandEntry[], limit: number = 20): void {
	const display = entries.slice(0, limit);
	console.log(`\nFound ${entries.length} commands (showing ${display.length}):\n`);
	display.forEach((e) => console.log(formatCommandEntry(e)));
	if (entries.length > limit) {
		console.log(`\n... and ${entries.length - limit} more`);
	}
}
