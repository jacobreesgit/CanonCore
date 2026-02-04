# Apple TV+ Redesign Demo

Preview the cinematic Apple TV+ inspired redesign for CanonCore. Full-bleed heroes, refined typography, and content-forward interfaces.

## Quick Start

```bash
pnpm run dev
# Navigate to http://localhost:3000/demo/apple-tv-redesign
```

**Requires:** `TMDB_API_KEY` in `.env.local`

---

## Demo Routes

| Route                               | Description           | Example Content      |
| ----------------------------------- | --------------------- | -------------------- |
| `/demo/apple-tv-redesign`           | Index with navigation | Design principles    |
| `/demo/apple-tv-redesign/item`      | Single movie view     | Dune: Part Two       |
| `/demo/apple-tv-redesign/container` | TV show with tabs     | Severance            |
| `/demo/apple-tv-redesign/explore`   | Public discovery      | Hero carousel + grid |
| `/demo/apple-tv-redesign/profile`   | User profile          | @filmfan library     |

---

## Design System

### CSS Custom Properties

Scoped to `.apple-tv-demo` class in `layout.tsx`:

```css
/* Colors - Dark Mode */
--atv-bg: #0a0a0a;
--atv-surface: #141414;
--atv-text-primary: rgba(255, 255, 255, 0.95);
--atv-text-secondary: rgba(255, 255, 255, 0.6);
--atv-text-tertiary: rgba(255, 255, 255, 0.4);
--atv-progress: white;
--atv-border: rgba(255, 255, 255, 0.1);

/* Spacing */
--atv-px-mobile: 1.25rem;
--atv-px-sm: 2rem;
--atv-px-md: 2.5rem;
--atv-px-lg: 4rem;
--atv-px-xl: 5rem;

/* Gradients */
--atv-gradient-hero: linear-gradient(to top, #0a0a0a 0%, transparent 70%);
--atv-gradient-card: linear-gradient(
  to top,
  rgba(0, 0, 0, 0.9) 0%,
  transparent 100%
);
```

### Typography

- **Display font:** Geist (matches existing design system)
- **Hero titles:** `text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight`
- **Section headers:** `text-xs uppercase tracking-[0.2em] font-medium`
- **Metadata:** `text-sm tracking-wide tabular-nums`

### Hero Heights

| Variant     | Desktop | Mobile |
| ----------- | ------- | ------ |
| Item (leaf) | 65vh    | 55vh   |
| Container   | 50vh    | 40vh   |
| Explore     | 50vh    | 40vh   |
| Profile     | 50vh    | 40vh   |

### Grid Columns

| Breakpoint            | Columns |
| --------------------- | ------- |
| Mobile (<640px)       | 2       |
| Tablet (640-1024px)   | 4       |
| Desktop (1024-1280px) | 5       |
| Large (1280-1536px)   | 6       |
| XL (>1536px)          | 7       |

---

## Components

### Core Components

| Component          | File                     | Description                                        |
| ------------------ | ------------------------ | -------------------------------------------------- |
| `DemoHero`         | `demo-hero.tsx`          | Full-bleed hero with backdrop, gradients, metadata |
| `DemoPosterCard`   | `demo-poster-card.tsx`   | 2:3 aspect ratio card with hover-reveal overlay    |
| `DemoPosterGrid`   | `demo-poster-grid.tsx`   | Responsive grid with staggered animation           |
| `DemoHeroCarousel` | `demo-hero-carousel.tsx` | Auto-advancing carousel for explore page           |

### Metadata Components

| Component          | File                     | Description                            |
| ------------------ | ------------------------ | -------------------------------------- |
| `DemoMetadataLine` | `demo-metadata-line.tsx` | "2024 • 2h 46m • PG-13 • ★ 8.8" format |
| `DemoGenrePills`   | `demo-genre-pills.tsx`   | Horizontal genre badges                |
| `DemoProgressBar`  | `demo-progress-bar.tsx`  | Thin white progress bar (4px height)   |
| `DemoTabs`         | `demo-tabs.tsx`          | Contents/About tab switcher            |

### Content Sections

| Component             | File                       | Description                            |
| --------------------- | -------------------------- | -------------------------------------- |
| `DemoCastRow`         | `demo-cast-row.tsx`        | Horizontal scroll with circular photos |
| `DemoWatchProviders`  | `demo-watch-providers.tsx` | Streaming service logos from TMDB      |
| `DemoVideoRow`        | `demo-video-row.tsx`       | YouTube thumbnails with play overlay   |
| `DemoRecommendations` | `demo-recommendations.tsx` | "More Like This" poster grid           |
| `DemoAboutSection`    | `demo-about-section.tsx`   | Expandable description text            |

### Placeholder Components (Future Features)

| Component            | File                       | Description                          |
| -------------------- | -------------------------- | ------------------------------------ |
| `DemoPlaylistButton` | `demo-playlist-button.tsx` | Shows "Coming Soon" toast            |
| `DemoWikiAccordion`  | `demo-wiki-accordion.tsx`  | Locked sections for wiki integration |

### Utility Components

| Component        | File                   | Description                       |
| ---------------- | ---------------------- | --------------------------------- |
| `DemoHeroButton` | `demo-hero-button.tsx` | Pill-shaped glassmorphism buttons |
| `DemoSection`    | `demo-section.tsx`     | Wrapper with responsive padding   |

---

## Data Sources

### Real TMDB Data

All movie/TV data is fetched from TMDB API:

```typescript
// lib/tmdb-demo.ts
export const DEMO_TMDB_IDS = {
  movie: 693134, // Dune: Part Two
  tvShow: 95396, // Severance
  featured: [693134, 872585, 792307, 466420, 346698],
  libraryMovies: [840430, 666277, 467244, 829557, 915935, 1011985],
  libraryTvShows: [136315, 126308, 106379, 108545, 224458],
};
```

**Data fetched per item:**

- Details (title, overview, tagline, runtime, vote_average)
- Genres
- Content rating (US certification)
- Cast & crew (top 10)
- Watch providers (US streaming)
- Videos (YouTube trailers)
- Recommendations (6 similar titles)

### Mock Data

- **Progress percentages:** Deterministic based on index
- **User owners:** Rotating mock users (filmfan, moviebuff, etc.)

---

## Animations

### Page Load

- Hero content: `slide-up 350ms ease-out`
- Grid items: Staggered `fade-in-up` (40ms intervals, first 12 only)

### Interactions

- Poster hover: `scale(1.05)` + shadow + info overlay fade-in
- Button press: `scale(0.97)` for tactile feedback
- Carousel: 600ms crossfade between slides

### Reduced Motion

All animations respect `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
  .apple-tv-demo * {
    animation: none !important;
    transition: none !important;
  }
}
```

---

## Accessibility

- **Focus states:** White ring on all interactive elements
- **Keyboard navigation:** Full support, info overlay shows on `:focus-visible`
- **Screen readers:** Proper ARIA labels, roles, and live regions
- **Title always visible:** Cards show title without hover for a11y
- **Reduced motion:** Fully respected

---

## File Structure

```
app/(public)/demo/apple-tv-redesign/
├── layout.tsx              # CSS variables, animations (inherits PublicLayout with sidebar)
├── page.tsx                # Index with navigation
├── item/page.tsx           # Single movie view
├── container/page.tsx      # TV show with tabs
├── explore/page.tsx        # Hero carousel + grid
├── profile/page.tsx        # User profile
├── components/
│   ├── index.ts            # Component exports
│   ├── demo-hero.tsx
│   ├── demo-poster-card.tsx
│   ├── demo-poster-grid.tsx
│   ├── demo-hero-carousel.tsx
│   ├── demo-metadata-line.tsx
│   ├── demo-genre-pills.tsx
│   ├── demo-progress-bar.tsx
│   ├── demo-tabs.tsx
│   ├── demo-cast-row.tsx
│   ├── demo-watch-providers.tsx
│   ├── demo-video-row.tsx
│   ├── demo-recommendations.tsx
│   ├── demo-about-section.tsx
│   ├── demo-playlist-button.tsx
│   ├── demo-wiki-accordion.tsx
│   ├── demo-hero-button.tsx
│   └── demo-section.tsx
├── lib/
│   └── tmdb-demo.ts        # TMDB fetching utilities
└── README.md               # This file
```

**Note:** Located in `(public)` route group to inherit the app's sidebar navigation and mobile footer.

---

## Design Principles

1. **Content is the interface** — Artwork dominates, UI chrome minimal
2. **Breathing room** — Generous spacing, items don't feel cramped
3. **Subtle sophistication** — Refined transitions, no jarring movements
4. **Unified experience** — All page types share the same design system

---

## Related Documentation

- [Full Design Plan](/docs/plans/2026-02-03-apple-tv-redesign.md)
- [MediaWiki Integration Design](/docs/plans/2026-01-31-mediawiki-integration-design.md)
