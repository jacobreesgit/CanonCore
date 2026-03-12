/**
 * Stories for CastRow component.
 * Fetches real TMDB cast data via Storybook loaders.
 */

import type { Meta, StoryObj } from "@storybook/nextjs";
import { fetchTmdbDetails } from "../../.storybook/lib/tmdb";
import { CastRow } from "./cast-row";

const meta: Meta = {
  title: "Items/About/CastRow",
  component: CastRow,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Horizontal scrolling cast row with circular TMDB profile photos, names, and character names.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="max-w-2xl">
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
      if (!tmdbId || !mediaType) return { cast: [] };
      const details = await fetchTmdbDetails(tmdbId, mediaType);
      return { cast: details?.cast ?? [] };
    },
  ],
  render: (_args, { loaded: { cast } }) => <CastRow cast={cast} />,
};

export default meta;
type Story = StoryObj<typeof meta>;

/** Default cast row with real TMDB profile images (Inception). */
export const Default: Story = {
  args: { tmdbId: 27205, mediaType: "movie" },
};
