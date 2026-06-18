# Piclaw Extensions

Tổ chức các custom provider và extensions cho PiClaw.

## Cấu trúc

```
extensions/
├── index.ts              # Main entry point (được load tự động)
├── providers/            # Provider definitions
│   ├── index.ts         # Re-exports
│   ├── kilo-provider.ts # Kilo provider
│   └── models/          # Model definitions
│       └── kilo-models.ts
└── README.md
```

## Thêm Provider Mới

1. Tạo file providers/<provider-name>-provider.ts:

```typescript
import type { ExtensionAPI, ProviderConfig } from "@earendil-works/pi-coding-agent";

export function registerMyProvider(api: ExtensionAPI): void {
  const config: ProviderConfig = {
    baseUrl: "https://api.example.com/v1",
    apiKey: "MY_API_KEY",
    api: "openai-completions",
    models: [
      {
        id: "my-model-v1",
        name: "My Model V1",
        reasoning: false,
        input: ["text"],
        cost: { input: 0, output: 0 },
        contextWindow: 128000,
        maxTokens: 4096,
      },
    ],
  };

  api.registerProvider("my-provider-id", config);
}
```

2. Thêm vào `providers/index.ts`:

```typescript
export { registerMyProvider } from "./my-provider.js";
```

3. Import trong `extensions/index.ts`:

```typescript
import { registerMyProvider } from "./providers/index.js";

export default function (api: ExtensionAPI) {
  registerMyProvider(api);
}
```

4. Build: `npm run build`

Provider sẽ xuất hiện trong `/login` → "Use an API key".

## Ghi chú

- Extension tự động được load thông qua global settings.
- Không cần thêm vào `package.json` workspaces.
- Models phải được khai báo đầy đủ nếu provider chưa có trong pi-core.
