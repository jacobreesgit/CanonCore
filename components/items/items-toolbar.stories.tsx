/**
 * Storybook stories for the ItemsToolbar component.
 * Demonstrates toolbar states, responsive layouts, and sync integration.
 */

import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn } from "storybook/test";

import { ItemsToolbar } from "./items-toolbar";

const meta = {
  title: "Items/Toolbar/ItemsToolbar",
  component: ItemsToolbar,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Unified toolbar for items views with sync, sort, filter, and action controls. Responsive layout collapses options into sheet on mobile.",
      },
    },
  },
  argTypes: {
    hasItems: {
      control: "boolean",
      description: "Whether there are items to show",
    },
    isEditing: {
      control: "boolean",
      description: "Whether edit mode is active",
    },
    sortBy: {
      control: "select",
      options: [
        "custom",
        "name-asc",
        "name-desc",
        "created-desc",
        "created-asc",
        "updated-desc",
      ],
      description: "Current sort option",
    },
    filterBy: {
      control: "select",
      options: ["all", "has-files", "no-files", "synced", "pending", "error"],
      description: "Current filter option",
    },
    hasDriveConnection: {
      control: "boolean",
      description: "Whether Google Drive is connected",
    },
  },
  args: {
    hasItems: true,
    isEditing: false,
    sortBy: "custom",
    filterBy: "all",
    hasDriveConnection: true,
    onEditToggle: fn(),
    onAddItem: fn(),
    onSortChange: fn(),
    onFilterChange: fn(),
    onSyncComplete: fn(),
  },
} satisfies Meta<typeof ItemsToolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

// === STANDARD VARIANTS ===

export const Default: Story = {};

export const EmptyState: Story = {
  args: {
    hasItems: false,
  },
  parameters: {
    docs: {
      description: {
        story: "Toolbar with controls disabled when no items exist.",
      },
    },
  },
};

export const EditModeActive: Story = {
  args: {
    hasItems: true,
    isEditing: true,
  },
  parameters: {
    docs: {
      description: {
        story: "Toolbar showing edit mode toggle in active state.",
      },
    },
  },
};

export const NoDriveConnection: Story = {
  args: {
    hasItems: true,
    hasDriveConnection: false,
  },
  parameters: {
    docs: {
      description: {
        story: "Sync button disabled when Google Drive is not connected.",
      },
    },
  },
};

export const EditDisabled: Story = {
  args: {
    hasItems: true,
    sortBy: "name-asc",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Edit button disabled when sort is not custom. Tooltip explains why reordering is unavailable.",
      },
    },
  },
};

export const ActiveFilter: Story = {
  args: {
    hasItems: true,
    filterBy: "has-files",
  },
  parameters: {
    docs: {
      description: {
        story: "Toolbar showing active filter indicator.",
      },
    },
  },
};

// === ITEM DETAIL PAGE ===

export const ItemDetailPage: Story = {
  args: {
    hasItems: true,
    item: {
      id: "item-1",
      name: "Breaking Bad",
      description: "A chemistry teacher diagnosed with terminal lung cancer.",
      isPublic: false,
      inheritVisibility: false,
      hasParent: false,
      hasChildren: true,
    },
    hasDriveConnection: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Toolbar on item detail page shows Settings button for the current item.",
      },
    },
  },
};
