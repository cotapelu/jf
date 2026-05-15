import { fuzzyMatch } from "@earendil-works/pi-tui";
import type { SessionInfo } from "../../../core/session-manager.js";

export type SortMode = "threaded" | "recent" | "relevance";
export type NameFilter = "all" | "named";

export interface ParsedSearchQuery {
	mode: "tokens" | "regex";
	tokens: { kind: "fuzzy" | "phrase"; value: string }[];
	regex: RegExp | null;
	error?: string;
}

export interface MatchResult {
	matches: boolean;
	score: number;
}

interface Token {
	kind: "fuzzy" | "phrase";
	value: string;
}

function makeToken(kind: "fuzzy" | "phrase", value: string): Token {
	return { kind, value };
}
function makeMatchResult(matches: boolean, score: number): MatchResult {
	return { matches, score };
}

function maybePushToken(tokens: Token[], kind: "fuzzy" | "phrase", v: string): void {
	if (v) tokens.push(makeToken(kind, v));
}

function normalizeWhitespaceLower(text: string): string {
	return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function getSessionSearchText(session: SessionInfo): string {
	return `${session.id} ${session.name ?? ""} ${session.allMessagesText} ${session.cwd}`;
}

export function hasSessionName(session: SessionInfo): boolean {
	return Boolean(session.name?.trim());
}

function matchesNameFilter(session: any, filter: NameFilter): boolean {
	if (filter === "all") return true;
	return hasSessionName(session as SessionInfo);
}

function tokenizeQuery(trimmed: string): { tokens: Token[]; hadUnclosedQuote: boolean } {
	const tokens: Token[] = [];
	let buf = "",
		inQuote = false,
		hadUnclosedQuote = false;
	for (let i = 0; i < trimmed.length; i++) {
		const ch = trimmed[i];
		if (ch === '"') {
			const kind = inQuote ? "phrase" : "fuzzy";
			const v = buf.trim();
			buf = "";
			maybePushToken(tokens, kind, v);
			inQuote = !inQuote;
			continue;
		}
		if (!inQuote && /\s/.test(ch)) {
			const v = buf.trim();
			buf = "";
			maybePushToken(tokens, "fuzzy", v);
			continue;
		}
		buf += ch;
	}
	if (inQuote) hadUnclosedQuote = true;
	const v = buf.trim();
	maybePushToken(tokens, inQuote ? "phrase" : "fuzzy", v);
	return { tokens, hadUnclosedQuote };
}

function parseRegexMode(pattern: string): ParsedSearchQuery {
	if (!pattern) {
		const mode = "regex";
		const tokens: Token[] = [];
		const regex = null;
		const error = "Empty regex";
		return { mode, tokens, regex, error };
	}
	try {
		const mode = "regex";
		const tokens: Token[] = [];
		const regex = new RegExp(pattern, "i");
		return { mode, tokens, regex };
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		const mode = "regex";
		const tokens: Token[] = [];
		const regex = null;
		const error = msg;
		return { mode, tokens, regex, error };
	}
}

export function parseSearchQuery(query: string): ParsedSearchQuery {
	const trimmed = query.trim();
	if (!trimmed) {
		const mode = "tokens";
		const tokens: Token[] = [];
		const regex = null;
		return { mode, tokens, regex };
	}
	if (trimmed.startsWith("re:")) {
		const pattern = trimmed.slice(3).trim();
		return parseRegexMode(pattern);
	}
	const { tokens, hadUnclosedQuote } = tokenizeQuery(trimmed);
	if (hadUnclosedQuote) {
		const mode = "tokens";
		const toks = trimmed
			.split(/\s+/)
			.map((t) => t.trim())
			.filter((t) => t.length > 0)
			.map((t) => makeToken("fuzzy", t));
		const regex = null;
		return { mode, tokens: toks, regex };
	}
	const mode = "tokens";
	const regex = null;
	return { mode, tokens, regex };
}

function matchRegexMode(text: string, parsed: ParsedSearchQuery): MatchResult | null {
	if (!parsed.regex) return null;
	const idx = text.search(parsed.regex);
	if (idx < 0) return null;
	return makeMatchResult(true, idx * 0.1);
}

function matchTokenMode(text: string, parsed: ParsedSearchQuery): MatchResult {
	let totalScore = 0;
	let normalizedText: string | null = null;
	for (const token of parsed.tokens) {
		if (token.kind === "phrase") {
			if (normalizedText === null) normalizedText = normalizeWhitespaceLower(text);
			const phrase = normalizeWhitespaceLower(token.value);
			if (!phrase) continue;
			const idx = normalizedText.indexOf(phrase);
			if (idx < 0) return makeMatchResult(false, 0);
			totalScore += idx * 0.1;
			continue;
		}
		const m = fuzzyMatch(token.value, text);
		if (!m.matches) return makeMatchResult(false, 0);
		totalScore += m.score;
	}
	return makeMatchResult(true, totalScore);
}

export function matchSession(session: SessionInfo, parsed: ParsedSearchQuery): MatchResult {
	const text = getSessionSearchText(session);
	if (parsed.mode === "regex") {
		const res = matchRegexMode(text, parsed);
		return res ?? makeMatchResult(false, 0);
	}
	if (parsed.tokens.length === 0) return makeMatchResult(true, 0);
	return matchTokenMode(text, parsed);
}

function filterRecent(sessions: any[], parsed: ParsedSearchQuery): any[] {
	return sessions.filter((s) => matchSession(s as any, parsed).matches);
}

function sortRelevance(sessions: any[], parsed: ParsedSearchQuery): any[] {
	const scored: Array<{ session: any; score: number }> = [];
	for (const s of sessions) {
		const res = matchSession(s as any, parsed);
		if (!res.matches) continue;
		scored.push({ session: s, score: res.score });
	}
	scored.sort((a, b) => a.score - b.score || b.session.modified.getTime() - a.session.modified.getTime());
	return scored.map((r) => r.session);
}

export function filterAndSortSessions(
	sessions: any[],
	query: string,
	sortMode: SortMode,
	nameFilter: NameFilter = "all",
): any[] {
	const nameFiltered = nameFilter === "all" ? sessions : sessions.filter((s) => matchesNameFilter(s, nameFilter));
	const trimmed = query.trim();
	if (!trimmed) return nameFiltered;
	const parsed = parseSearchQuery(query);
	if (parsed.error) return [];
	if (sortMode === "recent") return filterRecent(nameFiltered, parsed);
	return sortRelevance(nameFiltered, parsed);
}
