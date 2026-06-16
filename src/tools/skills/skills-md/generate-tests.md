# Generate Tests

**Mục đích:** Tạo unit tests comprehensive cho code.

**Framework:** Jest hoặc Vitest (tự động detect từ package.json)

**Yêu cầu:**

1. **Coverage tất cả public APIs:**
   - Functions/classes exported
   - Mỗi function: ít nhất 3 test cases
   - Edge cases, error cases, boundary conditions

2. **Mock external dependencies:**
   - APIs, DB connections, file system
   - Sử dụng jest.mock() hoặc vi.fn()

3. **Test structure:**
```typescript
describe('FunctionName', () => {
  it('should handle normal input', () => {
    // Arrange
    // Act
    // Assert
  });

  it('should throw on invalid input', () => {
    // ...
  });

  it('should handle edge case', () => {
    // ...
  });
});
```

4. **Assertions:**
   - Kiểm tra return values
   - Kiểm tra mutations (nếu có)
   - Kiểm tra errors thrown
   - Kiểm tra async (async/await hoặc promises)

**Output:** Chỉ trả về code test file, không giải thích.

**Example:**
```typescript
import { sum } from './math';

describe('sum', () => {
  it('adds positive numbers', () => {
    expect(sum(1, 2)).toBe(3);
  });

  it('handles zero', () => {
    expect(sum(0, 5)).toBe(5);
  });

  it('handles negative numbers', () => {
    expect(sum(-1, -2)).toBe(-3);
  });
});
```
