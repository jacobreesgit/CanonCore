/**
 * Stories for TreeItem component.
 * Compact tree item with visual hierarchy, progress display, and drag support.
 */
import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn } from "storybook/test";

import { TreeItem } from "./components/TreeItem/TreeItem";

const meta = {
  title: "Layout/TreeItem",
  component: TreeItem,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Tree item component with collapse toggle, drag handle, progress bar, and selection support.",
      },
    },
  },
  argTypes: {
    id: { control: "text" },
    value: { control: "text" },
    description: { control: "text" },
    depth: { control: { type: "number", min: 0, max: 5 } },
    indentationWidth: { control: { type: "number", min: 10, max: 50 } },
    collapsed: { control: "boolean" },
    showDragHandle: { control: "boolean" },
    progressPercentage: { control: { type: "number", min: 0, max: 100 } },
    watchedCount: { control: "number" },
    totalMediaCount: { control: "number" },
    totalItems: { control: "number" },
    isSelected: { control: "boolean" },
    syncStatus: {
      control: "select",
      options: ["SYNCED", "PENDING", "SYNCING", "ERROR"],
    },
  },
  args: {
    id: "item-1",
    value: "Sample Item",
    depth: 0,
    indentationWidth: 20,
    onClick: fn(),
    onCollapse: fn(),
    onSelectChange: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-[400px]">
        <ul className="space-y-1">
          <Story />
        </ul>
      </div>
    ),
  ],
} satisfies Meta<typeof TreeItem>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default tree item in view mode (no drag handle).
 */
export const Default: Story = {
  args: {
    showDragHandle: false,
    progressPercentage: 45,
    watchedCount: 3,
    totalMediaCount: 7,
    totalItems: 10,
  },
};

/**
 * Tree item in edit mode with drag handle and selection checkbox.
 */
export const EditMode: Story = {
  args: {
    showDragHandle: true,
    isSelected: false,
  },
};

/**
 * Selected item in edit mode.
 */
export const Selected: Story = {
  args: {
    showDragHandle: true,
    isSelected: true,
  },
};

/**
 * Collapsible item with children.
 */
export const WithChildren: Story = {
  args: {
    showDragHandle: false,
    collapsed: false,
    childCount: 5,
  },
};

/**
 * Collapsed item with children.
 */
export const Collapsed: Story = {
  args: {
    showDragHandle: false,
    collapsed: true,
    childCount: 5,
  },
};

/**
 * Nested items at various depths.
 */
export const NestedDepths: Story = {
  render: () => (
    <ul className="space-y-1">
      <TreeItem
        id="parent"
        value="Parent Item"
        depth={0}
        indentationWidth={20}
        showDragHandle={false}
        collapsed={false}
        onCollapse={fn()}
      />
      <TreeItem
        id="child-1"
        value="Child Item"
        depth={1}
        indentationWidth={20}
        showDragHandle={false}
        collapsed={false}
        onCollapse={fn()}
      />
      <TreeItem
        id="grandchild"
        value="Grandchild Item"
        depth={2}
        indentationWidth={20}
        showDragHandle={false}
      />
      <TreeItem
        id="child-2"
        value="Another Child"
        depth={1}
        indentationWidth={20}
        showDragHandle={false}
      />
    </ul>
  ),
  decorators: [
    (Story) => (
      <div className="w-[400px]">
        <Story />
      </div>
    ),
  ],
};

/**
 * Fully watched item (100% progress).
 */
export const FullyWatched: Story = {
  args: {
    showDragHandle: false,
    progressPercentage: 100,
    watchedCount: 5,
    totalMediaCount: 5,
    totalItems: 5,
  },
};

/**
 * Item with sync pending status.
 */
export const SyncPending: Story = {
  args: {
    showDragHandle: false,
    syncStatus: "PENDING",
  },
};

/**
 * Item with sync error status.
 */
export const SyncError: Story = {
  args: {
    showDragHandle: false,
    syncStatus: "ERROR",
  },
};

/**
 * Clone/overlay state during drag operation.
 */
export const DragClone: Story = {
  args: {
    clone: true,
    childCount: 3,
    showDragHandle: true,
  },
};
