# Performance Optimization

**Mục đích:** Tối ưu performance của code.

**Focus areas:**

1. **Algorithm complexity:**
   - Reduce O(n²) → O(n log n) hoặc O(n)
   - Avoid nested loops when possible
   - Use hash maps for lookups

2. **Memory usage:**
   - Avoid memory leaks (event listeners, intervals)
   - Use WeakMap/WeakSet khi cần
   - Dispose unused objects
   - Stream large data thay vì load all

3. **Database queries:**
   - N+1 query problems
   - Missing indexes
   - Select only needed columns
   - Use joins thay vì multiple queries

4. **Network:**
   - Batch requests
   - Cache responses
   - Use CDN cho static assets
   - Compression (gzip, brotli)

5. **Rendering (frontend):**
   - Virtual scrolling cho large lists
   - Debounce/throttle events
   - Lazy loading
   - Memoization (React.memo, useMemo)

**Output:**
- Refactored code với optimizations
- Explanation of changes
- Performance impact estimate

**Example transformation:**
```typescript
// Before: O(n²)
for (let i = 0; i < arr.length; i++) {
  for (let j = 0; j < arr.length; j++) {
    if (i !== j && arr[i] === arr[j]) ...
  }
}

// After: O(n)
const seen = new Set();
for (const item of arr) {
  if (seen.has(item)) ...
  seen.add(item);
}
```
