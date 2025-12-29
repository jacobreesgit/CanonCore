# Deployment 0.4.0: Mobile E2E Testing and Testing Strategy

This release adds mobile Chrome E2E testing and documents a unit/integration testing strategy.

## What changed

### Mobile Chrome E2E testing added

All 17 E2E tests now run on both desktop Chrome and mobile Chrome (iPhone 14 emulation). This doubles test coverage to 34 tests.

**Changes:**

- `e2e/playwright.config.ts` - added `mobile-chrome` project using `devices["iPhone 14"]`
- `e2e/pages/dashboard.page.ts` - handles collapsed sidebar on mobile viewport
- `components/site-header.tsx` - added `data-testid` to sidebar trigger for mobile navigation

**Run tests:**

```bash
pnpm run test:e2e                           # All tests (desktop + mobile)
pnpm run test:e2e --project=chromium        # Desktop only
pnpm run test:e2e --project=mobile-chrome   # Mobile only
```

### Unit and integration testing design

Added design document for Vitest-based unit and integration tests. Implementation pending.

See `docs/plans/2025-12-29-unit-integration-testing-design.md` for:

- Project structure (`tests/unit/`, `tests/integration/`)
- Vitest configuration
- Mocking strategy for unit tests
- Database cleanup for integration tests

## Test coverage summary

| Test Type   | Count  | Speed    |
| ----------- | ------ | -------- |
| E2E Desktop | 17     | ~5s      |
| E2E Mobile  | 17     | ~6s      |
| **Total**   | **34** | **~11s** |

## No breaking changes

All existing functionality unchanged. Mobile tests use the same test files as desktop.
