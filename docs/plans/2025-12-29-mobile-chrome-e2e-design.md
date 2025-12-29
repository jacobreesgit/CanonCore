# Mobile Chrome E2E Testing Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Run all existing E2E tests on mobile Chrome (iPhone 14 emulation) alongside desktop Chrome.

**Architecture:** Add a single Playwright project to the existing config. No test or page object changes required.

**Tech Stack:** Playwright device emulation

---

## Configuration

Add one project to `e2e/playwright.config.ts`:

```typescript
projects: [
  { name: "setup", testMatch: /global\.setup\.ts/ },
  {
    name: "chromium",
    use: { ...devices["Desktop Chrome"] },
    dependencies: ["setup"],
  },
  {
    name: "mobile-chrome",
    use: { ...devices["iPhone 14"] },
    dependencies: ["setup"],
  },
  {
    name: "teardown",
    testMatch: /global\.teardown\.ts/,
    use: { ...devices["Desktop Chrome"] },
  },
],
```

Playwright's `devices["iPhone 14"]` preset includes:

- Viewport: 390x844
- User agent: Mobile Safari
- Touch events enabled
- `isMobile: true` flag

## Running Tests

Commands stay the same:

- `pnpm run test:e2e` - runs all tests on both desktop and mobile
- `pnpm run test:e2e --project=chromium` - desktop only
- `pnpm run test:e2e --project=mobile-chrome` - mobile only

## CI Impact

- Test count doubles (17 → 34 tests)
- Execution time roughly doubles
- No additional dependencies - Playwright handles mobile emulation natively

## Considerations

**Touch vs click:** Playwright automatically translates `.click()` to touch events on mobile - no code changes needed.

**Viewport-specific selectors:** If any page objects use selectors that only exist on desktop (like a sidebar that collapses to a hamburger menu), tests may fail. The current auth pages use simple centered forms that work on both viewports.

**No changes needed to:**

- Page objects
- Test files
- Fixtures
- Helpers

## Implementation

Single file change (~5 lines in `e2e/playwright.config.ts`).
