# Plugin Registry - Hàm Đăng Ký Tất Cả Plugins

## Mục Đích

Hàm `registerAllPlugins(cwd)` giúp bạn đăng ký **toàn bộ** plugins (built-in tools + custom tools) trong **một lời gọi duy nhất**.

## Cách Dùng

### 1. Copy các file sau sang project mới:

```
src/addon/plugin-registry.ts     # File chính (hàm duy nhất)
src/addon/tools/                 # Thư mục chứa tất cả tool definitions
```

### 2. Trong `main.ts` hoặc file tương tự:

```typescript
import { registerAllPlugins } from './plugin-registry.js';

// Trong hàm tạo runtime
const allBuiltinAndCustomTools = registerAllPlugins(cwd);
```

### 3. Truyền vào session options:

```typescript
const sessionOptions: CreateAgentSessionFromServicesOptions = {
  services,
  sessionManager,
  sessionStartEvent,
  customTools: allBuiltinAndCustomTools, // <- Dùng array này
};
```

## Định Nghĩa Hàm

Function `registerAllPlugins` thực chất là alias của `registerAllBuiltinAndCustomTools` từ `tools/index.ts`, đã tổng hợp:

- **Built-in tools**: read, bash, edit, write, find, grep, ls
- **Custom tools**: getTime, codebaseIndex, compactContext, skillTool, multiAgent, session

## Lợi Ích

- ✅ **Một hàm duy nhất**: Không cần import nhiều hàm
- ✅ **Dễ copy-paste**: Chỉ cần copy `plugin-registry.ts` và thư mục `tools/`
- ✅ **Dễ bảo trì**: Thêm/xóa tools tự động ở `tools/index.ts`

## Nếu Chỉ Muốn Custom Tools

```typescript
import { registerAllCustomTools } from './tools/index.js';
const customToolsOnly = registerAllCustomTools();
```

## Nếu Chỉ Muốn Built-in Tools

```typescript
import { registerAllBuiltinTools } from './tools/builtin-tools.js';
const builtinToolsOnly = registerAllBuiltinTools(cwd);
```

---

**Lưu ý**: Đảm bảo project của bạn đã cài `@earendil-works/pi-coding-agent` và các dependencies liên quan.
