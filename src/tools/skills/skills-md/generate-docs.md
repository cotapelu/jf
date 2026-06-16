# Generate Documentation

**Mục đích:** Thêm JSDoc/TSDoc comments vào code.

**Standard:** TSDoc (TypeScript) hoặc JSDoc (JavaScript)

**Yêu cầu:**

1. **Tất cả public APIs:**
   - Functions: @param, @returns, @throws (nếu có)
   - Classes: @class, @constructor, @property
   - Interfaces/Types: mô tả clear

2. **File-level documentation:**
   - Mô tả module purposes
   - Usage example (nếu cần)

3. **Format:**
```typescript
/**
 * Brief description (1 line)
 *
 * Detailed description (optional, multiple lines)
 *
 * @param paramName - Description
 * @returns Description of return value
 * @throws {ErrorType} When this error occurs
 */
export function example(param: string): number {
  // ...
}
```

4. **Include:**
   - Parameter types (from TypeScript)
   - Return type
   - Edge cases in @throws
   - Examples in code comments nếu phức tạp

**Output:** Code đã được decorated với JSDoc/TSDoc. Không thay đổi logic, chỉ thêm comments.

**Đừng quên:**
- Đừng bỏ qua private/internal functions nếu được yêu cầu
- Giữ nguyên formatting
- Không thêm unnecessary comments
