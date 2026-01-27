# E2E Toast Usage Audit

**Total instances found: 122**

## Summary

- ❌ **Remove ~115 instances** - `waitForToastToDisappear()` after state changes
- ⚠️ **Keep ~5 instances** - `expectErrorToast()` for validation errors
- ⚠️ **Convert ~2 instances** - `expectSuccessToast()` for fork confirmation

## Why Toasts Are An Anti-Pattern in E2E Tests

### Problems:

1. **Toasts are side effects, not outcomes** - They're UI feedback, not state
2. **Race conditions** - Toasts can overlap, block clicks, or dismiss unpredictably
3. **Slow tests** - Each wait adds 4-15 seconds (15 mins total for 120 instances!)
4. **Brittle** - Changes to toast duration or design break tests
5. **Poor coverage** - Verifying toast != verifying actual data change

### Playwright Best Practice:

**Assert on outcomes, not side effects**

## Categorized Audit

### Category 1: Item Creation (REMOVE - 45 instances)

**Pattern:** Create item → wait for toast → verify item visible

**Files:**

- `items-hierarchy.spec.ts` (7 instances)
- `items-tree-drag.spec.ts` (12 instances)
- `items-max-depth.spec.ts` (8 instances)
- `items-view-toggle.spec.ts` (6 instances)
- `items-crud.spec.ts` (2 instances)
- `items-grid-drag.spec.ts` (1 instance)
- `items-loading.spec.ts` (3 instances)
- `items-settings.spec.ts` (6 instances)

**Current:**

```typescript
await itemsPage.createItem("Movies");
await itemsPage.waitForToastToDisappear(); // ❌ REMOVE
await itemsPage.expectItemVisible("Movies"); // Already verifies outcome
```

**Refactor:**

```typescript
await itemsPage.createItem("Movies");
await itemsPage.expectItemVisible("Movies"); // ✅ Sufficient
```

**Rationale:** The `expectItemVisible()` call already waits for the item to appear in the DOM, which confirms the creation succeeded. Toast is redundant.

---

### Category 2: Pin/Unpin Operations (REMOVE - 15 instances)

**Pattern:** Pin item → expect toast → wait for disappear → verify in sidebar

**Files:**

- `pinned-items.spec.ts` (15 instances)

**Current:**

```typescript
await itemsPage.pinItemViaContextMenu("Movies");
await itemsPage.expectSuccessToast("Pinned to sidebar"); // ❌ REMOVE
await itemsPage.waitForToastToDisappear(); // ❌ REMOVE
await itemsPage.expectItemPinnedInSidebar("Movies"); // Already verifies outcome
```

**Refactor:**

```typescript
await itemsPage.pinItemViaContextMenu("Movies");
await itemsPage.expectItemPinnedInSidebar("Movies"); // ✅ Sufficient
```

**Rationale:** Verifying the item appears in the sidebar with correct state is the real test. Toast is just UI feedback.

---

### Category 3: Bulk Delete Operations (CONVERT - 3 instances)

**Pattern:** Delete items → expect toast with count

**Files:**

- `bulk-delete.spec.ts` (3 instances)

**Current:**

```typescript
await itemsPage.bulkDelete();
await itemsPage.expectSuccessToast("Deleted 2 items"); // ⚠️ CONVERT
```

**Refactor:**

```typescript
await itemsPage.bulkDelete();
await itemsPage.expectItemsNotVisible(["Item 1", "Item 2"]); // ✅ Better
```

**Rationale:** Verifying items are gone is more reliable than checking toast message. However, the toast count verification is somewhat useful, so we could keep these but they're not critical.

---

### Category 4: Settings Save (REMOVE - 25 instances)

**Pattern:** Change setting → wait for toast → verify setting persisted

**Files:**

- `items-settings.spec.ts` (25 instances)

**Current:**

```typescript
await itemsPage.updateItemName("New Name");
await itemsPage.waitForToastToDisappear(); // ❌ REMOVE
await itemsPage.expectItemName("New Name"); // Already verifies outcome
```

**Refactor:**

```typescript
await itemsPage.updateItemName("New Name");
await itemsPage.expectItemName("New Name"); // ✅ Sufficient
```

---

### Category 5: Media Lookup (REMOVE - 18 instances)

**Pattern:** Apply TMDB metadata → wait for toast → verify metadata applied

**Files:**

- `media-lookup.spec.ts` (18 instances)

**Current:**

```typescript
await itemsPage.applyTmdbMetadata();
await itemsPage.waitForToastToDisappear(); // ❌ REMOVE
await itemsPage.expectItemArtwork(); // Already verifies outcome
```

**Refactor:**

```typescript
await itemsPage.applyTmdbMetadata();
await itemsPage.expectItemArtwork(); // ✅ Sufficient
```

---

### Category 6: Error Validation (KEEP - 3 instances)

**Pattern:** Submit invalid input → expect error toast

**Files:**

- `items-max-depth.spec.ts` (1 instance)
- `media-lookup.spec.ts` (2 instances)

**Current:**

```typescript
await itemsPage.createItem(""); // Invalid: empty name
await itemsPage.expectErrorToast("Name is required"); // ✅ KEEP
```

**Rationale:** These verify validation error messages that may not have other UI indicators. Keep these as they test actual error handling.

---

### Category 7: Fork Confirmation (CONVERT - 2 instances)

**Pattern:** Fork item → expect success toast

**Files:**

- `public-profile.spec.ts` (2 instances)

**Current:**

```typescript
await publicProfilePage.forkItem("Collection");
await publicProfilePage.expectSuccessToast(/added to your library/i); // ⚠️ CONVERT
```

**Refactor:**

```typescript
await publicProfilePage.forkItem("Collection");
await itemsPage.goto(); // Navigate to my items
await itemsPage.expectItemVisible("Collection"); // ✅ Verify it's in library
```

---

### Category 8: Drag and Drop (REMOVE - 13 instances)

**Pattern:** Drag item → wait for toast → verify new position

**Files:**

- `items-tree-drag.spec.ts` (12 instances)
- `items-grid-drag.spec.ts` (1 instance)

**Current:**

```typescript
await itemsPage.dragItem("Child", "New Parent");
await itemsPage.waitForToastToDisappear(); // ❌ REMOVE
await itemsPage.expectItemParent("Child", "New Parent"); // Already verifies outcome
```

**Refactor:**

```typescript
await itemsPage.dragItem("Child", "New Parent");
await itemsPage.expectItemParent("Child", "New Parent"); // ✅ Sufficient
```

---

### Category 9: Google Drive Sync (REMOVE - 4 instances)

**Pattern:** Upload file → wait for toast → verify sync

**Files:**

- `drive-web-to-cloud.spec.ts` (3 instances)
- `drive-connection.spec.ts` (1 instance)

**Current:**

```typescript
await itemsPage.uploadFile("video.mp4");
await itemsPage.waitForToastToDisappear(); // ❌ REMOVE
await itemsPage.expectFileUploaded("video.mp4"); // Already verifies outcome
```

**Refactor:**

```typescript
await itemsPage.uploadFile("video.mp4");
await itemsPage.expectFileUploaded("video.mp4"); // ✅ Sufficient
```

---

### Category 10: Miscellaneous (REMOVE - 8 instances)

**Files:**

- `sticky-footer.spec.ts` (1 instance)
- `edit-mode.spec.ts` (1 instance)
- `item-progress.spec.ts` (3 instances)
- `preferences.spec.ts` (2 instances)
- `items-sort-filter.spec.ts` (1 instance)

All follow the same pattern: perform action → wait for toast → verify outcome.
All should be refactored to remove toast wait.

---

## Refactoring Strategy

### Phase 1: Remove Obvious Cases (100 instances)

Files with the most impact (fastest improvement):

1. `items-settings.spec.ts` (25) - Settings save operations
2. `media-lookup.spec.ts` (18) - TMDB metadata
3. `pinned-items.spec.ts` (15) - Pin/unpin
4. `items-tree-drag.spec.ts` (12) - Drag and drop
5. `items-max-depth.spec.ts` (8) - Item creation
6. `items-hierarchy.spec.ts` (7) - Item creation
7. `items-view-toggle.spec.ts` (6) - View mode toggle

### Phase 2: Convert Success Toasts (5 instances)

1. `bulk-delete.spec.ts` (3) - Verify items deleted instead
2. `public-profile.spec.ts` (2) - Verify item in library instead

### Phase 3: Keep Error Toasts (3 instances)

1. `items-max-depth.spec.ts` (1) - Max depth error
2. `media-lookup.spec.ts` (2) - Validation errors

---

## Expected Benefits

### Time Savings:

- **Before:** 122 toast waits × 4-15 seconds = 8-30 minutes of waiting
- **After:** 0 seconds of waiting for toasts
- **Speedup:** ~15 minutes faster test suite

### Reliability:

- Eliminates race conditions from overlapping toasts
- Removes mobile toast-blocking issues
- No more flaky tests due to toast timing

### Maintainability:

- Tests verify actual state, not UI feedback
- Changes to toast design don't break tests
- Follows Playwright best practices

---

## Implementation Plan

1. **Remove `waitForToastToDisappear()` from Page Object** - Make it a no-op or remove entirely
2. **Batch refactor by file** - Start with high-impact files
3. **Run tests after each file** - Ensure no regressions
4. **Update CLAUDE.md** - Document the pattern for future tests

---

## Next Steps

Start with `items-settings.spec.ts` (25 instances) as it will have the biggest immediate impact on test speed and reliability.
