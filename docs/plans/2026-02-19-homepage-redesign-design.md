# Homepage Redesign Design

**Date:** 2026-02-19
**Branch:** `feat/homepage-redesign` (off `production`)
**Reference:** [Payload CMS website](https://github.com/payloadcms/website) (MIT licensed)

## Goal

Replace CanonCore's text-only landing page with a cinematic, visually rich homepage modelled after payloadcms.com. Use Payload's actual assets (video, images, textures) as placeholders — copy and imagery will be swapped out later.

## Decisions

| Decision | Choice |
|----------|--------|
| Sections | All 8 of Payload's homepage sections |
| Layout | Inside the existing app shell (sidebar + mobile footer nav) |
| Visual effects | All (video bg, grid lines, scanlines, noise) |
| Navigation | Keep existing sidebar nav (no mega-menu header) |
| Approach | Direct port using Tailwind CSS (no SCSS modules) |

## Architecture

The homepage renders inside `SidebarInset` (the app shell's main content area). No separate marketing header or footer — the existing sidebar and mobile footer nav handle navigation. The page is a single scrollable column of 6 content sections.

### File Structure

```
app/(public)/
  page.tsx                    # Server component (auth check, JSON-LD, renders HomepageContent)
  landing-hero.tsx            # REPLACED — becomes import of HomepageContent
components/homepage/
  homepage-content.tsx        # Client component — orchestrates all 6 sections
  hero-section.tsx            # Section 1: Full-viewport hero
  logo-bar.tsx                # Section 2: Social proof logos
  use-cases-section.tsx       # Section 3: Interactive use case tabs
  testimonials-carousel.tsx   # Section 4: Quote card carousel
  feature-accordion.tsx       # Section 5: Accordion with images
  manifesto-cta.tsx           # Section 6: Closing CTA
  background-grid.tsx         # Shared: CSS grid-line overlay
  background-scanline.tsx     # Shared: Scanline texture overlay
  background-video.tsx        # Shared: Looping MP4 video background
```

## Section Designs

### Section 1: Hero (Full-Viewport)

**Height:** `calc(100vh - var(--header-height))` or `min-h-[calc(100dvh-4rem)]`

**Background layers (bottom to top):**
1. **Video:** Looping MP4 (`glass-animation-5-f0gPcjmKFIV3ot5MGOdNy2r4QHBoXt.mp4` from `l4wlsi8vxy8hre4v.public.blob.vercel-storage.com`). Autoplays, loops, muted, `playsInline`. Covers full section via `object-cover`.
2. **Grid overlay:** 5 vertical columns created with CSS `linear-gradient`. Lines are `rgba(255, 255, 255, 0.125)` with gradient fade-in from top.
3. **Scanline texture:** Tiling `scanline-light.png` (from Payload's `/images/`) at 8% opacity.
4. **Noise texture:** `noise.png` at ~3-5% opacity for subtle grain.

**Content (positioned over background):**
- **Left column (60%):**
  - H1: Large bold headline (Payload placeholder text)
  - Terminal command box: styled as monospace pill with copy button
  - Secondary CTA: text link with arrow icon
- **Right column (40%):**
  - Product screenshot image(s) with slight overlap/depth effect
  - Using Payload's admin panel screenshots as placeholders

**Responsive:** On mobile, stack content vertically. Hide right-column screenshots below `md` breakpoint.

### Section 2: Logo Bar

**Layout:** `max-w-4xl mx-auto` centered block.

**Content:**
- Paragraph: Payload's social proof copy (placeholder)
- 6-8 company logos in a flex row with `flex-wrap`
- Logos rendered with `grayscale` filter + `opacity-60` hover to `opacity-100`
- Using Payload's logo images from their public CDN as placeholders

**Spacing:** `py-16 md:py-24`

### Section 3: Use Cases (Interactive Tabs)

**Layout:** Two-column grid (`grid-cols-1 lg:grid-cols-2`).

**Left column:**
- H2 headline (Payload placeholder)
- Vertical list of 4 use case labels — each is a button
- Active state: white text, bold. Inactive: muted text
- Bottom: CTA link with arrow

**Right column:**
- Image that switches based on active tab
- Crossfade transition (CSS `opacity` + `transition-opacity`)
- Using Payload's use case screenshots as placeholders

**State:** `useState` for active tab index. Images preloaded.

**Spacing:** `py-16 md:py-24`

### Section 4: Testimonials Carousel

**Layout:** Full-width horizontal scroll.

**Content:**
- H2 headline above the carousel
- 5 quote cards, each containing:
  - Large quote text (serif or large sans-serif)
  - Attribution: name, role, company
  - Company logo (bottom-left)
  - "Case Study" link (bottom-right)
- Prev/next arrow buttons below the carousel

**Implementation:** Embla Carousel (already installed: `embla-carousel-react`). Cards are `min-w-[80vw] md:min-w-[60vw] lg:min-w-[40vw]`.

**Styling:** Cards have `bg-white/5 border border-white/10 rounded-lg` glass effect.

**Spacing:** `py-16 md:py-24`

### Section 5: Feature Accordion

**Layout:** Two-column grid (`grid-cols-1 lg:grid-cols-2`).

**Left column:**
- H3 headline
- 4 accordion items, each with:
  - Clickable title (bold when expanded)
  - Description text (shown when expanded, animated height)
  - "Learn more" link

**Right column:**
- Image corresponding to the expanded accordion item
- Crossfade transition on switch

**State:** `useState` for expanded item index. First item expanded by default.

**Spacing:** `py-16 md:py-24`

### Section 6: Manifesto / Closing CTA

**Layout:** Centered text block, `max-w-3xl mx-auto`.

**Content:**
- H2 headline
- 3-4 paragraphs of body copy
- 2 side-by-side CTA buttons with arrow icons
- Buttons have slide-in hover animation (duplicate inner text slides up on hover)

**Styling:** Buttons use `border border-white/20` outlined style with hover fill.

**Spacing:** `py-16 md:py-24` with extra bottom padding.

## Shared Visual Components

### BackgroundVideo

```tsx
// Looping MP4 video, absolutely positioned, covers parent
<video autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover">
  <source src={videoUrl} type="video/mp4" />
</video>
```

### BackgroundGrid

CSS-only component. A `div` containing 5 child `div`s, each positioned at 20% intervals across the width. Each child has a `linear-gradient` creating a vertical line that fades in from the top. Color: `rgba(255, 255, 255, 0.125)`.

### BackgroundScanline

A full-size `div` with `background-image: url('/images/scanline-light.png')`, `background-repeat: repeat`, `opacity: 0.08`. The scanline image is a tiny repeating texture (83 bytes).

## Asset Sources (Placeholders)

All assets are from Payload's public CDN or repo. They will be replaced with CanonCore assets later.

| Asset | Source | Purpose |
|-------|--------|---------|
| `glass-animation-5.mp4` | `l4wlsi8vxy8hre4v.public.blob.vercel-storage.com/video/` | Hero video background |
| `scanline-light.png` | Payload repo `public/images/` | Scanline texture |
| `noise.png` | Payload repo `public/images/` | Noise grain texture |
| Hero screenshots | Payload repo / CDN | Product screenshots |
| Company logos | Payload repo / CDN | Logo bar |
| Use case images | Payload repo / CDN | Use cases section |
| Testimonial logos | Payload repo / CDN | Testimonials |
| Feature images | Payload repo / CDN | Feature accordion |

## Interaction with App Shell

- The homepage renders inside `SidebarInset` (desktop) / main content area (mobile)
- The existing `SiteHeader` (breadcrumbs) appears above the hero
- The existing `AppSidebar` provides navigation on desktop
- The existing `MobileFooterNav` provides navigation on mobile
- No changes needed to the app shell components
- The hero section should account for the header height in its min-height calculation

## Accessibility

- All images have descriptive alt text
- Video background is decorative (no audio, `aria-hidden="true"`)
- Accordion uses proper `aria-expanded`, `aria-controls` attributes
- Carousel has prev/next buttons with `aria-label`
- All sections have proper heading hierarchy (H1 > H2 > H3)
- `prefers-reduced-motion` disables video autoplay and crossfade transitions

## Performance

- Video loads lazily (browser handles `<video>` lazy loading naturally)
- Scanline and noise textures are tiny (<1KB each) and cached
- Use case and feature images use Next.js `<Image>` with `priority` for above-fold, `loading="lazy"` for below
- Embla Carousel is already in the bundle (used by CinematicHero)
- No new dependencies required
