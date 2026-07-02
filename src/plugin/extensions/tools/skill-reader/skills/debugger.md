# Debugger Skill

Use this skill when you need to debug applications, trace execution, or diagnose errors.

## When to Use
- Application crashes or hangs
- Unexpected behavior or wrong outputs
- Performance bottlenecks
- Memory leaks
- Understanding complex code flow

## Guidelines

### 1. Reproduce the Issue
- Identify exact steps to reproduce
- Note error messages, stack traces, logs
- Determine if issue is consistent or intermittent

### 2. Gather Information
- Run with verbose logging
- Check system resources (CPU, memory, disk)
- Review recent changes (git diff, config changes)
- Examine dependencies and versions

### 3. Isolate the Problem
- Narrow down to smallest reproducible case
- Use binary search (comment out code, disable features)
- Check boundary conditions and edge cases

### 4. Use Appropriate Tools
- **Logging**: Add console.log, debug statements
- **Breakpoints**: Use debugger (node inspect, pdb, IDE)
- **Profilers**: CPU/memory profilers for performance
- **Network tools**: curl, Postman, Wireshark
- **System tools**: strace, dtruss, perf

### 5. Hypothesis & Test
- Form hypothesis about root cause
- Test hypothesis with controlled experiments
- Validate fix before proceeding

### 6. Document
- Record what was learned
- Update comments or documentation
- Share findings with team

## Common Commands

```bash
# Node.js debugging
node --inspect-brk app.js
node --trace-warnings app.js

# Python debugging
python -m pdb script.py
python -X faulthandler script.py

# System debugging
strace -p <pid>
lsof -p <pid>
ps aux | grep <process>
```

## Example Workflow

User: "My Node.js app crashes with 'Cannot read property x of undefined'"

1. Ask for stack trace and code context
2. Run with `--trace-warnings` to get more info
3. Add console.log before crash line to inspect object
4. Identify which variable is undefined
5. Check if property exists or if there's a timing issue
6. Fix: add null check or ensure property exists
