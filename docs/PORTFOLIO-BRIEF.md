# CanonCore Portfolio Brief

## Files to Provide to Claude Web

1. **This file** - `docs/PORTFOLIO-BRIEF.md`
2. **CLAUDE.md** - Technical architecture and codebase patterns
3. **All deployment docs** - `docs/deployments/DEPLOYMENT-*.md` (shows project evolution from v0.2.0 to v5.0.0)
4. **Handbook files** - Portfolio writing guidelines and style references (attached separately)

---

This document provides context for writing portfolio copy about CanonCore. It complements the deployment docs (showing project evolution) and CLAUDE.md (technical architecture).

---

## The Problem CanonCore Solves

### The Pain Point

Media enthusiasts who maintain personal libraries (movies, TV shows, documentaries) face a fragmented experience:

1. **Files live in cloud storage** (Google Drive) but there's no good way to browse them as a media library
2. **Metadata is manual** - you have to remember what's in each folder, what you've watched, where you left off
3. **No visual browsing** - cloud storage shows file names, not movie posters and episode artwork
4. **Progress tracking doesn't exist** - no way to know "I'm 3 episodes into Season 2" or "I've watched 60% of my sci-fi collection"
5. **Sharing collections is impossible** - you can't show friends your curated library without giving them full Drive access

### The Solution

CanonCore transforms Google Drive folders into a beautiful, Netflix-like media library interface:

- **Visual Library** - Movie posters, TV show artwork, episode thumbnails
- **Smart Metadata** - One click to pull in titles, descriptions, and artwork from TMDB
- **Progress Tracking** - Automatic watch progress across your entire library hierarchy
- **Continue Watching** - "Next Up" buttons that know exactly where you left off
- **Public Profiles** - Share your curated collections without exposing your files
- **Forking** - Let others copy your organizational structure to their own library

---

## Target Audience

### Primary Users

1. **Media Collectors** - People who maintain personal movie/TV libraries (legally owned content, home videos, etc.)
2. **Curators** - Users who want to share their organizational systems with others
3. **Privacy-Conscious** - Users who want their media in their own cloud storage, not a third-party service

### Secondary Users

1. **Cord-Cutters** - People managing their own streaming alternatives
2. **Film Enthusiasts** - Users who want to track viewing across large collections
3. **Educators** - Managing video content libraries for courses

---

## Key Features to Highlight

### Visual Experience

- **Cinematic Hero Banners** - Full-width artwork with gradient overlays, animated progress bars
- **Movie Poster Grid** - Netflix-style browsing with lazy-loaded images
- **Dark Mode** - Full dark theme with proper color-scheme support
- **Responsive Design** - Desktop, tablet, and mobile optimized

### Smart Organization

- **Hierarchical Items** - Nested folders (Movies → Sci-Fi → Blade Runner)
- **Drag-and-Drop Reordering** - Visual edit mode with smooth animations
- **Custom Sort & Filter** - By name, date, progress, sync status
- **Pinned Items** - Quick access sidebar shortcuts

### TMDB Integration

- **One-Click Metadata** - Search for any movie/show, auto-fill everything
- **Poster Selection** - Choose from multiple poster options
- **Backdrop Selection** - Pick hero artwork from available images
- **Episode Data** - Full season/episode structure with air dates

### Google Drive Sync

- **Bidirectional Sync** - Changes flow both ways (web ↔ Drive)
- **Browser Uploads** - Upload directly through the web interface
- **Resumable Uploads** - Large file support with progress tracking
- **Encrypted Credentials** - AES-256-GCM for OAuth tokens

### Progress Tracking

- **Automatic Progress** - Updates as you watch (90% = complete)
- **Hierarchical Aggregation** - Folder progress shows all descendants
- **Visual Progress Bars** - On cards, in hero sections, throughout UI
- **Continue Watching** - "Next Up" finds your next incomplete item via DFS

### Public Profiles & Sharing

- **Public Profiles** - Share at `/u/username`
- **Item Visibility Control** - Granular public/private per item
- **Inherited Visibility** - Children can inherit parent's visibility
- **Forking** - Copy someone's organizational structure
- **Explore Page** - Discover public collections from the community

### Media Playback

- **In-Browser Player** - Vidstack-based video player
- **Subtitle Support** - SRT, VTT, ASS formats
- **Resume Playback** - Pick up exactly where you left off
- **Range Request Streaming** - Efficient seeking in large files

---

## Demo Data Context

The seeded database includes 5 users with distinct themed collections, providing visual variety for screenshots:

### Demo Users

| Username | Theme | Movies | TV Shows |
|----------|-------|--------|----------|
| `demo` | Classic Cinema | Shawshank, Godfather I/II, Pulp Fiction, Matrix | Breaking Bad, The Sopranos |
| `filmfan` | International Film | Spirited Away, Parasite, Amélie, Pan's Labyrinth | Squid Game, Dark |
| `bingewatcher` | Peak TV | Dark Knight, Inception, Interstellar | Game of Thrones, Stranger Things, The Office, Friends |
| `scifi_jordan` | Sci-Fi/Fantasy | Blade Runner, Dune, Arrival, Ex Machina | Doctor Who, The Expanse, Black Mirror |
| `testuser` | Empty (E2E) | None | None |

### Progress Simulation

Each user has different simulated watch progress for visual variety:
- `demo`: 25-75% progress (mid-way through collections)
- `filmfan`: 80-100% progress (nearly complete)
- `bingewatcher`: 10-30% progress (just started)
- `scifi_jordan`: 40-60% progress (halfway through)

### Folder Structure

Seeded content uses grouped structure:
```
My Items
├── Movies
│   ├── The Shawshank Redemption
│   ├── The Godfather
│   └── ...
└── TV Shows
    ├── Breaking Bad
    │   ├── Season 1
    │   │   ├── Pilot
    │   │   ├── Cat's in the Bag...
    │   │   └── ...
    │   └── Season 2
    └── ...
```

---

## Screenshot Opportunities

### Hero Moments (Most Impressive)

1. **Explore Page Carousel** - Featured collections with rotating hero artwork
2. **Profile Hero** - Full-width cinematic banner with avatar overlay
3. **Item Detail Hero** - Movie/show hero with progress bar and "Next Up" button
4. **Grid View** - Netflix-style poster grid with progress indicators

### Feature Demonstrations

5. **Spotlight Search** - Search dialog showing items, public collections, and people
6. **TMDB Metadata Wizard** - Step-by-step poster/backdrop selection
7. **Edit Mode** - Drag handles visible, simplified icons
8. **Settings Dialog** - Tabbed interface with file management
9. **Progress Bars** - Hero progress bar with "5/10 watched" labels
10. **Dark Mode Toggle** - Before/after comparison

### Mobile Experience

11. **Mobile Grid** - 2-column poster grid on phone
12. **Mobile Navigation** - Sidebar drawer and bottom sheets
13. **Mobile Hero** - Responsive hero scaling

### Technical Showcases

14. **Google Drive Connection** - OAuth flow and storage quota display
15. **Sync Status Badges** - Synced/pending/error states
16. **Public Profile** - Viewer mode with fork button

---

## Technical Achievements

### Architecture Highlights

- **Next.js 16 App Router** - Latest React Server Components architecture
- **React 19** - Cutting-edge React with concurrent features
- **Prisma 7** - Type-safe database access with PostgreSQL
- **Tailwind CSS 4** - Modern utility-first styling

### Performance Optimizations

- **Lazy Loading** - Intersection Observer for images
- **Code Splitting** - Dynamic imports for heavy components (dnd-kit, embla)
- **Request Deduplication** - React.cache() for server-side data
- **Optimistic Updates** - Immediate UI feedback

### Security Implementation

- **AES-256-GCM Encryption** - For OAuth credentials
- **Rate Limiting** - Upstash Redis for API protection
- **CSRF Protection** - Signed state for OAuth flows
- **Security Headers** - Full OWASP recommendations

### Testing Coverage

- **2300+ Unit Tests** - Vitest with comprehensive mocking
- **Integration Tests** - Real database testing
- **E2E Tests** - Playwright with Page Object Model
- **Mobile E2E** - Dedicated mobile Chrome testing

---

## User Experience Highlights

### Attention to Detail

- **Reduced Motion Support** - Respects `prefers-reduced-motion`
- **Skeleton Loading States** - Polished loading experience
- **Toast Notifications** - Non-intrusive feedback
- **Keyboard Navigation** - Full keyboard accessibility
- **Context Menus** - Right-click for quick actions

### Empty States

- **First-Time User** - Welcoming message with "Add Item" CTA
- **Empty Folder** - Contextual "Add your first item" prompt
- **No Filter Results** - Helpful "Try a different filter" message

### Error Handling

- **Graceful Degradation** - Fallback UI for failures
- **Circuit Breaker** - Protection against cascade failures
- **Offline Queue** - IndexedDB queue for offline operations

---

## Project Scale

### Codebase Metrics

- **140+ Components** - Comprehensive UI library
- **50+ Server Actions** - Type-safe backend operations
- **28 Documentation Pages** - Full user documentation
- **70+ E2E Test Files** - Extensive journey coverage

### Version History

- **v1.0.0** - Core item management with SFTP
- **v2.0.0** - Google Drive migration
- **v3.0.0** - Public profiles and forking
- **v4.0.0** - TMDB integration and progress tracking
- **v5.0.0** - Unified profile architecture and hero carousel

---

## Unique Selling Points

### For Portfolio Context

1. **Full-Stack Solo Project** - Complete application built independently
2. **Production Quality** - Real users could sign up and use this today
3. **Modern Stack** - Cutting-edge technologies (Next.js 16, React 19)
4. **Comprehensive Testing** - Professional testing practices
5. **Beautiful UI** - Cinematic, polished visual design
6. **Complex Features** - OAuth, real-time sync, progress tracking, public sharing

### What Makes It Impressive

- Not a tutorial project - original concept with real complexity
- Handles edge cases - offline, errors, rate limits, security
- Attention to detail - loading states, animations, accessibility
- Documentation - both user-facing and technical
- Evolution visible - 50+ deployment versions showing iterative development

---

## Suggested Copy Angles

### Technical Angle
"A full-stack media library application demonstrating modern web development practices: React Server Components, type-safe APIs, encrypted credential storage, and comprehensive test coverage."

### User Experience Angle
"Transform your Google Drive into a cinematic media library. Browse with movie posters, track your progress, and share curated collections - all while keeping your files in your own cloud storage."

### Portfolio Angle
"A production-ready application showcasing full-stack development: from OAuth integration and real-time sync to responsive design and accessibility. Built with Next.js 16, React 19, and PostgreSQL."

---

## Files Being Provided

1. **This Brief** - Context, screenshots, and copy angles
2. **CLAUDE.md** - Full technical architecture and patterns
3. **All Deployment Docs** - Version history showing project evolution
4. **seed-config.ts** - Demo data structure (already covered in this brief)
