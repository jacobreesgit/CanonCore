/**
 * Stories for Recommendations component.
 * Fetches real TMDB recommendation data via Storybook loaders.
 */

import type { Meta, StoryObj } from "@storybook/nextjs";
import type { Recommendation } from "@/lib/tmdb-client";
import { fetchTmdbDetails } from "../../.storybook/lib/tmdb";
import { Recommendations } from "./recommendations";

const meta: Meta = {
  title: "Items/About/Recommendations",
  component: Recommendations,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          'Displays a grid of recommendation poster cards from TMDB data. Each card shows an "Add to Library" toast on click.',
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-5xl p-8">
        <Story />
      </div>
    ),
  ],
  loaders: [
    async ({ args }) => {
      const { tmdbId, mediaType } = args as {
        tmdbId?: number;
        mediaType?: "movie" | "tv";
      };
      if (!tmdbId || !mediaType) return { recommendations: [] };
      const details = await fetchTmdbDetails(tmdbId, mediaType);
      return { recommendations: details?.recommendations ?? [] };
    },
  ],
  render: (args, { loaded: { recommendations } }) => (
    <Recommendations
      recommendations={args.recommendations ?? recommendations}
      title={args.title}
    />
  ),
};

export default meta;
type Story = StoryObj<typeof meta>;

/** Default recommendation grid with real TMDB posters (Inception). */
export const Default: Story = {
  args: { tmdbId: 27205, mediaType: "movie" },
};

/** No poster images — shows title initial fallback. */
export const NoPosterImages: Story = {
  args: {
    recommendations: [
      {
        id: 272,
        title: "Batman Begins",
        posterPath: null,
        backdropPath: null,
        mediaType: "movie",
      },
      {
        id: 155,
        title: "The Dark Knight",
        posterPath: null,
        backdropPath: null,
        mediaType: "movie",
      },
      {
        id: 550,
        title: "Fight Club",
        posterPath: null,
        backdropPath: null,
        mediaType: "movie",
      },
      {
        id: 13,
        title: "Forrest Gump",
        posterPath: null,
        backdropPath: null,
        mediaType: "movie",
      },
      {
        id: 120,
        title: "LOTR: Fellowship",
        posterPath: null,
        backdropPath: null,
        mediaType: "movie",
      },
      {
        id: 603,
        title: "The Matrix",
        posterPath: null,
        backdropPath: null,
        mediaType: "movie",
      },
    ] satisfies Recommendation[],
  },
  loaders: [],
  render: (args) => <Recommendations recommendations={args.recommendations} />,
  parameters: {
    docs: {
      description: {
        story:
          "When TMDB poster images are unavailable, cards display the first letter of the title as a fallback.",
      },
    },
  },
};
