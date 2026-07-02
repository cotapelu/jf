# Analyze Code

**Mục đích:** Phân tích code để tìm bugs, issues, improvements.

**Cách sử dụng:**
1. Người dùng cung cấp code (trong params)
2. LLM phân tích dựa trên hướng dẫn này

**Hướng dẫn chi tiết:**

- **Bugs & Potential Issues:**
  - Logic errors
  - Null/undefined dereferences
  - Incorrect conditionals
  - Off-by-one errors
  - Type mismatches

- **Performance Problems:**
  - O(n²) loops
  - Unnecessary re-renders
  - Memory leaks
  - Inefficient algorithms
  - Excessive API calls

- **Security Vulnerabilities:**
  - SQL injection
  - XSS
  - Command injection
  - Hardcoded secrets
  - Unsafe deserialization

- **Code Smells:**
  - Long functions (>20 lines)
  - Too many parameters
  - Duplicate code
  - God objects
  - Feature envy

- **Best Practice Violations:**
  - Naming conventions
  - Error handling
  - Accessibility
  - Consistency

**Output format:**
```
## Analysis Report

### Issues Found
1. [HIGH] Brief description
   - Location: line X
   - Fix: suggested solution

### Suggestions for Improvement
1. ...
```
