/**
 * Storybook stories for the ContentToolbar component.
 * Demonstrates toolbar states, responsive layouts, and sync integration.
 */

import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn } from "storybook/test";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGears, faPlus } from "@fortawesome/free-solid-svg-icons";

import { ContentToolbar } from "@/components/ui/content-toolbar";
import { Button } from "@/components/ui/button";
import { EditModeToggle } from "@/components/items/edit-mode-toggle";
import type { ContentFilter } from "@/lib/types";

const meta = {
  title: "UI/ContentToolbar",
  component: ContentToolbar,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Unified toolbar for content pages with sync, sort, multi-select filter, and action controls. Responsive layout collapses options into sheet on mobile.",
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
    filters: [] as ContentFilter[],
    showSync: true,
    hasDriveConnection: true,
    disabled: false,
    onSortChange: fn(),
    toggleFilter: fn(),
    clearFilters: fn(),
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
    filters: ["has-files"] as ContentFilter[],
  },
  parameters: {
    docs: {
      description: {
        story:
          "Toolbar showing active filter indicator with 'Filter (1)' badge.",
      },
    },
  },
};

export const MultipleActiveFilters: Story = {
  args: {
    filters: ["has-files", "synced"] as ContentFilter[],
  },
  parameters: {
    docs: {
      description: {
        story:
          "Toolbar showing multiple active filters with 'Filter (2)' badge.",
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
          <FontAwesomeIcon icon={faPlus} className="size-4" />
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
          <FontAwesomeIcon icon={faPlus} className="size-4" />
          <span className="hidden xl:inline">Add</span>
        </Button>
        <EditModeToggle isEditing={false} onToggle={fn()} />
        <Button variant="outline" size="sm" className="gap-1.5">
          <FontAwesomeIcon icon={faGears} className="size-4" />
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
