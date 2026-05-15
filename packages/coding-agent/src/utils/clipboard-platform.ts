import { execSync, spawn } from "child_process";

type NativeClipboardExecOptions = {
	input: string;
	timeout: number;
	stdio: ["pipe", "ignore", "ignore"];
};

export function copyToX11Clipboard(options: NativeClipboardExecOptions): void {
	try {
		execSync("xclip -selection clipboard", options);
	} catch {
		execSync("xsel --clipboard --input", options);
	}
}

export function copyToWaylandClipboard(text: string): boolean {
	try {
		// Verify wl-copy exists (spawn errors are async and won't be caught)
		execSync("which wl-copy", { stdio: "ignore" });
		// wl-copy with execSync hangs due to fork behavior; use spawn instead
		const proc = spawn("wl-copy", [], { stdio: ["pipe", "ignore", "ignore"] });
		proc.stdin.on("error", () => {
			// Ignore EPIPE errors if wl-copy exits early
		});
		proc.stdin.write(text);
		proc.stdin.end();
		proc.unref();
		return true;
	} catch {
		return false;
	}
}

export function copyToTermuxClipboard(text: string): boolean {
	try {
		execSync("termux-clipboard-set", { input: text, timeout: 5000, stdio: ["pipe", "ignore", "ignore"] });
		return true;
	} catch {
		return false;
	}
}

export function copyToDarwinClipboard(text: string): void {
	execSync("pbcopy", { input: text, timeout: 5000, stdio: ["pipe", "ignore", "ignore"] });
}

export function copyToWindowsClipboard(text: string): void {
	execSync("clip", { input: text, timeout: 5000, stdio: ["pipe", "ignore", "ignore"] });
}
