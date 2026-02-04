/**
 * Storybook stories for the MobileUserSheet component.
 * Demonstrates user account bottom sheet with various states.
 */

import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn } from "storybook/test";
import { useState } from "react";

import { MobileUserSheet } from "./mobile-user-sheet";
import { Button } from "@/components/ui/button";
import type { GoogleDriveConnection } from "@/lib/types";

const meta = {
  title: "Mobile/MobileUserSheet",
  component: MobileUserSheet,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    viewport: { defaultViewport: "mobile1" },
    docs: {
      description: {
        component:
          "Mobile user account bottom sheet. Displays user info, Google Drive storage, and account actions.",
      },
    },
  },
  argTypes: {
    open: {
      control: "boolean",
      description: "Whether the sheet is open",
    },
    driveConnection: {
      control: false, // Contains BigInt
      description: "Google Drive connection data",
    },
  },
  args: {
    open: false,
    onOpenChange: fn(),
  },
} satisfies Meta<typeof MobileUserSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

const mockUser = {
  name: "John Doe",
  email: "john@example.com",
  username: "johndoe",
  avatar: "https://github.com/shadcn.png",
  isPublic: true,
  hasImage: true,
  hasHeroImage: false,
};

const mockDriveConnection: GoogleDriveConnection = {
  email: "john@gmail.com",
  rootFolderId: "root-123",
  isActive: true,
  needsReauth: false,
  lastSyncAt: new Date(),
  lastError: null,
  quotaBytesUsed: BigInt(5_000_000_000), // ~5 GB
  quotaBytesTotal: BigInt(15_000_000_000), // 15 GB
};

const mockDriveConnectionHighUsage: GoogleDriveConnection = {
  ...mockDriveConnection,
  quotaBytesUsed: BigInt(13_000_000_000), // ~13 GB (87% usage)
};

/**
 * Interactive wrapper that manages sheet state.
 */
function SheetWrapper(
  props: Omit<
    React.ComponentProps<typeof MobileUserSheet>,
    "open" | "onOpenChange"
  >
) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-background min-h-[400px] p-4">
      <Button onClick={() => setOpen(true)}>Open User Sheet</Button>
      <MobileUserSheet open={open} onOpenChange={setOpen} {...props} />
    </div>
  );
}

// === USER STATES ===

export const Default: Story = {
  render: (args) => <SheetWrapper {...args} />,
  args: {
    user: mockUser,
    driveConnection: null,
  },
  parameters: {
    docs: {
      description: {
        story: "Default user sheet without Google Drive connection.",
      },
    },
  },
};

export const WithDriveConnection: Story = {
  render: (args) => <SheetWrapper {...args} />,
  args: {
    user: mockUser,
    driveConnection: mockDriveConnection,
  },
  parameters: {
    docs: {
      description: {
        story: "User sheet showing Google Drive storage bar (~33% usage).",
      },
    },
  },
};

export const HighStorageUsage: Story = {
  render: (args) => <SheetWrapper {...args} />,
  args: {
    user: mockUser,
    driveConnection: mockDriveConnectionHighUsage,
  },
  parameters: {
    docs: {
      description: {
        story:
          "User sheet with high storage usage (~87%). Shows warning color on storage bar.",
      },
    },
  },
};

export const NoAvatar: Story = {
  render: (args) => <SheetWrapper {...args} />,
  args: {
    user: {
      ...mockUser,
      avatar: undefined,
      hasImage: false,
    },
    driveConnection: mockDriveConnection,
  },
  parameters: {
    docs: {
      description: {
        story: "User without avatar shows fallback with initials.",
      },
    },
  },
};

export const LongEmail: Story = {
  render: (args) => <SheetWrapper {...args} />,
  args: {
    user: {
      ...mockUser,
      email: "verylongemailaddress@example.organization.com",
    },
    driveConnection: mockDriveConnection,
  },
  parameters: {
    docs: {
      description: {
        story: "Handles long email addresses with truncation.",
      },
    },
  },
};

// === OPEN STATE (for visual testing) ===

export const OpenState: Story = {
  args: {
    open: true,
    user: mockUser,
    driveConnection: mockDriveConnection,
  },
  parameters: {
    docs: {
      description: {
        story: "Sheet in open state for visual testing.",
      },
    },
  },
};
