# Server Testing Plan

> Comprehensive testing strategy for Uncharted Lands server

---

## 🎯 Testing Goals

1. **High Coverage** - Target 80%+ code coverage
2. **Critical Path Testing** - Focus on API routes and business logic
3. **Regression Prevention** - Catch bugs before production
4. **Documentation** - Tests serve as usage examples
5. **Fast Feedback** - Quick test execution for development

---

## 📊 Current Test Coverage

### Existing Tests ✅
- ✅ **resource-calculator.test.ts** - Production calculations
- ✅ **resource-generator.test.ts** - Resource generation
- ✅ **storage-calculator.test.ts** - Storage capacity
- ✅ **consumption-calculator.test.ts** - Resource consumption

### Coverage Status
```
Game Logic:        ~80% ✅
API Routes:         0% ❌
Middleware:         0% ❌
Database Queries:   0% ❌
Event Handlers:     0% ❌
Utilities:          0% ❌
```

---

## 🧪 Test Categories

### 1. Unit Tests (Priority 1) 🔴

**API Routes** - Individual endpoint testing
- ✅ Auth routes (register, login, logout)
- ✅ Account routes (GET /me)
- ✅ Server routes (CRUD operations)
- ✅ World routes (CRUD operations)
- ✅ Geography routes (regions, tiles, plots, map)
- ✅ Settlement routes (create, list, get)
- ✅ Player routes (admin management)
- ✅ Admin routes (dashboard)

**Middleware**
- ✅ authenticate() - User authentication
- ✅ authenticateAdmin() - Admin authentication
- ✅ optionalAuth() - Optional authentication
- ✅ Rate limiting

**Database Queries**
- Query helpers in `db/queries.ts`
- Complex joins and relations
- Transaction handling

**Utilities**
- Error handling
- Validation functions
- Helper utilities

### 2. Integration Tests (Priority 2) 🟡

**API Flow Testing**
- Full request → response cycles
- Multi-step operations (e.g., create server → create world → create settlement)
- Authentication flows
- Error handling across layers

**Database Integration**
- Real database queries (test DB)
- Transaction rollbacks
- Cascade deletions
- Index performance

### 3. End-to-End Tests (Priority 3) 🟢

**Complete User Flows**
- User registration → login → create settlement → view map
- Admin: create server → create world → manage players
- Settlement creation with plot finding algorithm
- Resource generation over time

**Socket.IO Events**
- Connection/disconnection
- Game actions
- State synchronization
- Real-time updates

---

## 📁 Test File Organization

```
server/src/
├── __tests__/
│   ├── helpers/
│   │   ├── test-utils.ts          ✅ Test utilities
│   │   ├── mock-db.ts             🔄 Database mocks
│   │   └── fixtures.ts            🔄 Test data fixtures
│   │
│   ├── unit/
│   │   ├── api/
│   │   │   ├── auth.test.ts       🔄 Auth endpoints
│   │   │   ├── account.test.ts    🔄 Account endpoints
│   │   │   ├── servers.test.ts    🔄 Server CRUD
│   │   │   ├── worlds.test.ts     🔄 World CRUD
│   │   │   ├── geography.test.ts  🔄 Geography endpoints
│   │   │   ├── settlements.test.ts 🔄 Settlement creation
│   │   │   ├── players.test.ts    🔄 Player management
│   │   │   └── admin.test.ts      🔄 Admin dashboard
│   │   │
│   │   ├── middleware/
│   │   │   ├── auth.test.ts       🔄 Auth middleware
│   │   │   └── rateLimit.test.ts  🔄 Rate limiting
│   │   │
│   │   └── db/
│   │       └── queries.test.ts    🔄 Query helpers
│   │
│   ├── integration/
│   │   ├── settlement-flow.test.ts 📝 Full settlement creation
│   │   ├── map-loading.test.ts     📝 Map data loading
│   │   └── admin-flow.test.ts      📝 Admin operations
│   │
│   └── e2e/
│       ├── user-journey.test.ts    📝 Complete user flow
│       └── gameplay.test.ts        📝 Game mechanics
│
├── api/
│   └── routes/
│       └── *.ts (no changes - tests separate)
│
└── game/
    ├── resource-calculator.test.ts  ✅ Existing
    ├── resource-generator.test.ts   ✅ Existing
    ├── storage-calculator.test.ts   ✅ Existing
    └── consumption-calculator.test.ts ✅ Existing
```

Legend:
- ✅ Complete
- 🔄 In Progress
- 📝 Planned

---

## 🎯 Phase 1: Critical API Routes (Current)

### Priority Order

1. **Authentication** (Highest Priority)
   - User registration
   - Login/logout
   - Session management
   - Password hashing

2. **Settlement Creation** (High Priority)
   - POST /api/settlements
   - Plot finding algorithm
   - Profile creation
   - Storage initialization

3. **Geography** (High Priority)
   - GET /api/map (player map loading)
   - GET /api/regions (with filtering)
   - Region/tile/plot queries

4. **Account Management** (Medium Priority)
   - GET /api/account/me
   - Profile lookup

5. **Server/World CRUD** (Medium Priority)
   - All CRUD operations
   - Admin-only access
   - Cascade deletions

6. **Player Management** (Low Priority)
   - Admin player management
   - Role changes
   - Player deletion

---

## 🧰 Testing Tools & Configuration

### Vitest Configuration
```typescript
// vitest.config.ts
{
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/index.ts',
        'src/db/seed.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
}
```

### Test Commands
```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# UI mode
npm run test:ui

# Run specific test file
npm test auth.test.ts

# Run tests matching pattern
npm test -- settlement
```

---

## 📝 Test Writing Guidelines

### 1. Test Structure
```typescript
describe('Feature/Component Name', () => {
  describe('Method/Function Name', () => {
    it('should do expected behavior', () => {
      // Arrange
      const input = setupTestData();
      
      // Act
      const result = functionUnderTest(input);
      
      // Assert
      expect(result).toBe(expectedOutput);
    });
  });
});
```

### 2. Naming Conventions
- Test files: `*.test.ts` or `*.spec.ts`
- Describe blocks: Feature/Component name
- It blocks: "should [expected behavior]"
- Mock functions: `mock[FunctionName]`

### 3. Best Practices
- ✅ Test behavior, not implementation
- ✅ One assertion concept per test
- ✅ Use descriptive test names
- ✅ Arrange-Act-Assert pattern
- ✅ Clean up after tests (if needed)
- ✅ Mock external dependencies
- ✅ Test edge cases and errors
- ❌ Don't test external libraries
- ❌ Don't test private methods directly

### 4. Mock Strategy
- **API Routes**: Mock database queries
- **Middleware**: Mock request/response
- **Integration**: Use test database
- **E2E**: Use real services

---

## 🎯 Coverage Targets

### Minimum Thresholds
- **Lines**: 80%
- **Functions**: 80%
- **Branches**: 80%
- **Statements**: 80%

### Priority Coverage
1. **API Routes**: 95%+ (critical path)
2. **Middleware**: 90%+ (security critical)
3. **Game Logic**: 85%+ (already good)
4. **Database Queries**: 80%+
5. **Utilities**: 75%+

---

## 🚀 Test Execution Plan

### Phase 1: API Routes (Week 1)
- [ ] Day 1: Auth routes + middleware
- [ ] Day 2: Settlement creation + tests
- [ ] Day 3: Geography routes (map, regions)
- [ ] Day 4: Account + Server/World CRUD
- [ ] Day 5: Player management + Admin

### Phase 2: Integration (Week 2)
- [ ] Day 1-2: Settlement creation flow
- [ ] Day 3: Map loading flow
- [ ] Day 4: Admin operations flow
- [ ] Day 5: Error handling scenarios

### Phase 3: E2E & Polish (Week 3)
- [ ] Day 1-2: User journey tests
- [ ] Day 3: Socket.IO event tests
- [ ] Day 4: Performance tests
- [ ] Day 5: Coverage improvements

---

## 📈 Success Metrics

### Quantitative
- ✅ 80%+ overall code coverage
- ✅ 95%+ API route coverage
- ✅ 0 failing tests in CI/CD
- ✅ <5s total test execution time

### Qualitative
- ✅ Tests serve as documentation
- ✅ Easy to add new tests
- ✅ Fast feedback loop
- ✅ Confidence in deployments
- ✅ Regression prevention

---

## 🔧 Continuous Integration

### GitHub Actions Workflow
```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v3
```

---

## 📚 Testing Resources

### Documentation
- [Vitest Docs](https://vitest.dev/)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [API Testing Guide](https://testingjavascript.com/)

### Tools
- **Vitest** - Test runner
- **@vitest/ui** - Visual test interface
- **@vitest/coverage-v8** - Coverage reporting
- **supertest** - HTTP assertions (optional)
- **msw** - API mocking (optional)

---

## ✅ Progress Tracking

### Current Status
- [x] Test infrastructure setup
- [x] Test utilities created
- [x] Game logic tests (existing)
- [ ] API route tests (in progress)
- [ ] Middleware tests
- [ ] Integration tests
- [ ] E2E tests
- [ ] CI/CD integration

### Next Steps
1. Complete API route tests (auth, settlements, geography)
2. Add middleware tests
3. Create integration test suite
4. Set up CI/CD pipeline
5. Achieve 80%+ coverage target

---

**Last Updated:** November 8, 2025  
**Status:** Phase 1 - API Route Testing In Progress  
**Coverage Goal:** 80%+ (Current: ~40%)
