/**
 * Storybook stories for the ItemStats component.
 * Demonstrates stats display with icons and text formats.
 */

import type { Meta, StoryObj } from "@storybook/nextjs";

import { ItemStats } from "./item-stats";

const meta = {
  title: "Items/Misc/ItemStats",
  component: ItemStats,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Reusable stats display showing child count and file counts (media, artwork, subtitles). Used in GridItem, TreeItem, and ItemSettingsDialog.",
      },
    },
  },
  argTypes: {
    childCount: {
      control: { type: "number", min: 0, max: 100 },
      description: "Number of child items",
    },
    variant: {
      control: "select",
      options: ["muted", "overlay"],
      description: "Visual variant",
    },
    format: {
      control: "select",
      options: ["icons", "text"],
      description: "Display format",
    },
    mediaIconType: {
      control: "select",
      options: ["film", "music", "mixed", null],
      description: "Media icon type",
    },
    showEmpty: {
      control: "boolean",
      description: "Whether to show empty state",
    },
  },
  decorators: [
    (Story) => (
      <div className="p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ItemStats>;

export default meta;
type Story = StoryObj<typeof meta>;

// === STANDARD VARIANTS ===

export const Default: Story = {
  args: {
    childCount: 5,
    fileCounts: { media: 3, artwork: 2, subtitles: 1 },
  },
};

export const FilesOnly: Story = {
  args: {
    childCount: 0,
    fileCounts: { media: 5, artwork: 3, subtitles: 2 },
  },
  parameters: {
    docs: {
      description: {
        story: "Shows only file counts when no children.",
      },
    },
  },
};

// === FORMAT VARIANTS ===

export const TextFormat: Story = {
  args: {
    childCount: 3,
    fileCounts: { media: 2, artwork: 1, subtitles: 1 },
    format: "text",
  },
  parameters: {
    docs: {
      description: {
        story: 'Text format shows "x3 children, x2 media" style.',
      },
    },
  },
};

// === VARIANT STYLES ===

export const OverlayVariant: Story = {
  args: {
    childCount: 5,
    fileCounts: { media: 3, artwork: 2, subtitles: 0 },
    variant: "overlay",
  },
  decorators: [
    (Story) => (
      <div className="rounded-lg bg-gradient-to-br from-slate-800 to-slate-900 p-6">
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        story: "Overlay variant with white text for dark backgrounds.",
      },
    },
  },
};
