import hostedGitInfo from "hosted-git-info";
import { splitRef } from "./git-url-splitter.js";
import { parseGenericGitUrl } from "./git-url-parser.js";
import type { GitSource } from "./git-types.js";

export type { GitSource } from "./git-types.js";

/**
 * Parse git source into a GitSource.
 *
 * Rules:
 * - With git: prefix, accept all historical shorthand forms.
 * - Without git: prefix, only accept explicit protocol URLs.
 */
export function parseGitUrl(source: string): GitSource | null {
	const trimmed = source.trim();
	const hasGitPrefix = trimmed.startsWith("git:");
	const url = hasGitPrefix ? trimmed.slice(4).trim() : trimmed;

	if (!hasGitPrefix && !/^(https?|ssh|git):\/\//i.test(url)) {
		return null;
	}

	const split = splitRef(url);

	const hostedCandidates = [split.ref ? `${split.repo}#${split.ref}` : undefined, url].filter(
		(value): value is string => Boolean(value),
	);
	for (const candidate of hostedCandidates) {
		const info = hostedGitInfo.fromUrl(candidate);
		if (info) {
			if (split.ref && info.project?.includes("@")) {
				continue;
			}
			const useHttpsPrefix =
				!split.repo.startsWith("http://") &&
				!split.repo.startsWith("https://") &&
				!split.repo.startsWith("ssh://") &&
				!split.repo.startsWith("git://") &&
				!split.repo.startsWith("git@");
			return {
				type: "git",
				repo: useHttpsPrefix ? `https://${split.repo}` : split.repo,
				host: info.domain || "",
				path: `${info.user}/${info.project}`.replace(/\.git$/, ""),
				ref: info.committish || split.ref || undefined,
				pinned: Boolean(info.committish || split.ref),
			};
		}
	}

	const httpsCandidates = [split.ref ? `https://${split.repo}#${split.ref}` : undefined, `https://${url}`].filter(
		(value): value is string => Boolean(value),
	);
	for (const candidate of httpsCandidates) {
		const info = hostedGitInfo.fromUrl(candidate);
		if (info) {
			if (split.ref && info.project?.includes("@")) {
				continue;
			}
			return {
				type: "git",
				repo: `https://${split.repo}`,
				host: info.domain || "",
				path: `${info.user}/${info.project}`.replace(/\.git$/, ""),
				ref: info.committish || split.ref || undefined,
				pinned: Boolean(info.committish || split.ref),
			};
		}
	}

	return parseGenericGitUrl(url);
}
