/**
 * Storybook stories for the GoogleDriveSettingsSection component.
 * Demonstrates connection states, sync status, and error handling.
 */

import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn } from "storybook/test";

import { GoogleDriveSettingsSection } from "./settings-section";

const meta = {
  title: "Google Drive/Connection",
  component: GoogleDriveSettingsSection,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Google Drive settings panel for connecting, syncing, and managing Drive integration. Shows connection status, storage quota, and sync actions.",
      },
    },
  },
  argTypes: {
    connection: {
      control: false, // Contains BigInt values that cannot be serialized
      description: "Current Google Drive connection, or null if disconnected",
    },
  },
  args: {
    onConnectionChange: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-[400px] rounded-lg border p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof GoogleDriveSettingsSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Disconnected: Story = {
  args: {
    connection: null,
  },
  parameters: {
    docs: {
      description: {
        story: "Initial state when no Google Drive connection exists.",
      },
    },
  },
};

export const StorageWarning: Story = {
  args: {
    connection: {
      email: "user@example.com",
      rootFolderId: "1abc123xyz",
      isActive: true,
      needsReauth: false,
      lastSyncAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
      lastError: null,
      quotaBytesUsed: BigInt(12_500_000_000), // 12.5 GB (83%)
      quotaBytesTotal: BigInt(15_000_000_000), // 15 GB
    },
  },
  parameters: {
    docs: {
      description: {
        story: "Storage bar shows warning colour when usage exceeds 80%.",
      },
    },
  },
};

export const StorageCritical: Story = {
  args: {
    connection: {
      email: "user@example.com",
      rootFolderId: "1abc123xyz",
      isActive: true,
      needsReauth: false,
      lastSyncAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      lastError: null,
      quotaBytesUsed: BigInt(14_500_000_000), // 14.5 GB (97%)
      quotaBytesTotal: BigInt(15_000_000_000), // 15 GB
    },
  },
  parameters: {
    docs: {
      description: {
        story: "Storage bar shows critical colour when usage exceeds 95%.",
      },
    },
  },
};

export const NeedsReauth: Story = {
  args: {
    connection: {
      email: "user@example.com",
      rootFolderId: "1abc123xyz",
      isActive: true,
      needsReauth: true,
      lastSyncAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 1 week ago
      lastError: null,
      quotaBytesUsed: BigInt(5_000_000_000),
      quotaBytesTotal: BigInt(15_000_000_000),
    },
  },
  parameters: {
    docs: {
      description: {
        story: "Shows reconnect badge and button when OAuth token has expired.",
      },
    },
  },
};

export const FolderTrashed: Story = {
  args: {
    connection: {
      email: "user@example.com",
      rootFolderId: "1abc123xyz",
      isActive: true,
      needsReauth: false,
      lastSyncAt: new Date(Date.now() - 60 * 60 * 1000),
      lastError: "ROOT_FOLDER_TRASHED",
      quotaBytesUsed: BigInt(5_000_000_000),
      quotaBytesTotal: BigInt(15_000_000_000),
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          "Warning banner when CanonCore folder is in Google Drive Trash. User can restore and retry sync.",
      },
    },
  },
};

export const FolderDeleted: Story = {
  args: {
    connection: {
      email: "user@example.com",
      rootFolderId: "1abc123xyz",
      isActive: true,
      needsReauth: false,
      lastSyncAt: new Date(Date.now() - 60 * 60 * 1000),
      lastError: "ROOT_FOLDER_DELETED",
      quotaBytesUsed: BigInt(5_000_000_000),
      quotaBytesTotal: BigInt(15_000_000_000),
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          "Error banner when CanonCore folder was permanently deleted. User must disconnect and reconnect.",
      },
    },
  },
};

export const GenericError: Story = {
  args: {
    connection: {
      email: "user@example.com",
      rootFolderId: "1abc123xyz",
      isActive: true,
      needsReauth: false,
      lastSyncAt: new Date(Date.now() - 60 * 60 * 1000),
      lastError: "Network error: Failed to reach Google Drive API",
      quotaBytesUsed: BigInt(5_000_000_000),
      quotaBytesTotal: BigInt(15_000_000_000),
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          "Generic error message displayed inline for non-folder-specific errors.",
      },
    },
  },
};

export const NoStorageData: Story = {
  args: {
    connection: {
      email: "user@example.com",
      rootFolderId: "1abc123xyz",
      isActive: true,
      needsReauth: false,
      lastSyncAt: null,
      lastError: null,
      quotaBytesUsed: null,
      quotaBytesTotal: null,
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          "Storage bar handles null quota values gracefully (fresh connection).",
      },
    },
  },
};

export const NeverSynced: Story = {
  args: {
    connection: {
      email: "user@example.com",
      rootFolderId: "1abc123xyz",
      isActive: true,
      needsReauth: false,
      lastSyncAt: null,
      lastError: null,
      quotaBytesUsed: BigInt(5_000_000_000),
      quotaBytesTotal: BigInt(15_000_000_000),
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'No "last synced" text when connection has never synced.',
      },
    },
  },
};
