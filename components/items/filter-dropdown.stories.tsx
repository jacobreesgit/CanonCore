/**
 * Storybook stories for the FilterDropdown component.
 * Demonstrates filter options with active state indicator.
 */
import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn } from "storybook/test";
import { FilterDropdown } from "./filter-dropdown";

const meta = {
  title: "Items/Controls/FilterDropdown",
  component: FilterDropdown,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Dropdown for filtering items by various criteria. Shows a visual indicator when a filter is active.",
      },
    },
  },
  argTypes: {
    value: {
      control: "select",
      options: ["all", "has-files", "no-files", "synced", "pending", "error"],
      description: "Current filter option",
    },
    disabled: { control: "boolean" },
  },
  args: {
    onChange: fn(),
  },
} satisfies Meta<typeof FilterDropdown>;

export default meta;
type Story = StoryObj<typeof meta>;

// === STANDARD VARIANTS ===

export const Default: Story = {
  args: {
    value: "all",
    disabled: false,
  },
};

export const FilterByFiles: Story = {
  args: {
    value: "has-files",
    disabled: false,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Shows active indicator (dot) when a filter other than 'all' is selected.",
      },
    },
  },
};

export const FilterNoFiles: Story = {
  args: {
    value: "no-files",
    disabled: false,
  },
};

export const FilterSynced: Story = {
  args: {
    value: "synced",
    disabled: false,
  },
};

export const FilterPending: Story = {
  args: {
    value: "pending",
    disabled: false,
  },
};

export const FilterError: Story = {
  args: {
    value: "error",
    disabled: false,
  },
};

export const Disabled: Story = {
  args: {
    value: "all",
    disabled: true,
  },
};
