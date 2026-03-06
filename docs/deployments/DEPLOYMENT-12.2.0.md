# Deployment 12.2.0

**Date**: 2026-03-06
**Type**: Minor (multi-screen mockups, hero mobile polish, UI refinements)
**Branch**: `development`
**Migration Required**: No

## Overview

Adds multi-screen mockup support to the LS Graphics pipeline, allowing scenes with multiple device screens (e.g., two side-by-side laptops) to receive different screenshots at configurable click positions. Also improves hero profile layout on mobile, reduces mobile footer nav height, and adds a new item grid screenshot to the portfolio.

17 files changed across the diff (bulk from updated/new webp images).

## Changes

### Multi-screen mockup pipeline

Extended the LS Graphics pipeline to support scenes with multiple device screens:

- **New types**: `ScreenPosition` and `MultiScreenMockupEntry` in `mockup-config.ts`
- **Refactored upload flow**: Extracted `navigateToEditor()` and `uploadAtPosition()` from `uploadToScene()` in `ls-graphics.utils.ts`. `uploadAtPosition()` accepts relative X/Y coordinates (0–1) within the scene canvas
- **New function**: `generateMultiScreenMockup()` iterates over configured screens, uploading a different screenshot to each green screen area
- **Optional resize**: `downloadMockup()` now accepts an optional `resize` parameter for post-render resizing via sharp
- **New scene**: MacBook Air Scene 12 (two laptops side by side)
- **First multi-screen output**: `duo-spotlight-item-detail.webp` — spotlight search on the left laptop, item detail on the right
- **Test support**: `mockups.spec.ts` loops over `MULTI_SCREEN_MOCKUPS` with source-file-existence checks

### New item grid screenshot (05-item-grid)

- Added `05-item-grid` to `PORTFOLIO_FEATURES` → generates `05-item-grid-macbook.webp` and `05-item-grid-iphone.webp`
- Captured from the same Breaking Bad collection as the tree view, switching to `?view=grid` within the same test scenario
- Portfolio now has 9 features × 2 devices = 18 device mockups (was 8 × 2 = 16)

### Hero profile mobile responsive improvements

- **cinematic-hero.tsx**: Profile mode now stacks vertically and centres on mobile (`flex-col items-center`), switching to horizontal left-aligned layout on md+ (`md:flex-row md:items-end`)
- **hero-avatar.tsx**: Base avatar size bumped from `size-28` to `size-32`, removed redundant `sm:size-32` breakpoint. Image `sizes` attribute updated to match
- Bio text and progress bar centred on mobile (`mx-auto`), left-aligned on md+ (`md:mx-0`)

### Mobile footer nav height reduction

- `mobile-footer-nav.tsx`: Height reduced from `h-16` (64px) to `h-12` (48px) for a more compact bottom navigation bar

### Media stack height fix

- `media-stack.module.css`: Laptop mock height increased from `5×` to `6×` the column width unit — gives the laptop screenshot more vertical space in the homepage media stack

### Screenshot framing improvements

- Tree view (02) and item grid (05) screenshots now scroll to the progress label as an anchor point for consistent framing across runs
- Updated webp outputs for tree view, item detail, and explore page screenshots with improved positioning

## New files

| File | Purpose |
|------|---------|
| `public/images/duo-spotlight-item-detail.webp` | Multi-screen mockup (spotlight + item detail) |
| `public/portfolio/05-item-grid-iphone.webp` | Item grid view on iPhone |
| `public/portfolio/05-item-grid-macbook.webp` | Item grid view on MacBook |

## Deployment notes

### No migration required

No schema changes. No new environment variables.

### Verification

1. **Build passes**: `pnpm run build`
2. **Type check passes**: `pnpm run type-check`
3. **Lint passes**: `pnpm run lint`
4. **Homepage loads**: Media stack images render with correct aspect ratio
5. **Hero mobile**: Profile hero stacks vertically and centres on mobile viewports
6. **Mobile nav**: Bottom navigation bar is compact (48px)
7. **Mockup pipeline**: `pnpm run mockups` generates multi-screen mockups alongside single-screen ones
