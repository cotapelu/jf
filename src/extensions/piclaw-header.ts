import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import type { ExtensionAPI, Theme } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { VERSION as PI_VERSION } from "@earendil-works/pi-coding-agent";

// Convert import.meta.url to __dirname for ES modules compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = __filename.substring(0, __filename.lastIndexOf('/'));

// Default values (fallback)
let PICLAW_APP_NAME = "piclaw";
let PICLAW_VERSION = "0.0.1";

// Try to read piclaw package.json from various locations
const possiblePaths = [
    join(process.cwd(), "package.json"),
    join(process.cwd(), "..", "package.json"),
    join(__dirname, "..", "..", "package.json"), // dist/extensions -> dist -> root
    join(__dirname, "..", "..", "..", "package.json"), // src/extensions -> src -> root
    join(__dirname, "..", "..", "..", "..", "package.json"),
];

for (const path of possiblePaths) {
    try {
        if (existsSync(path)) {
            const content = readFileSync(path, "utf-8");
            const pkg = JSON.parse(content);
            if (pkg.name) PICLAW_APP_NAME = pkg.name;
            if (pkg.version) PICLAW_VERSION = pkg.version;
            break;
        }
    } catch {
        // ignore
    }
}

async function checkForUpdate(): Promise<string | undefined> {
    if (process.env.PI_SKIP_VERSION_CHECK || process.env.PI_OFFLINE) return undefined;
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const response = await fetch("https://registry.npmjs.org/@earendil-works/pi-coding-agent/latest", {
            signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!response.ok) return undefined;
        const data = await response.json();
        // @ts-ignore
        const latestVersion = data.version;
        if (latestVersion && latestVersion !== PI_VERSION) {
            return latestVersion;
        }
    } catch {
        // ignore errors
    }
    return undefined;
}

export default function (api: ExtensionAPI): any {
	api.on("session_start", async (_event, ctx) => {
		if (ctx.hasUI) {
			const updateVersion = await checkForUpdate();

			ctx.ui.setHeader((_tui, theme) => {
				let header = `${theme.fg("dim", `${PICLAW_APP_NAME} agent build on top of pi.dev sdk.`)} \n`;
				header += `${theme.bold(theme.fg("accent", PICLAW_APP_NAME))}${theme.fg("dim", ` v${PICLAW_VERSION}`)}`;
				if (updateVersion) {
					header += `\n${theme.fg("warning", "Update Available")}`;
					header += `\n${theme.fg("dim", `New version ${updateVersion} is available.`)}`;
					header += `\n${theme.bold("Run piclaw update")}`;
				}
				return new Text(header, 1, 0);
			});
		}
	});
	// Return empty object to satisfy extension discovery
	return {};
}
