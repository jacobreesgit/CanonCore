/**
 * Stories for ContentToolbar component.
 * Unified glassmorphism toolbar with sort, filter, sync, and action slots.
 */

import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn } from "storybook/test";
import { ContentToolbar } from "./content-toolbar";
import { Button } from "@/components/ui/button";
import { Plus, Settings } from "lucide-react";
import { ABOUT_SECTION_FILTER_OPTIONS } from "@/lib/mock-data";

const meta = {
  title: "Items/Controls/ContentToolbar",
  component: ContentToolbar,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Unified toolbar for content pages. Renders a glassmorphism container with optional sort/filter dropdowns (responsive — collapses to a bottom sheet on mobile), sync button, and left/right action slots.",
      },
    },
  },
} satisfies Meta<typeof ContentToolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Full toolbar with sort, filter, sync, and action buttons. */
export const FullToolbar: Story = {
  args: {
    sortBy: "custom",
    onSortChange: fn(),
    filterBy: "all",
    onFilterChange: fn(),
    showSync: true,
    isSyncing: false,
    onSync: fn(),
    hasDriveConnection: true,
    actions: (
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="ghost"
          className="text-muted-foreground hover:text-foreground gap-1.5"
        >
          <Plus className="size-4" aria-hidden="true" />
          <span className="hidden xl:inline">Add</span>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-muted-foreground hover:text-foreground gap-1.5"
        >
          <Settings className="size-4" aria-hidden="true" />
          <span className="hidden xl:inline">Settings</span>
        </Button>
      </div>
    ),
  },
};

/** Sort and filter only — no sync or actions. */
export const SortAndFilter: Story = {
  args: {
    sortBy: "name-asc",
    onSortChange: fn(),
    filterBy: "has-files",
    onFilterChange: fn(),
  },
};

/** Filter-only toolbar (used by About tab with section filters). */
export const FilterOnly: Story = {
  args: {
    filterBy: "all",
    onFilterChange: fn(),
    filterOptions: ABOUT_SECTION_FILTER_OPTIONS,
  },
};

/** Syncing state — spinner and disabled sync button. */
export const Syncing: Story = {
  args: {
    sortBy: "custom",
    onSortChange: fn(),
    filterBy: "all",
    onFilterChange: fn(),
    showSync: true,
    isSyncing: true,
    onSync: fn(),
    hasDriveConnection: true,
  },
};

/** No Drive connection — sync button disabled. */
export const NoDriveConnection: Story = {
  args: {
    sortBy: "custom",
    onSortChange: fn(),
    filterBy: "all",
    onFilterChange: fn(),
    showSync: true,
    isSyncing: false,
    onSync: fn(),
    hasDriveConnection: false,
  },
  parameters: {
    docs: {
      description: {
        story:
          "When Google Drive is not connected, the sync button is visible but disabled.",
      },
    },
  },
};

/** Disabled controls (e.g., empty library). */
export const Disabled: Story = {
  args: {
    sortBy: "custom",
    onSortChange: fn(),
    filterBy: "all",
    onFilterChange: fn(),
    disabled: true,
  },
};

/** Mobile viewport — sort/filter collapse into MobileOptionsSheet. */
export const Mobile: Story = {
  args: {
    sortBy: "custom",
    onSortChange: fn(),
    filterBy: "all",
    onFilterChange: fn(),
    showSync: true,
    isSyncing: false,
    onSync: fn(),
    hasDriveConnection: true,
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
    docs: {
      description: {
        story:
          "On mobile viewports, sort and filter dropdowns collapse into a MobileOptionsSheet bottom sheet.",
      },
    },
  },
};
