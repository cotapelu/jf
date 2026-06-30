# Copy Add-on Guide - Chỉ Một Hàm Duy Nhất

## Mục Đích

Copy toàn bộ add-on (extensions + tools) sang project khác và dùng với **một hàm duy nhất**.

## Cách Copy

### Bước 1: Copy thư mục

```
Copy toàn bộ thư mục: src/addon/
```

Nó bao gồm:
- `index.ts` - **HÀM DUY NHẤT** `registerAllAddon(cwd)`
- `tools/` - tất cả tool definitions
- `extensions/` - tất cả extensions (git, master-tool, etc.)
- Các file phụ trợ: `runtime-context.ts`, `settings-config.ts`, `prompts/`, ...

### Bước 2: Trong `main.ts` của project mới

```typescript
// Import hàm đăng ký duy nhất
import { registerAllAddon } from './addon/index.js';

// Trong hàm createRuntime:
const { extensions, tools } = registerAllAddon(cwd);

// Sử dụng:
const servicesOptions: CreateAgentSessionServicesOptions = {
  cwd,
  agentDir,
  resourceLoaderOptions: {
    promptsOverride: () => ({ prompts: [defaultAssistantPrompt], diagnostics: [] }),
    extensionFactories: extensions,  // <- Dùng extensions
  },
};

const sessionOptions: CreateAgentSessionFromServicesOptions = {
  services,
  sessionManager,
  sessionStartEvent,
  customTools: tools,  // <- Dùng tools
};
```

## Định Nghĩa Hàm

```typescript
// src/addon/index.ts
export function registerAllAddon(cwd: string) {
  return {
    extensions: [extensionsAggregator],  // Tất cả extensions
    tools: registerAllBuiltinAndCustomTools(cwd),  // Tất cả tools
  };
}
```

## Lợi Ích

- ✅ **Một hàm duy nhất** - no more multiple imports
- ✅ **Copy-full-folder** - không cần chỉnh sửa gì
- ✅ **Tự động bao gồm** - extensions + built-in tools + custom tools
- ✅ **Plug & play** - import và dùng ngay

## Nếu Chỉ Muốn Tools

```typescript
import { registerAllBuiltinAndCustomTools } from './addon/tools/index.js';
const tools = registerAllBuiltinAndCustomTools(cwd);
```

## Nếu Chỉ Muốn Extensions

```typescript
import extensionsAggregator from './addon/extensions/index.js';
const extensions = [extensionsAggregator];
```

---

**Lưu ý:** Đảm bảo project đã cài `@earendil-works/pi-coding-agent`.
