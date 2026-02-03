/**
 * Storybook stories for the SettingsDialog component.
 * One story per tab to demonstrate each settings section.
 */

import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs";
import { expect, fn, userEvent, within } from "storybook/test";

import { Button } from "@/components/ui/button";
import { SettingsDialog } from "./settings-dialog";

/**
 * Wrapper component that provides a trigger button for the dialog.
 */
function DialogWithTrigger(
  props: Omit<
    React.ComponentProps<typeof SettingsDialog>,
    "open" | "onOpenChange"
  > & {
    buttonLabel?: string;
  }
) {
  const [open, setOpen] = useState(false);
  const { buttonLabel = "Open Settings", ...dialogProps } = props;

  return (
    <>
      <Button onClick={() => setOpen(true)} data-testid="dialog-trigger">
        {buttonLabel}
      </Button>
      <SettingsDialog {...dialogProps} open={open} onOpenChange={setOpen} />
    </>
  );
}

const meta = {
  title: "Profile/SettingsDialog",
  component: DialogWithTrigger,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Comprehensive settings dialog with profile, account, connections, preferences, and activity tabs. Supports step-based navigation for password/email/username changes.",
      },
    },
  },
  argTypes: {
    defaultTab: {
      control: "select",
      options: ["profile", "account", "connections", "preferences", "activity"],
      description: "Default tab to show",
    },
    googleDriveConnection: {
      control: false, // Contains BigInt values that cannot be serialized
      description: "Google Drive connection data",
    },
    buttonLabel: {
      control: "text",
      description: "Label for the trigger button",
    },
  },
  args: {
    onProfileChange: fn(() => Promise.resolve()),
  },
} satisfies Meta<typeof DialogWithTrigger>;

export default meta;
type Story = StoryObj<typeof meta>;

const defaultUser = {
  name: "Film Fan",
  email: "filmfan@example.com",
  username: "filmfan",
  isPublic: true,
  hasImage: false,
  hasHeroImage: false,
};

// Base date for deterministic mock data (avoids snapshot flakiness)
const baseDate = new Date("2024-01-15T10:00:00Z");

const connectedDrive = {
  email: "user@gmail.com",
  rootFolderId: "1abc123xyz",
  isActive: true,
  needsReauth: false,
  lastSyncAt: new Date(baseDate.getTime() - 5 * 60 * 1000),
  lastError: null,
  quotaBytesUsed: BigInt(5_000_000_000),
  quotaBytesTotal: BigInt(15_000_000_000),
};

/**
 * Profile tab - manage display name, avatar, cover image, and public profile toggle.
 */
export const ProfileTab: Story = {
  args: {
    user: defaultUser,
    googleDriveConnection: null,
    defaultTab: "profile",
    buttonLabel: "Profile Settings",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByTestId("dialog-trigger");
    await userEvent.click(trigger);
    // Dialog renders in portal, search in document.body
    const body = within(document.body);
    await body.findByRole("tab", { name: /profile/i });
  },
};

/**
 * Account tab - manage username, email, and password.
 */
export const AccountTab: Story = {
  args: {
    user: defaultUser,
    googleDriveConnection: null,
    defaultTab: "account",
    buttonLabel: "Account Settings",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByTestId("dialog-trigger");
    await userEvent.click(trigger);
    const body = within(document.body);
    await body.findByRole("tab", { name: /account/i });
  },
};

/**
 * Connections tab - manage Google Drive integration.
 */
export const ConnectionsTab: Story = {
  args: {
    user: defaultUser,
    googleDriveConnection: connectedDrive,
    defaultTab: "connections",
    buttonLabel: "Connections Settings",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByTestId("dialog-trigger");
    await userEvent.click(trigger);
    const body = within(document.body);
    await body.findByRole("tab", { name: /connections/i });
  },
};

/**
 * Preferences tab - manage default view mode and sort order.
 */
export const PreferencesTab: Story = {
  args: {
    user: defaultUser,
    googleDriveConnection: null,
    defaultTab: "preferences",
    buttonLabel: "Preferences Settings",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByTestId("dialog-trigger");
    await userEvent.click(trigger);
    const body = within(document.body);
    await body.findByRole("tab", { name: /preferences/i });
  },
};

/**
 * Activity tab - view sync history (requires Google Drive connection).
 */
export const ActivityTab: Story = {
  args: {
    user: defaultUser,
    googleDriveConnection: connectedDrive,
    defaultTab: "activity",
    buttonLabel: "Activity Settings",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByTestId("dialog-trigger");
    await userEvent.click(trigger);
    const body = within(document.body);
    await body.findByRole("tab", { name: /activity/i });
  },
};

// === INTERACTION TESTS ===

/**
 * Tab navigation interaction.
 * Tests clicking through all tabs.
 */
export const TabNavigation: Story = {
  args: {
    user: defaultUser,
    googleDriveConnection: connectedDrive,
    defaultTab: "profile",
    buttonLabel: "Test Tab Navigation",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Open dialog
    const trigger = canvas.getByTestId("dialog-trigger");
    await userEvent.click(trigger);

    // Dialog renders in portal, search in document.body
    const body = within(document.body);

    // Wait for dialog to appear
    const profileTab = await body.findByRole("tab", { name: /profile/i });
    await expect(profileTab).toHaveAttribute("aria-selected", "true");

    // Click Account tab
    const accountTab = body.getByRole("tab", { name: /account/i });
    await userEvent.click(accountTab);
    await expect(accountTab).toHaveAttribute("aria-selected", "true");

    // Click Connections tab
    const connectionsTab = body.getByRole("tab", { name: /connections/i });
    await userEvent.click(connectionsTab);
    await expect(connectionsTab).toHaveAttribute("aria-selected", "true");

    // Click Preferences tab
    const preferencesTab = body.getByRole("tab", { name: /preferences/i });
    await userEvent.click(preferencesTab);
    await expect(preferencesTab).toHaveAttribute("aria-selected", "true");

    // Click Activity tab
    const activityTab = body.getByRole("tab", { name: /activity/i });
    await userEvent.click(activityTab);
    await expect(activityTab).toHaveAttribute("aria-selected", "true");
  },
  parameters: {
    docs: {
      description: {
        story:
          "Demonstrates keyboard/mouse navigation through all settings tabs.",
      },
    },
  },
};

/**
 * Profile form interaction.
 * Tests editing profile fields.
 */
export const ProfileFormInteraction: Story = {
  args: {
    user: defaultUser,
    googleDriveConnection: null,
    defaultTab: "profile",
    buttonLabel: "Test Profile Form",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Open dialog
    const trigger = canvas.getByTestId("dialog-trigger");
    await userEvent.click(trigger);

    // Dialog renders in portal, search in document.body
    const body = within(document.body);

    // Wait for profile tab content
    const nameInput = await body.findByLabelText(/display name/i);
    await expect(nameInput).toBeInTheDocument();
    await expect(nameInput).toHaveValue("Film Fan");

    // Clear and type new name
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Movie Enthusiast");
    await expect(nameInput).toHaveValue("Movie Enthusiast");
  },
  parameters: {
    docs: {
      description: {
        story: "Tests editing the display name field in the Profile tab.",
      },
    },
  },
};

/**
 * Keyboard tab navigation.
 * Tests navigating tabs with arrow keys.
 */
export const KeyboardTabNavigation: Story = {
  args: {
    user: defaultUser,
    googleDriveConnection: connectedDrive,
    defaultTab: "profile",
    buttonLabel: "Test Keyboard Nav",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Open dialog
    const trigger = canvas.getByTestId("dialog-trigger");
    await userEvent.click(trigger);

    // Dialog renders in portal, search in document.body
    const body = within(document.body);

    // Wait for dialog and focus first tab
    const profileTab = await body.findByRole("tab", { name: /profile/i });
    await userEvent.click(profileTab);
    await expect(profileTab).toHaveFocus();

    // Navigate with arrow keys
    await userEvent.keyboard("{ArrowRight}");
    const accountTab = body.getByRole("tab", { name: /account/i });
    await expect(accountTab).toHaveFocus();

    await userEvent.keyboard("{ArrowRight}");
    const connectionsTab = body.getByRole("tab", { name: /connections/i });
    await expect(connectionsTab).toHaveFocus();
  },
  parameters: {
    docs: {
      description: {
        story: "Arrow keys navigate between tabs for accessibility compliance.",
      },
    },
  },
};
