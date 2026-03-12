/**
 * Stories for DetailSettingsMenu component.
 * Settings gear button for item detail hero with dropdown menu and delete confirmation.
 */

import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn } from "storybook/test";
import { DetailSettingsMenu } from "./detail-settings-menu";

const meta = {
  title: "Items/Menus/DetailSettingsMenu",
  component: DetailSettingsMenu,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    // Radix portals set aria-hidden on #storybook-root when dropdown opens,
    // which is correct accessibility behavior but triggers aria-hidden-focus
    a11y: { disable: true },
    docs: {
      description: {
        component:
          "Settings gear button for item detail hero pages. Opens a DropdownMenu on desktop with the full item action menu: edit item, pin/unpin, add child, open in Drive, add to playlist, and delete with confirmation.",
      },
    },
  },
  args: {
    itemName: "The Dark Knight",
    itemId: "item-1",
    onSettings: fn(),
    onDelete: fn(async () => {}),
    onAddChild: fn(async (_name: string, _description?: string) => ({
      itemId: "new-item-id",
    })),
    onAddChildComplete: fn(async () => {}),
    showAddChild: true,
    showAddToPlaylist: true,
    hasDriveConnection: false,
  },
} satisfies Meta<typeof DetailSettingsMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default — settings gear with add child and playlist options. */
export const Default: Story = {};

/** With Drive — shows "Open in Drive" link. */
export const WithDrive: Story = {
  args: {
    driveFileId: "drive-123",
    hasDriveConnection: true,
  },
};

/** Minimal — settings and delete only, no add child or playlist. */
export const Minimal: Story = {
  args: {
    showAddChild: false,
    showAddToPlaylist: false,
    onAddChild: undefined,
  },
};
