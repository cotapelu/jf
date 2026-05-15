import { spawnSync } from "child_process";
import extractZip from "extract-zip";
import { chmodSync, createWriteStream, existsSync, mkdirSync, readdirSync, renameSync, rmSync } from "fs";
import { arch, platform } from "os";
import { join } from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { APP_NAME, getBinDir } from "../config.js";

export const TOOLS_DIR = getBinDir();
const NETWORK_TIMEOUT_MS = 10_000;
const DOWNLOAD_TIMEOUT_MS = 120_000;

export interface ToolConfig {
	name: string;
	repo: string;
	binaryName: string;
	tagPrefix: string;
	getAssetName: (version: string, plat: string, architecture: string) => string | null;
}

export const TOOLS: Record<string, ToolConfig> = {
	fd: {
		name: "fd",
		repo: "sharkdp/fd",
		binaryName: "fd",
		tagPrefix: "v",
		getAssetName: (version, plat, architecture) => {
			if (plat === "darwin") {
				const archStr = architecture === "arm64" ? "aarch64" : "x86_64";
				return `fd-v${version}-${archStr}-apple-darwin.tar.gz`;
			} else if (plat === "linux") {
				const archStr = architecture === "arm64" ? "aarch64" : "x86_64";
				return `fd-v${version}-${archStr}-unknown-linux-gnu.tar.gz`;
			} else if (plat === "win32") {
				const archStr = architecture === "arm64" ? "aarch64" : "x86_64";
				return `fd-v${version}-${archStr}-pc-windows-msvc.zip`;
			}
			return null;
		},
	},
	rg: {
		name: "ripgrep",
		repo: "BurntSushi/ripgrep",
		binaryName: "rg",
		tagPrefix: "",
		getAssetName: (version, plat, architecture) => {
			if (plat === "darwin") {
				const archStr = architecture === "arm64" ? "aarch64" : "x86_64";
				return `ripgrep-${version}-${archStr}-apple-darwin.tar.gz`;
			} else if (plat === "linux") {
				if (architecture === "arm64") {
					return `ripgrep-${version}-aarch64-unknown-linux-gnu.tar.gz`;
				}
				return `ripgrep-${version}-x86_64-unknown-linux-musl.tar.gz`;
			} else if (plat === "win32") {
				const archStr = architecture === "arm64" ? "aarch64" : "x86_64";
				return `ripgrep-${version}-${archStr}-pc-windows-msvc.zip`;
			}
			return null;
		},
	},
};

export async function getLatestVersion(repo: string): Promise<string> {
	const response = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
		headers: { "User-Agent": `${APP_NAME}-coding-agent` },
		signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS),
	});

	if (!response.ok) {
		throw new Error(`GitHub API error: ${response.status}`);
	}

	const data = (await response.json()) as { tag_name: string };
	return data.tag_name.replace(/^v/, "");
}

export async function downloadFile(url: string, dest: string): Promise<void> {
	const response = await fetch(url, {
		signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
	});

	if (!response.ok) {
		throw new Error(`Failed to download: ${response.status}`);
	}

	if (!response.body) {
		throw new Error("No response body");
	}

	const fileStream = createWriteStream(dest);
	await pipeline(Readable.fromWeb(response.body as any), fileStream);
}

export function findBinaryRecursively(rootDir: string, binaryFileName: string): string | null {
	const stack: string[] = [rootDir];

	while (stack.length > 0) {
		const currentDir = stack.pop();
		if (!currentDir) continue;

		const entries = readdirSync(currentDir, { withFileTypes: true });
		for (const entry of entries) {
			const fullPath = join(currentDir, entry.name);
			if (entry.isFile() && entry.name === binaryFileName) {
				return fullPath;
			}
			if (entry.isDirectory()) {
				stack.push(fullPath);
			}
		}
	}

	return null;
}

function getDownloadPaths(
	tool: "fd" | "rg",
	version: string,
	plat: string,
	architecture: string,
): { assetName: string; binaryPath: string } {
	const config = TOOLS[tool];
	if (!config) throw new Error(`Unknown tool: ${tool}`);

	const assetName = config.getAssetName(version, plat, architecture);
	if (!assetName) {
		throw new Error(`Unsupported platform: ${plat}/${architecture}`);
	}

	const binaryExt = plat === "win32" ? ".exe" : "";
	const binaryPath = join(TOOLS_DIR, config.binaryName + binaryExt);

	return { assetName, binaryPath };
}

function extractTarGz(archivePath: string, extractDir: string, assetName: string): void {
	const extractResult = spawnSync("tar", ["xzf", archivePath, "-C", extractDir], { stdio: "pipe" });
	if (extractResult.error || extractResult.status !== 0) {
		const errMsg = extractResult.error?.message ?? extractResult.stderr?.toString().trim() ?? "unknown error";
		throw new Error(`Failed to extract ${assetName}: ${errMsg}`);
	}
}

function extractZipArchive(archivePath: string, extractDir: string, assetName: string): Promise<void> {
	return extractZip(archivePath, { dir: extractDir }).catch((err: Error) => {
		throw new Error(`Failed to extract ${assetName}: ${err.message}`);
	});
}

function findExtractedBinary(
	config: ToolConfig,
	extractDir: string,
	assetName: string,
	binaryExt: string,
): string | null {
	const binaryFileName = config.binaryName + binaryExt;
	const extractedDir = join(extractDir, assetName.replace(/\.(tar\.gz|zip)$/, ""));
	const extractedBinaryCandidates = [join(extractedDir, binaryFileName), join(extractDir, binaryFileName)];
	let extractedBinary: string | null = extractedBinaryCandidates.find((candidate) => existsSync(candidate)) ?? null;

	if (!extractedBinary) {
		extractedBinary = findBinaryRecursively(extractDir, binaryFileName);
	}

	return extractedBinary;
}

function makeBinaryExecutable(binaryPath: string, plat: string): void {
	if (plat !== "win32") {
		chmodSync(binaryPath, 0o755);
	}
}

function createExtractDir(): string {
	const extractDir = join(
		TOOLS_DIR,
		`extract_tmp_${process.pid}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
	);
	mkdirSync(extractDir, { recursive: true });
	return extractDir;
}

function cleanupFiles(archivePath: string, extractDir: string): void {
	rmSync(archivePath, { force: true });
	rmSync(extractDir, { recursive: true, force: true });
}

async function prepareToolDownload(tool: "fd" | "rg"): Promise<{
	config: ToolConfig;
	plat: string;
	architecture: string;
	version: string;
	assetName: string;
	binaryPath: string;
	downloadUrl: string;
	archivePath: string;
	extractDir: string;
	binaryExt: string;
}> {
	const config = TOOLS[tool];
	if (!config) throw new Error(`Unknown tool: ${tool}`);

	const plat = platform();
	const architecture = arch();
	const version = await getLatestVersion(config.repo);
	const { assetName, binaryPath } = getDownloadPaths(tool, version, plat, architecture);
	const downloadUrl = `https://github.com/${config.repo}/releases/download/${config.tagPrefix}${version}/${assetName}`;

	// Create tools directory
	mkdirSync(TOOLS_DIR, { recursive: true });

	const archivePath = join(TOOLS_DIR, assetName);
	const extractDir = createExtractDir();
	const binaryExt = plat === "win32" ? ".exe" : "";

	return {
		config,
		plat,
		architecture,
		version,
		assetName,
		binaryPath,
		downloadUrl,
		archivePath,
		extractDir,
		binaryExt,
	};
}

async function downloadToolArchive(downloadUrl: string, archivePath: string): Promise<void> {
	await downloadFile(downloadUrl, archivePath);
}

function extractToolArchive(archivePath: string, extractDir: string, assetName: string): void {
	if (assetName.endsWith(".tar.gz")) {
		extractTarGz(archivePath, extractDir, assetName);
	} else if (assetName.endsWith(".zip")) {
		// Cannot use await in non-async function, so we handle zip extraction differently
		throw new Error("Zip extraction must be async");
	} else {
		throw new Error(`Unsupported archive format: ${assetName}`);
	}
}

async function extractToolArchiveAsync(archivePath: string, extractDir: string, assetName: string): Promise<void> {
	if (assetName.endsWith(".zip")) {
		await extractZipArchive(archivePath, extractDir, assetName);
	} else {
		extractToolArchive(archivePath, extractDir, assetName);
	}
}

function installToolBinary(
	config: ToolConfig,
	extractDir: string,
	assetName: string,
	binaryPath: string,
	binaryExt: string,
): void {
	const extractedBinary = findExtractedBinary(config, extractDir, assetName, binaryExt);

	if (extractedBinary) {
		renameSync(extractedBinary, binaryPath);
	} else {
		throw new Error(`Binary not found in archive: expected ${config.binaryName}${binaryExt} under ${extractDir}`);
	}

	makeBinaryExecutable(binaryPath, platform());
}

function cleanupToolFiles(archivePath: string, extractDir: string): void {
	cleanupFiles(archivePath, extractDir);
}

// Download and install a tool
export async function downloadTool(tool: "fd" | "rg"): Promise<string> {
	const { config, assetName, binaryPath, downloadUrl, archivePath, extractDir, binaryExt } =
		await prepareToolDownload(tool);

	// Download
	await downloadToolArchive(downloadUrl, archivePath);

	try {
		// Extract
		await extractToolArchiveAsync(archivePath, extractDir, assetName);

		// Install
		installToolBinary(config, extractDir, assetName, binaryPath, binaryExt);

		return binaryPath;
	} finally {
		// Cleanup
		cleanupToolFiles(archivePath, extractDir);
	}
}
