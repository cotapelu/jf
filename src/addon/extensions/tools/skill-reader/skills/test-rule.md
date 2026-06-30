# Test Rule Skill

Use this skill to establish and enforce testing standards, quality gates, and test best practices.

## When to Use
- Setting up a new project's testing strategy
- Reviewing test suite quality and coverage
- Debugging failing tests or flaky tests
- Planning test automation improvements
- Onboarding new developers to testing practices
- Audit of testing practices

## Testing Principles

### ✅ Write Tests That:
- **Test behavior, not implementation**: Focus on what the code does, not how
- **Are independent**: No shared state between tests
- **Are repeatable**: Same result every run, no randomness without seed
- **Are fast**: Unit tests < 100ms, integration < 2s
- **Are readable**: Clear arrange-act-assert, descriptive names
- **Are maintainable**: Easy to update when code changes
- **Are trustworthy**: No false positives/negatives

### ❌ Avoid:
- Testing private methods (test through public API)
- Too many mocks (mock only external dependencies)
- Testing trivial getters/setters
- Brittle tests that break on refactoring
- Tests that depend on execution order
- Overly complex test setup

## Test Types & Pyramids

### 🏆 Test Pyramid (Ideal)
```
      /\
     /  \    Few
    /E2E \   Integration
   /______\
  /    |   \  Many
 /Unit |Unit \
/______|_____\
```

- **Unit Tests** (70%): Test single functions/classes in isolation
- **Integration Tests** (20%): Test interaction between components
- **End-to-End Tests** (10%): Test full user workflows through UI/API

### 🔄 Test Trophy (Modern)
```
   🏆 E2E
    / \
   /   \  Integration
  /     \
 /       \
Unit Tests
```

## Quality Gates

### Minimum Requirements
```
✓ Unit test coverage: ≥ 80% (critical paths ≥ 95%)
✓ Integration tests: All API endpoints covered
✓ E2E tests: All user journeys covered
✓ Static analysis passing (no errors)
✓ No test flakiness (flaky rate < 1%)
✓ Tests pass locally before commit
✓ CI runs full suite on PR
```

### Coverage Metrics
- **Line Coverage**: Percentage of executable lines run
- **Branch Coverage**: Percentage of decision branches taken
- **Path Coverage**: Percentage of possible execution paths
- **Mutation Coverage**: Percentage of mutants killed (best indicator)

**Warning thresholds**:
- Overall coverage < 70%: Needs improvement
- Critical module coverage < 90%: High risk
- New code coverage < 80%: Block merge

## Code Coverage Quality

Coverage alone is insufficient. Ensure:
- **Meaningful assertions**: Not just calling function and checking no error
- **Edge cases tested**: Empty inputs, nulls, boundaries, extremes
- **Error paths tested**: Exception handling, invalid states
- **Data variations**: Valid data with different values

**Anti-pattern**:
```javascript
test('adds two numbers', () => {
  expect(add(2, 3)).toBe(5); // Good ✅
  expect(add(0, 0)).toBe(0); // Edge case ✅
  expect(add(-1, 1)).toBe(0); // Edge case ✅
});

test('bad test', () => {
  add(1, 1);
  // No assertion - 100% coverage but tests nothing ❌
});
```

## Test Organization

### Structure by Feature (Preferred)
```
tests/
  ├── features/
  │   ├── authentication/
  │   │   ├── unit/
  │   │   │   ├── login.test.ts
  │   │   │   └── register.test.ts
  │   │   ├── integration/
  │   │   │   └── auth-flow.test.ts
  │   │   └── e2e/
  │   │       └── login-ui.test.ts
  │   └── payments/
  │       ├── unit/
  │       └── integration/
  └── shared/
      ├── fixtures/
      ├── helpers/
      └── mocks/
```

### Structure by Type (Alternative)
```
tests/
  ├── unit/
  │   ├── auth/
  │   │   ├── login.test.ts
  │   │   └── register.test.ts
  │   └── payments/
  ├── integration/
  │   └── api-endpoints.test.ts
  └── e2e/
      └── checkout-flow.test.ts
```

## AAA Pattern (Arrange-Act-Assert)

### Good Example
```typescript
describe('UserService.createUser', () => {
  it('creates user with valid data', async () => {
    // Arrange: Setup test data and mocks
    const userData = { email: 'test@example.com', name: 'Test' };
    const mockRepo = { save: jest.fn() };
    const service = new UserService(mockRepo as any);

    // Act: Execute the function under test
    const result = await service.createUser(userData);

    // Assert: Verify the outcome
    expect(result).toMatchObject({ id: expect.any(String), ...userData });
    expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining(userData));
  });
});
```

### Bad Example
```typescript
it('creates user', async () => {
  const repo = new UserRepository(); // Arranging and acting mixed
  const user = await service.create({ name: 'Bob' });
  if (user.id) {
    console.log('User created'); // Debug print in test
  }
  expect(user.name).toBe('Bob'); // Weak assertion
});
```

## Mocking Strategy

### Mock External Dependencies
- **Databases**: Use in-memory DB (SQLite) or mock repository
- **APIs**: Mock HTTP responses, use fixtures
- **File System**: Mock fs operations, use temp directories
- **Time**: Mock Date.now(), use fake timers

### Don't Mock:
- Your own domain logic
- Simple value objects
- Standard library functions (arr, obj methods)

### Mocking Libraries
- **Jest**: Built-in mocking (`jest.fn()`, `jest.mock()`)
- **Sinon**: Stubs, spies, mocks
- **Testdouble**: Friendly mocking syntax
- **MSW**: Mock Service Worker for API mocking

```typescript
// Good: Mock only external service
jest.mock('@external/sdk');
import { ExternalSDK } from '@external/sdk';

// Bad: Mock everything including internal logic
jest.mock('../src/utils/validation'); // Don't mock your own code
```

## Fixtures & Factories

### Use Fixtures for Test Data
```typescript
// fixtures/user.ts
export const userFixture = {
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  createdAt: new Date('2024-01-01'),
};

// fixtures/invalidUser.ts
export const invalidUserFixture = {
  email: 'not-an-email',
  name: '',
};

// In test
import { userFixture } from './fixtures/user';
expect(service.validate(userFixture)).toBe(true);
```

### Use Factories for Dynamic Data
```typescript
// factories/userFactory.ts
export function userFactory(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    email: `test-${Date.now()}@example.com`,
    name: 'Test User',
    createdAt: new Date(),
    ...overrides,
  };
}

// Generate unique users
const user1 = userFactory();
const user2 = userFactory({ name: 'Alice' });
```

## Flaky Tests

### Common Causes:
- **Timing issues**: async without proper await, race conditions
- **Shared state**: Tests modifying global/class state
- **External dependencies**: Network timeouts, API rate limits
- **Random data**: Non-deterministic test data
- **Date/time**: Tests that depend on current time
- **Order dependency**: Test A must run before test B

### Fixes:
```typescript
// ❌ Flaky: async without await
it('processes request', async () => {
  service.process(); // Fire-and-forget
  // test continues before process completes
});

// ✅ Fixed: await async operation
it('processes request', async () => {
  await service.process();
});

// ❌ Flaky: shared state
let counter = 0;
beforeEach(() => { counter = 0; }); // Not isolated

// ✅ Fixed: isolated state per test
it('increments counter', () => {
  const counter = new Counter();
  counter.increment();
  expect(counter.value).toBe(1);
});
```

## Integration Test Best Practices

1. **Use real database (temporary)**: SQLite in-memory or isolated test DB
2. **Clean up after tests**: Rollback transactions or drop test DB
3. **Seed with known data**: Start from clean, predictable state
4. **Test API contracts**: Status codes, headers, response format
5. **Test error scenarios**: 400, 404, 500 responses

```typescript
describe('User API', () => {
  let app: Express;
  let db: TestDatabase;

  beforeAll(async () => {
    db = await TestDatabase.create();
    app = createApp({ db });
  });

  afterAll(async () => {
    await db.close();
  });

  beforeEach(async () => {
    await db.seed(); // Clean state before each test
  });

  it('POST /users returns 201', async () => {
    const res = await request(app).post('/users').send({ email: 'a@b.c' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
  });
});
```

## Example Test Rules Configuration

```yaml
# .testrules.yml
rules:
  coverage:
    minimum: 85
    branches: 80
    severity: high
  complexity:
    maximum_cyclomatic: 10
    maximum_nesting: 4
  file_size:
    maximum_lines: 500
    maximum_functions: 20
  smells:
    - large_class
    - long_method
    - duplicate_code
  assertions:
    minimum_per_test: 2
  mocks:
    maximum_per_test: 5
  dependencies:
    maximum_depth: 3
exclusions:
  - "**/migrations/**"
  - "**/generated/**"
  - "**/*.d.ts"
```

## Running Tests with Quality Gates

```bash
# Run tests with coverage
npm test -- --coverage

# Enforce coverage thresholds
npx jest --coverage --coverageThreshold='{"global":{"branches":80,"functions":80,"lines":80,"statements":80}}'

# Run only changed files
npx jest --changedSince=main

# Run in CI (watch off)
CI=true npm test

# Run with specific reporter
npx jest --reporter=json --outputFile=test-results.json
```

## CI Integration Example (GitHub Actions)

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm ci
      - run: npm test -- --coverage --ci --reporters=default --reporters=html
      - uses: actions/upload-artifact@v3
        with:
          name: coverage-report
          path: coverage/
      - name: Check coverage
        run: |
          COVERAGE=$(cat coverage/coverage-summary.json | jq '.total.lines.pct')
          if (( $(echo "$COVERAGE < 80" | bc -l) )); then
            echo "Coverage $COVERAGE% < 80%"
            exit 1
          fi
```

## Test-Driven Development (TDD)

**Red → Green → Refactor**

1. **Red**: Write failing test for new feature
2. **Green**: Write minimal code to pass test
3. **Refactor**: Improve code while keeping tests green

```typescript
// 1. Red: Failing test
test('deposit adds amount to balance', () => {
  const account = new BankAccount(100);
  account.deposit(50);
  expect(account.balance).toBe(150); // Fails - deposit not implemented
});

// 2. Green: Minimal implementation
class BankAccount {
  balance = 0;
  deposit(amount) { this.balance += amount; }
}

// 3. Refactor: Improve implementation
class BankAccount {
  private _balance: number = 0;
  deposit(amount: number): void {
    if (amount <= 0) throw new Error('Invalid amount');
    this._balance += amount;
    this.logTransaction('deposit', amount);
  }
  // Tests still pass ✅
}
```

## Common Test Smells

| Smell | Problem | Fix |
|-------|---------|-----|
| `// TODO` in tests | Incomplete tests | Complete or remove |
| `console.log` in tests | Debugging artifacts | Remove |
| `Thread.sleep(1000)` | Timing dependency | Use proper async wait |
| `skip` or `xit` | Disabled tests | Investigate why disabled |
| `test.only` | Running single test | Remove before commit |
| `any` matchers (Jest) | Weak assertions | Use specific matchers |
| `mockReturnValue(undefined)` | Unclear expectations | Return meaningful data |
| `beforeEach` with heavy setup | Slow tests | Move to `beforeAll` or use factory |
| `it` name "works" or "test" | Non-descriptive | "should do X when Y" |
| `try/catch` without `fail()` | Silent failures | Use `expect.assertions()` |

## Mutation Testing

Better than coverage: inject bugs and check if tests catch them.

```bash
# Run mutation testing with Stryker
npx stryker run

# Example mutation: change === to !==
// Original:
if (status === 'SUCCESS') return true;
// Mutated to:
if (status !== 'SUCCESS') return true; // Bug introduced

// If tests still pass = weak test. If tests fail = mutation killed ✅
```

**Good mutation score**: > 80%

## Performance Testing

### Simple Benchmarking
```typescript
import { performance } from 'perf_hooks';

test('sort performance', () => {
  const data = Array.from({ length: 10000 }, () => Math.random());
  const start = performance.now();
  data.sort((a, b) => a - b);
  const duration = performance.now() - start;
  expect(duration).toBeLessThan(50); // ms
});
```

### Load Testing
- Use tools: k6, Artillery, Locust
- Test: concurrent users, sustained load, spike testing
- Metrics: throughput, latency, error rate

## Summary Checklist

- [ ] Tests follow AAA pattern
- [ ] Tests are independent and repeatable
- [ ] Unit tests fast (< 100ms)
- [ ] Coverage thresholds met
- [ ] No flaky tests
- [ ] Proper mocking (external only)
- [ ] Meaningful assertions (not just no errors)
- [ ] Edge cases covered
- [ ] Error paths tested
- [ ] Test data cleanup
- [ ] Descriptive test names
- [ ] No `any` types / weak matchers
- [ ] Fixtures/factories for test data
- [ ] CI runs all tests on every PR
- [ ] Test suite runs in reasonable time (< 10 min)
