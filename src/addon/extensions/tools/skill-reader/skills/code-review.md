# Code Review Skill

Use this skill to systematically review code for quality, security, and maintainability.

## When to Use
- Reviewing pull requests
- Self-review before commit
- Refactoring existing code
- Onboarding new team members
- Audit critical code

## Review Checklist

### ✅ Correctness
- Does the code solve the intended problem?
- Edge cases handled?
- Error conditions covered?
- Tests included and passing?
- No obvious bugs or logical errors?

### ✅ Security
- Input validation present?
- SQL injection/XSS vulnerabilities?
- Authentication/authorization checks?
- Secrets not hardcoded?
- Secure defaults?

### ✅ Performance
- Algorithms efficient (Big O)?
- Unnecessary loops or queries?
- Memory leaks potential?
- Caching appropriate?
- Database queries optimized?

### ✅ Maintainability
- Code readable and clear?
- Functions short and focused?
- Naming consistent and descriptive?
- Comments explain "why", not "what"?
- Duplication minimized?

### ✅ Best Practices
- Follows language conventions?
- Proper error handling (try/catch)?
- Logging appropriate?
- No dead code?
- Dependencies minimal and necessary?

## Review Process

1. **First pass**: Understand the change, run tests
2. **Line-by-line**: Check each change for issues
3. **Architecture**: Overall design sound?
4. **Run it**: Build and test locally if possible
5. **Summarize**: Provide constructive feedback

## Review Comments Template

```markdown
### ✅ Good
- [list positive aspects]

### ⚠️ Concerns
- [list issues with explanation]

### ❓ Questions
- [ask clarifying questions]

### 🔧 Suggestions
- [offer improvements]

### 🎯 Must-fix (blocking)
- [critical issues to address before merge]
```

## Example Review

User: "Here's a PR that adds user authentication"

Review:
1. Check password hashing (use bcrypt/scrypt)
2. Verify JWT secret management
3. Ensure rate limiting on login endpoint
4. Validate input sanitization
5. Test with SQL injection attempts
6. Check session timeout settings

## Common Pitfalls

- Focusing on style over substance (use linters for style)
- Being overly critical of minor issues
- Delaying reviews >24 hours
- Vague comments ("this is wrong") → be specific
- Not acknowledging good work
