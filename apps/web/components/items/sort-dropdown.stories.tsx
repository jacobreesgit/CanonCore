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

export const Disabled: Story = {
  args: {
    value: "custom",
    disabled: true,
  },
};
