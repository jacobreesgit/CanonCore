# Comprehensive Codebase Audit Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Audit the entire canoncore-v2 codebase against all 47 react-best-practices rules and all 90 web-design-guidelines rules.

**Architecture:** Systematic file-by-file review organized by rule category. Each rule is applied to all relevant files, findings documented, and fixes implemented immediately.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui

---

## Audit Scope

### Files to Audit

| Category              | Count | Files                                   |
| --------------------- | ----- | --------------------------------------- |
| **App Pages**         | 12    | `app/**/page.tsx`, `app/**/layout.tsx`  |
| **App API Routes**    | 7     | `app/api/**/route.ts`                   |
| **Client Components** | 4     | `app/**/*-client.tsx`                   |
| **Custom Components** | 59    | `components/**/*.tsx` (excluding `ui/`) |
| **Hooks**             | 12    | `hooks/*.ts`                            |
| **Server Actions**    | 9     | `lib/*-actions.ts`                      |
| **Lib Utilities**     | 28    | `lib/*.ts` (non-actions)                |
| **Contexts**          | 1     | `contexts/*.tsx`                        |

**Excluded:** `components/ui/*` (shadcn generated code)

### Rules to Apply

| Skill                     | Rules | Priority                      |
| ------------------------- | ----- | ----------------------------- |
| **react-best-practices**  | 47    | Critical → Low                |
| **web-design-guidelines** | 90    | Accessibility → Anti-patterns |

---

## Phase 1: React Best Practices (47 Rules)

### Task 1.1: Eliminating Waterfalls (CRITICAL) - 5 Rules

**Rules:**

1. `async-defer-await` - Move await into branches where actually used
2. `async-parallel` - Use Promise.all() for independent operations
3. `async-dependencies` - Use better-all for partial dependencies
4. `async-api-routes` - Start promises early, await late in API routes
5. `async-suspense-boundaries` - Use Suspense to stream content

**Files to Audit:**

```
app/api/fork/[itemId]/route.ts
app/api/artwork/[fileId]/route.ts
app/api/auth/[...nextauth]/route.ts
app/api/auth/callback/google-drive/route.ts
app/api/stream/[fileId]/route.ts
app/api/user/avatar/route.ts
app/api/user/hero/route.ts
app/api/username/check/route.ts
lib/auth-actions.ts
lib/item-actions.ts
lib/fork-actions.ts
lib/user-actions.ts
lib/tmdb-actions.ts
lib/google-drive-actions.ts
lib/google-drive-sync.ts
lib/google-drive-upload.ts
lib/item-file-actions.ts
lib/queue-aware-actions.ts
lib/sync-log.ts
app/(my-items)/my-items/page.tsx
app/(my-items)/my-items/[itemId]/page.tsx
app/(public)/u/[username]/page.tsx
app/(public)/u/[username]/[itemId]/page.tsx
app/(public)/explore/page.tsx
```

**Step 1:** Read rule `skills/react-best-practices/rules/async-defer-await.md`

**Step 2:** For each file, check for:

- `await` statements that could be deferred
- Sequential awaits that could be parallel
- Promises started late in the function

**Step 3:** Document findings in format:

```
FILE:LINE - RULE - FINDING - FIX
```

**Step 4:** Implement fixes

**Step 5:** Run `pnpm run check` to verify no regressions

**Step 6:** Commit: `fix: apply async-* waterfall rules`

---

### Task 1.2: Bundle Size Optimization (CRITICAL) - 5 Rules

**Rules:**

1. `bundle-barrel-imports` - Import directly, avoid barrel files
2. `bundle-dynamic-imports` - Use next/dynamic for heavy components
3. `bundle-defer-third-party` - Load analytics/logging after hydration
4. `bundle-conditional` - Load modules only when feature is activated
5. `bundle-preload` - Preload on hover/focus for perceived speed

**Files to Audit:**

```
components/items/items-view.tsx
components/items/item-settings-dialog.tsx
components/items/add-item-dialog.tsx
components/items/item-hero.tsx
components/items/media-search-combobox.tsx
components/items/image-selection-grid.tsx
components/items/fork-destination-dialog.tsx
components/media/media-player.tsx
components/media/media-overlay.tsx
components/sortable-tree/SortableTree.tsx
components/sortable-grid/SortableGrid.tsx
components/search/spotlight-search.tsx
components/google-drive/settings-section.tsx
components/google-drive/sync-history.tsx
components/profile/settings-dialog.tsx
components/app-sidebar.tsx
app/layout.tsx
app/(my-items)/layout.tsx
app/(public)/layout.tsx
```

**Step 1:** Read each bundle-\* rule file

**Step 2:** Check for:

- Barrel imports (`import { X, Y, Z } from '@/components'`)
- Heavy components not dynamically imported (media player, charts, modals)
- Third-party scripts loaded synchronously
- Features loaded before needed

**Step 3:** Document findings

**Step 4:** Implement fixes using `next/dynamic`:

```tsx
const HeavyComponent = dynamic(() => import("./HeavyComponent"), {
  loading: () => <Skeleton />,
});
```

**Step 5:** Run `pnpm run check`

**Step 6:** Commit: `fix: apply bundle-* optimization rules`

---

### Task 1.3: Server-Side Performance (HIGH) - 5 Rules

**Rules:**

1. `server-cache-react` - Use React.cache() for per-request deduplication
2. `server-cache-lru` - Use LRU cache for cross-request caching
3. `server-serialization` - Minimize data passed to client components
4. `server-parallel-fetching` - Restructure components to parallelize fetches
5. `server-after-nonblocking` - Use after() for non-blocking operations

**Files to Audit:**

```
app/(my-items)/my-items/page.tsx
app/(my-items)/my-items/[itemId]/page.tsx
app/(public)/u/[username]/page.tsx
app/(public)/u/[username]/[itemId]/page.tsx
app/(public)/explore/page.tsx
app/(docs)/docs/[[...slug]]/page.tsx
lib/auth.ts
lib/public-auth.ts
lib/item-actions.ts
lib/tmdb-client.ts
lib/google-drive-client.ts
```

**Step 1:** Read each server-\* rule file

**Step 2:** Check for:

- Duplicate data fetching that could use React.cache()
- Expensive operations that could benefit from LRU caching
- Large objects passed to client components
- Sequential fetches in server components

**Step 3:** Document findings

**Step 4:** Implement fixes

**Step 5:** Run `pnpm run check`

**Step 6:** Commit: `fix: apply server-* performance rules`

---

### Task 1.4: Client-Side Data Fetching (MEDIUM-HIGH) - 4 Rules

**Rules:**

1. `client-swr-dedup` - Use SWR for automatic request deduplication
2. `client-event-listeners` - Deduplicate global event listeners
3. `client-localstorage-schema` - Validate localStorage data with schema
4. `client-passive-event-listeners` - Use passive event listeners for scroll/touch

**Files to Audit:**

```
hooks/use-artwork-upload.ts
hooks/use-username-validation.ts
hooks/use-hero-collapse.ts
hooks/use-go-to-item.ts
hooks/use-online-status.ts
hooks/use-items-sort-filter.ts
hooks/use-lazy-image.ts
hooks/use-mobile.ts
hooks/use-image-loaded.ts
hooks/use-bulk-selection.ts
hooks/use-controllable-state.ts
hooks/use-tree-collapse.ts
components/items/items-view.tsx
components/items/item-detail-client.tsx
components/search/spotlight-search.tsx
app/(public)/u/[username]/public-profile-client.tsx
app/(public)/u/[username]/[itemId]/public-item-client.tsx
app/(public)/explore/explore-client.tsx
contexts/spotlight-context.tsx
lib/sync-queue.ts
```

**Step 1:** Read each client-\* rule file

**Step 2:** Check for:

- Fetching patterns that could use SWR
- Duplicate event listener registrations
- localStorage reads without validation
- Non-passive scroll/touch listeners

**Step 3:** Document findings

**Step 4:** Implement fixes

**Step 5:** Run `pnpm run check`

**Step 6:** Commit: `fix: apply client-* data fetching rules`

---

### Task 1.5: Re-render Optimization (MEDIUM) - 7 Rules

**Rules:**

1. `rerender-defer-reads` - Don't subscribe to state only used in callbacks
2. `rerender-memo` - Extract expensive work into memoized components
3. `rerender-dependencies` - Use primitive dependencies in effects
4. `rerender-derived-state` - Subscribe to derived booleans, not raw values
5. `rerender-functional-setstate` - Use functional setState for stable callbacks
6. `rerender-lazy-state-init` - Pass function to useState for expensive values
7. `rerender-transitions` - Use startTransition for non-urgent updates

**Files to Audit:**

ALL 59 custom components in `components/` (excluding `ui/`)

**Step 1:** Read each rerender-\* rule file

**Step 2:** For each component, check for:

- State subscriptions that cause unnecessary re-renders
- Missing useMemo/useCallback where expensive
- Object/array dependencies in useEffect
- Raw state subscriptions instead of derived booleans
- Non-functional setState in callbacks
- Expensive initial state calculations
- Missing startTransition for non-urgent updates

**Step 3:** Document findings

**Step 4:** Implement fixes

**Step 5:** Run `pnpm run check`

**Step 6:** Commit: `fix: apply rerender-* optimization rules`

---

### Task 1.6: Rendering Performance (MEDIUM) - 7 Rules

**Rules:**

1. `rendering-animate-svg-wrapper` - Animate div wrapper, not SVG element
2. `rendering-content-visibility` - Use content-visibility for long lists
3. `rendering-hoist-jsx` - Extract static JSX outside components
4. `rendering-svg-precision` - Reduce SVG coordinate precision
5. `rendering-hydration-no-flicker` - Use inline script for client-only data
6. `rendering-activity` - Use Activity component for show/hide
7. `rendering-conditional-render` - Use ternary, not && for conditionals

**Files to Audit:**

```
components/items/items-view.tsx
components/items/image-selection-grid.tsx
components/sortable-tree/Tree.tsx
components/sortable-tree/SortableTree.tsx
components/sortable-grid/Grid.tsx
components/sortable-grid/SortableGrid.tsx
components/search/spotlight-search.tsx
components/nav-pinned-items.tsx
components/nav-main.tsx
components/google-drive/sync-history.tsx
components/items/fork-destination-dialog.tsx
components/theme-toggle.tsx (if has SVG)
All files with conditional rendering
```

**Step 1:** Read each rendering-\* rule file

**Step 2:** Check for:

- SVG animations (should animate wrapper div)
- Long lists without content-visibility
- Static JSX defined inside components
- High-precision SVG coordinates
- Client-only data causing hydration flicker
- Show/hide patterns that could use Activity
- `&&` conditionals that could render `0` or `""`

**Step 3:** Document findings

**Step 4:** Implement fixes

**Step 5:** Run `pnpm run check`

**Step 6:** Commit: `fix: apply rendering-* performance rules`

---

### Task 1.7: JavaScript Performance (LOW-MEDIUM) - 12 Rules

**Rules:**

1. `js-batch-dom-css` - Group CSS changes via classes or cssText
2. `js-index-maps` - Build Map for repeated lookups
3. `js-cache-property-access` - Cache object properties in loops
4. `js-cache-function-results` - Cache function results in module-level Map
5. `js-cache-storage` - Cache localStorage/sessionStorage reads
6. `js-combine-iterations` - Combine multiple filter/map into one loop
7. `js-length-check-first` - Check array length before expensive comparison
8. `js-early-exit` - Return early from functions
9. `js-hoist-regexp` - Hoist RegExp creation outside loops
10. `js-min-max-loop` - Use loop for min/max instead of sort
11. `js-set-map-lookups` - Use Set/Map for O(1) lookups
12. `js-tosorted-immutable` - Use toSorted() for immutability

**Files to Audit:**

```
lib/item-utils.ts
lib/progress-utils.ts
lib/file-type-utils.ts
lib/sync-utils.ts
lib/upload-utils.ts
lib/validations.ts
lib/crypto.ts
lib/google-drive-batch.ts
lib/google-drive-sync.ts
lib/tmdb-client.ts
hooks/use-items-sort-filter.ts
components/sortable-tree/utilities.ts
components/items/items-view.tsx
components/search/spotlight-search.tsx
```

**Step 1:** Read each js-\* rule file

**Step 2:** Check for:

- Multiple DOM/CSS changes in sequence
- Array.find() in loops (should use Map)
- Property access in tight loops
- Expensive function calls without caching
- Multiple localStorage reads for same key
- Chained filter().map().filter() patterns
- Missing early returns
- RegExp created inside loops
- Array sort for min/max
- Array.includes() for O(n) lookups

**Step 3:** Document findings

**Step 4:** Implement fixes

**Step 5:** Run `pnpm run check`

**Step 6:** Commit: `fix: apply js-* performance rules`

---

### Task 1.8: Advanced Patterns (LOW) - 2 Rules

**Rules:**

1. `advanced-event-handler-refs` - Store event handlers in refs
2. `advanced-use-latest` - useLatest for stable callback refs

**Files to Audit:**

```
hooks/use-hero-collapse.ts
hooks/use-lazy-image.ts
hooks/use-online-status.ts
hooks/use-tree-collapse.ts
components/sortable-tree/SortableTree.tsx
components/sortable-grid/SortableGrid.tsx
components/items/items-view.tsx
components/media/media-player.tsx
components/search/spotlight-search.tsx
contexts/spotlight-context.tsx
```

**Step 1:** Read each advanced-\* rule file

**Step 2:** Check for:

- Event handlers that cause re-renders
- Callbacks that need stable references

**Step 3:** Document findings

**Step 4:** Implement fixes if beneficial

**Step 5:** Run `pnpm run check`

**Step 6:** Commit: `fix: apply advanced-* pattern rules`

---

## Phase 2: Web Design Guidelines (90 Rules)

### Task 2.1: Accessibility (10 Rules)

**Rules:**

1. Icon-only buttons need `aria-label`
2. Form controls need `<label>` or `aria-label`
3. Interactive elements need keyboard handlers
4. Use `<button>` for actions, `<a>`/`<Link>` for navigation
5. Images need `alt` text
6. Decorative icons need `aria-hidden="true"`
7. Async updates need `aria-live="polite"`
8. Prefer semantic HTML over ARIA
9. Headings hierarchical with skip link
10. Heading anchors need `scroll-margin-top`

**Files to Audit:**

ALL interactive components:

```
components/items/items-toolbar.tsx
components/items/bulk-actions-toolbar.tsx
components/items/edit-mode-toggle.tsx
components/items/view-toggle.tsx
components/items/sort-dropdown.tsx
components/items/filter-dropdown.tsx
components/items/visibility-toggle.tsx
components/items/item-context-menu.tsx
components/items/add-item-dialog.tsx
components/items/item-settings-dialog.tsx
components/items/fork-destination-dialog.tsx
components/items/media-search-combobox.tsx
components/items/file-type-combobox.tsx
components/items/mobile-options-sheet.tsx
components/search/spotlight-search.tsx
components/nav-user.tsx
components/nav-main.tsx
components/nav-pinned-items.tsx
components/nav-guest.tsx
components/theme-toggle.tsx
components/profile/settings-dialog.tsx
components/google-drive/settings-section.tsx
components/media/media-player.tsx
components/media/media-overlay.tsx
```

**Step 1:** Fetch guidelines from source URL

**Step 2:** For each component:

- Check icon buttons for aria-label
- Check form controls for labels
- Check interactive elements for keyboard handlers
- Verify semantic element usage
- Check images for alt text
- Check decorative icons for aria-hidden

**Step 3:** Document findings in format:

```
FILE:LINE - RULE - FINDING
```

**Step 4:** Implement fixes

**Step 5:** Run `pnpm run check`

**Step 6:** Commit: `fix: accessibility improvements`

---

### Task 2.2: Focus States (4 Rules)

**Rules:**

1. Interactive elements need visible focus states
2. Never remove outline without focus replacement
3. Use `:focus-visible` over `:focus`
4. Group focus with `:focus-within`

**Files to Audit:**

```
app/globals.css
components/ui/*.tsx (check focus styles)
All interactive components from Task 2.1
```

**Step 1:** Check global CSS for focus styles

**Step 2:** Check each interactive component for:

- Visible focus indicators
- Proper use of focus-visible
- focus-within for grouped elements

**Step 3:** Document findings

**Step 4:** Implement fixes

**Step 5:** Run `pnpm run check`

**Step 6:** Commit: `fix: focus state improvements`

---

### Task 2.3: Forms (11 Rules)

**Rules:**

1. Inputs need `autocomplete` and `name`
2. Use correct input `type` and `inputmode`
3. Never block paste functionality
4. Labels must be clickable
5. Disable spellcheck on emails/codes/usernames
6. Checkboxes/radios share single hit target
7. Submit button stays enabled until request starts
8. Errors inline next to fields
9. Placeholders end with `…` and show pattern
10. Use `autocomplete="off"` strategically
11. Warn before navigation with unsaved changes

**Files to Audit:**

```
app/(auth)/sign-in/page.tsx
app/(auth)/sign-up/page.tsx
app/(auth)/forgot-password/page.tsx
app/(auth)/reset-password/page.tsx
components/items/add-item-dialog.tsx
components/items/item-settings-dialog.tsx
components/items/title-description-step.tsx
components/items/media-search-combobox.tsx
components/profile/settings-dialog.tsx
components/profile/preferences-tab.tsx
components/search/spotlight-search.tsx
components/ui/input.tsx
components/ui/textarea.tsx
components/ui/password-input.tsx
components/ui/checkbox.tsx
components/ui/radio-group.tsx
components/ui/select.tsx
```

**Step 1:** Check each form component for all 11 rules

**Step 2:** Document findings

**Step 3:** Implement fixes

**Step 4:** Run `pnpm run check`

**Step 5:** Commit: `fix: form improvements`

---

### Task 2.4: Animation (6 Rules)

**Rules:**

1. Honor `prefers-reduced-motion`
2. Animate only `transform`/`opacity`
3. Never use `transition: all`
4. Set correct `transform-origin`
5. SVG transforms on `<g>` wrapper
6. Animations must be interruptible

**Files to Audit:**

```
app/globals.css
components/ui/animated-dialog-content.tsx
components/items/item-hero.tsx
components/sortable-tree/SortableTree.tsx
components/sortable-grid/SortableGrid.tsx
components/media/media-overlay.tsx
components/shader1.tsx
All components with animations/transitions
```

**Step 1:** Search for animation/transition usage:

```bash
grep -r "transition" components/ --include="*.tsx"
grep -r "animate" components/ --include="*.tsx"
```

**Step 2:** Check each for:

- prefers-reduced-motion media query
- Animating only transform/opacity
- No `transition: all`
- Proper transform-origin
- Interruptible animations

**Step 3:** Document findings

**Step 4:** Implement fixes

**Step 5:** Run `pnpm run check`

**Step 6:** Commit: `fix: animation improvements`

---

### Task 2.5: Typography (6 Rules)

**Rules:**

1. Use ellipsis `…` not `...`
2. Use curly quotes, not straight
3. Non-breaking spaces in measurements/brands
4. Loading states end with `…`
5. Use `font-variant-numeric: tabular-nums`
6. Use `text-wrap: balance` on headings

**Files to Audit:**

ALL files with text content:

```
components/items/empty-state.tsx
components/items/item-hero.tsx
components/items/item-stats.tsx
components/items/sync-badge.tsx
components/google-drive/storage-bar.tsx
components/google-drive/pending-indicator.tsx
components/nav-user.tsx
components/site-header.tsx
All page.tsx files
```

**Step 1:** Search for:

```bash
grep -r '\.\.\.' components/ app/ --include="*.tsx"
grep -r "Loading" components/ app/ --include="*.tsx"
```

**Step 2:** Check for:

- `...` that should be `…`
- Straight quotes that should be curly
- Numbers that need tabular-nums
- Headings that need text-wrap: balance

**Step 3:** Document findings

**Step 4:** Implement fixes

**Step 5:** Run `pnpm run check`

**Step 6:** Commit: `fix: typography improvements`

---

### Task 2.6: Content Handling (4 Rules)

**Rules:**

1. Text containers handle long content
2. Flex children need `min-w-0`
3. Handle empty states
4. Anticipate varied input lengths

**Files to Audit:**

```
components/items/items-view.tsx
components/items/empty-state.tsx
components/sortable-tree/components/TreeItem/TreeItem.tsx
components/sortable-grid/GridItem.tsx
components/nav-pinned-items.tsx
components/search/spotlight-search.tsx
All components displaying user-generated content
```

**Step 1:** Check each component for:

- Text overflow handling (truncate, wrap)
- min-w-0 on flex children
- Empty state handling
- Long text handling

**Step 2:** Document findings

**Step 3:** Implement fixes

**Step 4:** Run `pnpm run check`

**Step 5:** Commit: `fix: content handling improvements`

---

### Task 2.7: Images (3 Rules)

**Rules:**

1. `<img>` needs explicit dimensions
2. Below-fold images use `loading="lazy"`
3. Above-fold critical images use `priority`

**Files to Audit:**

```
components/items/item-hero.tsx
components/items/image-selection-grid.tsx
components/items/queued-file-thumbnail.tsx
components/items/poster-selection-step.tsx
components/items/hero-selection-step.tsx
components/sortable-grid/GridItem.tsx
components/nav-user.tsx (avatar)
hooks/use-lazy-image.ts
```

**Step 1:** Search for image usage:

```bash
grep -r "<img" components/ --include="*.tsx"
grep -r "Image" components/ --include="*.tsx" | grep "next/image"
```

**Step 2:** Check each for:

- Explicit width/height
- loading="lazy" for below-fold
- priority for above-fold

**Step 3:** Document findings

**Step 4:** Implement fixes

**Step 5:** Run `pnpm run check`

**Step 6:** Commit: `fix: image optimization`

---

### Task 2.8: Performance (6 Rules)

**Rules:**

1. Virtualize large lists (>50 items)
2. No layout reads in render
3. Batch DOM reads/writes
4. Prefer uncontrolled inputs
5. Add `<link rel="preconnect">` for CDNs
6. Preload critical fonts

**Files to Audit:**

```
components/items/items-view.tsx
components/items/fork-destination-dialog.tsx
components/search/spotlight-search.tsx
components/google-drive/sync-history.tsx
app/layout.tsx (preconnect, fonts)
All components with lists
```

**Step 1:** Check for:

- Lists that could exceed 50 items (need virtualization)
- getBoundingClientRect() or similar in render
- Multiple DOM operations that should be batched
- Controlled inputs that could be uncontrolled
- Missing preconnect for external domains

**Step 2:** Document findings

**Step 3:** Implement fixes (consider @tanstack/react-virtual for lists)

**Step 4:** Run `pnpm run check`

**Step 5:** Commit: `fix: performance improvements`

---

### Task 2.9: Navigation & State (4 Rules)

**Rules:**

1. URL reflects state (filters, tabs, pagination)
2. Links use `<a>`/`<Link>`
3. Deep-link stateful UI
4. Destructive actions need confirmation

**Files to Audit:**

```
components/items/items-view.tsx (sort, filter, view mode)
components/items/items-toolbar.tsx
components/items/sort-dropdown.tsx
components/items/filter-dropdown.tsx
components/items/view-toggle.tsx
components/items/item-context-menu.tsx (delete)
components/items/bulk-actions-toolbar.tsx (bulk delete)
hooks/use-items-sort-filter.ts
app/(my-items)/my-items/page.tsx
```

**Step 1:** Check for:

- Filter/sort state in URL params
- Proper Link usage for navigation
- Deep-linkable UI states
- Confirmation dialogs for destructive actions

**Step 2:** Document findings

**Step 3:** Implement fixes

**Step 4:** Run `pnpm run check`

**Step 5:** Commit: `fix: navigation and state improvements`

---

### Task 2.10: Touch & Interaction (5 Rules)

**Rules:**

1. Use `touch-action: manipulation`
2. Set `-webkit-tap-highlight-color`
3. Use `overscroll-behavior: contain` in modals
4. Disable text selection during drag
5. Use `autoFocus` sparingly

**Files to Audit:**

```
app/globals.css
components/sortable-tree/SortableTree.tsx
components/sortable-grid/SortableGrid.tsx
components/ui/dialog.tsx
components/ui/drawer.tsx
components/ui/sheet.tsx
components/items/mobile-options-sheet.tsx
All draggable components
All modal/dialog components
```

**Step 1:** Check global CSS for touch styles

**Step 2:** Check each component for:

- touch-action on interactive elements
- tap-highlight-color
- overscroll-behavior in modals
- user-select during drag
- Excessive autoFocus usage

**Step 3:** Document findings

**Step 4:** Implement fixes

**Step 5:** Run `pnpm run check`

**Step 6:** Commit: `fix: touch interaction improvements`

---

### Task 2.11: Safe Areas & Layout (3 Rules)

**Rules:**

1. Full-bleed layouts use `env(safe-area-inset-*)`
2. Avoid unwanted scrollbars
3. Prefer Flex/Grid over JS measurement

**Files to Audit:**

```
app/globals.css
app/layout.tsx
app/(my-items)/layout.tsx
app/(public)/layout.tsx
components/app-sidebar.tsx
components/ui/sidebar.tsx
components/items/items-view.tsx
```

**Step 1:** Check for:

- Safe area insets in full-bleed layouts
- overflow handling
- JS-based layout that could be CSS

**Step 2:** Document findings

**Step 3:** Implement fixes

**Step 4:** Run `pnpm run check`

**Step 5:** Commit: `fix: layout improvements`

---

### Task 2.12: Dark Mode & Theming (3 Rules)

**Rules:**

1. Set `color-scheme: dark` on `<html>`
2. Use `<meta name="theme-color">`
3. Native `<select>` needs explicit colors

**Files to Audit:**

```
app/layout.tsx
app/globals.css
components/providers/theme-provider.tsx
components/theme-toggle.tsx
components/ui/select.tsx
```

**Step 1:** Check for:

- color-scheme meta/CSS
- theme-color meta tag
- Explicit colors on native selects

**Step 2:** Document findings

**Step 3:** Implement fixes

**Step 4:** Run `pnpm run check`

**Step 5:** Commit: `fix: dark mode improvements`

---

### Task 2.13: Locale & i18n (3 Rules)

**Rules:**

1. Use `Intl.DateTimeFormat`
2. Use `Intl.NumberFormat`
3. Detect language via headers/navigator, not IP

**Files to Audit:**

```
lib/progress-utils.ts
components/items/item-stats.tsx
components/google-drive/storage-bar.tsx
components/google-drive/sync-history.tsx
All files with date/number formatting
```

**Step 1:** Search for:

```bash
grep -r "toLocaleString\|toLocaleDateString\|new Date" lib/ components/ --include="*.ts" --include="*.tsx"
```

**Step 2:** Check for:

- Hardcoded date formats
- Hardcoded number formats
- IP-based language detection

**Step 3:** Document findings

**Step 4:** Implement fixes using Intl APIs

**Step 5:** Run `pnpm run check`

**Step 6:** Commit: `fix: i18n improvements`

---

### Task 2.14: Hydration Safety (3 Rules)

**Rules:**

1. Inputs with `value` need `onChange`
2. Guard date/time rendering against mismatch
3. Minimize `suppressHydrationWarning`

**Files to Audit:**

ALL client components:

```
app/(public)/u/[username]/public-profile-client.tsx
app/(public)/u/[username]/[itemId]/public-item-client.tsx
app/(public)/explore/explore-client.tsx
components/items/item-detail-client.tsx
components/items/items-view.tsx
components/media/media-player.tsx
components/theme-toggle.tsx
All components with controlled inputs
```

**Step 1:** Check for:

- Controlled inputs missing onChange
- Date/time rendered without guards
- Excessive suppressHydrationWarning

**Step 2:** Document findings

**Step 3:** Implement fixes

**Step 4:** Run `pnpm run check`

**Step 5:** Commit: `fix: hydration safety improvements`

---

### Task 2.15: Hover & Interactive States (2 Rules)

**Rules:**

1. Buttons/links need `hover:` state
2. Interactive states increase contrast

**Files to Audit:**

```
app/globals.css
components/ui/button.tsx
All interactive components
```

**Step 1:** Check for:

- Missing hover states
- Low-contrast interactive states

**Step 2:** Document findings

**Step 3:** Implement fixes

**Step 4:** Run `pnpm run check`

**Step 5:** Commit: `fix: hover state improvements`

---

### Task 2.16: Content & Copy (7 Rules)

**Rules:**

1. Use active voice
2. Title Case for headings/buttons
3. Use numerals for counts
4. Specific button labels
5. Error messages include fix/next step
6. Use second person
7. Use `&` when space-constrained

**Files to Audit:**

ALL files with user-facing text:

```
components/items/empty-state.tsx
components/items/add-item-dialog.tsx
components/items/item-settings-dialog.tsx
components/items/bulk-actions-toolbar.tsx
components/google-drive/settings-section.tsx
components/profile/settings-dialog.tsx
app/(auth)/**/*.tsx
lib/validations.ts (error messages)
```

**Step 1:** Review all user-facing copy for:

- Active voice
- Proper capitalization
- Numerals for counts
- Specific button labels
- Helpful error messages

**Step 2:** Document findings

**Step 3:** Implement fixes

**Step 4:** Run `pnpm run check`

**Step 5:** Commit: `fix: content and copy improvements`

---

### Task 2.17: Anti-patterns (10 Rules)

**Rules:**

1. Disabling zoom via viewport meta
2. `onPaste` with `preventDefault`
3. `transition: all`
4. `outline-none` without replacement
5. Inline `onClick` navigation
6. Click handlers on `<div>`/`<span>`
7. Images without dimensions
8. Large arrays without virtualization
9. Form inputs without labels
10. Hardcoded date/number formats

**Files to Audit:**

ENTIRE CODEBASE - search for anti-patterns:

**Step 1:** Run searches:

```bash
grep -r "user-scalable=no\|maximum-scale=1" app/ --include="*.tsx"
grep -r "onPaste.*preventDefault" components/ --include="*.tsx"
grep -r "transition: all\|transition-all" components/ app/ --include="*.tsx" --include="*.css"
grep -r "outline-none\|outline: none" components/ app/ --include="*.tsx" --include="*.css"
grep -r "onClick.*router.push\|onClick.*navigate" components/ --include="*.tsx"
grep -r "<div.*onClick\|<span.*onClick" components/ --include="*.tsx"
```

**Step 2:** Document all anti-pattern findings

**Step 3:** Fix each anti-pattern

**Step 4:** Run `pnpm run check`

**Step 5:** Commit: `fix: remove anti-patterns`

---

## Phase 3: Final Verification

### Task 3.1: Full Test Suite

**Step 1:** Run all tests:

```bash
pnpm run test
pnpm run test:e2e
```

**Step 2:** Fix any failures

**Step 3:** Commit: `test: fix tests after audit`

---

### Task 3.2: Build Verification

**Step 1:** Run full check:

```bash
pnpm run check
```

**Step 2:** Fix any issues

**Step 3:** Commit: `chore: final audit cleanup`

---

### Task 3.3: Audit Report

**Step 1:** Create summary document `docs/audits/2026-01-19-audit-report.md`:

- Total findings per category
- Files with most issues
- Patterns that needed fixing
- Recommendations for future development

**Step 2:** Commit: `docs: add audit report`

---

## Execution Summary

| Phase     | Tasks              | Rules   | Est. Files      |
| --------- | ------------------ | ------- | --------------- |
| 1.1       | Waterfalls         | 5       | 24              |
| 1.2       | Bundle Size        | 5       | 19              |
| 1.3       | Server Performance | 5       | 11              |
| 1.4       | Client Data        | 4       | 20              |
| 1.5       | Re-renders         | 7       | 59              |
| 1.6       | Rendering          | 7       | 12              |
| 1.7       | JavaScript         | 12      | 14              |
| 1.8       | Advanced           | 2       | 10              |
| 2.1       | Accessibility      | 10      | 24              |
| 2.2       | Focus States       | 4       | 25              |
| 2.3       | Forms              | 11      | 17              |
| 2.4       | Animation          | 6       | 8               |
| 2.5       | Typography         | 6       | 10              |
| 2.6       | Content            | 4       | 7               |
| 2.7       | Images             | 3       | 8               |
| 2.8       | Performance        | 6       | 6               |
| 2.9       | Navigation         | 4       | 9               |
| 2.10      | Touch              | 5       | 10              |
| 2.11      | Layout             | 3       | 7               |
| 2.12      | Dark Mode          | 3       | 5               |
| 2.13      | i18n               | 3       | 5               |
| 2.14      | Hydration          | 3       | 8               |
| 2.15      | Hover States       | 2       | 3               |
| 2.16      | Copy               | 7       | 9               |
| 2.17      | Anti-patterns      | 10      | ALL             |
| 3.x       | Verification       | 3       | ALL             |
| **Total** | **28**             | **137** | **~130 unique** |

---

## Appendix: File-to-Rule Mapping

### High-Priority Files (Touch Many Rules)

| File                                        | Rule Categories                                                             |
| ------------------------------------------- | --------------------------------------------------------------------------- |
| `components/items/items-view.tsx`           | async, bundle, rerender, rendering, js, accessibility, content, performance |
| `components/items/item-settings-dialog.tsx` | bundle, forms, accessibility, focus                                         |
| `components/items/add-item-dialog.tsx`      | bundle, forms, accessibility, focus                                         |
| `components/search/spotlight-search.tsx`    | client, rerender, rendering, accessibility, forms, performance              |
| `components/media/media-player.tsx`         | bundle, advanced, accessibility, touch                                      |
| `app/layout.tsx`                            | bundle, server, layout, dark-mode, performance                              |
| `lib/item-actions.ts`                       | async, server, js                                                           |
| `hooks/use-items-sort-filter.ts`            | client, js, rerender                                                        |

### shadcn Components to Skip

All files in `components/ui/` are shadcn generated and should be skipped EXCEPT:

- Check for focus states
- Check for accessibility attributes
- Check for dark mode colors on native elements
