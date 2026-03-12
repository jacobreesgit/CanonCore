/**
 * Stories for AboutSection (expandable description) component.
 * Fetches real TMDB overview text via Storybook loaders.
 */

import type { Meta, StoryObj } from "@storybook/nextjs";
import { fetchTmdbOverview } from "../../.storybook/lib/tmdb";
import { AboutSection } from "./expandable-description";

const meta: Meta = {
  title: "Items/About/ExpandableDescription",
  component: AboutSection,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "About section with expandable long descriptions. Shows a 'Read more' toggle when text exceeds 200 characters.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="max-w-lg">
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
      if (!tmdbId || !mediaType) return { overview: "" };
      const overview = await fetchTmdbOverview(tmdbId, mediaType);
      return { overview };
    },
  ],
  render: (args, { loaded: { overview } }) => (
    <AboutSection description={args.description ?? overview} />
  ),
};

export default meta;
type Story = StoryObj<typeof meta>;

/** Default with long description and "Read more" toggle (Inception). */
export const Default: Story = {
  args: { tmdbId: 27205, mediaType: "movie" },
};
