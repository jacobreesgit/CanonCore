# Store Screenshots

## Workflow

### iOS App Store (marketing screenshots)

Uses `app-store-screenshots` — an AI agent skill that creates polished marketing images with device frames, headlines, and CanonCore branding.

1. Capture raw screenshots with Maestro: `pnpm screenshots:ios`
2. Generate marketing screenshots: `cd app-store-screenshots && npm run dev`
3. Click each slide in the browser to export PNGs at all 4 Apple sizes
4. Upload to App Store Connect

Exports at: 6.9" (1320x2868), 6.5" (1284x2778), 6.3" (1206x2622), 6.1" (1125x2436)

### Android Play Store (raw screenshots)

Uses raw Maestro captures directly.

1. Capture screenshots: `pnpm screenshots:android`
2. Upload to Play Console -> Store listing -> Phone screenshots

Requirements: min 2, max 8, 16:9 or 9:16 ratio, 320-3840px per side

### Google Play Feature Graphic

Separate asset: `assets/store/feature-graphic.png` (1024x500)

## Screenshot Screens

1. **Home** — Shelves with "Continue Watching", recent items
2. **Library** — Grid of items with artwork
3. **Item Detail** — Cinematic hero with TMDB metadata
4. **Player** — Expanded media player
5. **Explore** — Public collections and playlists

## Regenerating

To update screenshots after UI changes:
1. Run Maestro flows to capture new raw screenshots
2. Restart the app-store-screenshots dev server
3. Re-export PNGs from the browser
