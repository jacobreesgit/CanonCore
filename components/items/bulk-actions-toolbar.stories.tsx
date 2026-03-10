/**
 * Storybook stories for the BulkActionsToolbar component.
 * Demonstrates floating toolbar states and animations.
 */

import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn } from "storybook/test";

import { BulkActionsToolbar } from "./bulk-actions-toolbar";

const meta = {
  title: "Items/Toolbar/BulkActionsToolbar",
  component: BulkActionsToolbar,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      story: { iframeHeight: "120px" },
      description: {
        component:
          "Floating toolbar for bulk actions on selected items. Fixed at bottom with glass morphism and smooth animations.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="relative min-h-[100px]">
        <Story />
      </div>
    ),
  ],
  argTypes: {
    selectionCount: {
      control: { type: "number", min: 0, max: 100 },
      description: "Number of selected items",
    },
    isAllSelected: {
      control: "boolean",
      description: "Whether all items are selected",
    },
    isDeleting: {
      control: "boolean",
      description: "Whether delete is in progress",
    },
  },
  args: {
    selectionCount: 3,
    isAllSelected: false,
    isDeleting: false,
    onSelectAll: fn(),
    onDeselectAll: fn(),
    onDelete: fn(),
  },
} satisfies Meta<typeof BulkActionsToolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

// === STANDARD VARIANTS ===

export const Default: Story = {
  args: {
    selectionCount: 42,
  },
};

export const AllSelected: Story = {
  args: {
    selectionCount: 10,
    isAllSelected: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Button text changes to 'Deselect All' when all items are selected.",
      },
    },
  },
};

export const Deleting: Story = {
  args: {
    selectionCount: 5,
    isDeleting: true,
  },
  parameters: {
    docs: {
      description: {
        story: "Shows loading spinner and disabled state during deletion.",
      },
    },
  },
};
