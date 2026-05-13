import type { OAuthProviderInterface } from "@mariozechner/pi-ai";
import { getProviders } from "@mariozechner/pi-ai";
import { getOAuthProviders } from "@mariozechner/pi-ai/oauth";
import { Container, getKeybindings, Spacer, Text, TruncatedText } from "@mariozechner/pi-tui";
import type { AuthStorage } from "../../../core/auth-storage.js";
import { theme } from "../theme/theme.js";
import { DynamicBorder } from "./dynamic-border.js";

type SimpleApiKeyProvider = { id: string; name: string };

type ProviderEntry =
	| { type: "oauth"; provider: OAuthProviderInterface }
	| { type: "simple"; provider: SimpleApiKeyProvider };

export class OAuthSelectorComponent extends Container {
	private listContainer: Container;
	private allProviders: ProviderEntry[] = [];
	private selectedIndex: number = 0;
	private mode: "login" | "logout";
	private authStorage: AuthStorage;
	private onSelectCallback: (providerId: string, isSimple: boolean) => void;
	private onCancelCallback: () => void;

	constructor(
		mode: "login" | "logout",
		authStorage: AuthStorage,
		onSelect: (providerId: string, isSimple: boolean) => void,
		onCancel: () => void,
	) {
		super();

		this.mode = mode;
		this.authStorage = authStorage;
		this.onSelectCallback = onSelect;
		this.onCancelCallback = onCancel;

		this.loadProviders();

		this.addChild(new DynamicBorder());
		this.addChild(new Spacer(1));

		const title = mode === "login" ? "Select provider to login:" : "Select provider to logout:";
		this.addChild(new TruncatedText(theme.bold(title)));
		this.addChild(new Spacer(1));

		this.listContainer = new Container();
		this.addChild(this.listContainer);

		this.addChild(new Spacer(1));

		this.addChild(new DynamicBorder());

		this.updateList();
	}

	private loadProviders(): void {
		const oauthProviders = getOAuthProviders().map((p) => ({ type: "oauth" as const, provider: p }));
		const simpleProviders = getProviders().map((p) => ({ type: "simple" as const, provider: { id: p, name: p } }));

		if (this.mode === "logout") {
			this.allProviders = oauthProviders.filter((entry) => {
				const cred = this.authStorage.get(entry.provider.id);
				return cred?.type === "oauth";
			});
		} else {
			this.allProviders = [...oauthProviders, ...simpleProviders];
		}
	}

	private updateList(): void {
		this.listContainer.clear();

		let oauthCount = 0;
		let simpleCount = 0;

		for (let i = 0; i < this.allProviders.length; i++) {
			const entry = this.allProviders[i];
			if (!entry) continue;

			const isSelected = i === this.selectedIndex;

			if (entry.type === "oauth" && oauthCount === 0) {
				this.listContainer.addChild(new Text(theme.fg("dim", " OAuth Providers"), 0, 0));
				oauthCount++;
			}
			if (entry.type === "simple" && simpleCount === 0) {
				this.listContainer.addChild(new Text(theme.fg("dim", " API Key Providers"), 0, 0));
				simpleCount++;
			}

			const provider = entry.provider;
			const isSimple = entry.type === "simple";

			const credentials = this.authStorage.get(provider.id);
			const isLoggedIn = credentials?.type === "api_key" || credentials?.type === "oauth";
			const statusIndicator = isLoggedIn ? theme.fg("success", " ✓ configured") : "";

			const providerName = isSimple
				? (provider as SimpleApiKeyProvider).name
				: (provider as OAuthProviderInterface).name;
			let line = "";
			if (isSelected) {
				line = theme.fg("accent", `→ ${providerName}`) + statusIndicator;
			} else {
				line = ` ${providerName}${statusIndicator}`;
			}

			this.listContainer.addChild(new TruncatedText(line, 0, 0));
		}

		if (this.allProviders.length === 0) {
			const message = this.mode === "login" ? "No providers available" : "No providers logged in. Use /login first.";
			this.listContainer.addChild(new TruncatedText(theme.fg("muted", ` ${message}`), 0, 0));
		}
	}

	handleInput(keyData: string): void {
		const kb = getKeybindings();
		if (kb.matches(keyData, "tui.select.up")) {
			this.selectedIndex = Math.max(0, this.selectedIndex - 1);
			this.updateList();
		} else if (kb.matches(keyData, "tui.select.down")) {
			this.selectedIndex = Math.min(this.allProviders.length - 1, this.selectedIndex + 1);
			this.updateList();
		} else if (kb.matches(keyData, "tui.select.confirm")) {
			const selectedEntry = this.allProviders[this.selectedIndex];
			if (selectedEntry) {
				const isSimple = selectedEntry.type === "simple";
				const providerId = isSimple
					? (selectedEntry.provider as SimpleApiKeyProvider).id
					: (selectedEntry.provider as OAuthProviderInterface).id;
				this.onSelectCallback(providerId, isSimple);
			}
		} else if (kb.matches(keyData, "tui.select.cancel")) {
			this.onCancelCallback();
		}
	}
}
