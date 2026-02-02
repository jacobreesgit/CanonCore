/**
 * Storybook stories for the MediaSearchCombobox component.
 * Demonstrates TMDB search. Set STORYBOOK_TMDB_READ_ACCESS_TOKEN env var for live search.
 */

import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn } from "storybook/test";

import { MediaSearchCombobox } from "./media-search-combobox";

const meta = {
  title: "Items/Search/MediaSearchCombobox",
  component: MediaSearchCombobox,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Auto-suggest combobox for TMDB media search. Shows movie/TV results with poster thumbnails as user types.",
      },
    },
  },
  argTypes: {
    value: {
      control: "text",
      description: "Current value to display",
    },
    placeholder: {
      control: "text",
      description: "Placeholder text",
    },
  },
  args: {
    value: "",
    placeholder: "Search movies & TV shows...",
    onSelect: fn(),
    onChange: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-[400px] p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MediaSearchCombobox>;

export default meta;
type Story = StoryObj<typeof meta>;

// === STANDARD VARIANTS ===

export const Default: Story = {
  args: {
    value: "",
    placeholder: "Search movies & TV shows...",
  },
};

export const WithValue: Story = {
  args: {
    value: "Breaking Bad",
    placeholder: "Search movies & TV shows...",
  },
  parameters: {
    docs: {
      description: {
        story: "Combobox with pre-filled value from previous selection.",
      },
    },
  },
};
