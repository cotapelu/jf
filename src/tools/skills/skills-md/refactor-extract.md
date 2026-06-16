# Refactor Extract

**Mục đích:** Tách một khối code thành hàm mới với parameters rõ ràng.

**Input:** Code block (start_line, end_line) hoặc toàn bộ function.

**Hướng dẫn:**

1. **Identify the block** to extract
2. **Analyze dependencies:**
   - Biến nào được read (trở thành parameters)
   - Biến nào được write (trở thành return value hoặc out params)
3. **Create new function:**
   - Tên rõ ràng (verb + noun)
   - Parameters đầy đủ với types
   - Return type chính xác
4. **Replace original block** with function call
5. **Check imports** - đảm bảo không breaking existing code

**Rules:**
- ✅ Preserve original logic 100%
- ✅ Keep original variable names (inside new function)
- ✅ Add proper TypeScript types
- ✅ Handle edge cases (null, undefined, errors)
- ❌ KHÔNG đổi behavior
- ❌ KHÔNG bỏ xử lý edge cases

**Output:**
```typescript
// New function
function newFunction(param1: Type1, param2: Type2): ReturnType {
  // extracted logic
}

// Modified original - replace block with:
const result = newFunction(arg1, arg2);
```
