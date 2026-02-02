/**
 * Storybook stories for the MobileOptionsSheet component.
 * Demonstrates mobile bottom drawer for sort and filter options.
 */

import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn } from "storybook/test";

import { MobileOptionsSheet } from "./mobile-options-sheet";

const meta = {
  title: "Items/Misc/MobileOptionsSheet",
  component: MobileOptionsSheet,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    viewport: { defaultViewport: "mobile" },
    docs: {
      description: {
        component:
          "Mobile bottom drawer consolidating Sort and Filter controls. Uses Vaul for native-feeling swipe gestures and spring animations.",
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
    disabled: {
      control: "boolean",
      description: "Whether controls are disabled",
    },
    defaultSort: {
      control: "select",
      options: [
        "custom",
        "name-asc",
        "name-desc",
        "created-desc",
        "created-asc",
        "updated-desc",
      ],
      description: "Default sort for active indicator",
    },
  },
  args: {
    sortBy: "custom",
    filterBy: "all",
    disabled: false,
    defaultSort: "custom",
    onSortChange: fn(),
    onFilterChange: fn(),
  },
} satisfies Meta<typeof MobileOptionsSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

// === STANDARD VARIANTS ===

export const Default: Story = {
  args: {
    sortBy: "custom",
    filterBy: "all",
  },
};

export const ActiveSort: Story = {
  args: {
    sortBy: "name-asc",
    filterBy: "all",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Shows active indicator dot when sort differs from default (custom).",
      },
    },
  },
};

export const ActiveFilter: Story = {
  args: {
    sortBy: "custom",
    filterBy: "has-files",
  },
  parameters: {
    docs: {
      description: {
        story: "Shows active indicator dot when filter is not 'all'.",
      },
    },
  },
};

export const BothActive: Story = {
  args: {
    sortBy: "name-desc",
    filterBy: "synced",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Shows active indicator when either sort or filter is non-default.",
      },
    },
  },
};

export const SortOnly: Story = {
  args: {
    sortBy: "custom",
    filterBy: undefined,
    onFilterChange: undefined,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Filter section hidden when filterBy and onFilterChange are not provided.",
      },
    },
  },
};

export const Disabled: Story = {
  args: {
    sortBy: "custom",
    filterBy: "all",
    disabled: true,
  },
  parameters: {
    docs: {
      description: {
        story: "All controls disabled when no items exist.",
      },
    },
  },
};
