# Security Audit

**Mục đích:** Audit code để tìm security vulnerabilities.

**Checklist:**

1. **Injection vulnerabilities:**
   - SQL injection
   - Command injection (os.system, exec)
   - XSS (innerHTML, eval)
   - LDAP injection
   - XML injection

2. **Authentication & Authorization:**
   - Hardcoded credentials
   - Weak password hashing (MD5, SHA1)
   - Missing authentication
   - Insecure direct object references
   - Missing authorization checks

3. **Sensitive data exposure:**
   - Logging secrets
   - Exposing PII in responses
   - Insecure storage (plain text passwords)
   - Missing encryption for sensitive data

4. **XXE (XML External Entity):**
   - Disabled entity expansion
   - External DTD processing

5. **Broken Access Control:**
   - CORS misconfiguration
   - Path traversal (../)
   - Insecure direct object references
   - Missing CSRF tokens

6. **Security misconfiguration:**
   - Debug mode in production
   - Default credentials
   - Verbose error messages
   - Unused features enabled

**Output format:**
```
## Security Audit Report

### Critical
1. [SQL Injection] Description...
   - Location: file.ts:15
   - Fix: Use parameterized queries

### High
...

### Medium
...

### Low
...
```
