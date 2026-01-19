# Codebase Audit - Future Work

Items identified during the comprehensive codebase audit that are out of scope for current tasks but should be addressed later.

---

## From Task 1.1: Eliminating Waterfalls

### Suspense Boundary Opportunities (Low-Medium Priority)

These pages could benefit from Suspense boundaries to stream content incrementally, but require structural refactoring:

| Page                                        | Issue                                           | Priority |
| ------------------------------------------- | ----------------------------------------------- | -------- |
| `app/(my-items)/my-items/page.tsx`          | Entire page blocks on all data before rendering | Low      |
| `app/(my-items)/my-items/[itemId]/page.tsx` | Sequential getItem → Promise.all pattern        | Medium   |
| `app/(public)/u/[username]/page.tsx`        | Four sequential awaits block page render        | High     |
| `app/(public)/explore/page.tsx`             | Single sequential fetch blocks entire page      | Medium   |

**Implementation approach:** Extract data fetching into child components, wrap in Suspense with skeleton fallbacks.

---

## From Task 1.2: Bundle Size Optimization

### Dynamic Import Opportunities (Medium-High Priority)

Heavy components that could be dynamically imported to reduce initial bundle size:

| Component            | File                                        | Dependency        | Size  | Priority | Notes                                                       |
| -------------------- | ------------------------------------------- | ----------------- | ----- | -------- | ----------------------------------------------------------- |
| `SortableTree`       | `components/sortable-tree/SortableTree.tsx` | `@dnd-kit/core`   | ~15KB | High     | Only used in edit mode; could lazy-load when "Edit" clicked |
| `SortableGrid`       | `components/sortable-grid/SortableGrid.tsx` | `@dnd-kit/core`   | ~15KB | High     | Same as SortableTree                                        |
| `VideoPlayer`        | `components/media/media-player.tsx`         | `@vidstack/react` | ~50KB | Medium   | Complex due to CSS imports; only loaded when media played   |
| `ItemSettingsDialog` | `components/items/item-settings-dialog.tsx` | Various           | ~10KB | Low      | Modal, could lazy-load on settings click                    |
| `AddItemDialog`      | `components/items/add-item-dialog.tsx`      | Various           | ~10KB | Low      | Modal, could lazy-load on "Add" click                       |

**Implementation approach:** Use `next/dynamic` with `loading` fallback. For edit mode components, load on "Edit" button click.

### Preload on Hover (Low Priority)

Micro-optimization opportunities:

| Trigger             | Component to Preload | Notes                                             |
| ------------------- | -------------------- | ------------------------------------------------- |
| "Edit" button hover | `@dnd-kit/core`      | Reduces perceived latency when entering edit mode |
| "Play" button hover | `@vidstack/react`    | Reduces delay before media playback               |
| Context menu hover  | Respective dialogs   | Settings/Delete dialogs                           |

**Implementation approach:** Use `next/dynamic` preload or manual `import()` on `onMouseEnter`/`onFocus`.

### WebGL Shader Optimization (Low Priority)

`Shader1` component in `components/shader1.tsx`:

- Currently conditionally skipped in automated tests
- Could use Intersection Observer to only load when visible
- Consider replacing with CSS-only fallback for low-end devices

---

## From Task 1.3: Server-Side Performance

### after() API Adoption (Medium Priority)

Detached promise patterns that should migrate to Next.js `after()` API when patterns are clearer:

| File                  | Line    | Current Pattern                          | Potential Improvement                             |
| --------------------- | ------- | ---------------------------------------- | ------------------------------------------------- |
| `lib/item-actions.ts` | 849-883 | `createDriveFolderOnly().then().catch()` | Use `after()` for non-blocking post-response work |
| `lib/item-actions.ts` | 965-968 | `renameItemInGoogleDrive().catch()`      | Use `after()` for fire-and-forget rename          |

**Why deferred:**

- Requires investigation of Next.js 15.1+ `after()` API behavior with server actions
- Need to understand error handling differences vs detached promises
- Current pattern works; optimization is nice-to-have

### Sequential Data Fetching (Low Priority)

| File                                        | Line  | Issue                                     | Impact                                                                             |
| ------------------------------------------- | ----- | ----------------------------------------- | ---------------------------------------------------------------------------------- |
| `app/(my-items)/my-items/[itemId]/page.tsx` | 25-49 | `getItem` awaited before parallel fetches | Cannot easily restructure due to data dependency (need item ID for children/files) |

**Why deferred:** Data dependency makes parallelization complex; would require significant refactoring.

### LRU Cross-Request Caching (Low Priority)

| Target                 | Use Case                  | Benefit                         |
| ---------------------- | ------------------------- | ------------------------------- |
| Public profile lookups | High-traffic profiles     | Reduces DB hits across requests |
| TMDB API responses     | Repeated metadata lookups | Reduces external API calls      |

**Why deferred:**

- Adds complexity with cache invalidation
- Current per-request React.cache() handles most cases
- Vercel Fluid Compute may provide implicit benefits

### Additional React.cache() Opportunities (Low Priority)

| Function                 | File          | Notes                              |
| ------------------------ | ------------- | ---------------------------------- |
| `getExtendedSidebarUser` | `lib/auth.ts` | Called once per layout, low impact |

---

## From Task 1.6: Rendering Performance

### SVG Animation Wrapper (Low Priority)

38 instances of `animate-spin` applied directly to Lucide SVG icons (Loader2):

| Pattern                              | Impact   | Effort |
| ------------------------------------ | -------- | ------ |
| `<Loader2 className="animate-spin">` | Very Low | Low    |

**Recommendation:** Create a `<Spinner />` wrapper component:

```tsx
export function Spinner({ className }: { className?: string }) {
  return (
    <div className={cn("animate-spin", className)}>
      <Loader2 className="size-full" />
    </div>
  );
}
```

**Why deferred:** Micro-optimization with minimal real-world impact. Lucide icons are small and simple; modern browsers handle SVG animations well.

### content-visibility for Long Lists (Medium Priority)

Lists that could benefit from CSS `content-visibility: auto`:

| Component      | File                                     | Typical Size | Priority |
| -------------- | ---------------------------------------- | ------------ | -------- |
| Tree view      | `components/sortable-tree/Tree.tsx`      | 10-100 items | Medium   |
| Grid view      | `components/sortable-grid/Grid.tsx`      | 10-100 items | Medium   |
| Search results | `components/search/spotlight-search.tsx` | 10-500 items | Low      |

**Implementation:**

```css
.tree-item,
.grid-item {
  content-visibility: auto;
  contain-intrinsic-size: 0 40px; /* Adjust based on item height */
}
```

**Why deferred:** Requires testing for visual side effects and accessibility implications. Current performance is acceptable for typical use cases (<100 items).

### Virtualization for Spotlight Search (Low Priority)

For users with large item collections (500+ items), consider virtualizing search results:

| Component | Current State              | Recommendation                        |
| --------- | -------------------------- | ------------------------------------- |
| Spotlight | Renders all search results | Limit results OR virtualize with cmdk |

**Implementation approach:**

- `fork-destination-dialog` already uses `@tanstack/react-virtual` as a reference
- Could limit results to top 50 matches as simpler alternative
- cmdk supports virtualization via custom list rendering

**Why deferred:** Most users have <100 items; optimization would be premature

---

## From Task 2.1: Accessibility Audit

### Remaining Decorative Icons (Low Priority)

Large components with many decorative icons that were not modified due to complexity:

| File                          | Icon Count | Notes                                   |
| ----------------------------- | ---------- | --------------------------------------- |
| `add-item-dialog.tsx`         | 50+        | Wizard steps with many icons throughout |
| `item-settings-dialog.tsx`    | 30+        | Multiple tabs and form sections         |
| `spotlight-search.tsx`        | 5+         | Search, folder, and loader icons        |
| `settings-dialog.tsx`         | 40+        | Profile, preferences, activity tabs     |
| `settings-section.tsx`        | 15+        | Google Drive connection UI              |
| `media-search-combobox.tsx`   | 5+         | Film and TV icons in search results     |
| `file-type-combobox.tsx`      | 15+        | Icons in file list items                |
| `fork-destination-dialog.tsx` | 10+        | Folder icons in virtualized list        |

**Pattern to apply:**

\`\`\`tsx
// Before
<Settings className="size-4" />

// After
<Settings aria-hidden="true" className="size-4" />
\`\`\`

**Why deferred:** These are complex dialog components. The high-traffic interactive components (toolbars, navigation, context menus) were prioritized. These dialogs are modal and less frequently used.

### Skip Link (Medium Priority)

Rule 9 recommends adding a "skip to main content" link for keyboard users. Current state:

- No skip link implemented
- Would require adding to \`app/layout.tsx\`
- Should skip to \`<main>\` element

**Implementation:**

\`\`\`tsx
// In layout.tsx
<a href="#main-content" className="sr-only focus:not-sr-only">
Skip to main content
</a>
// ...

<main id="main-content">
\`\`\`

### aria-live for Async Updates (Low Priority)

Rule 7 recommends \`aria-live="polite"\` for async content updates. Potential locations:

| Component                | Async Update                    | Current State      |
| ------------------------ | ------------------------------- | ------------------ |
| \`spotlight-search.tsx\` | Search results loading/updating | No aria-live       |
| \`sync-history.tsx\`     | Sync log updates                | No aria-live       |
| \`storage-bar.tsx\`      | Storage quota updates           | No aria-live       |
| Toast notifications      | Sonner handles this             | Already accessible |

**Why deferred:** Toast library (Sonner) handles most user feedback. Remaining cases are lower priority.

---

## From Task 2.8: Performance Audit

No new items identified. Virtualization consideration for spotlight search already documented in Task 1.6 section above.

---

## From Task 2.2: Focus States Audit

### focus-within Enhancement (Low Priority)

Compound controls that could benefit from `:focus-within` styling to highlight the entire group when any child is focused:

| Component             | File                                         | Benefit                        |
| --------------------- | -------------------------------------------- | ------------------------------ |
| Search input wrapper  | `components/search/spotlight-search.tsx`     | Highlight wrapper when focused |
| Media search combobox | `components/items/media-search-combobox.tsx` | Highlight wrapper when focused |
| Dropzone              | `components/ui/dropzone.tsx`                 | Highlight entire zone on focus |

**Implementation:**

```css
.search-wrapper:focus-within {
  @apply ring-ring ring-2 ring-offset-2;
}
```

**Why deferred:** Current implementations work correctly without `focus-within`. This is a visual enhancement, not a functional issue.

### Focus Trap Testing (Low Priority)

Modal components should be tested to verify focus trap behavior:

| Component             | File                                        | Test Scenario                     |
| --------------------- | ------------------------------------------- | --------------------------------- |
| Dialog                | `components/ui/dialog.tsx`                  | Tab cycles within dialog          |
| Sheet                 | `components/ui/sheet.tsx`                   | Tab cycles within sheet           |
| AnimatedDialogContent | `components/ui/animated-dialog-content.tsx` | Tab cycles within animated dialog |
| Drawer                | `components/ui/drawer.tsx`                  | Tab cycles within drawer          |

**Why deferred:** Radix UI primitives handle focus trapping automatically. Testing would be for verification only.

---

## From Task 2.4: Animation Audit

### shadcn/ui transition-all Usage (Low Priority)

Several shadcn-generated UI components use `transition-all` which is an anti-pattern (animates all properties, less performant):

| File           | Instances | Properties Animated |
| -------------- | --------- | ------------------- |
| `button.tsx`   | 1         | colors, shadow      |
| `switch.tsx`   | 1         | transform, colors   |
| `sidebar.tsx`  | 1         | resize handle       |
| `progress.tsx` | 1         | width               |

**Why deferred:** These are shadcn-generated components. Modifying them would require maintaining a fork and handling updates manually. The performance impact is minimal for these small UI elements.

### dnd-kit Reduced Motion Support (Low Priority)

The dnd-kit library (used in `SortableTree.tsx` and `SortableGrid.tsx`) provides drop animations that don't explicitly check `prefers-reduced-motion`. However:

- The library handles this internally with reasonable defaults
- The drop animation duration is short (200ms)
- Manual override would require complex configuration

**Why deferred:** dnd-kit's animation handling is acceptable for most users. Manual intervention would add complexity with minimal benefit.

---

## From Task 2.9: Navigation & State Audit

### URL-Based State Management (Medium Priority)

Sort, filter, and view mode state are currently stored in localStorage rather than URL search params. This is an intentional design decision with valid tradeoffs.

**Current Implementation:**

| State         | Storage                                 | File                               |
| ------------- | --------------------------------------- | ---------------------------------- |
| Sort option   | localStorage (`canoncore-items-sort`)   | `hooks/use-items-sort-filter.ts`   |
| Filter option | localStorage (`canoncore-items-filter`) | `hooks/use-items-sort-filter.ts`   |
| View mode     | localStorage (`items-view-mode`)        | `components/items/view-toggle.tsx` |

**Benefits of Current Approach:**

1. Cross-tab sync via storage events
2. Persistent user preferences across sessions
3. No URL updates = faster transitions
4. Hydration-safe with server snapshots

**Tradeoffs (potential future improvements):**

1. Users cannot share links like `/my-items?sort=name-asc&filter=has-files&view=grid`
2. Bookmarks don't preserve specific view states
3. Browser back/forward doesn't restore previous sort/filter states

**If implementing URL-based state:**

- Use `nuqs` library for type-safe URL state management
- Or use `useSearchParams` + `useRouter` for manual implementation
- Consider shallow routing to avoid full page reloads
- May need to update server component to read initial state from URL

**Example with nuqs:**

```tsx
import { parseAsString, useQueryState } from "nuqs";

export function useItemsSortFilter() {
  const [sortBy, setSortBy] = useQueryState(
    "sort",
    parseAsString.withDefault("custom")
  );
  const [filterBy, setFilterBy] = useQueryState(
    "filter",
    parseAsString.withDefault("all")
  );
  // ...
}
```

**Why deferred:** Current localStorage approach is intentional and working well for persistent user preferences. Implementing URL-based state would be a significant change that should be user-driven (i.e., if users request shareability).

---

## From Task 2.13: Locale & i18n Audit

### Full i18n Infrastructure (Medium Priority)

The codebase now uses `Intl.NumberFormat` and `Intl.ListFormat` with `undefined` locale (auto-detects from browser). However, full internationalization would require:

| Area              | Current State                         | Future Enhancement              |
| ----------------- | ------------------------------------- | ------------------------------- |
| Number formatting | Uses `Intl.NumberFormat(undefined)`   | Already locale-aware            |
| List formatting   | Uses `Intl.ListFormat(undefined)`     | Already locale-aware            |
| Date formatting   | Uses `date-fns` with English defaults | Add locale imports for date-fns |
| UI strings        | Hardcoded English                     | Extract to translation files    |

**For date-fns locale support:**

```typescript
import { formatDistanceToNow } from "date-fns";
import { enUS, de, fr } from "date-fns/locale";

// Get user's locale and map to date-fns locale
const localeMap = { "en-US": enUS, "de-DE": de, "fr-FR": fr };
const userLocale = localeMap[navigator.language] || enUS;

formatDistanceToNow(date, { addSuffix: true, locale: userLocale });
```

**Why deferred:** Current implementation is functional and respects browser locale for numbers. Full i18n with translated strings would require significant infrastructure (translation files, locale detection, React context for current locale).

### Centralized Formatting Utilities (Low Priority)

Currently, there are multiple `formatBytes` functions across files:

| File                                      | Function              | Purpose                 |
| ----------------------------------------- | --------------------- | ----------------------- |
| `components/google-drive/storage-bar.tsx` | `formatBytes(bigint)` | Storage quota display   |
| `lib/upload-utils.ts`                     | `formatBytes(number)` | Upload progress display |
| `components/ui/dropzone.tsx`              | `renderBytes(number)` | File size constraints   |

**Potential consolidation:**

```typescript
// lib/format-utils.ts
export function formatBytes(
  bytes: number | bigint,
  options?: FormatBytesOptions
): string {
  // Single implementation with locale-aware formatting
}
```

**Why deferred:** Each function has slightly different requirements (bigint vs number, decimal precision). Current implementations work correctly; consolidation would be a refactoring exercise.

---

_This file is updated as audit tasks are completed._
