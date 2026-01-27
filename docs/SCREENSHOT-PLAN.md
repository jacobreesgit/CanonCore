# Screenshot Plan for Portfolio

**Resolution:** 1920x1080 (all screenshots)
**Total:** 35 screenshots

---

## Updating This Plan

When adding new features, use this prompt to update the screenshot plan:

```
I've added a new feature to CanonCore: [DESCRIBE FEATURE]

Please update docs/SCREENSHOT-PLAN.md to:
1. Add a new screenshot entry for this feature (with login, route, capture instructions)
2. Update the total count
3. Add to the checklist
4. Consider if it replaces any existing screenshots or needs dark mode variant
```

**Last updated:** 2025-01-23
**Features covered:** Grid/Tree views, Video Player, TMDB Wizard, Progress Tracking, Google Drive Sync, Public Profiles, Spotlight Search, Edit Mode, Explore Page, Fork Dialog

---

## Login Credentials

All seeded users have the same password: `SeedPassword123!`

| User         | Email                      | Password         | Content Theme                                               |
| ------------ | -------------------------- | ---------------- | ----------------------------------------------------------- |
| demo         | demo@canoncore.com         | SeedPassword123! | Classic films (Shawshank, Godfather, Matrix) + Breaking Bad |
| filmfan      | filmfan@canoncore.com      | SeedPassword123! | International (Spirited Away, Parasite, Amélie)             |
| bingewatcher | bingewatcher@canoncore.com | SeedPassword123! | Nolan films + GoT, Stranger Things, The Office              |
| scifi_jordan | scifi@canoncore.com        | SeedPassword123! | Sci-Fi (Blade Runner, Dune) + Doctor Who                    |

---

## 9 Main Feature Screenshots

### 1. Library Grid

- **Login:** demo@canoncore.com
- **Route:** `/u/demo` → Grid view
- **Capture:** Hero carousel at top, poster cards with progress bars, Movies folder visible
- **Theme:** Light mode

### 2. Tree View

- **Login:** demo@canoncore.com
- **Route:** `/u/demo` → Tree view toggle
- **Capture:** Expanded Breaking Bad showing seasons/episodes, indentation visible
- **Theme:** Light mode

### 3. Video Player

- **Login:** demo@canoncore.com
- **Route:** `/u/demo` → Breaking Bad → Season 1 → Episode 1 → Play
- **Capture:** Vidstack player with progress bar, subtitle track selector open
- **Theme:** Light mode
- **Note:** Upload a video to S1E1 first

### 4. TMDB Wizard

- **Login:** demo@canoncore.com
- **Route:** Any page → Click "Add Item" → Search for a movie
- **Capture:** Step 2: poster selection grid with multiple poster options
- **Theme:** Light mode

### 5. Progress Tracking

- **Login:** demo@canoncore.com
- **Route:** `/u/demo` → Click into Breaking Bad folder
- **Capture:** "X/Y watched" label, progress bar, "Go to next" button visible
- **Theme:** Light mode

### 6. Google Drive Sync

- **Login:** demo@canoncore.com
- **Route:** Settings → Google Drive section
- **Capture:** Connected state with email, last sync time, storage usage bar
- **Theme:** Light mode

### 7. Explore Page

- **Login:** demo@canoncore.com
- **Route:** `/explore`
- **Capture:** Featured carousel with public items (not Dune 2021), grid of public collections below
- **Theme:** Light mode
- **Note:** Fork button should NOT appear on items the user has already forked

### 8. Spotlight Search

- **Login:** demo@canoncore.com
- **Route:** Any page → Press `/` key
- **Capture:** Search modal with all 3 sections populated: Your Items, Public Collections, People
- **Theme:** Light mode
- **Tip:** Type a letter to show results in all sections

### 9. Edit Mode

- **Login:** demo@canoncore.com
- **Route:** `/u/demo` → Grid view → Click "Edit"
- **Capture:** Checkboxes on poster cards, drag handles visible, bulk actions toolbar at top
- **Theme:** Light mode

---

## 26 Marquee Screenshots

### Different Users' Libraries (10-13)

#### 10. filmfan Grid

- **Login:** filmfan@canoncore.com
- **Route:** `/u/filmfan` → Grid view
- **Capture:** International films - Spirited Away, Parasite, Amélie posters
- **Theme:** Light mode

#### 11. bingewatcher Grid

- **Login:** bingewatcher@canoncore.com
- **Route:** `/u/bingewatcher` → Grid view
- **Capture:** TV-heavy library - Game of Thrones, Stranger Things, The Office posters
- **Theme:** Light mode

#### 12. scifi_jordan Grid

- **Login:** scifi@canoncore.com
- **Route:** `/u/scifi_jordan` → Grid view
- **Capture:** Sci-fi aesthetic - Blade Runner, Dune, Arrival, Ex Machina posters
- **Theme:** Light mode

#### 13. scifi_jordan Tree

- **Login:** scifi@canoncore.com
- **Route:** `/u/scifi_jordan` → Tree view
- **Capture:** Doctor Who expanded showing Classic + Modern separation
- **Theme:** Light mode

---

### Dark Mode Variants (14-18)

#### 14. Library Grid (Dark)

- **Login:** demo@canoncore.com
- **Route:** `/u/demo` → Grid view
- **Capture:** Same as #1 but in dark mode
- **Theme:** Dark mode (toggle in header)

#### 15. Tree View (Dark)

- **Login:** scifi@canoncore.com
- **Route:** `/u/scifi_jordan` → Tree view
- **Capture:** Doctor Who expanded showing Classic/Modern era separation in dark mode
- **Theme:** Dark mode

#### 16. Spotlight Search (Dark)

- **Login:** demo@canoncore.com
- **Route:** Any page → Press `/`
- **Capture:** Search modal with results in dark mode
- **Theme:** Dark mode

#### 17. Public Profile (Dark)

- **Login:** demo@canoncore.com (viewing another user's profile)
- **Route:** `/u/filmfan`
- **Capture:** Visitor's view of public profile with Fork buttons in dark mode
- **Theme:** Dark mode

#### 18. Settings - Profile Tab (Dark)

- **Login:** demo@canoncore.com
- **Route:** Settings → Profile tab
- **Capture:** Name, avatar/hero uploads, public profile toggle in dark mode
- **Theme:** Dark mode

---

### Item Detail Pages (19-22)

#### 19. Movie Detail - The Matrix

- **Login:** demo@canoncore.com
- **Route:** `/u/demo` → Click on The Matrix
- **Capture:** Hero banner with backdrop, description, play button
- **Theme:** Light mode

#### 20. TV Show Detail - Game of Thrones

- **Login:** bingewatcher@canoncore.com
- **Route:** `/u/bingewatcher` → Click on Game of Thrones
- **Capture:** Hero banner with backdrop, season list/grid below
- **Theme:** Light mode

#### 21. Episode Detail - Doctor Who

- **Login:** scifi@canoncore.com
- **Route:** `/u/scifi_jordan` → Doctor Who → Series 1 → E01 - Rose
- **Capture:** Episode-specific hero, description, play button
- **Theme:** Light mode
- **Note:** Doctor Who consolidates Classic + Modern seasons under one folder

#### 22. International Film Detail

- **Login:** filmfan@canoncore.com
- **Route:** `/u/filmfan` → Click on Spirited Away
- **Capture:** Spirited Away detail page with hero
- **Theme:** Light mode

---

### Different UI States (23-27)

#### 23. Empty State

- **Login:** demo@canoncore.com
- **Route:** Create a new empty folder, click into it
- **Capture:** "Add your first item" empty state prompt
- **Theme:** Light mode

#### 24. Bulk Selection

- **Login:** demo@canoncore.com
- **Route:** `/u/demo` → Edit mode → Select multiple items
- **Capture:** Multiple checkboxes ticked, delete button active in toolbar
- **Theme:** Light mode

#### 25. Context Menu

- **Login:** demo@canoncore.com
- **Route:** `/u/demo` → Right-click on any item
- **Capture:** Context menu showing Pin, Delete, Settings, Add Child options
- **Theme:** Light mode

#### 26. Filter Active

- **Login:** filmfan@canoncore.com
- **Route:** `/u/filmfan` → Click Filter → Select "Has Files"
- **Capture:** Grid with filter chip visible, filtered results (international films)
- **Theme:** Light mode

#### 27. Sort Dropdown

- **Login:** bingewatcher@canoncore.com
- **Route:** `/u/bingewatcher` → Click Sort dropdown
- **Capture:** Sort menu open showing all options (Custom, Name, Date, etc.)
- **Theme:** Light mode

---

### Progress Variations (28-30)

#### 28. Nearly Complete (~90%)

- **Login:** filmfan@canoncore.com
- **Route:** `/u/filmfan` → Any folder with progress
- **Capture:** Progress bar nearly full (filmfan has 80-100% progress range)
- **Theme:** Light mode

#### 29. Just Started (~20%)

- **Login:** bingewatcher@canoncore.com
- **Route:** `/u/bingewatcher` → Any folder with progress
- **Capture:** Progress bar showing mixed progress (bingewatcher has 10-95% range)
- **Theme:** Light mode

#### 30. Mid-Progress (~50%)

- **Login:** scifi@canoncore.com
- **Route:** `/u/scifi_jordan` → Any folder with progress
- **Capture:** Progress bar at middle (scifi_jordan has 40-95% range)
- **Theme:** Light mode

---

### Public/Social Features (31-33)

#### 31. Public Profile

- **Login:** demo@canoncore.com (viewing another user's profile)
- **Route:** `/u/filmfan`
- **Capture:** Visitor's view of public profile with hero carousel, international films, Fork buttons visible
- **Theme:** Light mode

#### 32. Fork Dialog

- **Login:** demo@canoncore.com
- **Route:** `/u/filmfan` → Click Fork on any item
- **Capture:** Fork destination picker dialog showing folder selection
- **Theme:** Light mode

#### 33. Settings - Connections Tab (Light)

- **Login:** demo@canoncore.com
- **Route:** Settings → Connections tab
- **Capture:** Google Drive connection card with settings
- **Theme:** Light mode

---

### Hero Carousel States (34-35)

#### 34. Multi-slide Carousel

- **Login:** Any user or logged out
- **Route:** `/explore`
- **Capture:** Carousel with multiple slides, navigation dots visible, auto-playing, attribution badges visible
- **Theme:** Dark mode

#### 35. Single Hero Banner

- **Login:** demo@canoncore.com
- **Route:** `/u/demo` → Click into any movie with backdrop
- **Capture:** Full-width hero banner with gradient overlay
- **Theme:** Light mode

---

## Checklist

### Pre-Screenshot Setup

- [x] Run seed if needed: `pnpm prisma db seed`
- [x] Upload video to Breaking Bad S1E1
- [x] Ensure Google Drive is connected for demo user

### Portfolio Screenshots (1-9) ✅

- [x] 1. Library Grid
- [x] 2. Tree View
- [x] 3. Video Player
- [x] 4. TMDB Wizard (Dune)
- [x] 5. Item Settings (Breaking Bad)
- [x] 6. Google Drive Sync
- [x] 7. Explore Page
- [x] 8. Spotlight Search
- [x] 9. Edit Mode

### Marketing Suite (10-35) ✅

- [x] 10. filmfan Grid
- [x] 11. bingewatcher Grid
- [x] 12. scifi_jordan Grid
- [x] 13. scifi_jordan Tree
- [x] 14. Library Grid (Dark)
- [x] 15. Tree View (Dark)
- [x] 16. Spotlight Search (Dark)
- [x] 17. Public Profile (Dark)
- [x] 18. Settings - Profile Tab (Dark)
- [x] 19. Movie Detail - The Matrix
- [x] 20. TV Show Detail - Game of Thrones
- [x] 21. Episode Detail - Doctor Who
- [x] 22. International Film Detail - Spirited Away
- [x] 23. Empty State
- [x] 24. Bulk Selection
- [x] 25. Context Menu
- [x] 26. Filter Active
- [x] 27. Sort Dropdown
- [x] 28. Nearly Complete
- [x] 29. Just Started
- [x] 30. Mid-Progress
- [x] 31. Public Profile
- [x] 32. Fork Dialog
- [x] 33. Settings - Connections Tab
- [x] 34. Multi-slide Carousel (Dark)
- [x] 35. Single Hero Banner

---

## Output Folder

Save all screenshots to: `public/portfolio/`

Naming convention examples:

- `01-library-grid.png` - Library Grid View
- `05-progress-tracking.png` - Progress Tracking
- `20-got-detail.png` - Game of Thrones Detail
- `33-settings-connections.png` - Settings Connections Tab
