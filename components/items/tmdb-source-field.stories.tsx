/**
 * Storybook stories for the TmdbSourceField component.
 * Demonstrates linked state with poster thumbnail, unlinked empty state,
 * and detach confirmation dialog. Mirrors FileTypeCombobox story structure.
 */

import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn } from "storybook/test";

import { TmdbSourceField } from "./tmdb-source-field";

const meta: Meta<typeof TmdbSourceField> = {
  title: "Items/TMDB/TmdbSourceField",
  component: TmdbSourceField,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "TMDB source field with inline detach action. Mirrors FileTypeCombobox DOM structure for visual consistency on the Details tab.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="w-[400px] p-4">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof TmdbSourceField>;

export const LinkedMovie: Story = {
  render: () => (
    <TmdbSourceField
      item={{
        id: "item-1",
        tmdbId: 155,
        tmdbType: "movie",
        tmdbPosterPath: "/8cdWjvZQUExUUTzyp4t6EDMubfO.jpg",
        name: "The Dark Knight",
      }}
      onChange={fn()}
      onSettingsChange={fn()}
    />
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Movie linked to TMDB. Shows poster thumbnail, type badge, title, and detach icon.",
      },
    },
  },
};

export const LinkedTV: Story = {
  render: () => (
    <TmdbSourceField
      item={{
        id: "item-2",
        tmdbId: 1396,
        tmdbType: "tv",
        tmdbPosterPath: "/ztkUQFLlC19CCMYHW9o1zWhJRNq.jpg",
        name: "Breaking Bad",
      }}
      onChange={fn()}
      onSettingsChange={fn()}
    />
  ),
  parameters: {
    docs: {
      description: {
        story: "TV show linked to TMDB.",
      },
    },
  },
};

export const NotLinked: Story = {
  render: () => (
    <TmdbSourceField
      item={{
        id: "item-3",
        tmdbId: null,
        tmdbType: null,
        tmdbPosterPath: null,
        name: "My Custom Item",
      }}
      onChange={fn()}
      onSettingsChange={fn()}
    />
  ),
  parameters: {
    docs: {
      description: {
        story:
          'No TMDB source linked. Trigger shows placeholder "Search TMDB\u2026" and detach icon is hidden.',
      },
    },
  },
};

export const LinkedNoPoster: Story = {
  render: () => (
    <TmdbSourceField
      item={{
        id: "item-4",
        tmdbId: 100,
        tmdbType: "movie",
        tmdbPosterPath: null,
        name: "Some Movie",
      }}
      onChange={fn()}
      onSettingsChange={fn()}
    />
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Linked to TMDB but no poster path. Shows type and title without thumbnail.",
      },
    },
  },
};
