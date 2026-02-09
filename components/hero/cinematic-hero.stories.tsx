/**
 * Storybook stories for CinematicHero component.
 * Demonstrates carousel, item detail, and profile avatar modes.
 */

import type { Meta, StoryObj } from "@storybook/nextjs";
import { CinematicHero } from "./cinematic-hero";
import { HeroButton } from "@/components/items/hero-button";
import { Play, Copy, Check } from "lucide-react";
import type { HeroSlide } from "./types";

const meta: Meta<typeof CinematicHero> = {
  title: "Layout/CinematicHero",
  component: CinematicHero,
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;
type Story = StoryObj<typeof CinematicHero>;

/** Multi-slide explore carousel with TMDB metadata. */
const exploreSlides: HeroSlide[] = [
  {
    id: "1",
    name: "Breaking Bad",
    description: "A chemistry teacher turned methamphetamine manufacturer.",
    artworkId: "art-bb",
    link: "/u/demo/item-1",
    attribution: "Shared by @demo",
    tagline: "All Hail the King.",
    metadata: { year: "2008", contentRating: "TV-MA", voteAverage: 8.9 },
    genres: ["Drama", "Crime", "Thriller"],
  },
  {
    id: "2",
    name: "The Godfather",
    description: "The aging patriarch of an organized crime dynasty.",
    artworkId: "art-gf",
    link: "/u/filmfan/item-2",
    attribution: "Shared by @filmfan",
    tagline: "An offer you can't refuse.",
    metadata: {
      year: "1972",
      runtime: 175,
      contentRating: "R",
      voteAverage: 8.7,
    },
    genres: ["Drama", "Crime"],
  },
  {
    id: "3",
    name: "Inception",
    description: "A thief who steals corporate secrets through dream-sharing.",
    artworkId: "art-in",
    link: "/u/demo/item-3",
    attribution: "Shared by @demo",
    metadata: {
      year: "2010",
      runtime: 148,
      contentRating: "PG-13",
      voteAverage: 8.4,
    },
    genres: ["Action", "Sci-Fi", "Thriller"],
  },
];

/** Single item detail slide with TMDB metadata. */
const itemSlide: HeroSlide = {
  id: "movie-1",
  name: "Dune: Part Two",
  description:
    "Paul Atreides unites with Chani and the Fremen while on a warpath of revenge against the conspirators who destroyed his family.",
  artworkId: "art-dune",
  tagline: "Long live the fighters.",
  metadata: {
    year: "2024",
    runtime: 166,
    contentRating: "PG-13",
    voteAverage: 8.3,
  },
  genres: ["Sci-Fi", "Adventure", "Drama"],
  progress: 42,
  progressLabel: "42% watched",
};

/** Profile avatar slide. */
const profileSlide: HeroSlide = {
  id: "profile-1",
  name: "Film Fan",
  progress: 72,
  progressLabel: "72% watched",
  profile: {
    id: "user-filmfan",
    username: "filmfan",
    name: "Film Fan",
    hasImage: false,
  },
};

/** Default: Multi-slide explore carousel (guest view). */
export const ExploreCarousel: Story = {
  args: {
    slides: exploreSlides,
    renderActions: (_slide) => (
      <>
        <HeroButton onClick={() => {}}>View Item</HeroButton>
        <HeroButton onClick={() => {}}>
          <Copy className="size-4" />
          Sign in to Fork
        </HeroButton>
      </>
    ),
  },
};

/** Item detail page (owner view) with TMDB metadata and play button. */
export const ItemDetailOwner: Story = {
  args: {
    slides: [itemSlide],
    headingLevel: "h1",
    actions: (
      <>
        <HeroButton variant="primary" onClick={() => {}}>
          <Play className="size-4" />
          Play
        </HeroButton>
        <HeroButton onClick={() => {}}>Next Up: Chapter 5</HeroButton>
      </>
    ),
  },
};

/** Item detail page (public viewer) with attribution and fork. */
export const ItemDetailViewer: Story = {
  args: {
    slides: [
      {
        ...itemSlide,
        attribution: "Shared by @filmfan",
      },
    ],
    headingLevel: "h1",
    actions: (
      <>
        <HeroButton onClick={() => {}}>
          <Copy className="size-4" />
          Fork to Library
        </HeroButton>
      </>
    ),
  },
};

/** Already forked item. */
export const AlreadyForked: Story = {
  args: {
    slides: [
      {
        ...itemSlide,
        attribution: "Shared by @filmfan",
      },
    ],
    headingLevel: "h1",
    actions: (
      <HeroButton variant="secondary" onClick={() => {}}>
        <Check className="size-4 text-green-400" />
        In Your Library
      </HeroButton>
    ),
  },
};

/** Profile avatar mode (viewer). */
export const ProfileViewer: Story = {
  args: {
    slides: [profileSlide],
    headingLevel: "h1",
  },
};

/** Profile avatar mode (owner, My Items). */
export const ProfileOwner: Story = {
  args: {
    slides: [
      {
        ...profileSlide,
        backgroundUrl: "/api/user/hero?userId=user-filmfan",
      },
    ],
  },
};

/** No background (shader fallback). */
export const NoBackground: Story = {
  args: {
    slides: [
      {
        id: "no-bg",
        name: "My Collection",
        description: "A curated collection of favorites.",
      },
    ],
    headingLevel: "h1",
  },
};
