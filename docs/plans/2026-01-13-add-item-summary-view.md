# Add Item Dialog: Summary View Redesign

## Overview

Replace the tabbed interface (Detail + Files) in the Add Item dialog with a single summary view that shows all configured fields at once. This eliminates confusion where artwork dropzones appear after the user has already selected artwork in the wizard.

## Problem

Current flow after TMDB wizard:

1. User searches TMDB, selects match
2. Wizard: Name/Description → Poster → Hero
3. Returns to dialog with Detail + Files tabs
4. Files tab shows Artwork dropzones again → confusing/redundant

## Solution

Single summary view showing everything configured - no tabs.

## Visual Design

### Desktop Layout

```
┌─────────────────────────────────────────────────────┐
│                    Add New Item                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│ Name                                                │
│ ┌─────────────────────────────────────────────────┐ │
│ │ The Matrix                                      │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ Description                                         │
│ ┌─────────────────────────────────────────────────┐ │
│ │ A computer hacker learns about the true nature  │ │
│ │ of reality and his role in the war against...   │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ Artwork                                             │
│ ┌───────────┐  ┌─────────────────────────────────┐ │
│ │           │  │                                 │ │
│ │  Poster   │  │            Hero                 │ │
│ │  (2:3)    │  │           (16:9)                │ │
│ │           │  │                                 │ │
│ └───────────┘  └─────────────────────────────────┘ │
│  From TMDB      From TMDB                          │
│  [Change]       [Change]                           │
│                                                     │
│ Files                                               │
│ ┌─────────────────────────────────────────────────┐ │
│ │ No files queued                                 │ │
│ │                                                 │ │
│ │ [+ Add Media Files]                             │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│                        ┌────────┐ ┌──────────────┐ │
│                        │ Cancel │ │   Add Item   │ │
│                        └────────┘ └──────────────┘ │
└─────────────────────────────────────────────────────┘
```

### Mobile Layout

```
┌───────────────────────────┐
│      Add New Item         │
├───────────────────────────┤
│ Name                      │
│ ┌───────────────────────┐ │
│ │ The Matrix            │ │
│ └───────────────────────┘ │
│                           │
│ Description               │
│ ┌───────────────────────┐ │
│ │ A computer hacker...  │ │
│ └───────────────────────┘ │
│                           │
│ Artwork                   │
│ ┌───────────────────────┐ │
│ │      Poster (2:3)     │ │
│ │                       │ │
│ │      [thumbnail]      │ │
│ │                       │ │
│ │  From TMDB  [Change]  │ │
│ └───────────────────────┘ │
│ ┌───────────────────────┐ │
│ │      Hero (16:9)      │ │
│ │    [thumbnail]        │ │
│ │  From TMDB  [Change]  │ │
│ └───────────────────────┘ │
│                           │
│ Files                     │
│ ┌───────────────────────┐ │
│ │ No files queued       │ │
│ │ [+ Add Media Files]   │ │
│ └───────────────────────┘ │
│                           │
│  [Cancel]   [Add Item]    │
└───────────────────────────┘
```

## User Flows

### Flow A: TMDB Movie Search

1. Open Add Item dialog
2. Type in Name field → TMDB combobox searches
3. Select TMDB movie → Wizard opens
4. Step 1: Confirm/edit name and description
5. Step 2: Select poster (TMDB gallery or upload)
6. Step 3: Select hero (TMDB gallery or upload)
7. Wizard closes → Summary view shows all selections
8. Optionally expand "Add Media Files" to queue video/subtitle files
9. Click "Add Item"

### Flow B: TMDB TV Episode Search

1. Open Add Item dialog
2. Type in Name field → Select TV show from TMDB
3. Episode picker: Select season → Select episode
4. Wizard opens with episode metadata
5. Step 1: Confirm/edit name and description (episode has no artwork)
6. Wizard closes → Summary view shows name/description, artwork section hidden
7. Optionally add files
8. Click "Add Item"

### Flow C: Manual Entry

1. Open Add Item dialog
2. Type name manually (no TMDB selection)
3. Optionally add description
4. Artwork section shows "None selected" with "Add" buttons
5. Optionally add files
6. Click "Add Item"

## Component Structure

### Summary View Sections

1. **Name Field**
   - MediaSearchCombobox (existing)
   - Triggers wizard on TMDB selection

2. **Description Field**
   - Textarea with character count
   - Pre-filled from wizard or manual entry

3. **Artwork Preview Section**
   - Side-by-side poster and hero thumbnails (desktop)
   - Stacked vertically on mobile, full width, preserving aspect ratios
   - Source label: "From TMDB" / "Uploaded" / "None"
   - "Change" button opens single-step modal for that artwork type only
   - Aspect ratios: Poster 2:3, Hero 16:9
   - Hidden entirely for TV episode selections (episodes have no artwork)

4. **Files Section**
   - Collapsed by default: "No files queued" or "{n} files queued"
   - Expand button: "+ Add Media Files"
   - When expanded: Dropzones for Media, Subtitles, Other (NOT Artwork)
   - Queued file list with remove buttons

### Artwork Preview Card Details

The ArtworkPreviewCard component handles three selection sources:

| Source | Thumbnail                                    | Label           | State Storage                                                                     |
| ------ | -------------------------------------------- | --------------- | --------------------------------------------------------------------------------- |
| TMDB   | `https://image.tmdb.org/t/p/w185{file_path}` | "From TMDB"     | `posterValue` = file_path, `posterSource` = "tmdb"                                |
| Queued | `URL.createObjectURL(file.file)`             | "Uploaded"      | `posterValue` = file.id, `posterSource` = "queued", file in `queuedFiles.artwork` |
| None   | Placeholder icon                             | "None selected" | `posterValue` = null                                                              |

When multiple files are queued for the same artwork type:

- First file shown as primary thumbnail
- Badge shows "+N more" if additional files queued
- All files uploaded on submit, first marked as primary

### New Components Needed

```
components/items/
├── add-item-dialog.tsx          # Refactor to summary view
├── artwork-preview-card.tsx     # NEW: Thumbnail + source label + change button
├── files-section.tsx            # NEW: Collapsible files area
└── item-dialog-tabs.tsx         # Keep for ItemSettingsDialog only
```

## Implementation Tasks

### Phase 1: Summary Layout

- [ ] Remove Tabs wrapper from add-item-dialog.tsx
- [ ] Create single-column summary layout
- [ ] Move name/description fields to top
- [ ] Add responsive breakpoint for mobile stacking

### Phase 2: Artwork Preview

- [ ] Create ArtworkPreviewCard component
  - Thumbnail display (TMDB URL or queued file object URL)
  - Source label (From TMDB / Uploaded / None)
  - "Change" button
  - "+N more" badge for multiple queued files
- [ ] Add poster and hero preview cards to summary
- [ ] Wire "Change" to open single-step artwork modal
- [ ] Handle TV episode case: hide artwork section when no images available

### Phase 3: Files Section

- [ ] Create collapsible FilesSection component
- [ ] Show queued file count when collapsed
- [ ] Expand to show dropzones (Media, Subtitles, Other only - NO Artwork)
- [ ] Remove Artwork from file type options in Add dialog

### Phase 4: State Management

- [ ] Simplify dialog state (no activeTab needed)
- [ ] Ensure wizard selections persist to summary
- [ ] Handle "Change" button reopening single artwork step
- [ ] Clear queued artwork when switching from queued to TMDB selection

### Phase 5: Polish

- [ ] Responsive layout (stack artwork cards on mobile)
- [ ] Keyboard navigation through summary sections
- [ ] Focus management after wizard/change modal closes
- [ ] Update tests

### Phase 6: Cleanup

- [ ] Keep item-dialog-tabs.tsx for ItemSettingsDialog
- [ ] Update ItemSettingsDialog imports if needed
- [ ] Remove unused code from add-item-dialog.tsx

## Edge Cases

1. **No TMDB selection**: Show empty artwork cards with "Add" buttons
2. **TMDB has no images**: Show "No poster available from TMDB" state with upload option
3. **User uploads then switches to TMDB**: Clear queued artwork file, use TMDB selection
4. **Long description**: Truncate in summary with "Show more" expansion
5. **Many queued files**: Scrollable list within Files section
6. **TV Episode selection**: Hide artwork section entirely (episodes have no poster/backdrop)
7. **Multiple queued artwork files**: Show first as primary thumbnail with "+N more" badge
8. **Change button clicked**: Opens modal for just that artwork type, independent of other selections
9. **Mobile viewport**: Stack poster and hero cards vertically, maintain aspect ratios

## Interaction Specifications

### "Change" Button Behavior

- Opens a modal containing only the relevant selection step (PosterSelectionStep or HeroSelectionStep)
- Poster and Hero selections are independent - changing one does not affect the other
- Modal has "Cancel" (discard changes) and "Save" (apply new selection) buttons
- On save, summary view updates to reflect new selection

### Artwork Source Priority

When user makes a new selection, it replaces the previous:

1. User selects TMDB image → posterSource = "tmdb", clears any queued artwork
2. User uploads file → posterSource = "queued", file added to queue
3. User skips → posterSource = null, posterValue = null

## Files to Modify

| File                         | Change                                              |
| ---------------------------- | --------------------------------------------------- |
| `add-item-dialog.tsx`        | Major refactor - remove tabs, implement summary     |
| `item-dialog-tabs.tsx`       | Keep for ItemSettingsDialog only, no changes needed |
| `poster-selection-step.tsx`  | No changes                                          |
| `hero-selection-step.tsx`    | No changes                                          |
| `title-description-step.tsx` | No changes                                          |

## Testing

### Unit Tests

- ArtworkPreviewCard: renders TMDB, queued, and empty states
- ArtworkPreviewCard: "Change" button fires callback
- ArtworkPreviewCard: "+N more" badge shows correct count
- FilesSection: collapsed/expanded states
- FilesSection: file count display
- Update existing add-item-dialog tests for new structure

### E2E Tests

- Full flow: TMDB movie → wizard → summary → submit
- Full flow: TMDB TV episode → wizard (no artwork) → summary → submit
- Manual entry: name only → submit
- Manual entry: with uploaded artwork → submit
- Change artwork: TMDB → Change → upload → save → verify summary updates
- Mobile: verify stacked layout and touch interactions

## Decisions Made

1. **"Change" artwork behavior**: Opens single-step modal for that artwork type only (not full wizard)

2. **Files section default state**: Collapsed, with clear "+ Add Media Files" affordance

3. **Settings dialog**: Keeps tabs (different context - editing existing item with existing files)

4. **item-dialog-tabs.tsx**: Kept for ItemSettingsDialog, not removed

5. **TV Episode handling**: Artwork section hidden entirely (clean UX, no confusing empty state)

6. **Multiple queued files**: First shown as primary, badge indicates additional files
