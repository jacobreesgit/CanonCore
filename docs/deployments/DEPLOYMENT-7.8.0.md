# Deployment 7.8.0

**Date**: 2026-02-16
**Type**: Patch (CI fix, accessibility improvements, test stability)
**Migration Required**: No

## Overview

Maintenance release fixing Storybook CI failures caused by Playwright browser version mismatches in pnpm, two WCAG accessibility violations in mobile components, and an Embla Carousel initialisation race condition in a Storybook interaction test.

7 files changed, 25 insertions, 14 deletions.

## Fixes

### Storybook CI Playwright browser installation

`.github/workflows/storybook.yml` — The Storybook test-runner (`@storybook/test-runner@0.24.2`) depends on `playwright-core@1.57.0`, while `@playwright/test@1.58.2` depends on `playwright-core@1.58.2`. Each version expects a different Chromium revision. The CI step `npx playwright install --with-deps chromium` only installed browsers for the version resolved by `@playwright/test`, leaving the test-runner's `playwright-core@1.57.0` without a matching Chromium binary.

**Root cause:** pnpm hoists transitive dependencies into `node_modules/.pnpm/playwright-core@*/node_modules/playwright-core`. When two packages depend on different major or patch versions of `playwright-core`, each gets its own copy with its own expected browser revision.

**Fix:** After the standard install, iterate over all pnpm-hoisted `playwright-core` versions and install Chromium for each:

```yaml
- name: Install Playwright browsers
  run: |
    npx playwright install --with-deps chromium
    for pw in node_modules/.pnpm/playwright-core@*/node_modules/playwright-core; do
      node "$pw/cli.js" install chromium
    done
```

### Accessibility: scrollable-region-focusable

Two components had scrollable regions (`overflow-y-auto`) without keyboard accessibility, triggering axe `scrollable-region-focusable` violations in Storybook's a11y addon (configured with `test: "error"` in `preview.tsx`).

**`components/mobile/mobile-search-sheet.tsx`** — The search results container is scrollable but had no `tabIndex`. Added `tabIndex={0}` so keyboard users can scroll results without a mouse.

**`components/mobile/swipeable-tabs.tsx`** — The Select mode (>3 tabs) content wrapper is scrollable but had no `tabIndex`. Added `tabIndex={0}` for keyboard accessibility.

### Storybook test stability: SwipeableTabs TabClick

`components/mobile/swipeable-tabs.stories.tsx` — The `TabClick` interaction test failed intermittently because `emblaApi` was `null` when the test immediately clicked a non-active tab. Embla Carousel initialises asynchronously after mount, and `emblaApi?.scrollTo()` was a no-op while `emblaApi` was still `null`.

**Fix:** Click the already-active tab first (triggers a React render cycle and allows Embla to initialise), then click the target tab. Wrapped the assertion in `waitFor()` to handle the async carousel settle:

```typescript
play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  const detailsTab = canvas.getByRole("tab", { name: /details/i });
  await userEvent.click(detailsTab);
  const filesTab = canvas.getByRole("tab", { name: /files/i });
  await userEvent.click(filesTab);
  await waitFor(() => {
    expect(filesTab).toHaveAttribute("aria-selected", "true");
  });
},
```

## Cleanup

### knip.json stale dependency

Removed `@types/mdx` from `ignoreDependencies` in `knip.json`. This entry was stale — the package is no longer in the dependency tree.

### E2E formatting

Prettier formatting applied to `e2e/journeys/docs/docs-navigation.spec.ts` and `e2e/pages/explore.page.ts` (no logic changes).

## Deployment notes

### No migration required

No database schema changes.

### No new dependencies

No packages added or removed.

### No environment variable changes

No new variables required.

### Verification

1. **Build passes**: `pnpm run build`
2. **Type check passes**: `pnpm run type-check`
3. **Lint passes**: `pnpm run lint`
4. **Knip passes**: `pnpm run knip`
5. **Unit tests pass**: `pnpm run test` — 2,409 tests
6. **Integration tests pass**: `pnpm run test:integration` — 199 tests
7. **Storybook tests pass**: `pnpm run test-storybook` — 312 tests across 58 suites
8. **Format check passes**: `pnpm run format --check`
