# Store Submission Checklist

Reference for manual configuration steps in App Store Connect and Google Play Console.
Code-managed config lives in `store.config.json` (Apple) and `eas.json`.

---

## Apple App Store Connect

### Before First Submission

- [ ] Create app record in App Store Connect
  - Bundle ID: `com.canoncore.mobile`
  - SKU: `canoncore-mobile`
  - Primary language: English (UK)
- [ ] Set primary category: Entertainment
- [ ] Set secondary category: Lifestyle
- [ ] Add privacy policy URL: `https://canoncore.com/legal/privacy`
- [ ] Complete App Privacy questionnaire:
  - Data collected: Email address (for authentication), name (display name), user content (library metadata)
  - Data linked to user: Email, name
  - Data not linked to user: Diagnostics (crash reports via Sentry)
  - Data used for tracking: None
- [ ] Upload screenshots (generated via Maestro — see screenshot flows)
  - iPhone 6.9" (1320x2868) — required (iPhone 16 Pro Max)
  - iPhone 6.5" (1284x2778) — required (fallback for older devices)
  - iPad Pro 12.9" (2048x2732) — if supporting tablet
- [ ] Add demo account credentials (managed in store.config.json `review` section)
- [ ] Set up ASC API Key for automated submissions

### For Each Release

- [ ] Update `store.config.json` release notes
- [ ] Push metadata: `eas metadata:push`
- [ ] Build + submit: `eas build -p ios --profile production --auto-submit`
- [ ] Monitor TestFlight processing (5-30 min)
- [ ] Submit for App Review from App Store Connect

---

## Google Play Console

### Before First Submission

- [ ] Create app in Google Play Console
  - App name: CanonCore
  - Default language: English (United Kingdom)
  - App type: App (not game)
  - Free / Paid: Free
- [ ] Complete store listing:
  - Short description (80 chars): "Organise your Google Drive media library with cinematic style."
  - Full description (4000 chars max):

    Transform your Google Drive into a beautifully organised media library.

    BROWSE YOUR LIBRARY
    - Grid view with cinematic artwork and colour-matched themes
    - Drill down through nested folders and collections
    - Search across your entire library instantly

    ENRICH WITH METADATA
    - Auto-fill metadata from TMDB (The Movie Database)
    - Track watch progress across movies, series, and audio
    - Mark items watched/unwatched with a tap

    PLAY ANYWHERE
    - Stream video with full playback controls and Picture-in-Picture
    - Background audio with lock screen controls
    - Cast to Chromecast and AirPlay devices
    - Download for offline playback

    ORGANISE WITH PLAYLISTS
    - Create custom playlists from your library
    - Share playlists publicly or via private links

    DISCOVER & SHARE
    - Explore public collections from other users
    - Fork collections to build on what others have curated

    Works with your existing Google Drive files — no upload required.

- [ ] Upload feature graphic: `assets/store/feature-graphic.png` (1024x500)
- [ ] Upload screenshots (generated via Maestro)
  - Phone: minimum 2, recommended 8 (16:9 or 9:16)
  - 7" tablet: optional
  - 10" tablet: optional
- [ ] Complete content rating questionnaire (IARC):
  - Violence: None
  - Sexuality: None
  - Language: None
  - Controlled substance: None
  - Interactive elements: Users interact, shares info, digital purchases (None for MVP)
- [ ] Set up target audience and content:
  - Target age: 13+ (no children-directed content)
  - Contains ads: No
- [ ] Complete data safety section:
  - Data collected: Email address, name, app interactions, crash logs
  - Data shared: None
  - Encryption in transit: Yes (HTTPS)
  - Data deletion: Users can delete their account
  - Privacy policy: `https://canoncore.com/legal/privacy`
- [ ] Set pricing: Free
- [ ] Select countries: All countries
- [ ] Create service account for automated submissions

### For Each Release

- [ ] Build: `eas build -p android --profile production`
- [ ] Submit: `eas submit -p android --latest`
- [ ] Monitor review status in Play Console

---

## Demo Account Setup

Create a dedicated demo account for store reviewers:

- Email: `demo@canoncore.com`
- Password: `AppReviewDemo2026!`
- Pre-populated library with diverse content (movies, TV series, music albums)
- Google Drive connected with sample media files
- Public profile enabled
- At least one playlist created

Seed this account using: `pnpm seed:production` (configure demo user in seed config)

---

## Required Credentials

| Secret | Type | Where |
|---|---|---|
| `EXPO_APPLE_ID` | env | EAS Secret |
| `EXPO_ASC_APP_ID` | env | EAS Secret |
| `EXPO_APPLE_TEAM_ID` | env | EAS Secret |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | file | EAS env (`eas env:create --type file --visibility secret`) |
| `ASC_API_KEY` | file | EAS Secret (`.p8` key for CI submissions) |
| `ASC_API_KEY_ID` | env | EAS Secret |
| `ASC_API_KEY_ISSUER_ID` | env | EAS Secret |

---

## Release Workflow

### Hotfix (JavaScript-only changes)

```bash
# Push OTA update to production users (no store review)
cd apps/mobile && eas update --channel production --message "fix: description of fix"
```

### Minor Release (new features, no native changes)

1. Update version in `store.config.json` release notes
2. Push OTA update: `eas update --channel production --message "feat: description"`
3. Optionally push metadata: `eas metadata:push`

### Major Release (native changes or new native modules)

1. Update `store.config.json` release notes
2. Build both platforms:
   ```bash
   eas build --profile production
   ```
3. Submit to both stores:
   ```bash
   eas submit -p ios --latest
   eas submit -p android --latest
   ```
4. iOS: Submit for App Review in App Store Connect
5. Android: Create release in Play Console (staged rollout recommended)
6. Push metadata: `eas metadata:push`

### Version Numbers

Managed automatically by EAS:
- `appVersionSource: "remote"` — EAS tracks current version
- `autoIncrement: true` — build numbers auto-increment
- To manually set: `eas build:version:set -p ios` (interactive prompt for version/build number)
