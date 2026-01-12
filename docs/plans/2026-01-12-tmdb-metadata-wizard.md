# TMDB Metadata Wizard Design

## Overview

Enhance the item metadata experience with a multi-step TMDB metadata wizard, tabbed settings interface, episode support, and improved seed quality.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Add Item Dialog / Item Settings Dialog                      │
│  ├─ Title field = MediaSearchCombobox (TMDB autocomplete)   │
│  └─ On select → Opens MetadataWizardModal                   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ MetadataWizardModal (3 steps)                               │
│  ├─ Step 1: TitleDescriptionStep (checkboxes to apply)      │
│  ├─ Step 2: PosterSelectionStep (tabbed grid)               │
│  └─ Step 3: HeroSelectionStep (tabbed grid)                 │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ ImageSelectionGrid (reusable)                               │
│  ├─ Tab: "From TMDB" → fetched images                       │
│  └─ Tab: "My Uploads" → existing artwork files              │
└─────────────────────────────────────────────────────────────┘
```

## Metadata Wizard Modal

### Trigger

User selects a TMDB result from the title field (MediaSearchCombobox) in either Add Item or Edit Item dialogs.

### Step 1: Title & Description

- Show TMDB title with checkbox to apply
- Show TMDB description with checkbox to apply
- For Add Item: Shows "Will be set to:" (no current value)
- For Edit Item: Shows diff "Current: X → Will become: Y"
- Checkboxes default to checked; user can uncheck to skip

### Step 2: Poster Selection (Plex-style grid)

- Tabbed interface: "From TMDB" | "My Uploads"
- From TMDB: Fetches `/movie/{id}/images` or `/tv/{id}/images`, shows posters sorted by vote average
- My Uploads: Shows existing artwork files from the item
- First poster pre-selected
- Skip checkbox available

### Step 3: Hero Banner Selection

- Same tabbed grid interface as poster
- From TMDB: Fetches backdrops, sorts textless (`iso_639_1: null`) first
- Landscape aspect ratio (16:9 thumbnails)
- Skip checkbox available
- Final "Apply Changes" button downloads/uploads selected images

## Episode Hierarchical Drill-Down

When user searches and selects a TV show, they can drill down:

1. **Search results** → Select show
2. **Season list** → Pick season (with episode counts)
3. **Episode list** → Pick episode
4. **Wizard opens** with episode metadata

Escape hatches at each level:

- "Use Show Metadata Instead"
- "Use Season Metadata Instead"

## Item Settings Tabbed Interface

Two tabs:

- **Details tab**: Name (MediaSearchCombobox), description
- **Files tab**: Primary media, primary artwork, hero banner (always visible), default subtitle

Key changes:

- Hero Banner picker always visible (not conditional on 2+ artwork)
- Title field replaced with MediaSearchCombobox
- Cleaner separation between metadata and file management

## Seed Script Improvements

### New TMDB Client Functions

```typescript
getMovieImages(id: number): Promise<TMDBImages>
getTVShowImages(id: number): Promise<TMDBImages>

interface TMDBImages {
  backdrops: TMDBImage[];
  posters: TMDBImage[];
}

interface TMDBImage {
  file_path: string;
  vote_average: number;
  iso_639_1: string | null;  // null = textless
  width: number;
  height: number;
}

getBestTextlessBackdrop(images: TMDBImages): string | null
```

### Seed Changes

- Fetch `/images` endpoint for each movie/show
- Pick best textless backdrop for hero image
- Download at `w1280` or `original` size for quality
- Set `isHero: true` on hero artwork file
- Add rate limiting delay between `/images` calls

## Testing Strategy

### Unit Tests (new)

```
tests/unit/
├── components/items/
│   ├── metadata-wizard-modal.test.tsx
│   ├── image-selection-grid.test.tsx
│   ├── episode-picker.test.tsx
│   └── item-settings-dialog.test.tsx  ← update for tabs
├── lib/
│   └── tmdb-client.test.ts  ← add getMovieImages, getTVShowImages
```

### Integration Tests (new)

```
tests/integration/
├── tmdb/
│   ├── apply-metadata.test.ts  ← update for confirmation flow
│   ├── fetch-images.test.ts    ← new
│   └── episode-lookup.test.ts  ← new
```

### E2E Tests (new)

```
e2e/journeys/items/
├── metadata-wizard.spec.ts
│   ├── search and select movie
│   ├── confirm title/description checkboxes
│   ├── select poster from grid
│   ├── select hero from grid
│   └── verify images applied
├── episode-lookup.spec.ts
│   ├── drill down show → season → episode
│   └── apply episode metadata
└── item-settings-tabs.spec.ts
    ├── switch between Details/Files tabs
    └── hero picker always visible
```

### Tests to Update

- `add-item-dialog.test.tsx` - title field now triggers wizard
- `media-search-combobox.test.tsx` - episode drill-down support
- `seed.test.ts` - textless backdrop fetching

## File Changes

### New Files

```
components/items/
├── metadata-wizard-modal.tsx      # 3-step wizard container
├── title-description-step.tsx     # Step 1: checkboxes
├── image-selection-grid.tsx       # Reusable tabbed grid
├── poster-selection-step.tsx      # Step 2: poster picker
├── hero-selection-step.tsx        # Step 3: hero picker
└── episode-picker.tsx             # Show → Season → Episode drill-down
```

### Modified Files

```
components/items/
├── add-item-dialog.tsx            # Title field → MediaSearchCombobox + wizard trigger
├── item-settings-dialog.tsx       # Add tabs (Details/Files), always show hero picker
└── media-search-combobox.tsx      # Support episode drill-down mode

lib/
├── tmdb-client.ts                 # Add getMovieImages, getTVShowImages, getBestTextlessBackdrop
└── tmdb-actions.ts                # Update applyMetadataAction for confirmation flow

prisma/
└── seed.ts                        # Fetch textless backdrops for hero images
```

## Behavioral Notes

### No Hero Banner Selected

If user skips hero selection or no hero is set, fall back to primary artwork (poster) for the hero display. The existing shader/gradient effect handles the visual treatment.

### Children Inheritance

Applying metadata to a show does NOT cascade to seasons/episodes. Each item is updated individually. User must drill down and apply metadata to children separately if desired.

## Breaking Changes

None - existing items continue to work, new features are additive.
