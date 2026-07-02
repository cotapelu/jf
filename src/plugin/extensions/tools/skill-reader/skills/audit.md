# Audit Skill

Use this skill to systematically audit code for quality, security, performance, and compliance issues.

## When to Use
- Pre-release security audit
- Performance bottleneck investigation
- Compliance checking (GDPR, HIPAA, PCI-DSS)
- Technical debt assessment
- Due diligence before acquisition
- Regular code health checks

## Audit Areas

### 🔒 Security Audit
- **Authentication & Authorization**: Proper auth mechanisms, least privilege
- **Input Validation**: All inputs validated, sanitized, type-checked
- **Secrets Management**: No hardcoded secrets, proper key rotation
- **Dependency Security**: No known vulnerabilities (check SCA tools)
- **Injection Risks**: SQL injection, XSS, command injection
- **Cryptography**: Use standard libraries, proper algorithms, sufficient key length
- **Session Management**: Secure cookies, session timeout, CSRF protection
- **Data Protection**: Encryption at rest and in transit, data masking

### ⚡ Performance Audit
- **Algorithm Efficiency**: Big O analysis, avoid O(n²) or worse
- **Database Queries**: N+1 problems, missing indexes, full table scans
- **Memory Usage**: Memory leaks, excessive allocations, GC pressure
- **I/O Operations**: Blocking I/O, too many file handles, network latency
- **Caching Strategy**: Appropriate cache levels, TTL settings, invalidation
- **Concurrency**: Race conditions, deadlocks, thread safety
- **Resource Cleanup**: Proper cleanup of resources (DB connections, file handles)

### 🏗️ Architecture & Design Audit
- **SOLID Principles**: Single responsibility, Open/Closed, Liskov, Interface Segregation, Dependency Inversion
- **Coupling & Cohesion**: Loose coupling, high cohesion
- **Modularity**: Clear module boundaries, minimal circular dependencies
- **Abstraction Layers**: Proper abstraction, no leaky abstractions
- **Design Patterns**: Appropriate use, not over-engineered
- **API Design**: RESTful conventions, versioning, error handling

### 📖 Code Quality Audit
- **Maintainability**: Readable code, meaningful names, consistent style
- **Complexity**: Cyclomatic complexity < 10, functions < 50 lines
- **Duplication**: DRY principle, extract common code
- **Technical Debt**: Quick fixes, workarounds, TODOs, FIXMEs
- **Documentation**: Inline comments for "why", not "what"; API docs
- **Testing**: Test coverage, meaningful assertions, test quality not just quantity

### 📊 Metrics & Measurements
- **Code Coverage**: Aim 80%+ but focus on critical paths
- **Technical Debt Ratio**: Debt / (Debt + Development effort)
- **Code Smells**: Number of code smells per KLOC
- **Duplication**: Percentage of duplicated code
- **Complexity**: Average cyclomatic complexity
- **Maintainability Index**: Composite score (0-100)

## Audit Process

### 1. Preparation
- Define audit scope (entire codebase, specific module, critical paths)
- Gather documentation (architecture diagrams, requirements, threat models)
- Identify tools to use (static analysis, dynamic analysis, manual review)

### 2. Static Analysis
- Run linters (ESLint, Pylint, RuboCop)
- Run security scanners (Snyk, OWASP Dependency Check, Bandit)
- Run code quality tools (SonarQube, CodeClimate)
- Review code metrics (complexity, duplication, coverage)

### 3. Dynamic Analysis
- Run application with profiling tools
- Perform load testing and identify bottlenecks
- Monitor resource usage (CPU, memory, disk, network)
- Check logs for errors, warnings, performance issues

### 4. Manual Review
- Read critical code sections
- Check for logic errors, edge cases, race conditions
- Review architectural decisions
- Verify compliance with standards

### 5. Findings Documentation
For each finding:
- **Severity**: Critical, High, Medium, Low, Info
- **Location**: File, line numbers, function
- **Description**: What is the issue?
- **Impact**: Security risk, performance degradation, maintenance burden
- **Recommendation**: How to fix
- **References**: CWE, OWASP, best practices links

### 6. Report Generation
Create audit report including:
- Executive summary
- Scope and methodology
- Findings by category (security, performance, quality)
- Risk assessment matrix
- Prioritized remediation plan
- Positive observations

## Audit Checklist Template

```
## Security
- [ ] No hardcoded credentials
- [ ] All user inputs validated
- [ ] SQL queries parameterized
- [ ] HTTPS enforced
- [ ] Authentication robust
- [ ] Authorization checks in place
- [ ] Secrets stored in vault

## Performance
- [ ] No O(n²) loops
- [ ] Database queries optimized
- [ ] Caching implemented appropriately
- [ ] No memory leaks
- [ ] FastAPI endpoints < 200ms p95

## Code Quality
- [ ] Code follows style guide
- [ ] Functions are small and focused
- [ ] No code duplication > 10 lines
- [ ] Meaningful variable/function names
- [ ] Error handling comprehensive

## Testing
- [ ] Unit tests cover critical paths
- [ ] Integration tests exist
- [ ] Test data is isolated
- [ ] CI runs tests on every commit
- [ ] Code coverage tracked

## Documentation
- [ ] README with setup instructions
- [ ] API documentation current
- [ ] Architecturally significant decisions documented
- [ ] Complex algorithms explained
```

## Example Audit

**Audit Scope**: User authentication module

**Findings**:
1. **CRITICAL**: Password stored in plaintext in logs (CWE-532)
2. **HIGH**: SQL injection vulnerability in login query (CWE-89)
3. **MEDIUM**: Session timeout set to 30 days (security best practice: < 24h)
4. **LOW**: Function `validateUser()` cyclomatic complexity = 15

**Recommendations**:
1. Remove password from logs immediately
2. Use parameterized queries or ORM
3. Reduce session timeout to 8 hours
4. Refactor `validateUser()` into smaller functions

## Tools Reference

- **Static Security**: Snyk, OWASP ZAP, Bandit (Python), ESLint security plugins
- **Dynamic Security**: Burp Suite, OWASP ZAP, nmap
- **Performance**: profilers (py-spy, node --prof), APM tools (New Relic, Datadog)
- **Code Quality**: SonarQube, CodeClimate, Codecov
- **Dependency**: npm audit, pip-audit, RubyBundler-audit

## Regulatory Compliance

Depending on industry, check:
- **GDPR**: Data minimization, user consent, right to delete
- **HIPAA**: PHI encryption, access controls, audit logs
- **PCI-DSS**: Card data encryption, network segmentation, logging
- **SOC2**: Security, availability, processing integrity
