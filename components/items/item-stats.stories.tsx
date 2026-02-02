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

export const ChildrenOnly: Story = {
  args: {
    childCount: 12,
    fileCounts: { media: 0, artwork: 0, subtitles: 0 },
  },
  parameters: {
    docs: {
      description: {
        story: "Shows only child count when no files present.",
      },
    },
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

export const SingleChild: Story = {
  args: {
    childCount: 1,
    fileCounts: { media: 1, artwork: 0, subtitles: 0 },
  },
  parameters: {
    docs: {
      description: {
        story: "Uses singular 'child' text for single child.",
      },
    },
  },
};

export const MediaOnlyVideo: Story = {
  args: {
    childCount: 0,
    fileCounts: { media: 3, artwork: 0, subtitles: 0 },
    mediaIconType: "film",
  },
  parameters: {
    docs: {
      description: {
        story: "Shows Film icon when all media files are video.",
      },
    },
  },
};

export const MediaOnlyAudio: Story = {
  args: {
    childCount: 0,
    fileCounts: { media: 5, artwork: 0, subtitles: 0 },
    mediaIconType: "music",
  },
  parameters: {
    docs: {
      description: {
        story: "Shows Music icon when all media files are audio.",
      },
    },
  },
};

export const MediaMixed: Story = {
  args: {
    childCount: 0,
    fileCounts: { media: 4, artwork: 0, subtitles: 0 },
    mediaIconType: "mixed",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Shows FolderOpen icon when media contains both video and audio.",
      },
    },
  },
};

// === EMPTY STATES ===

export const EmptyNoShow: Story = {
  args: {
    childCount: 0,
    fileCounts: { media: 0, artwork: 0, subtitles: 0 },
    showEmpty: false,
  },
  parameters: {
    docs: {
      description: {
        story: "Returns null when empty and showEmpty is false.",
      },
    },
  },
};

export const EmptyWithLabel: Story = {
  args: {
    childCount: 0,
    fileCounts: { media: 0, artwork: 0, subtitles: 0 },
    showEmpty: true,
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows "Empty" label when showEmpty is true.',
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

export const IconsFormat: Story = {
  args: {
    childCount: 3,
    fileCounts: { media: 2, artwork: 1, subtitles: 1 },
    format: "icons",
  },
  parameters: {
    docs: {
      description: {
        story: "Icons format shows icons with counts (default).",
      },
    },
  },
};

// === VARIANT STYLES ===

export const MutedVariant: Story = {
  args: {
    childCount: 5,
    fileCounts: { media: 3, artwork: 2, subtitles: 0 },
    variant: "muted",
  },
  parameters: {
    docs: {
      description: {
        story: "Muted variant for light backgrounds (default).",
      },
    },
  },
};

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
