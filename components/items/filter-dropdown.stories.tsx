/**
 * Storybook stories for the FilterDropdown component.
 * Demonstrates multi-select filter options with active state indicator and grouped checkboxes.
 */
import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn } from "storybook/test";
import { FilterDropdown } from "./filter-dropdown";
import type { ContentFilter } from "@/lib/types";

const meta = {
  title: "Items/Controls/FilterDropdown",
  component: FilterDropdown,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Multi-select dropdown for filtering items by file and sync status. Uses grouped checkboxes with active count badge and clear button.",
      },
    },
  },
  argTypes: {
    filters: {
      control: "object",
      description: "Currently active content filters",
    },
    disabled: { control: "boolean" },
  },
  args: {
    toggleFilter: fn(),
    clearFilters: fn(),
  },
} satisfies Meta<typeof FilterDropdown>;

export default meta;
type Story = StoryObj<typeof meta>;

// === STANDARD VARIANTS ===

export const Default: Story = {
  args: {
    filters: [] as ContentFilter[],
    disabled: false,
  },
};

export const SingleFileFilter: Story = {
  args: {
    filters: ["has-files"] as ContentFilter[],
    disabled: false,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Shows active count badge 'Filter (1)' and dot indicator when a filter is selected.",
      },
    },
  },
};

export const SingleSyncFilter: Story = {
  args: {
    filters: ["synced"] as ContentFilter[],
    disabled: false,
  },
};

export const MultipleFilters: Story = {
  args: {
    filters: ["has-files", "synced"] as ContentFilter[],
    disabled: false,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Multiple filters active across groups. Shows 'Filter (2)' badge. AND logic across groups, OR within groups.",
      },
    },
  },
};

export const AllSyncFilters: Story = {
  args: {
    filters: ["synced", "pending", "error"] as ContentFilter[],
    disabled: false,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Multiple sync status filters selected. Items matching any selected sync status are shown.",
      },
    },
  },
};

export const Disabled: Story = {
  args: {
    filters: [] as ContentFilter[],
    disabled: true,
  },
};
