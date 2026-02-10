/**
 * Stories for VideoRow component.
 * Fetches real TMDB video data via Storybook loaders.
 */

import type { Meta, StoryObj } from "@storybook/nextjs";
import { fetchTmdbDetails } from "../../.storybook/lib/tmdb";
import { VideoRow } from "./video-row";

const meta: Meta = {
  title: "Items/About/VideoRow",
  component: VideoRow,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Horizontal scrolling row of YouTube video thumbnails with play button overlay. Uses real TMDB video data.",
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
      if (!tmdbId || !mediaType) return { videos: [] };
      const details = await fetchTmdbDetails(tmdbId, mediaType);
      return { videos: details?.videos ?? [] };
    },
  ],
  render: (_args, { loaded: { videos } }) => <VideoRow videos={videos} />,
};

export default meta;
type Story = StoryObj<typeof meta>;

/** Default with real YouTube trailer thumbnails (Inception). */
export const Default: Story = {
  args: { tmdbId: 27205, mediaType: "movie" },
};
