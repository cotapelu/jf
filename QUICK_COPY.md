# Copy & Paste Add-on - Quick Guide

## 🎯 Mục Đích

Copy **một lần**, dùng **ở mọi nơi**. Chỉ cần 1 hàm `registerAllAddon(cwd)`.

## 📦 Files Để Copy

```
src/addon/
├── index.ts               ← HÀM DUY NHẤT registerAllAddon()
├── main.simple.ts         ← Main đơn giản (copy thay thế main.ts)
├── extensions/            ← Tất cả extensions
├── tools/                 ← Tất cả tools
├── prompts/               ← Default prompts (nếu dùng)
├── runtime-context.ts     ← Context helpers
├── settings-config.ts     ← Settings config
└── ...                    ← Các file phụ trợ khác
```

## 🚀 Cách Dùng (3 Bước)

### Bước 1: Copy toàn bộ thư mục `src/addon/` sang project mới.

### Bước 2: Trong `main.ts` mới (hoặc dùng `main.simple.ts`):

```typescript
import { registerAllAddon } from './addon/index.js';

// Trong createRuntime factory:
const { extensions, tools } = registerAllAddon(cwd);

// Dùng:
resourceLoaderOptions.extensionFactories = extensions;
sessionOptions.customTools = tools;
```

### Bước 3: Build & run

```bash
npm run build
npm start
```

## 📄 File Main Template

Tôi đã tạo sẵn `main.simple.ts` - main.ts tối giản chỉ dùng 1 hàm.

```typescript
import { registerAllAddon } from './addon/index.js';
import { createAgentSessionRuntime, ... } from '@earendil-works/pi-coding-agent';

const createRuntime = async ({ cwd, agentDir, sessionManager, sessionStartEvent }) => {
  const { extensions, tools } = registerAllAddon(cwd); // ✅ 1 dòng

  const services = await createAgentSessionServices({
    cwd,
    agentDir,
    resourceLoaderOptions: {
      promptsOverride: () => ({ prompts: [defaultAssistantPrompt], diagnostics: [] }),
      extensionFactories: extensions,
    },
  });

  configureSettings(services.settingsManager);

  const result = await createAgentSessionFromServices({
    services,
    sessionManager,
    sessionStartEvent,
    customTools: tools,
  });

  return { session: result.session, services, diagnostics: services.diagnostics || [] };
};
```

## ✨ Lợi Ích

- ✅ **1 hàm duy nhất** - không cần import nhiều thứ
- ✅ **Copy-full-folder** - không chỉnh sửa, không config
- ✅ **Tự động bao gồm** - extensions + built-in tools + custom tools
- ✅ **Plug & play** - dùng ngay

## 🔧 Nếu Cần Tùy Chỉnh

- **Chỉ tools**: `import { registerAllBuiltinAndCustomTools } from './addon/tools/index.js'`
- **Chỉ extensions**: `import extensionsAggregator from './addon/extensions/index.js'`
- **Thêm prompts**: import từ `./addon/prompts/`
- **Tùy settings**: sửa `./addon/settings-config.ts`

---

**Lưu ý**: Đảm bảo `package.json` có `@earendil-works/pi-coding-agent`.
