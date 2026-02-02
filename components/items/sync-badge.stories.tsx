/**
 * Storybook stories for the SyncBadge and SyncIcon components.
 * Demonstrates visual feedback for different sync states.
 */

import type { Meta, StoryObj } from "@storybook/nextjs";

import { SyncBadge, SyncIcon } from "./sync-badge";

const meta = {
  title: "Items/Misc/SyncBadge",
  component: SyncBadge,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Badge showing sync status for items with visual feedback for synced, syncing, pending, and error states.",
      },
    },
  },
  argTypes: {
    syncStatus: {
      control: "select",
      options: ["SYNCED", "SYNCING", "PENDING", "ERROR"],
      description: "Current sync status of the item",
    },
    syncError: {
      control: "text",
      description: "Error message if sync failed",
    },
  },
  decorators: [
    (Story) => (
      <div className="flex items-center gap-4 p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SyncBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

// === STANDARD VARIANTS ===

export const Synced: Story = {
  args: {
    syncStatus: "SYNCED",
  },
  parameters: {
    docs: {
      description: {
        story: "Returns null for SYNCED status (no visual indicator needed).",
      },
    },
  },
};

export const Syncing: Story = {
  args: {
    syncStatus: "SYNCING",
  },
  parameters: {
    docs: {
      description: {
        story: "Shows spinning loader icon during active sync.",
      },
    },
  },
};

export const Pending: Story = {
  args: {
    syncStatus: "PENDING",
  },
  parameters: {
    docs: {
      description: {
        story: "Shows small dot with tooltip for items waiting to sync.",
      },
    },
  },
};

export const Error: Story = {
  args: {
    syncStatus: "ERROR",
    syncError: null,
  },
  parameters: {
    docs: {
      description: {
        story: "Shows warning triangle with default error message.",
      },
    },
  },
};

export const ErrorWithMessage: Story = {
  args: {
    syncStatus: "ERROR",
    syncError: "Network connection failed. Please check your internet.",
  },
  parameters: {
    docs: {
      description: {
        story: "Shows warning triangle with custom error message in tooltip.",
      },
    },
  },
};

// === ICON-ONLY VARIANT ===

export const SyncIconVariant: Story = {
  args: {
    syncStatus: "PENDING",
  },
  render: () => (
    <div className="flex items-center gap-8">
      <div className="flex flex-col items-center gap-2">
        <SyncIcon syncStatus="SYNCED" />
        <span className="text-muted-foreground text-xs">Synced</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <SyncIcon syncStatus="SYNCING" />
        <span className="text-muted-foreground text-xs">Syncing</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <SyncIcon syncStatus="PENDING" />
        <span className="text-muted-foreground text-xs">Pending</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <SyncIcon syncStatus="ERROR" />
        <span className="text-muted-foreground text-xs">Error</span>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "Icon-only version for compact display without tooltips.",
      },
    },
  },
};
