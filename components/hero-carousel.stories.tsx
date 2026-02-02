/**
 * Storybook stories for the HeroCarousel component (Explore page).
 * Multi-slide carousel showcasing featured public items from different users.
 * For item detail page hero banner, see Items/ItemHero.
 */
import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn } from "storybook/test";
import { HeroCarousel, type HeroSlide } from "./hero-carousel";

// TMDB backdrop URLs for realistic visuals
const TMDB_BACKDROP_BASE = "https://image.tmdb.org/t/p/w1280";

/**
 * Hero carousel component for the Explore page.
 *
 * ## Features
 * - Multi-slide mode with autoplay and navigation dots
 * - Attribution badge showing item owner (avatar + @username)
 * - Fork button for logged-in users
 * - "View Item" CTA button
 * - Reduced motion support via `prefers-reduced-motion`
 *
 * For single-slide mode (item detail page), see Items/ItemHero.
 */
const meta = {
  title: "Layout/HeroCarousel",
  component: HeroCarousel,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Hero carousel for the Explore page. Multi-slide mode with autoplay, navigation dots, owner attribution badges, and fork functionality.",
      },
    },
  },
  argTypes: {
    slides: {
      description: "Array of slides to display",
    },
    ctaText: {
      control: "text",
      description: "Custom CTA button text",
    },
    showCta: {
      control: "boolean",
      description: "Whether to show CTA button",
    },
    autoplayDelay: {
      control: { type: "number", min: 1000, max: 10000, step: 500 },
      description: "Autoplay delay in milliseconds",
    },
    textAlign: {
      control: "radio",
      options: ["left", "center", "right"],
      description: "Text alignment for content",
    },
    currentUserId: {
      control: "text",
      description: "Current user ID for fork button visibility",
    },
  },
  args: {
    onFork: fn(),
    showCta: true,
    ctaText: "View Item",
  },
} satisfies Meta<typeof HeroCarousel>;

export default meta;
type Story = StoryObj<typeof meta>;

// =============================================================================
// EXPLORE PAGE SLIDES (public items with attribution, no progress data)
// =============================================================================

// Explore page shows featured public items from different users
// Each slide has owner attribution (ownerUsername, profileId, profileHasImage)
// NO progress data (hasMedia, progressPercentage, etc.) - that's for owner view only

const exploreSlides: HeroSlide[] = [
  {
    id: "slide-1",
    name: "Breaking Bad",
    description:
      "A chemistry teacher diagnosed with inoperable lung cancer turns to manufacturing methamphetamine.",
    backgroundUrl: `${TMDB_BACKDROP_BASE}/tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg`,
    link: "/u/demo/breaking-bad",
    ownerUsername: "demo",
    ownerName: "Demo User",
    ownerUserId: "user-demo",
    profileId: "user-demo",
    profileHasImage: true,
  },
  {
    id: "slide-2",
    name: "The Godfather",
    description:
      "The aging patriarch of an organized crime dynasty transfers control to his reluctant son.",
    backgroundUrl: `${TMDB_BACKDROP_BASE}/tmU7GeKVybMWFButWEGl2M4GeiP.jpg`,
    link: "/u/filmfan/the-godfather",
    ownerUsername: "filmfan",
    ownerName: "Film Fan",
    ownerUserId: "user-filmfan",
    profileId: "user-filmfan",
    profileHasImage: false,
  },
  {
    id: "slide-3",
    name: "Inception",
    description:
      "A thief who steals corporate secrets through dream-sharing technology is given the task of planting an idea.",
    backgroundUrl: `${TMDB_BACKDROP_BASE}/8ZTVqvKDQ8emSGUEMjsS4yHAwrp.jpg`,
    link: "/u/cinephile/inception",
    ownerUsername: "cinephile",
    ownerName: "Cinephile",
    ownerUserId: "user-cinephile",
    profileId: "user-cinephile",
    profileHasImage: false,
  },
  {
    id: "slide-4",
    name: "Interstellar",
    description:
      "A team of explorers travel through a wormhole in space in an attempt to ensure humanity's survival.",
    backgroundUrl: `${TMDB_BACKDROP_BASE}/xJHokMbljvjADYdit5fK5VQsXEG.jpg`,
    link: "/u/scifi-fan/interstellar",
    ownerUsername: "scifi-fan",
    ownerName: "Sci-Fi Fan",
    ownerUserId: "user-scifi",
    profileId: "user-scifi",
    profileHasImage: true,
  },
  {
    id: "slide-5",
    name: "The Dark Knight",
    description:
      "When the menace known as the Joker wreaks havoc and chaos on the people of Gotham, Batman must accept one of the greatest psychological and physical tests.",
    backgroundUrl: `${TMDB_BACKDROP_BASE}/nMKdUUepR0i5zn0y1T4CsSB5ber.jpg`,
    link: "/u/batman-fan/dark-knight",
    ownerUsername: "batman-fan",
    ownerName: "Batman Fan",
    ownerUserId: "user-batman",
    profileId: "user-batman",
    profileHasImage: false,
  },
];

// =============================================================================
// STORIES
// =============================================================================

/**
 * Default Explore page carousel.
 * Multi-slide with autoplay, attribution badges, and View Item CTA.
 * Guest view (no fork button - requires currentUserId).
 */
export const Default: Story = {
  args: {
    slides: exploreSlides,
  },
};

/**
 * Logged-in user viewing Explore page.
 * Shows Fork button on slides owned by other users.
 */
export const LoggedInUser: Story = {
  args: {
    slides: exploreSlides,
    currentUserId: "user-viewer",
  },
};

/**
 * Slides without background images.
 * Falls back to animated shader background.
 */
export const NoBackground: Story = {
  args: {
    slides: [
      {
        id: "no-bg-1",
        name: "New Collection",
        description: "A collection without artwork yet",
        link: "/u/demo/new-collection",
        ownerUsername: "demo",
        ownerName: "Demo User",
        ownerUserId: "user-demo",
        profileId: "user-demo",
        profileHasImage: true,
      },
      {
        id: "no-bg-2",
        name: "Another Collection",
        description: "Another collection awaiting artwork",
        link: "/u/filmfan/another",
        ownerUsername: "filmfan",
        ownerName: "Film Fan",
        ownerUserId: "user-filmfan",
        profileId: "user-filmfan",
        profileHasImage: false,
      },
    ],
    currentUserId: "user-viewer",
  },
};
