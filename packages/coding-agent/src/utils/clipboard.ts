import { platform } from "os";
import { isWaylandSession } from "./clipboard-image.js";
import { clipboard } from "./clipboard-native.js";
import { copyToX11Clipboard, copyToWaylandClipboard, copyToTermuxClipboard, copyToDarwinClipboard, copyToWindowsClipboard } from "./clipboard-platform.js";

type NativeClipboardExecOptions = {
	input: string;
	timeout: number;
	stdio: ["pipe", "ignore", "ignore"];
};

export async function copyToClipboard(text: string): Promise<void> {
	// Always emit OSC 52 - works over SSH/mosh, harmless locally
	const encoded = Buffer.from(text).toString("base64");
	process.stdout.write(`\x1b]52;c;${encoded}\x07`);

	try {
		if (clipboard) {
			await clipboard.setText(text);
			return;
		}
	} catch {
		// Fall through to platform-specific clipboard tools.
	}

	// Also try native tools (best effort for local sessions)
	const p = platform();
	const options: NativeClipboardExecOptions = { input: text, timeout: 5000, stdio: ["pipe", "ignore", "ignore"] };

	try {
		if (p === "darwin") {
			copyToDarwinClipboard(text);
		} else if (p === "win32") {
			copyToWindowsClipboard(text);
		} else {
			// Linux. Try Termux, Wayland, or X11 clipboard tools.
			if (process.env.TERMUX_VERSION) {
				if (copyToTermuxClipboard(text)) {
					return;
				}
			}

			const hasWaylandDisplay = Boolean(process.env.WAYLAND_DISPLAY);
			const hasX11Display = Boolean(process.env.DISPLAY);
			const isWayland = isWaylandSession();
			if (isWayland && hasWaylandDisplay) {
				if (copyToWaylandClipboard(text)) {
					return;
				}
				if (hasX11Display) {
					copyToX11Clipboard(options);
				}
			} else if (hasX11Display) {
				copyToX11Clipboard(options);
			}
		}
	} catch {
		// Ignore - OSC 52 already emitted as fallback
	}
}
