# Deployment 2.6.0 - Image Loading & Sticky Dialog Footers

**Date**: 2026-01-14
**Branch**: development

## Summary

Images now load reliably regardless of browser caching, and dialog footers stay visible while scrolling. Two new hooks (`useImageLoaded`, `useLazyImage`) fix a bug where cached images remained invisible, plus add lazy loading for grid performance. Dialog components use a new slot-based API where headers and footers render outside the animated area, keeping action buttons always accessible.

## Features

### Best practice image loading

Browser-cached images can load synchronously before React attaches the `onLoad` handler, causing images to stay at `opacity: 0` forever. The new `useImageLoaded` hook detects cached images by checking `img.complete && img.naturalHeight > 0` on mount.

**Components fixed:**

- `GridItem.tsx` - Grid artwork thumbnails
- `spotlight-search.tsx` - Search result thumbnails
- `image-selection-grid.tsx` - TMDB poster and backdrop selection (2 instances)
- `media-search-combobox.tsx` - TMDB search thumbnails
- `file-type-combobox.tsx` - File type icons

**Usage:**

```typescript
const { ref, loaded, error, onLoad, onError } = useImageLoaded(src);

<img
  ref={ref}
  src={src}
  onLoad={onLoad}
  onError={onError}
  className={loaded ? "opacity-100" : "opacity-0"}
/>
```

### Lazy image loading with priority

The new `useLazyImage` hook uses Intersection Observer to defer loading images until they enter the viewport. The first 4 grid items load immediately (priority), while the rest lazy load with 200px preloading margin.

**Usage:**

```typescript
const { ref, shouldLoad } = useLazyImage({ priority: index < 4 });

<div ref={ref}>
  {shouldLoad && <img src={src} />}
</div>
```

### Sticky dialog footers

Dialog footers now stay visible at the bottom of the viewport while body content scrolls. This uses a slot-based API where `header` and `footer` props render outside the animated area.

**Before:**

```tsx
<AnimatedDialogContent stepKey={step}>
  <DialogHeader>...</DialogHeader>
  <div>Body content</div>
  <DialogFooter>...</DialogFooter>
</AnimatedDialogContent>
```

**After:**

```tsx
<AnimatedDialogContent
  stepKey={step}
  header={<DialogHeader>...</DialogHeader>}
  footer={<DialogFooter>...</DialogFooter>}
>
  <div>Body content (only this animates)</div>
</AnimatedDialogContent>
```

**Dialogs updated:**

- Add Item Dialog (8 steps)
- Item Settings Dialog (5 steps)
- Profile Settings Dialog (3 steps)

**Base component updates:**

- `DialogContent` and `AlertDialogContent` now use `flex-col` layout
- `DialogFooter` and `AlertDialogFooter` have `shrink-0 pt-4` for fixed positioning
- `AnimatedDialogContent` body section has `min-h-0 overflow-y-auto` for proper flex scrolling

## Files Changed

### Added

```
hooks/use-image-loaded.ts                           # Cached image detection hook
hooks/use-lazy-image.ts                             # Intersection Observer lazy loading
tests/unit/hooks/use-image-loaded.test.ts           # 7 tests
tests/unit/hooks/use-lazy-image.test.ts             # 8 tests
tests/unit/components/ui/dialog.test.tsx            # 3 tests
tests/unit/components/ui/alert-dialog.test.tsx      # 2 tests
tests/unit/components/ui/animated-dialog-content.test.tsx  # 5 tests
e2e/journeys/items/sticky-footer.spec.ts            # E2E scroll verification
docs/plans/2026-01-14-best-practice-image-loading.md
docs/plans/2026-01-14-sticky-dialog-footers.md
```

### Modified

```
components/ui/animated-dialog-content.tsx   # Slot-based API with header/footer props
components/ui/dialog.tsx                    # flex-col layout, shrink-0 footer
components/ui/alert-dialog.tsx              # flex-col layout, shrink-0 footer
components/ui/button.tsx                    # Minor styling
components/ui/command.tsx                   # Minor styling
components/items/add-item-dialog.tsx        # Migrate to slot-based API
components/items/item-settings-dialog.tsx   # Migrate to slot-based API
components/items/image-selection-grid.tsx   # Use useImageLoaded hook
components/items/media-search-combobox.tsx  # Use useImageLoaded hook
components/items/file-type-combobox.tsx     # Use useImageLoaded hook
components/items/item-hero.tsx              # Use useImageLoaded hook
components/profile/settings-dialog.tsx      # Migrate to slot-based API
components/search/spotlight-search.tsx      # Use useImageLoaded hook
components/sortable-grid/Grid.tsx           # Pass priority prop to GridItem
components/sortable-grid/GridItem.tsx       # Use useImageLoaded + useLazyImage
tests/unit/components/add-item-dialog.test.tsx
tests/unit/components/grid-item.test.tsx
tests/unit/components/items/item-hero.test.tsx
e2e/journeys/google-drive/drive-connection.spec.ts
e2e/journeys/items/spotlight-search.spec.ts
```

## Test Results

| Suite       | Tests | Result     |
| ----------- | ----- | ---------- |
| Unit        | 1225  | All passed |
| Integration | 92    | All passed |
| E2E         | 59    | All passed |

## API Changes

### New hooks

```typescript
// hooks/use-image-loaded.ts
interface UseImageLoadedReturn {
  ref: React.MutableRefObject<HTMLImageElement | null>;
  loaded: boolean;
  error: boolean;
  onLoad: () => void;
  onError: () => void;
}

export function useImageLoaded(src?: string): UseImageLoadedReturn;

// hooks/use-lazy-image.ts
interface UseLazyImageOptions {
  priority?: boolean;      // Load immediately (default: false)
  rootMargin?: string;     // Preload distance (default: "200px")
}

interface UseLazyImageReturn {
  ref: React.RefCallback<HTMLElement>;
  shouldLoad: boolean;
}

export function useLazyImage(options?: UseLazyImageOptions): UseLazyImageReturn;
```

### Updated component props

```typescript
// components/ui/animated-dialog-content.tsx
interface AnimatedDialogContentProps {
  stepKey: string;
  showClose?: boolean;
  header?: React.ReactNode;   // NEW: Fixed header content
  footer?: React.ReactNode;   // NEW: Fixed footer content
  children: React.ReactNode;  // Body content (animates)
}
```

## Breaking Changes

`AnimatedDialogContent` now uses a slot-based API. Existing usages that put header and footer inside children must be updated to use the new `header` and `footer` props. All internal usages have been migrated.

## Performance Improvements

- **Grid lazy loading**: Only the first 4 items load immediately; remaining items load as they scroll into view with 200px preloading margin
- **Reduced layout thrashing**: ResizeObserver in AnimatedDialogContent only measures body content height, not header/footer
- **Stable animations**: Spring-based height transitions with `stiffness: 400, damping: 35` for smooth step changes
