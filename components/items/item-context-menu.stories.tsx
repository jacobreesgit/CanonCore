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
          "Context menu for item actions. Right-click to open a glassmorphism menu with edit, pin/unpin, add child, open in Drive, and delete options. Delete shows a confirmation dialog.",
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

/** Default — right-click the card to open. */
export const Default: Story = {
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
  parameters: {
    // Radix portals set aria-hidden on #storybook-root when context menu opens,
    // which is correct accessibility behavior but triggers aria-hidden-focus
    a11y: { disable: true },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const target = canvas.getByText("Right-click me");
    await userEvent.pointer({ keys: "[MouseRight]", target });
    const body = within(document.body);
    await expect(await body.findByText("Add Child Item")).toBeInTheDocument();
    await expect(await body.findByText("Edit Item")).toBeInTheDocument();
    await expect(await body.findByText("Pin to Sidebar")).toBeInTheDocument();
    await expect(await body.findByText("Open in Drive")).toBeInTheDocument();
    await expect(await body.findByText("Delete")).toBeInTheDocument();
  },
};
