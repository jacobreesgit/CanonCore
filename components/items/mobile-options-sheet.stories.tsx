/**
 * Storybook stories for the MobileOptionsSheet component.
 * Demonstrates mobile bottom drawer for sort, multi-select filter, and view options.
 */

import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn } from "storybook/test";

import { MobileOptionsSheet } from "./mobile-options-sheet";
import type { ContentFilter } from "@/lib/types";

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
          "Mobile bottom drawer consolidating Sort, multi-select Filter, and View controls. Uses Vaul for native-feeling swipe gestures and spring animations.",
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
    filters: [] as ContentFilter[],
    disabled: false,
    defaultSort: "custom",
    onSortChange: fn(),
    toggleFilter: fn(),
    clearFilters: fn(),
  },
} satisfies Meta<typeof MobileOptionsSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

// === STANDARD VARIANTS ===

export const Default: Story = {
  args: {
    sortBy: "custom",
    filters: [] as ContentFilter[],
  },
};

export const ActiveSort: Story = {
  args: {
    sortBy: "name-asc",
    filters: [] as ContentFilter[],
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
    filters: ["has-files"] as ContentFilter[],
  },
  parameters: {
    docs: {
      description: {
        story:
          "Shows active indicator dot and 'Filter (1)' count when filters are active.",
      },
    },
  },
};

export const MultipleActiveFilters: Story = {
  args: {
    sortBy: "custom",
    filters: ["has-files", "synced"] as ContentFilter[],
  },
  parameters: {
    docs: {
      description: {
        story:
          "Multiple filters active across groups. Shows 'Filter (2)' count with clear all button.",
      },
    },
  },
};

export const BothActive: Story = {
  args: {
    sortBy: "name-desc",
    filters: ["synced"] as ContentFilter[],
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
    filters: undefined,
    toggleFilter: undefined,
    clearFilters: undefined,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Filter section hidden when filters and toggleFilter are not provided.",
      },
    },
  },
};

export const Disabled: Story = {
  args: {
    sortBy: "custom",
    filters: [] as ContentFilter[],
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
