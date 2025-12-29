# Deployment 0.5.0: Unit and Integration Testing

This release adds Vitest-based unit and integration tests for auth logic.

## What changed

### Unit tests added (15 tests)

Tests for `lib/auth-actions.ts` and `lib/utils.ts` using mocked Prisma and email.

**auth-actions tests (8 tests):**

- `signUp` - creates user with hashed password, rejects duplicate emails
- `forgotPassword` - creates reset token, sends email, prevents enumeration
- `resetPassword` - validates token, handles expiry, updates password

**utils tests (7 tests):**

- `cn()` - merges classes, handles conditionals, Tailwind conflicts

### Integration tests added (3 tests)

Real database tests for sign-up flow using Neon PostgreSQL.

- Persists user to database
- Stores hashed password (not plaintext)
- Prevents duplicate email registration

### Test infrastructure

```
tests/
├── unit/
│   ├── lib/
│   │   ├── auth-actions.test.ts
│   │   └── utils.test.ts
│   ├── setup.ts              # Prisma + email mocks
│   └── vitest.config.ts
├── integration/
│   ├── auth/
│   │   └── sign-up.test.ts
│   ├── setup.ts              # DB cleanup, env loading
│   └── vitest.config.ts
└── vitest.config.ts          # Base config
```

### Other changes

- Added `.DS_Store` to `.gitignore`
- Added `skills/code-review-excellence/` skill
- Reorganized `skills/docs-write.md` to `skills/docs-write/SKILL.md`

## Run tests

```bash
pnpm run test:unit         # Unit tests (mocked, ~300ms)
pnpm run test:integration  # Integration tests (real DB, ~2s)
pnpm run test              # Default: unit tests
pnpm run test:coverage     # Unit tests with coverage
```

## Test coverage summary

| Test Type   | Count  | Speed    | Database |
| ----------- | ------ | -------- | -------- |
| Unit        | 15     | ~300ms   | Mocked   |
| Integration | 3      | ~2s      | Real     |
| E2E         | 34     | ~11s     | Real     |
| **Total**   | **52** | **~13s** |          |

## Dependencies added

- `vitest` ^4.0.16
- `@vitest/coverage-v8` ^4.0.16
- `dotenv` ^17.2.3 (already present, used for integration tests)

## No breaking changes

All existing functionality unchanged. Tests validate existing auth behavior.
