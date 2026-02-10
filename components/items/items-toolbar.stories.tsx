/**
 * Storybook stories for the ContentToolbar component.
 * Demonstrates toolbar states, responsive layouts, and sync integration.
 */

import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn } from "storybook/test";
import { Plus, Settings2 } from "lucide-react";

import { ContentToolbar } from "@/components/ui/content-toolbar";
import { Button } from "@/components/ui/button";
import { EditModeToggle } from "./edit-mode-toggle";

const meta = {
  title: "Items/Toolbar/ContentToolbar",
  component: ContentToolbar,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Unified toolbar for content pages with sync, sort, filter, and action controls. Responsive layout collapses options into sheet on mobile.",
      },
    },
  },
  argTypes: {
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
    showSync: {
      control: "boolean",
      description: "Whether to show sync button",
    },
    hasDriveConnection: {
      control: "boolean",
      description: "Whether Google Drive is connected",
    },
    disabled: {
      control: "boolean",
      description: "Whether controls are disabled",
    },
  },
  args: {
    sortBy: "custom",
    filterBy: "all",
    showSync: true,
    hasDriveConnection: true,
    disabled: false,
    onSortChange: fn(),
    onFilterChange: fn(),
    onSync: fn(),
  },
} satisfies Meta<typeof ContentToolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

// === STANDARD VARIANTS ===

export const Default: Story = {};

export const EmptyState: Story = {
  args: {
    disabled: true,
  },
  parameters: {
    docs: {
      description: {
        story: "Toolbar with controls disabled when no items exist.",
      },
    },
  },
};

export const NoDriveConnection: Story = {
  args: {
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

export const ActiveFilter: Story = {
  args: {
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

// === WITH ACTIONS ===

export const WithOwnerActions: Story = {
  args: {
    viewMode: "grid",
    onViewChange: fn(),
    actions: (
      <>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Plus className="size-4" strokeWidth={2} />
          <span className="hidden xl:inline">Add</span>
        </Button>
        <EditModeToggle isEditing={false} onToggle={fn()} />
      </>
    ),
  },
  parameters: {
    docs: {
      description: {
        story:
          "Toolbar with owner action buttons (Add, Edit) and view dropdown.",
      },
    },
  },
};

export const ItemDetailPage: Story = {
  args: {
    viewMode: "grid",
    onViewChange: fn(),
    actions: (
      <>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Plus className="size-4" strokeWidth={2} />
          <span className="hidden xl:inline">Add</span>
        </Button>
        <EditModeToggle isEditing={false} onToggle={fn()} />
        <Button variant="outline" size="sm" className="gap-1.5">
          <Settings2 className="size-4" />
          <span className="hidden xl:inline">Settings</span>
        </Button>
      </>
    ),
  },
  parameters: {
    docs: {
      description: {
        story:
          "Toolbar on item detail page shows Settings button alongside other actions.",
      },
    },
  },
};
