/**
 * Storybook stories for the SortDropdown component.
 * Demonstrates sort options for item ordering.
 */
import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn } from "storybook/test";
import { SortDropdown } from "./sort-dropdown";

const meta = {
  title: "Items/Controls/SortDropdown",
  component: SortDropdown,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Dropdown for selecting sort order for items. Shows the current selection in the trigger button.",
      },
    },
  },
  argTypes: {
    value: {
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
    disabled: { control: "boolean" },
  },
  args: {
    onChange: fn(),
  },
} satisfies Meta<typeof SortDropdown>;

export default meta;
type Story = StoryObj<typeof meta>;

// === STANDARD VARIANTS ===

export const Default: Story = {
  args: {
    value: "custom",
    disabled: false,
  },
};

export const SortByNameAsc: Story = {
  args: {
    value: "name-asc",
    disabled: false,
  },
  parameters: {
    docs: {
      description: {
        story: "Alphabetical ordering A-Z.",
      },
    },
  },
};

export const SortByNameDesc: Story = {
  args: {
    value: "name-desc",
    disabled: false,
  },
  parameters: {
    docs: {
      description: {
        story: "Reverse alphabetical ordering Z-A.",
      },
    },
  },
};

export const SortByNewest: Story = {
  args: {
    value: "created-desc",
    disabled: false,
  },
  parameters: {
    docs: {
      description: {
        story: "Most recently created items first.",
      },
    },
  },
};

export const SortByOldest: Story = {
  args: {
    value: "created-asc",
    disabled: false,
  },
  parameters: {
    docs: {
      description: {
        story: "Oldest items first.",
      },
    },
  },
};

export const SortByRecentlyUpdated: Story = {
  args: {
    value: "updated-desc",
    disabled: false,
  },
  parameters: {
    docs: {
      description: {
        story: "Most recently updated items first.",
      },
    },
  },
};

export const Disabled: Story = {
  args: {
    value: "custom",
    disabled: true,
  },
};
