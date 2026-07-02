# Refactor Skill

Use this skill to safely improve code structure without changing behavior.

## When to Refactor

**Good candidates:**
- Code smells (duplication, long functions, large classes)
- Complex conditional logic
- Poor naming
- Tight coupling
- Hard-to-test code

**Avoid refactoring when:**
- Under tight deadline (separate into task)
- No tests covering the code (write tests first!)
- Code is already stable and rarely touched
- Business logic is unclear (understand first)

## Refactoring Principles

### 1. Tests First
- Ensure comprehensive tests exist before refactoring
- Tests should cover current behavior
- If no tests, write them first (characterization tests)

### 2. Small Steps
- Make one change at a time
- Run tests after each change
- Commit frequently with clear messages
- Never break the build

### 3. Keep It Green
- Maintain 100% test pass rate
- Don't mix refactoring with feature changes
- If tests fail, revert immediately

## Common Refactorings

### Extract Function
```javascript
// Before
function processOrder(order) {
  // 20 lines of logic
  const total = calculateTotal(items);
  const tax = total * 0.08;
  // ...
}

// After
function processOrder(order) {
  const total = calculateTotal(order.items);
  const tax = computeTax(total);
  const shipping = calculateShipping(order);
  return createInvoice(order, total + tax + shipping);
}
```

### Rename
- Variables: `d` → `daysSinceLastLogin`
- Functions: `handle` → `handleUserAuthentication`
- Classes: `Mgr` → `UserManager`

### Remove Duplication
- Extract common code to shared function
- Use templates/generics
- Leverage inheritance or composition

### Simplify Conditionals
```javascript
// Before
if (status === 'active' || status === 'pending' || status === 'approved') {
  // ...
}

// After
const validStatuses = ['active', 'pending', 'approved'];
if (validStatuses.includes(status)) {
  // ...
}
```

## Refactoring Checklist

- [ ] Tests exist and pass before starting
- [ ] Changes are small and focused
- [ ] No behavior change (only structure)
- [ ] All tests still pass
- [ ] Code is more readable/maintainable
- [ ] No new dependencies added
- [ ] Performance not degraded
- [ ] Commit message describes refactoring clearly

##的危险信号 (Stop!)

- You're changing more than 200 lines at once
- Tests are failing and you're not sure why
- Other developers need help understanding your changes
- You're tired or rushed
- The refactor is taking longer than estimated (re-evaluate)

## Example Workflow

User: "This function is 50 lines long and hard to understand"

1. Confirm tests exist (if not, write characterization tests)
2. Identify logical sections in the function
3. Extract each section into well-named helper functions
4. Run tests after each extraction
5. Review: is main function now readable?
6. Update any call sites if signatures changed
