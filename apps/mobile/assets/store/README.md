# App Store Assets

## App Icon

The app icon must be a 1024x1024 PNG with no transparency and no rounded corners (stores apply rounding).

Design requirements:
- Background: #0a0a0a (CanonCore dark)
- Foreground: CanonCore wordmark or "CC" monogram in white/brand accent
- No text smaller than 10% of icon size
- Simple, recognisable at small sizes (29x29 px minimum render)

### Generate icon variants

Expo automatically generates all required sizes from the 1024x1024 source.

- `icon.png` — 1024x1024, used for iOS App Store and general icon
- `adaptive-icon.png` — 1024x1024 foreground layer (Android adaptive icon, padded with safe zone)

### Adaptive Icon Safe Zone

Android adaptive icons use a 66% visible area. Keep the logo within the centre 66% circle:
- Canvas: 1024x1024
- Safe zone: ~174px inset on each side (visible area ~676x676)
- Background colour: #0a0a0a (set in app.config.ts)

## Feature Graphic (Google Play)

- Size: 1024x500 PNG or JPEG
- Used at top of Play Store listing
- File: `feature-graphic.png`
- Include app name and a representative screenshot or illustration

## Splash Screen

- `splash-icon.png` — app logo centred on #0a0a0a background
- Expo renders this at native resolution; keep it simple (logo only, no text)
