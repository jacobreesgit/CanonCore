/**
 * Stories for ItemContextMenu component.
 * Right-click context menu with glassmorphism styling and delete confirmation.
 */

import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn } from "storybook/test";
import { userEvent, within, expect } from "storybook/test";
import { ItemContextMenu } from "./item-context-menu";

const meta = {
  title: "Items/Menus/ItemContextMenu",
  component: ItemContextMenu,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Context menu for item actions. Right-click to open a glassmorphism menu with settings, pin/unpin, add child, open in Drive, and delete options. Delete shows a confirmation dialog.",
      },
    },
  },
  args: {
    itemName: "Inception",
    children: null,
    onSettings: fn(),
    onDelete: fn(async () => {}),
    onAddChild: fn(async (_name: string, _description?: string) => ({
      itemId: "new-item-id",
    })),
    onAddChildComplete: fn(async () => {}),
    onPin: fn(async () => {}),
  },
} satisfies Meta<typeof ItemContextMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

/** All menu options visible. Right-click the card to open. */
export const AllOptions: Story = {
  args: {
    itemName: "Inception",
    showAddChild: true,
    driveFileId: "1abc-drive-folder-id",
    isPinned: false,
    hasDriveConnection: true,
  },
  render: (args) => (
    <ItemContextMenu {...args}>
      <div className="text-muted-foreground flex h-48 w-64 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-sm">
        Right-click me
      </div>
    </ItemContextMenu>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const target = canvas.getByText("Right-click me");
    await userEvent.pointer({ keys: "[MouseRight]", target });
    const body = within(document.body);
    await expect(await body.findByText("Add Child Item")).toBeInTheDocument();
    await expect(await body.findByText("Settings")).toBeInTheDocument();
    await expect(await body.findByText("Pin to Sidebar")).toBeInTheDocument();
    await expect(await body.findByText("Open in Drive")).toBeInTheDocument();
    await expect(await body.findByText("Delete")).toBeInTheDocument();
  },
};

/** Pinned item shows "Unpin from Sidebar" instead of "Pin". */
export const PinnedItem: Story = {
  args: {
    itemName: "The Dark Knight",
    isPinned: true,
    onUnpin: fn(async () => {}),
    driveFileId: null,
  },
  render: (args) => (
    <ItemContextMenu {...args}>
      <div className="text-muted-foreground flex h-48 w-64 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-sm">
        Right-click me (pinned item)
      </div>
    </ItemContextMenu>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const target = canvas.getByText("Right-click me (pinned item)");
    await userEvent.pointer({ keys: "[MouseRight]", target });
    const body = within(document.body);
    await expect(
      await body.findByText("Unpin from Sidebar")
    ).toBeInTheDocument();
  },
};

/** Minimal options — settings and delete only. */
export const MinimalOptions: Story = {
  args: {
    itemName: "Interstellar",
    showAddChild: false,
    driveFileId: null,
    isPinned: false,
    onPin: undefined,
    onUnpin: undefined,
  },
  render: (args) => (
    <ItemContextMenu {...args}>
      <div className="text-muted-foreground flex h-48 w-64 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-sm">
        Right-click me (minimal)
      </div>
    </ItemContextMenu>
  ),
};
