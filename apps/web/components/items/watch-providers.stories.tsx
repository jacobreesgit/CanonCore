/**
 * Stories for WatchProviders component.
 * Fetches real TMDB watch provider data via Storybook loaders.
 */

import type { Meta, StoryObj } from "@storybook/nextjs";
import { fetchTmdbDetails } from "../../.storybook/lib/tmdb";
import { WatchProviders } from "./watch-providers";

const meta: Meta = {
  title: "Items/About/WatchProviders",
  component: WatchProviders,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Streaming service logos from TMDB watch provider data with JustWatch attribution.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="max-w-md">
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
      if (!tmdbId || !mediaType) return { providers: [] };
      const details = await fetchTmdbDetails(tmdbId, mediaType);
      return { providers: details?.providers ?? [] };
    },
  ],
  render: (_args, { loaded: { providers } }) => (
    <WatchProviders providers={providers} />
  ),
};

export default meta;
type Story = StoryObj<typeof meta>;

/** Default with streaming provider logos (Inception). */
export const Default: Story = {
  args: { tmdbId: 27205, mediaType: "movie" },
};
