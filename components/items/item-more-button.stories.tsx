/**
 * Stories for ItemMoreButton component.
 * Glassmorphism ellipsis dropdown with shared menu items.
 */

import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn } from "storybook/test";
import { userEvent, within, expect } from "storybook/test";
import { ItemMoreButton } from "./item-more-button";

const meta = {
  title: "Items/Menus/ItemMoreButton",
  component: ItemMoreButton,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Ellipsis dropdown button for item actions. Opens a glassmorphism menu with the same options as the context menu: settings, pin/unpin, add child, open in Drive, and delete.",
      },
    },
  },
  args: {
    itemName: "Inception",
    onSettings: fn(),
    onDelete: fn(async () => {}),
    onAddChild: fn(async (_name: string, _description?: string) => ({
      itemId: "new-item-id",
    })),
    onAddChildComplete: fn(async () => {}),
    onPin: fn(async () => {}),
  },
} satisfies Meta<typeof ItemMoreButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** All options available — click to open the dropdown. */
export const AllOptions: Story = {
  args: {
    itemName: "Inception",
    showAddChild: true,
    driveFileId: "1abc-drive-folder-id",
    isPinned: false,
    hasDriveConnection: true,
  },
  parameters: {
    // Radix portals set aria-hidden on #storybook-root when dropdown opens,
    // which is correct accessibility behavior but triggers aria-hidden-focus
    a11y: { disable: true },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "More options" });
    await userEvent.click(trigger);
    const body = within(document.body);
    await expect(await body.findByText("Add Child Item")).toBeInTheDocument();
    await expect(await body.findByText("Settings")).toBeInTheDocument();
    await expect(await body.findByText("Delete")).toBeInTheDocument();
  },
};

/** Pinned item shows unpin option. */
export const PinnedItem: Story = {
  args: {
    itemName: "The Dark Knight",
    isPinned: true,
    onUnpin: fn(async () => {}),
    driveFileId: null,
  },
  parameters: {
    // Radix portals set aria-hidden on #storybook-root when dropdown opens
    a11y: { disable: true },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "More options" });
    await userEvent.click(trigger);
    const body = within(document.body);
    await expect(
      await body.findByText("Unpin from Sidebar")
    ).toBeInTheDocument();
  },
};

/** Minimal — settings and delete only. */
export const Minimal: Story = {
  args: {
    itemName: "Interstellar",
    showAddChild: false,
    driveFileId: null,
    isPinned: false,
    onPin: undefined,
    onUnpin: undefined,
  },
};
