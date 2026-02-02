/**
 * Storybook stories for the item page hero banner.
 * Single-slide HeroCarousel used on item detail pages (/u/[username]/[itemId]).
 *
 * Two main modes:
 * - Owner view: Shows Play/Resume, Go to Next, progress bar (no attribution)
 * - Public view: Shows attribution badge and Fork button (no media controls)
 */
import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn } from "storybook/test";
import { HeroCarousel, type HeroSlide } from "../hero-carousel";

// TMDB backdrop URLs for realistic visuals
const TMDB_BACKDROP_BASE = "https://image.tmdb.org/t/p/w1280";

/**
 * Item page hero banner component.
 * Single-slide mode of HeroCarousel for displaying item details with artwork.
 *
 * ## Features
 * - Full-width hero with backdrop image
 * - Owner view: Progress bar, Play/Resume button, Go to Next button
 * - Public view: Attribution badge with owner avatar, Fork button
 * - Shader fallback when no artwork
 */
const meta = {
  title: "Items/ItemHero",
  component: HeroCarousel,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Item page hero banner showing backdrop with progress tracking for owners or attribution and fork button for public viewers.",
      },
    },
  },
  argTypes: {
    isOwner: {
      control: "boolean",
      description: "Whether current user owns this item",
    },
    currentUserId: {
      control: "text",
      description: "Current user ID for fork button visibility",
    },
  },
  args: {
    onPlay: fn(),
    onGoToNext: fn(),
    onFork: fn(),
    onViewForked: fn(),
    showCta: false,
  },
} satisfies Meta<typeof HeroCarousel>;

export default meta;
type Story = StoryObj<typeof meta>;

// =============================================================================
// OWNER VIEW SLIDES (no profile data - owner doesn't see attribution)
// =============================================================================

// Movie item with progress - owner view
const movieOwnerSlide: HeroSlide = {
  id: "inception",
  name: "Inception",
  description:
    "A thief who steals corporate secrets through dream-sharing technology is given the inverse task of planting an idea into the mind of a C.E.O.",
  backgroundUrl: `${TMDB_BACKDROP_BASE}/8ZTVqvKDQ8emSGUEMjsS4yHAwrp.jpg`,
  link: "/u/filmfan/inception",
  hasMedia: true,
  hasProgress: true,
  primaryMediaName: "Inception.mkv",
  progressPercentage: 45,
  progressLabel: "1h 6m / 2h 28m",
};

// TV show with episode progress - owner view
const tvShowOwnerSlide: HeroSlide = {
  id: "breaking-bad",
  name: "Breaking Bad",
  description:
    "A chemistry teacher diagnosed with inoperable lung cancer turns to manufacturing methamphetamine.",
  backgroundUrl: `${TMDB_BACKDROP_BASE}/tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg`,
  link: "/u/demo/breaking-bad",
  hasMedia: true,
  hasProgress: true,
  primaryMediaName: "S01E01 - Pilot",
  progressPercentage: 35,
  progressLabel: "18/62 episodes",
  nextItem: { id: "next-ep", name: "S02E03 - Bit by a Dead Bee" },
};

// Completed item - owner view
const completedOwnerSlide: HeroSlide = {
  id: "godfather",
  name: "The Godfather",
  description:
    "The aging patriarch of an organized crime dynasty transfers control to his reluctant son.",
  backgroundUrl: `${TMDB_BACKDROP_BASE}/tmU7GeKVybMWFButWEGl2M4GeiP.jpg`,
  link: "/u/filmfan/the-godfather",
  hasMedia: true,
  progressPercentage: 100,
  progressLabel: "Completed",
};

// Item without artwork - owner view
const noArtworkOwnerSlide: HeroSlide = {
  id: "new-item",
  name: "New Item",
  description: "Add artwork via TMDB search or upload from your device",
  link: "/u/demo/new-item",
  hasMedia: false,
};

// =============================================================================
// PUBLIC VIEW SLIDES (with profile data for attribution, no media controls)
// =============================================================================

// Movie item - public view (viewer sees attribution, not media controls)
const moviePublicSlide: HeroSlide = {
  id: "inception",
  name: "Inception",
  description:
    "A thief who steals corporate secrets through dream-sharing technology is given the inverse task of planting an idea into the mind of a C.E.O.",
  backgroundUrl: `${TMDB_BACKDROP_BASE}/8ZTVqvKDQ8emSGUEMjsS4yHAwrp.jpg`,
  link: "/u/filmfan/inception",
  ownerUsername: "filmfan",
  ownerName: "Film Fan",
  ownerUserId: "user-filmfan",
  profileId: "user-filmfan",
  profileHasImage: true,
  // No hasMedia, hasProgress, progressPercentage - viewers don't see these
};

// Already forked item - public view (shows "In Library" instead of Fork)
const alreadyForkedSlide: HeroSlide = {
  ...moviePublicSlide,
  isForked: true,
  forkedItemId: "my-forked-inception",
};

// =============================================================================
// OWNER VIEW STORIES
// =============================================================================

/**
 * Owner viewing their movie item with progress.
 * Shows Resume button and progress bar.
 */
export const MovieOwnerView: Story = {
  args: {
    slides: [movieOwnerSlide],
    isOwner: true,
  },
};

/**
 * Owner viewing their TV show with episode progress.
 * Shows Go to Next button for continuing to next episode.
 */
export const TVShowOwnerView: Story = {
  args: {
    slides: [tvShowOwnerSlide],
    isOwner: true,
  },
};

/**
 * Completed item with 100% progress.
 * Shows completed state styling.
 */
export const Completed: Story = {
  args: {
    slides: [completedOwnerSlide],
    isOwner: true,
  },
};

/**
 * Item not yet started (0% progress).
 * Shows Play button instead of Resume.
 */
export const NotStarted: Story = {
  args: {
    slides: [
      {
        ...movieOwnerSlide,
        hasProgress: false,
        progressPercentage: 0,
        progressLabel: "Not started",
      },
    ],
    isOwner: true,
  },
};

/**
 * Item without artwork.
 * Falls back to animated shader background.
 */
export const NoArtwork: Story = {
  args: {
    slides: [noArtworkOwnerSlide],
    isOwner: true,
  },
};

// =============================================================================
// PUBLIC VIEW STORIES
// =============================================================================

/**
 * Public viewer seeing someone else's item.
 * Shows attribution badge with owner avatar.
 * No media controls or progress (viewers can't play files).
 */
export const PublicView: Story = {
  args: {
    slides: [moviePublicSlide],
    isOwner: false,
    currentUserId: "user-viewer",
  },
};

/**
 * Public viewer who already forked this item.
 * Shows "In Library" button with check icon instead of Fork button.
 */
export const AlreadyForked: Story = {
  args: {
    slides: [alreadyForkedSlide],
    isOwner: false,
    currentUserId: "user-viewer",
  },
  parameters: {
    docs: {
      description: {
        story:
          "When an item has already been forked, shows 'In Library' with a check icon. Clicking navigates to the forked item.",
      },
    },
  },
};

/**
 * Guest (not logged in) viewing a public item.
 * Shows "Sign in to Fork" button that links to sign-in page.
 */
export const GuestView: Story = {
  args: {
    slides: [moviePublicSlide],
    isOwner: false,
    currentUserId: undefined,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Unauthenticated users see a 'Sign in to Fork' button that links to the sign-in page.",
      },
    },
  },
};
