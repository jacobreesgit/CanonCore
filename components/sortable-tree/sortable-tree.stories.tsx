/**
 * Storybook stories for the SortableTree component.
 * Covers tree views, drag-and-drop, and interaction states.
 */
import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn } from "storybook/test";
import { SortableTree } from "./SortableTree";
import type { TreeItems, TreeItem } from "@/lib/types";

/**
 * Sortable tree component with drag-and-drop reordering.
 *
 * ## Features
 * - Hierarchical tree view with nesting up to 10 levels
 * - Drag-and-drop reordering with keyboard support
 * - Collapsible folders with expand/collapse state
 * - Context menu for Settings, Pin, Delete, Add Child
 * - Accessibility announcements for screen readers
 * - Reparent warning for inheriting items
 *
 * ## Keyboard Navigation
 * - `Arrow keys` - Navigate between items
 * - `Space/Enter` - Select/expand item
 * - `Shift + Arrow` - Change depth during drag
 */
const meta = {
  title: "Layout/SortableTree",
  component: SortableTree,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Hierarchical tree with drag-and-drop reordering via dnd-kit. Supports nesting up to 10 levels with collapsible folders.",
      },
    },
  },
  argTypes: {
    items: {
      description: "Tree items to display",
    },
    collapsible: {
      control: "boolean",
      description: "Whether items can be collapsed",
    },
    indentationWidth: {
      control: { type: "number", min: 10, max: 50, step: 5 },
      description: "Pixels per depth level",
    },
    indicator: {
      control: "boolean",
      description: "Show depth indicator line",
    },
    maxDepth: {
      control: { type: "number", min: 1, max: 15 },
      description: "Maximum nesting depth",
    },
    hasDriveConnection: {
      control: "boolean",
      description: "Whether user has Google Drive connected",
    },
  },
  args: {
    onItemsChange: fn(),
    onItemClick: fn(),
    onOpenSettings: fn(),
    onDeleteItem: fn(),
    onAddChild: fn(),
    onAddChildComplete: fn(),
    onPinItem: fn(),
    onUnpinItem: fn(),
    isItemSelected: () => false,
    onItemSelectChange: fn(),
  },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-2xl rounded-lg border p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SortableTree>;

export default meta;
type Story = StoryObj<typeof meta>;

// Helper to create tree items
function createTreeItem(
  id: string,
  name: string,
  options: Partial<TreeItem> = {}
): TreeItem {
  return {
    id,
    name,
    order: 0,
    depth: 0,
    parentId: null,
    children: [],
    ...options,
  };
}

// Mock tree data - media library structure
const mockTreeItems: TreeItems = [
  createTreeItem("movies", "Movies", {
    order: 0,
    children: [
      createTreeItem("action", "Action", {
        parentId: "movies",
        order: 0,
        depth: 1,
        children: [
          createTreeItem("die-hard", "Die Hard", {
            parentId: "action",
            order: 0,
            depth: 2,
            artworkId: "artwork-1",
            fileCounts: { media: 1, artwork: 1, subtitles: 2 },
          }),
          createTreeItem("mad-max", "Mad Max: Fury Road", {
            parentId: "action",
            order: 1,
            depth: 2,
            artworkId: "artwork-2",
            fileCounts: { media: 1, artwork: 1, subtitles: 1 },
          }),
        ],
      }),
      createTreeItem("drama", "Drama", {
        parentId: "movies",
        order: 1,
        depth: 1,
        children: [
          createTreeItem("shawshank", "The Shawshank Redemption", {
            parentId: "drama",
            order: 0,
            depth: 2,
            artworkId: "artwork-3",
          }),
        ],
      }),
    ],
    pinnedOrder: 0,
    driveFileId: "drive-folder-1",
  }),
  createTreeItem("tv-shows", "TV Shows", {
    order: 1,
    children: [
      createTreeItem("breaking-bad", "Breaking Bad", {
        parentId: "tv-shows",
        order: 0,
        depth: 1,
        artworkId: "artwork-bb",
        progressPercentage: 35,
        watchedCount: 18,
        totalMediaCount: 52,
        children: [
          createTreeItem("bb-s1", "Season 1", {
            parentId: "breaking-bad",
            order: 0,
            depth: 2,
            progressPercentage: 100,
          }),
          createTreeItem("bb-s2", "Season 2", {
            parentId: "breaking-bad",
            order: 1,
            depth: 2,
            progressPercentage: 50,
          }),
        ],
      }),
    ],
  }),
  createTreeItem("music", "Music", {
    order: 2,
    mediaIconType: "music",
    children: [],
  }),
];

// Flat list (no nesting)
const flatItems: TreeItems = [
  createTreeItem("item-1", "The Godfather", { artworkId: "gf" }),
  createTreeItem("item-2", "Pulp Fiction", { artworkId: "pf" }),
  createTreeItem("item-3", "The Dark Knight", { artworkId: "dk" }),
  createTreeItem("item-4", "Inception", { artworkId: "inc" }),
  createTreeItem("item-5", "Fight Club", { artworkId: "fc" }),
];

// Deep nesting example
const deepNestedItems: TreeItems = [
  createTreeItem("level-0", "Level 0", {
    children: [
      createTreeItem("level-1", "Level 1", {
        parentId: "level-0",
        depth: 1,
        children: [
          createTreeItem("level-2", "Level 2", {
            parentId: "level-1",
            depth: 2,
            children: [
              createTreeItem("level-3", "Level 3", {
                parentId: "level-2",
                depth: 3,
                children: [
                  createTreeItem("level-4", "Level 4", {
                    parentId: "level-3",
                    depth: 4,
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  }),
];

/**
 * Default tree with nested structure.
 * Demonstrates typical media library hierarchy.
 */
export const Default: Story = {
  args: {
    items: mockTreeItems,
    collapsible: true,
    indentationWidth: 20,
    indicator: true,
    maxDepth: 10,
  },
};

/**
 * Flat list without nesting.
 * Simple sortable list view.
 */
export const FlatList: Story = {
  args: {
    items: flatItems,
    collapsible: false,
  },
};

/**
 * Deep nested structure.
 * Demonstrates multi-level hierarchy.
 */
export const DeepNesting: Story = {
  args: {
    items: deepNestedItems,
    collapsible: true,
    indentationWidth: 24,
    maxDepth: 10,
  },
};

/**
 * Non-collapsible tree.
 * All items always visible.
 */
export const NonCollapsible: Story = {
  args: {
    items: mockTreeItems,
    collapsible: false,
  },
};

/**
 * Without depth indicator.
 * Cleaner look without vertical lines.
 */
export const NoIndicator: Story = {
  args: {
    items: mockTreeItems,
    indicator: false,
  },
};
